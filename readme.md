这是一个 Replit AI 上游代理节点。

你只需要记住 3 件事：

```txt
只用 pnpm
只启动 API Server
只看 8080 端口
```

## 1. 这个项目是什么

它把请求转发到 Replit AI Integrations。

支持 4 个通道：

```txt
/modelfarm/openai/*
/modelfarm/anthropic/*
/modelfarm/google/*
/modelfarm/openrouter/*
```

不要自己申请 API Key。
费用走 Replit Credits。

## 2. 先安装

在项目根目录执行：

```bash
corepack enable
bash setup.sh
```

`setup.sh` 会自动做：

```txt
pnpm install
pnpm run typecheck
```

看到脚本没有报错，再继续。

## 3. 配置 Replit AI

让 Replit Agent 调用：

```txt
setupReplitAIIntegrations
```

必须配置 4 个：

```txt
openai
anthropic
gemini
openrouter
```

每个都要返回：

```txt
success: true
```

不要漏掉任何一个。

## 4. 重启后端

在 Replit Workflows 里重启这个工作流：

```txt
artifacts/api-server: API Server
```

重启是必须的。
因为环境变量配置后，后端要重启才能读到。

## 5. 验证是否成功

执行：

```bash
curl -fsS http://localhost:8080/api/setup-status
```

成功时应该返回 JSON。

重点看 4 个通道都必须是：

```txt
configured: true
```

也可以打开：

```txt
http://localhost:8080/
```

页面里 4 个通道都应该显示可用。

## 6. 构建命令

```bash
pnpm run build
```

这个命令只做两件事：

```txt
检查 API Server 类型
构建 API Server
```

没有前端构建。
没有 Vite。
没有 24927 端口。

## 7. 本地启动命令

```bash
PORT=8080 pnpm --filter @workspace/api-server run dev
```

启动后访问：

```txt
http://localhost:8080/
```

## 8. 常见错误

### 错误 1：用了 npm

不要用：

```bash
npm install
```

正确做法：

```bash
pnpm install
```

### 错误 2：`configured: false`

原因只有两个：

```txt
Replit AI 没配置好
配置后没有重启 API Server
```

重新做第 3 步和第 4 步。

### 错误 3：打开了错误端口

不要看 24927。
不要找 Vite。

只看：

```txt
8080
```

## 9. AI 执行清单

按顺序做，不要跳步：

```txt
[ ] 进入项目根目录
[ ] corepack enable
[ ] bash setup.sh
[ ] 调用 setupReplitAIIntegrations
[ ] openai 返回 success: true
[ ] anthropic 返回 success: true
[ ] gemini 返回 success: true
[ ] openrouter 返回 success: true
[ ] 重启 artifacts/api-server: API Server
[ ] curl http://localhost:8080/api/setup-status
[ ] 确认 4 个 configured 都是 true
[ ] 打开 http://localhost:8080/
```

做完上面这些，项目就搭好了。
