import { Router, type Request, type Response } from "express";
import { requireAuth } from "../../lib/auth.js";
import { isModelDisabled } from "../../lib/models.js";
import type { ImageGenerationRequest, ImageGenerationResponse } from "../../types.js";

const router = Router();

// Vercel AI Gateway configuration (zero-config in v0.app environment)
const VERCEL_AI_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh";

const IMAGE_MODELS = new Set([
  "openai/gpt-5.4-image-2",
  "bytedance-seed/seedream-4.5",
]);

interface ChatContentPart {
  type?: string;
  text?: string;
  image_url?: { url?: string };
  output_image?: { url?: string; b64_json?: string };
  data?: string;
  media_type?: string;
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
// Keep-alive helper — mirrors the pattern in modelfarm.ts.
// Writes a newline to the client every 15 s (after a 10 s grace period) so
// Replit's 300 s idle proxy timeout does not fire while waiting for a slow
// upstream to finish generating an image.
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
// Image content extraction from chat completion response
//
// OpenRouter returns image data for gpt-5.4-image-2 in message.images
// (not message.content which is null). message.images may be:
//   - Array of { b64_json, url, revised_prompt, ... }
//   - Array of strings (raw base64 or data URIs)
//   - Single base64/URL string
// We also check message.content for models that use the content array.
// ---------------------------------------------------------------------------
function extractImagesFromChat(result: ChatCompletionResult): ImageGenerationResponse["data"] {
  const msg = result.choices?.[0]?.message as Record<string, unknown> | undefined;
  const images: ImageGenerationResponse["data"] = [];
  if (!msg) return images;

  // ── 1. OpenRouter custom field: message.images ──────────────────────────
  const msgImages = msg["images"];
  if (msgImages !== null && msgImages !== undefined) {
    if (Array.isArray(msgImages)) {
      for (const item of msgImages as unknown[]) {
        if (typeof item === "string") {
          if (item.startsWith("data:")) images.push({ b64_json: item.split(",")[1] ?? item });
          else if (item.startsWith("http")) images.push({ url: item });
          else images.push({ b64_json: item }); // raw base64
        } else if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          // { type: "image_url", image_url: { url: "data:..." } }  — OpenRouter format
          if (obj["image_url"] && typeof obj["image_url"] === "object") {
            const imgObj = obj["image_url"] as Record<string, unknown>;
            const u = typeof imgObj["url"] === "string" ? imgObj["url"] : "";
            if (u.startsWith("data:")) images.push({ b64_json: u.split(",")[1] ?? u });
            else if (u) images.push({ url: u });
          } else if (typeof obj["b64_json"] === "string") {
            images.push({ b64_json: obj["b64_json"] });
          } else if (typeof obj["url"] === "string") {
            images.push({ url: obj["url"] });
          } else if (typeof obj["revised_prompt"] === "string") {
            images.push({ revised_prompt: obj["revised_prompt"] });
          }
        }
      }
    } else if (typeof msgImages === "string") {
      if (msgImages.startsWith("data:")) images.push({ b64_json: msgImages.split(",")[1] ?? msgImages });
      else if (msgImages.startsWith("http")) images.push({ url: msgImages });
      else images.push({ b64_json: msgImages });
    } else if (typeof msgImages === "object") {
      const obj = msgImages as Record<string, unknown>;
      if (typeof obj["b64_json"] === "string") images.push({ b64_json: obj["b64_json"] });
      else if (typeof obj["url"] === "string") images.push({ url: obj["url"] });
    }
    if (images.length > 0) return images;
  }

  // ── 2. Standard content array (output_image / image_url parts) ──────────
  const content = msg["content"];
  if (Array.isArray(content)) {
    for (const part of content as ChatContentPart[]) {
      const t = part.type ?? "";
      if (t === "output_image") {
        if (part.output_image?.b64_json) images.push({ b64_json: part.output_image.b64_json });
        else if (part.output_image?.url) {
          const u = part.output_image.url;
          images.push(u.startsWith("data:") ? { b64_json: u.split(",")[1] ?? u } : { url: u });
        }
      } else if (t === "image_url" || t === "image") {
        const u = part.image_url?.url ?? "";
        if (u.startsWith("data:")) images.push({ b64_json: u.split(",")[1] ?? u });
        else if (u) images.push({ url: u });
      } else if (part.data && typeof part.data === "string") {
        images.push({ b64_json: part.data });
      }
    }
  } else if (typeof content === "string" && content.length > 0) {
    if (content.startsWith("data:")) images.push({ b64_json: content.split(",")[1] ?? content });
    else if (content.startsWith("http")) images.push({ url: content });
    else images.push({ revised_prompt: content });
  }

  return images;
}

