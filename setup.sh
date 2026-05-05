#!/usr/bin/env bash
set -euo pipefail

echo "==> [1/4] 安装依赖"
pnpm install

echo "==> [2/4] 类型检查"
pnpm run typecheck

echo "==> [3/4] 开发环境前置约束自检"
# 开发环境下，门户(Vite, 24927) 与 API Server(Express, 8080) 是两个独立服务。
# 门户用相对路径 /api/* 调后端，必须靠 Vite 的 server.proxy 转发到 8080；
# 否则 Vite 会按 SPA 默认行为返回 index.html，前端 res.json() 报
# "Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON"。
VITE_CONFIG="artifacts/api-portal/vite.config.ts"
if ! grep -q "/modelfarm" "$VITE_CONFIG" || ! grep -q "/api" "$VITE_CONFIG"; then
  echo "!! $VITE_CONFIG 未配置 /api 或 /modelfarm 的 server.proxy" >&2
  echo "!! 请在 server 块中加入：" >&2
  echo "!!   proxy: { '/api': 'http://localhost:8080', '/modelfarm': 'http://localhost:8080' }" >&2
  exit 1
fi
echo "   OK: Vite 代理已配置 /api 和 /modelfarm -> :8080"

cat <<'EOF'

==> [4/4] 后续手动步骤
1) 通过 Replit AI Integrations 配置四个通道（Agent 会自动调用 setupReplitAIIntegrations）：
   - openai     -> AI_INTEGRATIONS_OPENAI_BASE_URL / AI_INTEGRATIONS_OPENAI_API_KEY
   - anthropic  -> AI_INTEGRATIONS_ANTHROPIC_BASE_URL / AI_INTEGRATIONS_ANTHROPIC_API_KEY
   - gemini     -> AI_INTEGRATIONS_GEMINI_BASE_URL / AI_INTEGRATIONS_GEMINI_API_KEY
   - openrouter -> AI_INTEGRATIONS_OPENROUTER_BASE_URL / AI_INTEGRATIONS_OPENROUTER_API_KEY

2) 重启 API Server 工作流以加载新环境变量。

3) 验证（开发环境，经 Vite 代理）：
   curl -fsS http://localhost:24927/api/setup-status

   验证（线上域名，经 Replit 路径路由）：
   curl -fsS https://<你的域名>/api/setup-status

   返回 JSON 中每个通道的 "configured": true 即配置成功。
   若返回的是 HTML（含 <!DOCTYPE），说明 Vite 代理或线上路由有问题。
EOF
