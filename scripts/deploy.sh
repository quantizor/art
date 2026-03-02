#!/usr/bin/env bash
set -euo pipefail

# Build and prerender for GitHub Pages.
# Workaround: Nitro v3 static preset is broken with Vite 7,
# so we build normally, start the server, and curl each route.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOCS="$ROOT/docs"

echo "==> Building..."
cd "$ROOT"
bun run vite build

echo "==> Starting server..."
node .output/server/index.mjs &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null || true" EXIT

# Wait for server
for _ in $(seq 1 30); do
  curl -sf -o /dev/null http://localhost:3000/ && break
  sleep 0.3
done

# Clean and seed with static assets
rm -rf "$DOCS"
cp -r .output/public "$DOCS"

# Prerender routes
for route in / /projects/id1 /projects/tension /ui; do
  if [ "$route" = "/" ]; then
    curl -sf http://localhost:3000/ > "$DOCS/index.html"
  else
    mkdir -p "$DOCS$route"
    curl -sf "http://localhost:3000$route" > "$DOCS$route/index.html"
  fi
  echo "  $route"
done

# SPA fallback + GitHub Pages config
cp "$DOCS/index.html" "$DOCS/404.html"
echo "quantizor.art" > "$DOCS/CNAME"
touch "$DOCS/.nojekyll"

kill $SERVER_PID 2>/dev/null || true
echo "==> docs/ ready"