// ---------------------------------------------------------------------------
// Shared upstream call
// ---------------------------------------------------------------------------
async function callChatForImage(
  model: string,
  body: ImageGenerationRequest,
): Promise<{ chatResult: ChatCompletionResult; raw: string }> {
  // Vercel AI Gateway is zero-config in v0.app environment
  const url = `${VERCEL_AI_GATEWAY_BASE_URL}/chat/completions`;

  const chatBody: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: body.prompt }],
  };
  if (body.n) chatBody["n"] = body.n;
  if (body.size) chatBody["size"] = body.size;
  if (body.quality) chatBody["quality"] = body.quality;
  if (body.style) chatBody["style"] = body.style;
  if (body.response_format) chatBody["response_format"] = body.response_format;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "HTTP-Referer": "https://v0.app",
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
// POST /v1/images/generations
// ---------------------------------------------------------------------------
router.post("/v1/images/generations", requireAuth, async (req: Request, res: Response) => {
  res.setTimeout(600_000);
  req.socket.setTimeout(600_000);

  const body = req.body as ImageGenerationRequest;

  if (!body.prompt || typeof body.prompt !== "string") {
    res.status(400).json({ error: { message: "prompt is required" } }); return;
  }
  if (!body.model) {
    res.status(400).json({ error: { message: "model is required" } }); return;
  }
  if (isModelDisabled(body.model)) {
    res.status(400).json({ error: { message: `Model ${body.model} is disabled` } }); return;
  }
  if (!IMAGE_MODELS.has(body.model)) {
    res.status(400).json({
      error: { message: `Model ${body.model} does not support image generation. Supported: ${[...IMAGE_MODELS].join(", ")}` },
    }); return;
  }

  req.log.info({ model: body.model }, "image generation via chat/completions");
  const stopKA = startKeepAlive(res);

  try {
    const { chatResult } = await callChatForImage(body.model, body);
    stopKA();

    // Log content structure for debugging
    const msg = chatResult.choices?.[0]?.message;
    const content = msg?.["content"];
    req.log.info({
      msgKeys: msg ? Object.keys(msg) : [],
      contentType: typeof content,
      isNull: content === null,
      isArray: Array.isArray(content),
      arrayLen: Array.isArray(content) ? (content as unknown[]).length : undefined,
      partTypes: Array.isArray(content)
        ? (content as ChatContentPart[]).map((p) => ({ type: p.type, keys: Object.keys(p) }))
        : undefined,
    }, "chat response content structure");

    const data = extractImagesFromChat(chatResult);
    const result: ImageGenerationResponse = {
      created: chatResult.created ?? Math.floor(Date.now() / 1000),
      data: data.length > 0 ? data : [{ revised_prompt: "(no image data returned by model)" }],
    };
    if (!res.headersSent) res.json(result);
    else res.end(JSON.stringify(result));
  } catch (err) {
    stopKA();
    const message = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "Image generation error");
    if (!res.headersSent) res.status(502).json({ error: { message, type: "upstream_error" } });
  }
});

// ---------------------------------------------------------------------------
// POST /v1/images/generations/raw  — debug: inspect raw chat response shape
// ---------------------------------------------------------------------------
router.post("/v1/images/generations/raw", requireAuth, async (req: Request, res: Response) => {
  res.setTimeout(600_000);
  req.socket.setTimeout(600_000);

  const body = req.body as ImageGenerationRequest;
  if (!body.prompt || !body.model) {
    res.status(400).json({ error: { message: "prompt and model are required" } }); return;
  }

  const stopKA = startKeepAlive(res);

  try {
    const { raw, chatResult } = await callChatForImage(body.model, body);
    stopKA();

    const msg = chatResult.choices?.[0]?.message as Record<string, unknown> | undefined;
    const content = msg?.["content"];

    const skeleton = {
      id: chatResult.id,
      created: chatResult.created,
      rawLength: raw.length,
      choices: [{
        messageKeys: msg ? Object.keys(msg) : [],
        content: {
          type: typeof content,
          isNull: content === null,
          isArray: Array.isArray(content),
          preview: Array.isArray(content)
            ? (content as ChatContentPart[]).map((p) => ({
                type: p.type,
                keys: Object.keys(p),
                imageUrlPrefix: (p.image_url?.url ?? "").slice(0, 60),
                outputImageKeys: p.output_image ? Object.keys(p.output_image) : undefined,
                dataLen: typeof p.data === "string" ? p.data.length : undefined,
              }))
            : typeof content === "string"
              ? content.slice(0, 200)
              : content !== null && content !== undefined
                ? JSON.stringify(content).slice(0, 200)
                : null,
        },
        messageSizes: msg ? Object.fromEntries(
          Object.entries(msg).map(([k, v]) => [k, typeof v === "string" ? v.length : JSON.stringify(v).length])
        ) : {},
        imagesField: (() => {
          const imgs = msg?.["images"];
          if (imgs === null || imgs === undefined) return null;
          if (Array.isArray(imgs)) {
            return (imgs as unknown[]).slice(0, 2).map((item) => {
              if (typeof item === "string") return { type: "string", len: item.length, prefix: item.slice(0, 40) };
              if (item && typeof item === "object") return { type: "object", keys: Object.keys(item as object), sizes: Object.fromEntries(Object.entries(item as Record<string,unknown>).map(([k,v]) => [k, typeof v === "string" ? (v as string).length : JSON.stringify(v).length])) };
              return { type: typeof item };
            });
          }
          if (typeof imgs === "string") return { type: "string", len: imgs.length, prefix: imgs.slice(0, 40) };
          if (typeof imgs === "object") return { type: "object", keys: Object.keys(imgs as object) };
          return { type: typeof imgs };
        })(),
      }],
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
