# AI Upstream Pool Node

## Overview

A single-instance **upstream pool node** deployed on Replit. Its sole job is to expose `/modelfarm/{openai,anthropic,google,openrouter}/*` paths and transparently forward every byte to the actual provider backends configured via Replit AI Integrations on this Repl.

Other gateways (the "downstream" / orchestrator) put this node's URL into their reverse-proxy pool. This node itself does **not** do any model routing, registry, request rewriting, or response rewriting.

## Architecture

Two artifacts in a pnpm monorepo:

- **`artifacts/api-server`** — Express + TypeScript proxy (serves at `/api` and `/modelfarm`)
- **`artifacts/api-portal`** — React + Vite status portal (serves at `/`)
前端 api-portal（React + Vite + Tailwind）
技术栈：React 19 + Vite 7 + TypeScript + Tailwind CSS v4（深色主题）

核心文件：

src/App.tsx — 顶层布局：标题栏 + 标签栏（节点状态/接入文档）+ 内容区，用 useState 切换两个页面，没有用任何路由库
src/pages/ConfigPage.tsx — 节点状态页，挂载时通过 fetch('/api/setup-status') 拉取节点配置状态并渲染卡片
src/pages/DocsPage.tsx — 接入文档页，纯静态内容（教程步骤 + 调用示例 + 接口表格）
src/lib/api.ts — 简单的 fetch 封装，定义了 SetupStatus / SegmentStatus 类型
src/index.css — Tailwind 主题变量（HSL 深色配色）
没有用：React Query、React Router、状态管理库 — 因为页面只有一个简单的 GET 请求和两个 tab 切换，原生 useState + useEffect 足够了。

## Stack

- pnpm workspaces, Node.js 24, Express 5, esbuild ESM bundle
- React + Vite + TypeScript + Tailwind CSS v4
- No database, no persisted state

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET    | /healthz, /api/healthz | Health check |
| GET    | /api/setup-status | Node role + per-segment env-var status |
| ANY    | /modelfarm/<segment>/<rest> | Transparent proxy to upstream |

### `/modelfarm/<segment>` mapping

| Segment | Forwarded to | Auth header injected |
|---|---|---|
| `openai` | `AI_INTEGRATIONS_OPENAI_BASE_URL` | `Authorization: Bearer …` |
| `anthropic` | `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` | `x-api-key` + `anthropic-version` (passed through, default `2023-06-01`) |
| `google` | `AI_INTEGRATIONS_GEMINI_BASE_URL` | `x-goog-api-key` |
| `openrouter` | `AI_INTEGRATIONS_OPENROUTER_BASE_URL` | `Authorization: Bearer …` |

The proxy:
- Uses `express.raw()` so the original request body bytes are forwarded untouched.
- Preserves request method, query string, and `Content-Type` / `Accept` headers.
- Streams the upstream response body verbatim (so SSE works out of the box).
- Returns `503` if the segment's env vars are missing.

## Environment Variables
通过 replit AI Integrations 来调用四个接口！通过 Replit AI Integrations 自动代理，无需提供自己的 API Key
Replit AI Integrations (auto-provisioned per provider in use):

通过 Replit AI Integrations 配置四个 AI 通道
前提：无需自备任何 API Key，费用从 Replit Credits 扣除。



把以下指令原样发给 Agent
通过 Replit AI Integrations 依次配置以下四个通道的环境变量：
1. OpenAI     — AI_INTEGRATIONS_OPENAI_BASE_URL / AI_INTEGRATIONS_OPENAI_API_KEY
2. Anthropic  — AI_INTEGRATIONS_ANTHROPIC_BASE_URL / AI_INTEGRATIONS_ANTHROPIC_API_KEY
3. Gemini     — AI_INTEGRATIONS_GEMINI_BASE_URL / AI_INTEGRATIONS_GEMINI_API_KEY
4. OpenRouter — AI_INTEGRATIONS_OPENROUTER_BASE_URL / AI_INTEGRATIONS_OPENROUTER_API_KEY

Agent 会自动调用 setupReplitAIIntegrations 完成配置，每个通道返回 "success": true 即成功。

重启 API Server
配置完成后，在工作流面板中重启 API Server，让新的环境变量生效。

验证
切换到门户的节点状态页，四个通道应全部显示 可用。

或用 curl 直接验证：

curl https://<你的域名>/api/setup-status

返回结果中每个通道的 "configured": true 即表示配置成功。

四个通道环境变量速查
通道	Base URL 变量	API Key 变量
OpenAI	AI_INTEGRATIONS_OPENAI_BASE_URL	AI_INTEGRATIONS_OPENAI_API_KEY
Anthropic	AI_INTEGRATIONS_ANTHROPIC_BASE_URL	AI_INTEGRATIONS_ANTHROPIC_API_KEY
Google Gemini	AI_INTEGRATIONS_GEMINI_BASE_URL	AI_INTEGRATIONS_GEMINI_API_KEY
OpenRouter	AI_INTEGRATIONS_OPENROUTER_BASE_URL	AI_INTEGRATIONS_OPENROUTER_API_KEY
以上变量由 Replit 自动注入，请勿手动修改。其中 API Key 是占位字符串，代理会在转发时自动替换为真实密钥。

Optional:

- `PROXY_API_KEY` — when set, every `/modelfarm/*` request must carry it in `Authorization: Bearer <key>` or `x-api-key: <key>`. When unset the node is open.

## Admin Portal

Two tabs:

1. **节点状态** — Node base URL, `PROXY_API_KEY` status, per-segment env-var status.
2. **接入文档** — Auth, segment mapping, sample curl, how to add this node to a downstream pool.

## Key Commands

- `pnpm --filter @workspace/api-server run dev` — run API server
- `pnpm --filter @workspace/api-portal run dev` — run admin portal
- `pnpm run typecheck` — full repo typecheck
