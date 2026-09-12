#!/usr/bin/env bash
# Run local Playwright worker + Cloudflare quick tunnel, then wire Convex DEV.
#
# Usage (from repo root):
#   npm run dev                      # Astro + Convex + this tunnel
#   bash scripts/brand-capture-tunnel.sh   # tunnel only
#
# Ctrl+C unsets BRAND_CAPTURE_WORKER_URL automatically.
# Do NOT point production at trycloudflare.com — URLs die when the tunnel closes.

set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-8787}"
SECRET="${BRAND_CAPTURE_WORKER_SECRET:-dev}"
export BRAND_CAPTURE_WORKER_SECRET="$SECRET"
# Local tunnel helper — do not force REQUIRE_SECRET (secret still enforced if set)
unset REQUIRE_SECRET || true
export NODE_ENV="${NODE_ENV:-development}"

LOG="$(mktemp -t brand-tunnel.XXXXXX.log)"
MARKER="${TMPDIR:-/tmp}/snattic-brand-capture-url.marker"
WORKER_PID=""
TUNNEL_PID=""
CLEANED=0

run_unset() {
  local helper="scripts/unset-brand-capture-url.sh"
  if command -v setsid >/dev/null 2>&1; then
    # New session so Convex's process-group SIGTERM cannot cancel the unset.
    setsid bash "$helper"
  else
    bash "$helper"
  fi
}

cleanup() {
  if [[ "$CLEANED" -eq 1 ]]; then
    return
  fi
  CLEANED=1
  trap '' INT TERM
  echo ""
  echo "Stopping worker + tunnel…"
  run_unset
  if [[ -n "${WORKER_PID}" ]]; then
    kill "${WORKER_PID}" 2>/dev/null || true
  fi
  if [[ -n "${TUNNEL_PID}" ]]; then
    kill "${TUNNEL_PID}" 2>/dev/null || true
  fi
  wait "${WORKER_PID}" 2>/dev/null || true
  wait "${TUNNEL_PID}" 2>/dev/null || true
  rm -f "$LOG"
}
trap cleanup EXIT INT TERM

echo "Starting brand-capture worker on :$PORT …"
npm run brand-capture-worker &
WORKER_PID=$!

# Wait for health
for _ in $(seq 1 40); do
  if curl -fsS -m 1 "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done
curl -fsS -m 2 "http://127.0.0.1:${PORT}/health" >/dev/null

echo "Starting Cloudflare quick tunnel…"
npx cloudflared tunnel --url "http://127.0.0.1:${PORT}" >"$LOG" 2>&1 &
TUNNEL_PID=$!

URL=""
for _ in $(seq 1 60); do
  URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | head -1 || true)"
  if [[ -n "$URL" ]]; then
    break
  fi
  sleep 0.5
done

if [[ -z "$URL" ]]; then
  echo "Could not parse tunnel URL. Log:"
  cat "$LOG"
  exit 1
fi

echo ""
echo "Tunnel:  $URL"
echo "Secret:  $SECRET"
echo ""
echo "Wiring Convex DEV…"
printf '%s\n' "$URL" >"$MARKER"
npx convex env set BRAND_CAPTURE_WORKER_URL "$URL"
npx convex env set BRAND_CAPTURE_WORKER_SECRET "$SECRET"

echo ""
echo "Ready. Leave this running while you test brand import / onboarding."
echo "Ctrl+C to stop — the tunnel URL is removed from Convex DEV automatically."
echo ""

wait
