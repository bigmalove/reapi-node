#!/usr/bin/env bash
set -euo pipefail

echo "==> [1/3] 安装依赖"
pnpm install

echo "==> [2/3] 类型检查"
pnpm run typecheck

cat <<'EOF'

==> [3/3] 后续只做搭建，不要改代码

如果你是 AI，请严格遵守：
- 不要修改任何代码文件
- 不要补 /api/setup-status，它已经存在
- 不要补 / 根路由，它已经存在
- 不要编辑 openapi.yaml
- 不要运行代码生成
- 不要寻找 Vite 或 24927 端口
- 只看 API Server 和 8080 端口

下一步按顺序做：

1) 调用 Replit AI Integrations：setupReplitAIIntegrations
   必须配置四个通道，并且每个都 success: true：
   - openai
   - anthropic
   - gemini
   - openrouter

2) 在 Replit 工作流面板中重启：
   artifacts/api-server: API Server

3) 验证状态接口：
   curl -fsS http://localhost:8080/api/setup-status

   成功标准：返回 JSON，四个通道都是 configured: true。

4) 验证首页：
   http://localhost:8080/

如果 configured: false：重新配置 Replit AI，然后重启 API Server。
如果首页 404：确认运行的是 8080 的 API Server，然后 git pull、pnpm run build、重启 API Server。
不要通过改代码解决搭建问题。
EOF
