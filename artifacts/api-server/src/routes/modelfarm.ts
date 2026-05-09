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

// Fixed x-replit-* identity headers injected into every outgoing request so
// the upstream sees the call as originating from inside replit.app. Values are
// read once at startup from Replit's standard environment variables; any header
// already set by the client takes precedence (client value wins).
const REPLIT_IDENTITY_HEADERS: Record<string, string> = Object.fromEntries(
  (
    [
      ["x-replit-repl-id",   process.env.REPL_ID        ?? ""],
      ["x-replit-user-name", process.env.REPL_OWNER     ?? ""],
      ["x-replit-cluster",   process.env.REPLIT_CLUSTER ?? ""],
      ["x-forwarded-host",   process.env.REPLIT_DOMAINS
                               ? process.env.REPLIT_DOMAINS.split(",")[0].trim()
                               : "replit.app"],
    ] as [string, string][]
  ).filter(([, v]) => v !== ""),
);

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

// ---------------------------------------------------------------------------
// Upstream permanent-failure detection
// ---------------------------------------------------------------------------

type DisableReason =
  | "api-key-not-approved"
  | "invalid-api-key"
  | "quota-exhausted"
  | "billing-disabled"
  | "account-not-approved";

function detectOpenAiDisableReason(
  status: number,
  body: string,
): DisableReason | null {
  if (status === 401 && /ApiKey not approved/i.test(body)) {
    return "api-key-not-approved";
  }
  if (status === 401 && /invalid.*api.*key|incorrect.*api.*key/i.test(body)) {
    return "invalid-api-key";
  }
  if (status === 429 && /quota|insufficient_quota|billing/i.test(body)) {
    return "quota-exhausted";
  }
  if (status === 403 && /billing|not approved|account/i.test(body)) {
    return "billing-disabled";
  }
  return null;
}

function detectAnthropicDisableReason(
  status: number,
  body: string,
): DisableReason | null {
  if (status === 401 && /invalid.*api.*key|authentication/i.test(body)) {
    return "invalid-api-key";
  }
  if (status === 403 && /billing|credit|not approved|account/i.test(body)) {
    return "billing-disabled";
  }
  if (
    status === 429 &&
    /quota|credit|billing|rate limit exceeded your current quota/i.test(body)
  ) {
    return "quota-exhausted";
  }
  return null;
}

function detectGoogleDisableReason(
  status: number,
  body: string,
): DisableReason | null {
  if (status === 401 && /api key not valid|invalid.*api.*key/i.test(body)) {
    return "invalid-api-key";
  }
  if (
    status === 403 &&
    /billing|permission denied|not enabled|api key not valid/i.test(body)
  ) {
    return "billing-disabled";
  }
  if (status === 429 && /quota|resource exhausted/i.test(body)) {
    return "quota-exhausted";
  }
  return null;
}

function detectOpenRouterDisableReason(
  status: number,
  body: string,
): DisableReason | null {
  if (status === 401 && /invalid.*key|unauthorized/i.test(body)) {
    return "invalid-api-key";
  }
  if (status === 402 && /credit|payment|balance/i.test(body)) {
    return "quota-exhausted";
  }
  if (status === 403 && /account|disabled|not approved|billing/i.test(body)) {
    return "billing-disabled";
  }
  if (status === 429 && /quota|credit|rate limit/i.test(body)) {
    return "quota-exhausted";
  }
  return null;
}

