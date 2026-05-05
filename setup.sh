#!/usr/bin/env bash
set -euo pipefail

echo "==> [1/3] 安装依赖"
pnpm install

echo "==> [2/3] 类型检查"
pnpm run typecheck

cat <<'EOF'

==> [3/3] 后续手动步骤
1) 通过 Replit AI Integrations 配置四个通道（Agent 会自动调用 setupReplitAIIntegrations）：
   - openai     -> AI_INTEGRATIONS_OPENAI_BASE_URL / AI_INTEGRATIONS_OPENAI_API_KEY
   - anthropic  -> AI_INTEGRATIONS_ANTHROPIC_BASE_URL / AI_INTEGRATIONS_ANTHROPIC_API_KEY
   - gemini     -> AI_INTEGRATIONS_GEMINI_BASE_URL / AI_INTEGRATIONS_GEMINI_API_KEY
   - openrouter -> AI_INTEGRATIONS_OPENROUTER_BASE_URL / AI_INTEGRATIONS_OPENROUTER_API_KEY

2) 重启 API Server 工作流以加载新环境变量。

3) 验证：
   curl -fsS http://localhost:8080/api/setup-status

   或线上域名：
   curl -fsS https://<你的域名>/api/setup-status

   返回 JSON 中每个通道的 "configured": true 即配置成功。

4) 浏览器打开 http://localhost:8080/ 可查看节点状态与接入文档页面。
EOF
