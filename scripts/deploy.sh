#!/usr/bin/env bash
set -euo pipefail

# Build and prerender for GitHub Pages.
# Workaround: Nitro v3 static preset is broken with Vite 7,
# so we build normally, start the server, and curl each route.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOCS="$ROOT/docs"
# Use an uncommon port so a running dev server on :3000 can't accidentally
# answer our prerender curls and bake dev-mode HTML into docs/. Regression:
# commit e7f42e6 shipped docs/*.html referencing /src/styles/app.css and
# /@react-refresh because port 3000 was occupied during deploy.
PORT=4173

echo "==> Building..."
cd "$ROOT"
bun run vite build

# Refuse to start if the port is already taken — don't silently scrape
# whoever is sitting on it.
if (echo >/dev/tcp/127.0.0.1/$PORT) 2>/dev/null; then
  echo "!! Port $PORT is already in use. Stop the other process and retry." >&2
  exit 1
fi

echo "==> Starting server on :$PORT..."
PORT=$PORT node .output/server/index.mjs &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null || true" EXIT

# Wait for the server we just started — verify it's still alive AND answering.
for _ in $(seq 1 50); do
  if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "!! Production server exited before becoming ready." >&2
    exit 1
  fi
  curl -sf -o /dev/null "http://localhost:$PORT/" && break
  sleep 0.3
done

# Sanity check: the response must be production HTML, not dev HTML.
# Dev HTML has /@react-refresh or /src/styles/. If we see those, abort before
# overwriting docs/ with broken output.
PROBE="$(curl -sf "http://localhost:$PORT/" || true)"
if printf '%s' "$PROBE" | grep -qE '/@react-refresh|/@id/virtual:|/src/styles/|data-tanstack-router-dev-styles'; then
  echo "!! Server returned dev-mode HTML — refusing to prerender." >&2
  exit 1
fi

# Preserve hand-authored content (e.g. docs/research/) across the rebuild.
PRESERVE_TMP="$(mktemp -d)"
trap "kill $SERVER_PID 2>/dev/null || true; rm -rf \"$PRESERVE_TMP\"" EXIT
for dir in research; do
  [ -d "$DOCS/$dir" ] && cp -r "$DOCS/$dir" "$PRESERVE_TMP/"
done

# Clean and seed with static assets
rm -rf "$DOCS"
cp -r .output/public "$DOCS"

# Restore preserved content
for dir in research; do
  [ -d "$PRESERVE_TMP/$dir" ] && cp -r "$PRESERVE_TMP/$dir" "$DOCS/"
done

# Prerender routes
for route in / /projects/id1 /projects/tension /ui; do
  if [ "$route" = "/" ]; then
    curl -sf "http://localhost:$PORT/" > "$DOCS/index.html"
  else
    mkdir -p "$DOCS$route"
    curl -sf "http://localhost:$PORT$route" > "$DOCS$route/index.html"
  fi
  echo "  $route"
done

# SPA fallback + GitHub Pages config
cp "$DOCS/index.html" "$DOCS/404.html"
echo "quantizor.art" > "$DOCS/CNAME"
touch "$DOCS/.nojekyll"

kill $SERVER_PID 2>/dev/null || true
echo "==> docs/ ready"
