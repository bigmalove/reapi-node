#!/usr/bin/env bash
set -euo pipefail

echo "==> [1/3] 安装依赖"
pnpm install

echo "==> [2/3] 类型检查"
pnpm run typecheck

cat <<'EOF'


通过 Replit AI Integrations 配置四个 AI 通道
前提：无需自备任何 API Key，费用从 Replit Credits 扣除。
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