function detectDisableReason(
  segment: string,
  status: number,
  body: string,
): DisableReason | null {
  switch (segment) {
    case "openai":
      return detectOpenAiDisableReason(status, body);
    case "anthropic":
      return detectAnthropicDisableReason(status, body);
    case "google":
      return detectGoogleDisableReason(status, body);
    case "openrouter":
      return detectOpenRouterDisableReason(status, body);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------

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
        输入: "not_found",
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
        输入: "upstream_not_configured",
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

  // Inject Replit identity headers (client value takes precedence).
  for (const [name, value] of Object.entries(REPLIT_IDENTITY_HEADERS)) {
    const alreadySet = Object.keys(headers).some(
      (h) => h.toLowerCase() === name,
    );
    if (!alreadySet) headers[name] = value;
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

  // ---------------------------------------------------------------------------
  // Keep-alive heartbeat to survive Replit's deployment proxy 300 s idle timeout.
  //
  // For non-streaming (JSON) requests the server waits silently for the upstream
  // AI model to finish thinking. If that takes > 300 s the Replit reverse-proxy
  // cuts the connection before we can send the response.
  //
  // Strategy: after a 10 s grace period (fast 4xx/5xx errors always return in
  // < a second, so they still get the real HTTP status code), begin writing a
  // newline character every 15 s. Each write resets the proxy's idle timer.
  // Leading whitespace is harmless — JSON.parse(), all AI SDKs, and fetch()
  // callers that read .text() all tolerate it.
  //
  // Once fetch() returns we clear both timers so normal response handling takes
  // over. If the heartbeat had already fired we cannot change the HTTP status,
  // but in practice the upstream will have started returning data long before
  // 10 s elapses for any successful inference request.
  // ---------------------------------------------------------------------------
  const clientWantsSSE =
    (req.headers["accept"] ?? "").includes("text/event-stream");

  let keepAliveCommitted = false;
  let keepAliveGraceTimer: ReturnType<typeof setTimeout> | null = null;
  let keepAlivePingInterval: ReturnType<typeof setInterval> | null = null;

  const stopKeepAlive = () => {
    if (keepAliveGraceTimer !== null) {
      clearTimeout(keepAliveGraceTimer);
      keepAliveGraceTimer = null;
    }
    if (keepAlivePingInterval !== null) {
      clearInterval(keepAlivePingInterval);
      keepAlivePingInterval = null;
    }
  };

  if (!clientWantsSSE) {
    keepAliveGraceTimer = setTimeout(() => {
      keepAliveGraceTimer = null;
      keepAliveCommitted = true;
      req.log.info({ segment }, "keep-alive: grace period elapsed, sending heartbeat pings");
      if (!res.headersSent) {
        res.flushHeaders?.();
      }
      if (!res.writableEnded) {
        res.write("\n");
      }
      keepAlivePingInterval = setInterval(() => {
        if (res.writableEnded) {
          stopKeepAlive();
          return;
        }
        res.write("\n");
      }, 15_000);
    }, 10_000);
  }

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
    stopKeepAlive();
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

  stopKeepAlive();

  // Check for permanent upstream failures before streaming the response.
  if (!upstream.ok) {
    const text = await upstream.text();
    const reason = detectDisableReason(segment, upstream.status, text);

    if (reason) {
      req.log.warn(
        { segment, upstreamStatus: upstream.status, reason },
        "upstream_node_unavailable — permanent failure detected",
      );
      if (!res.headersSent) {
        res.status(502).json({
          error: {
            type: "upstream_node_unavailable",
            provider: segment,
            upstreamStatus: upstream.status,
            reason,
            retryable: false,
            disabledCandidate: true,
            message: "Upstream provider credential or quota is unavailable",
          },
        });
      } else {
        // Keep-alive already committed headers; send error as plain body.
        req.log.warn({ segment, upstreamStatus: upstream.status, reason },
          "keep-alive committed headers; error body sent without status change");
        res.end(text);
      }
      return;
    }

    // Not a recognised permanent failure — forward the original error
    // response verbatim so the caller gets real upstream error details.
    if (!res.headersSent) {
      res
        .status(upstream.status)
        .type(upstream.headers.get("content-type") ?? "text/plain")
        .send(text);
    } else {
      req.log.warn({ segment, upstreamStatus: upstream.status },
        "keep-alive committed headers; forwarding error body without status change");
      res.end(text);
    }
    return;
  }

  // Only set status / headers when keep-alive has not yet flushed them.
  if (!res.headersSent) {
    res.status(upstream.status);
  }

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
  if (!res.headersSent) {
    upstream.headers.forEach((value, key) => {
      if (RES_STRIP.has(key.toLowerCase())) return;
      res.setHeader(key, value);
    });
  }

  const isSSE = (upstream.headers.get("content-type") ?? "").includes(
    "text/event-stream",
  );
  if (isSSE && !res.headersSent) {
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    // Tell nginx/Replit's reverse proxy NOT to buffer this response so each
    // SSE chunk is forwarded to the client immediately without batching.
    // Without this header, nginx buffers the SSE stream and the 300 s proxy
    // read-timeout fires even though the upstream is still sending data.
    res.setHeader("X-Accel-Buffering", "no");
    // Disable Nagle so each SSE chunk flushes immediately.
    req.socket.setNoDelay(true);
  } else if (isSSE) {
    res.setHeader("X-Accel-Buffering", "no");
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

  // For SSE streams: inject an SSE comment (": keep-alive\n\n") every 15 s
  // while waiting between upstream chunks. SSE comments are ignored by all
  // EventSource / SDK clients but each write resets the Replit proxy's idle
  // read-timeout, preventing the 300 s cut-off during slow model generation.
  let sseKeepaliveTimer: ReturnType<typeof setInterval> | null = null;
  if (isSSE) {
    sseKeepaliveTimer = setInterval(() => {
      if (!res.writableEnded) {
        res.write(": keep-alive\n\n");
      }
    }, 15_000);
  }

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
    if (sseKeepaliveTimer !== null) {
      clearInterval(sseKeepaliveTimer);
      sseKeepaliveTimer = null;
    }
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
