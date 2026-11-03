#!/usr/bin/env bash
# AgentForge Local — build: compila o daemon (single binary) e copia a UI
set -euo pipefail
cd "$(dirname "$0")/.."

BUN="${BUN:-bun}"
command -v "$BUN" >/dev/null || BUN="/home/z/my-project/.tools/bun-linux-x64/bun"

echo "→ typecheck..."
"$BUN" build src/index.ts --compile --minify --outfile dist/agentforge-local
echo "→ copiando UI..."
rm -rf dist/web
cp -r web dist/web
echo "→ pronto: dist/agentforge-local ($(du -h dist/agentforge-local | cut -f1)) + dist/web"
