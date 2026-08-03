#!/usr/bin/env bash
set -euo pipefail

# Build and prerender for GitHub Pages.
# Workaround: Nitro v3 static preset is broken with Vite 7,
# so we build normally, start the server, and curl each route.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOCS="$ROOT/docs"
# A port nothing else defaults to. Not 4173: that is Vite's `preview` default,
# and any other project previewing on it competes for this deploy. An occupied
# prerender port is how dev-mode HTML ends up baked into docs/.
PORT=45173

echo "==> Building..."
cd "$ROOT"
bun run vite build

# Prerendering trusts whatever answers on $PORT, so the two guards below decide
# whether docs/ is this app's output or a stranger's. Liveness alone cannot tell
# them apart: Nitro binds the IPv6 wildcard while a `vite preview` binds IPv4
# 127.0.0.1, so both listen on one port number without EADDRINUSE, our server
# stays alive and listening, and `localhost` resolution decides which one the
# curls reach. A "is this dev HTML" probe cannot tell them apart either, since
# another project's preview build is production-shaped HTML.

# Pin the bind to a single address, and curl that exact address. With no
# `localhost` indirection there is one socket in play, so a squatter on the
# port makes our own server fail loudly instead of hiding behind it.
BIND_HOST=127.0.0.1
BASE="http://$BIND_HOST:$PORT"

# Every HTML this script keeps must carry this marker. TanStack Start emits the
# stream-barrier script only when this app server-rendered the response, so a
# foreign server answering on $PORT cannot forge it. This is the load-bearing
# gate: the port checks can be fooled, the rendered body cannot.
MARKER='$tsr-stream-barrier'

# Refuse to start if the port is already taken — don't silently scrape
# whoever is sitting on it.
if (echo >/dev/tcp/$BIND_HOST/$PORT) 2>/dev/null; then
  echo "!! Port $PORT is already in use. Stop the other process and retry." >&2
  exit 1
fi

# Nitro reads NITRO_HOST || HOST for its bind address (.output/server/index.mjs).
echo "==> Starting server on $BIND_HOST:$PORT..."
HOST="$BIND_HOST" NITRO_HOST="$BIND_HOST" PORT="$PORT" node .output/server/index.mjs &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null || true" EXIT

# True if the process listening on $PORT is the child we just spawned. Catches
# a server that died or never bound; does not by itself prove our server is the
# one answering, which is the marker check's job.
owns_port() {
  lsof -nP -a -p "$SERVER_PID" -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1
}

for _ in $(seq 1 50); do
  owns_port && curl -sf -o /dev/null "$BASE/" && break
  sleep 0.3
done

if ! owns_port; then
  LISTENER="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | tail -n +2 || true)"
  echo "!! Our server (pid $SERVER_PID) is not listening on :$PORT." >&2
  if [ -n "$LISTENER" ]; then
    echo "   Something else holds the port:" >&2
    printf '   %s\n' "$LISTENER" >&2
  else
    echo "   It exited before becoming ready. Run '.output/server/index.mjs' by hand to see why." >&2
  fi
  exit 1
fi

# Fetch a route, verify the body is our own server-rendered HTML, and only then
# hand it back. Any failure aborts before docs/ is touched.
fetch_route() {
  local route="$1" dest="$2" body
  body="$(curl -sf "$BASE$route")" || {
    echo "!! $route did not return 200." >&2
    return 1
  }
  if ! printf '%s' "$body" | grep -qF "$MARKER"; then
    echo "!! $route is missing the SSR marker '$MARKER' — refusing to prerender." >&2
    echo "   Got: $(printf '%s' "$body" | grep -o '<title>[^<]*</title>' | head -1)" >&2
    return 1
  fi
  if printf '%s' "$body" | grep -qE '/@react-refresh|/@id/virtual:|/src/styles/|data-tanstack-router-dev-styles'; then
    echo "!! $route returned dev-mode HTML — refusing to prerender." >&2
    return 1
  fi
  printf '%s' "$body" > "$dest"
}

# Prerender into a staging tree first. docs/ is replaced only after every route
# passes, so an abort halfway through can't leave a half-broken site behind.
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/art-prerender.XXXXXX")"
trap "kill $SERVER_PID 2>/dev/null || true; rm -rf '$STAGE'" EXIT

# Seed with static assets. Hand-authored research lives under research/ at the
# repo root, not under docs/.
cp -r .output/public "$STAGE/site"

for route in / /projects/id1 /projects/tension /ui; do
  if [ "$route" = "/" ]; then
    fetch_route / "$STAGE/site/index.html"
  else
    mkdir -p "$STAGE/site$route"
    fetch_route "$route" "$STAGE/site$route/index.html"
  fi
  echo "  $route"
done

# SPA fallback + GitHub Pages config
cp "$STAGE/site/index.html" "$STAGE/site/404.html"
echo "quantizor.art" > "$STAGE/site/CNAME"
touch "$STAGE/site/.nojekyll"

rm -rf "$DOCS"
mv "$STAGE/site" "$DOCS"

kill $SERVER_PID 2>/dev/null || true
echo "==> docs/ ready"
