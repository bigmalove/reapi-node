# ReAPI Node：傻瓜搭建说明

你现在的任务是：**搭建项目**。

你不是来修代码的。
你不是来补接口的。
你不是来改 OpenAPI 的。
你不是来生成类型的。

## 0. 绝对禁止

如果你是 AI，请先读这里。

```txt
禁止修改任何代码文件
禁止新建接口
禁止编辑 openapi.yaml
禁止运行代码生成
禁止解压旧压缩包来覆盖项目
禁止寻找 Vite 前端
禁止使用 24927 端口
禁止使用 npm install
```

本项目已经有这些东西，不需要你补：

```txt
/api/setup-status 已存在
/ 首页已存在
/modelfarm/* 代理已存在
```

如果你觉得缺接口，说明你在看旧代码或跑错服务。
正确做法不是改代码，而是重新拉最新代码。

## 1. 先确认你拿到的是最新项目

项目根目录应该有这些文件：

```txt
package.json
setup.sh
artifacts/api-server/package.json
artifacts/api-server/src/routes/setup.ts
artifacts/api-server/src/lib/index-html.ts
```

项目里不应该需要这些东西：

```txt
artifacts/api-portal
artifacts/mockup-sandbox
lib/api-spec
lib/api-zod
lib/api-client-react
openapi.yaml
```

如果你看到上面这些旧目录，不要改它们。
直接重新拉最新仓库：

```bash
git clone https://github.com/bigmalove/reapi-node.git
cd reapi-node
```

如果已经在仓库里，执行：

```bash
git pull
```

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

不要找前端服务。
不要找 Vite。
不要打开 24927。

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

让 Replit Agent 调用：

```txt
setupReplitAIIntegrations
```

必须配置 4 个通道：

```txt
openai
anthropic
gemini
openrouter
```

每个都必须返回：

```txt
success: true
```

不要只配一个。
不要跳过任何一个。
不要手写假的环境变量。

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

没有前端构建。
没有 Vite 构建。
没有 OpenAPI 代码生成。

## 9. 本地启动命令

如果不用 Replit Workflows，本地可以执行：

```bash
PORT=8080 pnpm --filter @workspace/api-server run dev
```

然后打开：

```txt
http://localhost:8080/
```

## 10. 最终检查清单

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
```

## 11. 一句话版本

```txt
拉最新代码，用 pnpm，运行 bash setup.sh，配置 4 个 Replit AI 通道，重启 API Server，看 8080，验证 /api/setup-status，不要改代码。
```
