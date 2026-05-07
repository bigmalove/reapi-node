AI Gateway Node
A small Express proxy that fronts the Replit AI Integrations modelfarm (localhost:1106) and exposes per-provider passthrough endpoints to OpenAI, Anthropic, Gemini, and OpenRouter through a single HTTP surface on port 8080.

Run & Operate
Dev: pnpm --filter @workspace/api-server run dev (uses tsx directly)
Build: pnpm --filter @workspace/api-server run build (esbuild bundle)
Start (prod): pnpm --filter @workspace/api-server run start
Typecheck: pnpm --filter @workspace/api-server run typecheck
Required env: PORT, plus per-provider AI_INTEGRATIONS_{OPENAI|ANTHROPIC|GEMINI|OPENROUTER}_BASE_URL and ..._API_KEY (all four channels are wired up via Replit AI integrations).
Optional: PROXY_API_KEY to lock down the gateway.
Stack
Node 24, TypeScript, Express 5
pino + pino-http (with pino-pretty in dev) for logging
Dev runtime: tsx (we deliberately do not use the esbuild bundle in dev — see Gotchas)
Bundler: esbuild + esbuild-plugin-pino
Where things live
artifacts/api-server/src/index.ts — server bootstrap (reads PORT)
artifacts/api-server/src/app.ts — Express wiring (pino-http, cors, routes)
artifacts/api-server/src/routes/modelfarm.ts — provider passthrough proxy (the heart of the app)
artifacts/api-server/src/routes/setup.ts, index.ts — /api/setup-status & friends
artifacts/api-server/src/lib/auth.ts — optional shared-secret auth
Architecture decisions
Per-provider config table (UPSTREAM) maps a URL segment to env vars + auth header style (bearer / x-api-key / x-goog-api-key).
Body is forwarded as a UTF-8 string (req.body.toString("utf-8")), not as a binary Uint8Array — see Gotchas.
Upstream responses are streamed back via Response.body.getReader() so SSE and large completions work.
Client-disconnect cancellation: res.on("close") is attached after fetch returns and only cancels the body reader during streaming.
Product
A single artifact (AI Gateway Node) that:

Reports per-provider configuration via GET /api/setup-status
Proxies model calls under POST /modelfarm/{openai|anthropic|google|openrouter}/...
Serves a small landing page at / describing the API surface
Gotchas
Do not run the esbuild bundle in dev. When the bundled dist/index.mjs runs under Replit's workflow, outbound fetch() to localhost:1106 hangs before any TCP connect. The dev script uses tsx against src/ to avoid this.
Do not pass signal: abortController.signal to fetch() in this Replit container — it causes the outbound request to hang ~20s before any TCP connection. Cancellation is implemented at the streaming layer instead.
Do not set Content-Length manually when calling fetch() — undici computes it; an explicit one combined with our body shape produced hangs in testing.
Gemini upstream is currently unsupported by Replit's AI proxy (localhost:1106/modelfarm/gemini/* returns INVALID_ENDPOINT for :generateContent and openai/v1/chat/completions shapes alike). Setup reports configured: true because the env vars exist, but real requests fail at the platform layer, not in this app.
Pointers
readme.md (project root) — original product brief
.local/skills/integrations — Replit AI integrations setup
.local/skills/artifacts — artifact registration model
