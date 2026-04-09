#!/bin/sh
set -e

# Inject HLS_MANIFEST_URL into player.js at runtime
# This replaces the placeholder so the CDN URL is configurable via env var
MANIFEST_URL="${HLS_MANIFEST_URL:-}"

if [ -n "$MANIFEST_URL" ]; then
  # Write a small config script that sets the global variable
  cat > /usr/share/nginx/html/config.js <<EOF
window.__HLS_MANIFEST_URL__ = '${MANIFEST_URL}';
EOF
  # Inject config.js into index.html before player.js
  sed -i 's|<script src="player.js">|<script src="config.js"></script><script src="player.js">|' \
    /usr/share/nginx/html/index.html
fi

exec nginx -g "daemon off;"
