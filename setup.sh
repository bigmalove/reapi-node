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

如果 configured: false：重新配置 Replit AI，然后重启 API Server。
如果首页 404：确认运行的是 8080 的 API Server，然后 git pull、pnpm run build、重启 API Server。
不要通过改代码解决搭建问题。
EOF
