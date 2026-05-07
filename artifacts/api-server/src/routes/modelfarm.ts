import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth } from "../lib/auth.js";

type AuthMode = "bearer" | "x-api-key" | "x-goog-api-key";

interface UpstreamConfig {
  baseUrlEnv: string;
  apiKeyEnv: string;
  authMode: AuthMode;
  // Lower-cased client header names that should be forwarded verbatim to
  // the real upstream (in addition to the always-forwarded set below).
  forwardHeaders: readonly string[];
}

const UPSTREAM: Record<string, UpstreamConfig> = {
  openai: {
    baseUrlEnv: "AI_INTEGRATIONS_OPENAI_BASE_URL",
    apiKeyEnv: "AI_INTEGRATIONS_OPENAI_API_KEY",
    authMode: "bearer",
    forwardHeaders: ["openai-beta", "openai-organization", "openai-project"],
  },
  anthropic: {
    baseUrlEnv: "AI_INTEGRATIONS_ANTHROPIC_BASE_URL",
    apiKeyEnv: "AI_INTEGRATIONS_ANTHROPIC_API_KEY",
    authMode: "x-api-key",
    forwardHeaders: ["anthropic-beta", "anthropic-version"],
  },
  google: {
    baseUrlEnv: "AI_INTEGRATIONS_GEMINI_BASE_URL",
    apiKeyEnv: "AI_INTEGRATIONS_GEMINI_API_KEY",
    authMode: "x-goog-api-key",
    forwardHeaders: ["x-goog-api-client"],
  },
  openrouter: {
    baseUrlEnv: "AI_INTEGRATIONS_OPENROUTER_BASE_URL",
    apiKeyEnv: "AI_INTEGRATIONS_OPENROUTER_API_KEY",
    authMode: "bearer",
    forwardHeaders: [
      "openai-beta",
      "openai-organization",
      "openai-project",
      "http-referer",
      "x-title",
    ],
  },
};

// Headers that must NEVER be passed through to upstream — these are either
// authentication for our proxy (replaced with the real upstream key below),
// or hop-by-hop / framing headers that fetch/undici will recompute.
const STRIP_HEADERS = new Set([
  "host",
  "content-length",
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "proxy-connection",
  "proxy-authorization",
  "te",
  "trailer",
  "expect",
  "authorization",
  "x-api-key",
  "x-goog-api-key",
  "cookie",
  // Let undici negotiate compression with the upstream itself; it
  // auto-decodes the response body, so forwarding the client's
  // accept-encoding would mismatch the bytes we actually re-emit.
  "accept-encoding",
]);

export const SEGMENTS = Object.keys(UPSTREAM);

export interface SegmentStatus {
  segment: string;
  configured: boolean;
  baseUrlEnv: string;
  apiKeyEnv: string;
}

export function listSegmentStatus(): SegmentStatus[] {
  return SEGMENTS.map((segment) => {
    const cfg = UPSTREAM[segment]!;
    return {
      segment,
      configured: !!process.env[cfg.baseUrlEnv] && !!process.env[cfg.apiKeyEnv],
      baseUrlEnv: cfg.baseUrlEnv,
      apiKeyEnv: cfg.apiKeyEnv,
    };
  });
}

const router: IRouter = Router();

router.use(requireAuth);

