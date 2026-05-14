import { Router, type Request, type Response } from "express";
import { requireAuth } from "../../lib/auth.js";
import { isModelDisabled } from "../../lib/models.js";
import { resolveProviderEndpoint } from "../../lib/providerEndpoint.js";
import type { VideoGenerationRequest, VideoGenerationResponse } from "../../types.js";

const router = Router();

const VIDEO_MODELS = new Set([
  "bytedance/seedance-2.0",
  "kwaivgi/kling-v3.0-pro",
]);

interface ChatContentPart {
  type?: string;
  video_url?: { url?: string };
  image_url?: { url?: string };
  [key: string]: unknown;
}

interface ChatCompletionResult {
  id?: string;
  created?: number;
  choices?: Array<{
    message?: Record<string, unknown>;
  }>;
}

// ---------------------------------------------------------------------------
// Keep-alive — same pattern as images.ts / modelfarm.ts
// ---------------------------------------------------------------------------
function startKeepAlive(res: Response): () => void {
  let graceTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
    graceTimer = null;
    if (!res.headersSent) res.flushHeaders?.();
    if (!res.writableEnded) res.write("\n");

    const ping = setInterval(() => {
      if (res.writableEnded) { clearInterval(ping); return; }
      res.write("\n");
    }, 15_000);

    stop = () => { clearInterval(ping); };
  }, 10_000);

  let stop = () => {
    if (graceTimer !== null) { clearTimeout(graceTimer); graceTimer = null; }
  };

  return () => stop();
}

// ---------------------------------------------------------------------------
// Video URL / base64 extraction from chat completion response
//
// OpenRouter image models store data in message.images; video models likely
// use message.videos (same pattern). We also check message.content as a
// fallback for standard content-part formats.
// ---------------------------------------------------------------------------
function extractVideosFromChat(result: ChatCompletionResult): VideoGenerationResponse["data"] {
  const msg = result.choices?.[0]?.message as Record<string, unknown> | undefined;
  const items: NonNullable<VideoGenerationResponse["data"]> = [];
  if (!msg) return items;

  // ── 1. message.videos  (OpenRouter custom field, same pattern as images) ─
  const msgVideos = msg["videos"];
  if (msgVideos !== null && msgVideos !== undefined) {
    const list = Array.isArray(msgVideos) ? msgVideos as unknown[] : [msgVideos];
    for (const item of list) {
      if (typeof item === "string") {
        items.push({ url: item });
      } else if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        // { type: "video_url", video_url: { url: "..." } }
        if (obj["video_url"] && typeof obj["video_url"] === "object") {
          const u = (obj["video_url"] as Record<string, unknown>)["url"];
          if (typeof u === "string") items.push({ url: u });
        } else if (typeof obj["url"] === "string") {
          items.push({ url: obj["url"] });
        }
      }
    }
    if (items.length > 0) return items;
  }

  // ── 2. Standard content array ────────────────────────────────────────────
  const content = msg["content"];
  if (Array.isArray(content)) {
    for (const part of content as ChatContentPart[]) {
      const t = part.type ?? "";
      if (t === "video_url") {
        const u = part.video_url?.url ?? "";
        if (u) items.push({ url: u });
      } else if (t === "image_url") {
        // Some providers return video as an image_url with a video MIME
        const u = part.image_url?.url ?? "";
        if (u) items.push({ url: u });
      }
    }
  } else if (typeof content === "string" && content.startsWith("http")) {
    items.push({ url: content });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Shared upstream call via chat/completions
// ---------------------------------------------------------------------------
async function callChatForVideo(
  model: string,
  body: VideoGenerationRequest,
): Promise<{ chatResult: ChatCompletionResult; raw: string }> {
  const { baseUrl, apiKey } = resolveProviderEndpoint("openrouter");
  const url = `${baseUrl}/chat/completions`;

  const chatBody: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: body.prompt }],
  };
  if (body.duration) chatBody["duration"] = body.duration;
  if (body.resolution) chatBody["resolution"] = body.resolution;
  if (body.fps) chatBody["fps"] = body.fps;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://replit.com",
      "X-Title": "AI Gateway",
    },
    body: JSON.stringify(chatBody),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw Object.assign(
      new Error(`Upstream error ${response.status}: ${raw.slice(0, 400)}`),
      { status: response.status, raw },
    );
  }
  return { chatResult: JSON.parse(raw) as ChatCompletionResult, raw };
}

