#!/usr/bin/env bash
# Remove the local Cloudflare tunnel URL from Convex DEV.
# Safe to call twice. Survives Ctrl+C process-group teardown.
set +e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MARKER="${TMPDIR:-/tmp}/snattic-brand-capture-url.marker"
LOCK="${MARKER}.lock"

if [[ ! -f "$MARKER" ]]; then
  exit 0
fi

if ! mkdir "$LOCK" 2>/dev/null; then
  exit 0
fi

echo "Removing BRAND_CAPTURE_WORKER_URL from Convex DEV…"

CONVEX="$ROOT/node_modules/.bin/convex"
if [[ -x "$CONVEX" ]]; then
  "$CONVEX" env unset BRAND_CAPTURE_WORKER_URL
else
  npx convex env unset BRAND_CAPTURE_WORKER_URL
fi
status=$?

rm -f "$MARKER"
rmdir "$LOCK" 2>/dev/null

if [[ $status -eq 0 ]]; then
  echo "Removed tunnel URL."
else
  echo "Could not unset BRAND_CAPTURE_WORKER_URL (it may already be gone)."
fi
exit 0