router.use(async (req: Request, res: Response) => {
  const match = req.path.match(/^\/([^/]+)(\/.*)?$/);
  if (!match) {
    res.status(404).json({ error: { message: "Not found", type: "not_found" } });
    return;
  }
  const segment = match[1]!;
  const rest = match[2] ?? "/";
  const cfg = UPSTREAM[segment];
  if (!cfg) {
    res.status(404).json({
      error: {
        message: `Unknown upstream segment "${segment}". Expected one of: ${SEGMENTS.join(", ")}.`,
        type: "not_found",
      },
    });
    return;
  }

  const baseUrl = process.env[cfg.baseUrlEnv];
  const apiKey = process.env[cfg.apiKeyEnv];
  if (!baseUrl || !apiKey) {
    res.status(503).json({
      error: {
        message: `Upstream "${segment}" is not configured. Set ${cfg.baseUrlEnv} and ${cfg.apiKeyEnv}.`,
        type: "upstream_not_configured",
      },
    });
    return;
  }

  const qIdx = req.originalUrl.indexOf("?");
  const qs = qIdx >= 0 ? req.originalUrl.slice(qIdx) : "";
  const targetUrl = `${baseUrl.replace(/\/+$/, "")}${rest}${qs}`;

  const headers: Record<string, string> = {};

  // Pass through every client header except the strip-list and segment
  // auth headers. This is the "don't drop unknown headers" principle:
  // upstream-specific betas (anthropic-beta, openai-beta), telemetry
  // (x-goog-api-client), routing hints (openai-organization,
  // openai-project), etc. all flow through unchanged. cfg.forwardHeaders
  // documents the per-upstream headers we explicitly know about.
  void cfg.forwardHeaders;
  for (const [name, raw] of Object.entries(req.headers)) {
    if (raw === undefined) continue;
    const lower = name.toLowerCase();
    if (STRIP_HEADERS.has(lower)) continue;
    // Drop framing / proxy-internal headers we never want to forward.
    if (lower.startsWith("x-replit-") || lower.startsWith("x-forwarded-")) {
      continue;
    }
    // Skip Accept: */* — undici hangs in this Replit container when
    // given a wildcard Accept against the local model-farm proxy.
    if (lower === "accept") {
      const v = Array.isArray(raw) ? raw[0] : raw;
      if (typeof v === "string" && v !== "*/*") headers["Accept"] = v;
      continue;
    }
    const value = Array.isArray(raw) ? raw.join(", ") : raw;
    if (typeof value === "string") headers[name] = value;
  }

  // Inject our real upstream credentials, replacing whatever the client
  // sent for proxy auth.
  switch (cfg.authMode) {
    case "bearer":
      headers["Authorization"] = `Bearer ${apiKey}`;
      break;
    case "x-api-key": {
      headers["x-api-key"] = apiKey;
      // Anthropic requires anthropic-version; default if client omitted.
      const hasVersion = Object.keys(headers).some(
        (h) => h.toLowerCase() === "anthropic-version",
      );
      if (!hasVersion) headers["anthropic-version"] = "2023-06-01";
      break;
    }
    case "x-goog-api-key":
      headers["x-goog-api-key"] = apiKey;
      break;
  }

  res.setTimeout(600_000);
  req.socket.setTimeout(600_000);

  // Undici's fetch hangs in this Replit container when given a binary
  // body sourced from express.raw's pooled Buffer (regardless of whether
  // it's wrapped as Uint8Array or fresh ArrayBuffer). Passing the body as
  // a string works reliably. All upstream model APIs are JSON, so this is
  // safe.
  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    if (Buffer.isBuffer(req.body)) {
      body = req.body.toString("utf-8");
    } else if (typeof req.body === "string") {
      body = req.body;
    }
  }
  // Note: do NOT set Content-Length manually — undici/fetch sets it from
  // the body and an explicit one causes the request to hang indefinitely
  // on this Replit container.

  req.log.info(
    {
      segment,
      targetUrl,
      method: req.method,
      bodyLen: body?.length ?? 0,
      hdrs: Object.keys(headers),
    },
    "modelfarm proxy -> upstream",
  );

  // NOTE: Do NOT pass an AbortSignal sourced from a long-lived
  // AbortController to fetch on this Replit container — it causes the
  // outbound request to hang for ~20s before any TCP connection is even
  // attempted. Cancellation during streaming is handled below by
  // cancelling the body reader when the client closes.
  let upstream: globalThis.Response;
  try {
    upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });
  } catch (err) {
    req.log.error({ err, segment, targetUrl }, "Upstream fetch failed");
    if (!res.headersSent) {
      res.status(502).json({
        error: {
          message: err instanceof Error ? err.message : "Upstream fetch failed",
          type: "upstream_error",
        },
      });
    }
    return;
  }

  res.status(upstream.status);

  // Forward all upstream response headers verbatim so callers see real
  // error bodies, rate-limit hints, request IDs, etc. Strip the full
  // RFC 7230 hop-by-hop set plus framing headers that would mismatch
  // the bytes we actually emit (fetch has already decompressed and
  // de-chunked the body).
  const RES_STRIP = new Set([
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "content-length",
    "content-encoding",
  ]);
  // Per RFC 7230, the upstream Connection header may name additional
  // connection-scoped headers that must also be stripped.
  const upConn = upstream.headers.get("connection");
  if (upConn) {
    for (const tok of upConn.split(",")) {
      const t = tok.trim().toLowerCase();
      if (t) RES_STRIP.add(t);
    }
  }
  upstream.headers.forEach((value, key) => {
    if (RES_STRIP.has(key.toLowerCase())) return;
    res.setHeader(key, value);
  });

  const isSSE = (upstream.headers.get("content-type") ?? "").includes(
    "text/event-stream",
  );
  if (isSSE) {
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    // Disable Nagle so each SSE chunk flushes immediately.
    req.socket.setNoDelay(true);
  }

  if (!upstream.body) {
    res.end();
    return;
  }

  const reader = upstream.body.getReader();
  let clientAborted = false;
  const onClientClose = () => {
    if (!res.writableEnded) {
      clientAborted = true;
      reader.cancel().catch(() => {});
    }
  };
  res.on("close", onClientClose);

  res.flushHeaders?.();
  try {
    while (true) {
      if (clientAborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      if (value && !res.write(Buffer.from(value))) {
        await new Promise<void>((resolve) => {
          const cleanup = () => {
            res.off("drain", cleanup);
            res.off("close", cleanup);
            res.off("error", cleanup);
            resolve();
          };
          res.once("drain", cleanup);
          res.once("close", cleanup);
          res.once("error", cleanup);
        });
      }
    }
  } catch (err) {
    if (!clientAborted) {
      req.log.error({ err, segment }, "Upstream stream error");
    }
  } finally {
    res.off("close", onClientClose);
    try {
      await reader.cancel();
    } catch {
      // ignore
    }
    if (!res.writableEnded) res.end();
  }
});

export default router;
