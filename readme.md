# AI Gateway 上游节点

本节点是反向代理池中的一个上游成员，对外暴露 `/modelfarm/{openai,anthropic,google,openrouter}`，将请求透传到本机配置的 Replit AI 集成。

## 架构

整个项目只有一个服务：

| 服务       | 端口 | 框架    | 路径                                              |
| ---------- | ---- | ------- | ------------------------------------------------- |
| API Server | 8080 | Express | `/`（HTML 页面）、`/api/*`、`/modelfarm/*`        |

- `GET /` — 节点状态与接入文档（单文件 HTML，原生 JS 调 `/api/setup-status`）
- `GET /api/healthz` · `GET /api/setup-status` — 管理接口
- `ANY /modelfarm/<segment>/*` — 透传到对应上游

## 1. 运行 setup

```bash
bash setup.sh
```

完成依赖安装与类型检查。

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

```bash
curl -fsS http://localhost:8080/api/setup-status
# 或线上：
curl -fsS https://<你的域名>/api/setup-status
```

返回 JSON 中每个通道的 `"configured": true` 即表示配置成功。也可用浏览器打开 `http://localhost:8080/` 查看「节点状态」页，四个通道应全部显示「可用」。

## 构建与部署

```bash
pnpm install
pnpm run build                                  # typecheck + 构建 api-server
pnpm --filter @workspace/api-server run dev     # 开发模式启动
```

部署使用 Replit Deployments（autoscale），构建/启动命令在 `artifacts/api-server/.replit-artifact/artifact.toml` 中定义。