// ---------------------------------------------------------------------------
// POST /v1/videos/generations
// ---------------------------------------------------------------------------
router.post("/v1/videos/generations", requireAuth, async (req: Request, res: Response) => {
  res.setTimeout(600_000);
  req.socket.setTimeout(600_000);

  const body = req.body as VideoGenerationRequest;

  if (!body.prompt || typeof body.prompt !== "string") {
    res.status(400).json({ error: { message: "prompt is required" } }); return;
  }
  if (!body.model) {
    res.status(400).json({ error: { message: "model is required" } }); return;
  }
  if (isModelDisabled(body.model)) {
    res.status(400).json({ error: { message: `Model ${body.model} is disabled` } }); return;
  }
  if (!VIDEO_MODELS.has(body.model)) {
    res.status(400).json({
      error: { message: `Model ${body.model} does not support video generation. Supported: ${[...VIDEO_MODELS].join(", ")}` },
    }); return;
  }

  req.log.info({ model: body.model }, "video generation via chat/completions");
  const stopKA = startKeepAlive(res);

  try {
    const { chatResult } = await callChatForVideo(body.model, body);
    stopKA();

    const msg = chatResult.choices?.[0]?.message;
    req.log.info({
      msgKeys: msg ? Object.keys(msg) : [],
      hasChatId: !!chatResult.id,
    }, "video chat response structure");

    const data = extractVideosFromChat(chatResult) ?? [];
    const result: VideoGenerationResponse = {
      id: chatResult.id,
      status: data.length > 0 ? "completed" : "pending",
      created: chatResult.created ?? Math.floor(Date.now() / 1000),
      data: data.length > 0 ? data : undefined,
    };

    if (!res.headersSent) res.json(result);
    else res.end(JSON.stringify(result));
  } catch (err) {
    stopKA();
    const message = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "Video generation error");
    if (!res.headersSent) res.status(502).json({ error: { message, type: "upstream_error" } });
  }
});

// ---------------------------------------------------------------------------
// POST /v1/videos/generations/raw  — debug: inspect raw chat response shape
// ---------------------------------------------------------------------------
router.post("/v1/videos/generations/raw", requireAuth, async (req: Request, res: Response) => {
  res.setTimeout(600_000);
  req.socket.setTimeout(600_000);

  const body = req.body as VideoGenerationRequest;
  if (!body.prompt || !body.model) {
    res.status(400).json({ error: { message: "prompt and model are required" } }); return;
  }

  const stopKA = startKeepAlive(res);

  try {
    const { raw, chatResult } = await callChatForVideo(body.model, body);
    stopKA();

    const msg = chatResult.choices?.[0]?.message as Record<string, unknown> | undefined;
    const skeleton = {
      id: chatResult.id,
      created: chatResult.created,
      rawLength: raw.length,
      messageKeys: msg ? Object.keys(msg) : [],
      messageSizes: msg ? Object.fromEntries(
        Object.entries(msg).map(([k, v]) => [k, typeof v === "string" ? v.length : JSON.stringify(v).length])
      ) : {},
    };

    if (!res.headersSent) res.json(skeleton);
    else res.end(JSON.stringify(skeleton));
  } catch (err) {
    stopKA();
    const message = err instanceof Error ? err.message : "Unknown error";
    if (!res.headersSent) res.status(502).json({ error: { message } });
  }
});

export default router;
