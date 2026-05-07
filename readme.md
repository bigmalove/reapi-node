# ReAPI Node：傻瓜搭建说明

你现在的任务是：**搭建项目**。





## 2. 记住唯一服务

本项目只有一个服务：

```txt
API Server
端口：8080
```

访问地址只有这个：

```txt
http://localhost:8080/
```



## 3. 安装和检查

在项目根目录执行：

```bash
corepack enable
bash setup.sh
```

脚本成功就继续。
脚本失败就看报错。
不要自己改业务代码。

## 4. 配置 Replit AI

Replit AI Integrations 配置过程

在 code_execution JS 沙箱中，依次调用 setupReplitAIIntegrations()，每次等上一个完成再调下一个：

// 1. OpenAI
const r1 = await setupReplitAIIntegrations({
  providerSlug: "openai",
  providerUrlEnvVarName: "AI_INTEGRATIONS_OPENAI_BASE_URL",
  providerApiKeyEnvVarName: "AI_INTEGRATIONS_OPENAI_API_KEY",
});
// 返回：{ success: true, envVarsSet: ["AI_INTEGRATIONS_OPENAI_BASE_URL", "AI_INTEGRATIONS_OPENAI_API_KEY"] }
// 2. Anthropic
const r2 = await setupReplitAIIntegrations({
  providerSlug: "anthropic",
  providerUrlEnvVarName: "AI_INTEGRATIONS_ANTHROPIC_BASE_URL",
  providerApiKeyEnvVarName: "AI_INTEGRATIONS_ANTHROPIC_API_KEY",
});
// 返回：{ success: true, envVarsSet: [...] }
// 3. Gemini
const r3 = await setupReplitAIIntegrations({
  providerSlug: "gemini",
  providerUrlEnvVarName: "AI_INTEGRATIONS_GEMINI_BASE_URL",
  providerApiKeyEnvVarName: "AI_INTEGRATIONS_GEMINI_API_KEY",
});
// 返回：{ success: true, envVarsSet: [...] }
// 4. OpenRouter
const r4 = await setupReplitAIIntegrations({
  providerSlug: "openrouter",
  providerUrlEnvVarName: "AI_INTEGRATIONS_OPENROUTER_BASE_URL",
  providerApiKeyEnvVarName: "AI_INTEGRATIONS_OPENROUTER_API_KEY",
});
// 返回：{ success: true, envVarsSet: [...] }

配置完成后重启 API Server 工作流，再验证：

curl http://localhost:8080/api/setup-status



## 5. 重启 API Server

配置完成后，重启 Replit 工作流：

```txt
artifacts/api-server: API Server
```

必须重启。
不重启就读不到新环境变量。

## 6. 验证状态接口

执行：

```bash
curl -fsS http://localhost:8080/api/setup-status
```

正确结果是 JSON。

JSON 里 4 个通道都要是：

```txt
configured: true
```

如果是 `configured: false`，只做两件事：

```txt
重新配置 Replit AI
重启 API Server
```

不要改代码。

## 7. 验证首页

打开：

```txt
http://localhost:8080/
```

如果首页 404，不要补根路由。

正确处理顺序：

```txt
1. 确认运行的是 API Server
2. 确认端口是 8080
3. 执行 git pull
4. 执行 pnpm run build
5. 重启 artifacts/api-server: API Server
```

仍然 404，再检查是否在旧项目里。
不要编辑 `routes/index.ts`。

## 8. 构建命令

```bash
pnpm run build
```

它只构建 API Server。


## 9. 本地启动命令

如果不用 Replit Workflows，本地可以执行：

```bash
PORT=8080 pnpm --filter @workspace/api-server run dev
```

然后打开：

```txt
http://localhost:8080/
```

## 10. 已知陷阱与规避方法
陷阱 1：AI_INTEGRATIONS_*_BASE_URL 一旦写错，无法被代码默认值覆盖
原因 Replit Secrets 的优先级高于代码里的任何默认值，且无法通过 API 或代码删除，只能在 Secrets 面板手动删除。

症状

所有 /modelfarm/* 推理请求返回 504 或挂起 30s
服务启动日志正常，/api/setup-status 显示 configured: true，但实际请求超时
规避方法

这 4 个变量不要存 Secret，不要手动填写：

AI_INTEGRATIONS_OPENAI_BASE_URL
AI_INTEGRATIONS_ANTHROPIC_BASE_URL
AI_INTEGRATIONS_GEMINI_BASE_URL
AI_INTEGRATIONS_OPENROUTER_BASE_URL

它们的值由代码根据 POOL_HOST 自动构造，不需要外部设置。

上游池地址只用 POOL_HOST 一个变量控制（可选，不设就用代码默认值）：

POOL_HOST=https://your-pool-node.replit.app

如果已经误存了错误值，必须去 Secrets 面板手动删除那 4 个 key，然后重启服务。

陷阱 2：BASE_URL 指向 localhost 自身（请求自环）
原因 setupReplitAIIntegrations() 默认把 BASE_URL 写成本节点自己的 localhost 地址。如果本节点是下游网关（不直连 AI 厂商），这会导致请求打回自身，无限等待。

症状

4 个 provider 全部 504
curl 直打本地 /modelfarm/openai/chat/completions 也超时
上游池的根路径 GET / 返回 200，但 /modelfarm/* 无响应
规避方法

只在真正直连 AI 厂商的节点上调用 setupReplitAIIntegrations()。 下游网关节点只需要设置：

POOL_HOST=https://<上游池域名>
AI_INTEGRATIONS_OPENAI_API_KEY=<proxy key 或 dummy>
AI_INTEGRATIONS_ANTHROPIC_API_KEY=<proxy key 或 dummy>
AI_INTEGRATIONS_GEMINI_API_KEY=<proxy key 或 dummy>
AI_INTEGRATIONS_OPENROUTER_API_KEY=<proxy key 或 dummy>

## 11. 最终检查清单

只按这个清单做。
不要增加额外步骤。

```txt
[ ] 确认项目是最新 reapi-node
[ ] 不修改任何代码文件
[ ] corepack enable
[ ] bash setup.sh
[ ] 调用 setupReplitAIIntegrations
[ ] openai success: true
[ ] anthropic success: true
[ ] gemini success: true
[ ] openrouter success: true
[ ] 重启 artifacts/api-server: API Server
[ ] curl http://localhost:8080/api/setup-status
[ ] 看到 4 个 configured: true
[ ] 打开 http://localhost:8080/
[ ] 输出html页面访问地址(真实外网地址比如https://xxx.sisko.replit.dev/，而不是内部地址)
```

## 12. 一句话版本

```txt
拉最新代码，用 pnpm，运行 bash setup.sh，配置 4 个 Replit AI 通道，重启 API Server，看 8080，验证 /api/setup-status，不要改代码。
```

