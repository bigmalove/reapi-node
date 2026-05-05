# AI Gateway 上游节点

本节点是反向代理池中的一个上游成员，对外暴露 `/modelfarm/{openai,anthropic,google,openrouter}`，将请求透传到本机配置的 Replit AI 集成。

## 0. 环境前置约束（必读）

开发环境下，门户和 API Server 是两个独立端口的服务：

| 服务               | 端口  | 框架          |
| ------------------ | ----- | ------------- |
| AI Gateway Portal  | 24927 | Vite          |
| API Server         | 8080  | Express       |

门户用相对路径 `/api/*`、`/modelfarm/*` 调后端，**必须经过 Vite 的 `server.proxy` 转发到 8080**，否则 Vite 会按 SPA 默认行为返回 `index.html`，前端 `res.json()` 会抛出
`Unexpected token '<', "<!DOCTYPE "... is not valid JSON`。

代理配置见 `artifacts/api-portal/vite.config.ts` 的 `server.proxy`。新增任何跨服务路径前缀时，记得同步加进去。`setup.sh` 已内置自检，缺失会报错。

生产环境由 Replit 路径路由统一处理（`/` → 门户静态文件；`/api`、`/modelfarm` → API Server），无需额外配置。

## 1. 运行 setup

```bash
bash setup.sh
```

完成依赖安装、类型检查与开发环境代理自检。

## 2. 配置四个 AI 通道

无需自备任何 API Key，费用从 Replit Credits 扣除。Agent 会自动调用 `setupReplitAIIntegrations` 依次配置以下四个通道：

1. OpenAI     — `AI_INTEGRATIONS_OPENAI_BASE_URL` / `AI_INTEGRATIONS_OPENAI_API_KEY`
2. Anthropic  — `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` / `AI_INTEGRATIONS_ANTHROPIC_API_KEY`
3. Gemini     — `AI_INTEGRATIONS_GEMINI_BASE_URL` / `AI_INTEGRATIONS_GEMINI_API_KEY`
4. OpenRouter — `AI_INTEGRATIONS_OPENROUTER_BASE_URL` / `AI_INTEGRATIONS_OPENROUTER_API_KEY`

每个通道返回 `"success": true` 即配置完成。

## 3. 重启 API Server

在工作流面板中重启 `API Server`，让新环境变量生效。

## 4. 验证

切到门户的「节点状态」页，四个通道应全部显示「可用」。

也可用 curl 直接验证：

```bash
# 开发环境（经 Vite 代理）
curl -fsS http://localhost:24927/api/setup-status

# 线上域名（经 Replit 路径路由）
curl -fsS https://<你的域名>/api/setup-status
```

返回 JSON 中每个通道的 `"configured": true` 即表示配置成功。
若返回的是 HTML，说明 Vite 代理或线上路由有问题，回到第 0 节排查。
