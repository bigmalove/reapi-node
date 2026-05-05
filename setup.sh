#!/usr/bin/env bash
set -euo pipefail

echo "==> [1/3] 安装依赖"
pnpm install

echo "==> [2/3] 类型检查"
pnpm run typecheck

cat <<'EOF'
