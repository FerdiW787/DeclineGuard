#!/usr/bin/env bash
# Started by `npx convex dev --start` after the first successful Convex push.
# Runs Astro plus the local Playwright worker + Cloudflare quick tunnel.
set -euo pipefail
cd "$(dirname "$0")/.."

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
  echo "Stopping Astro and brand-capture tunnel…"
  if [[ -n "${TUNNEL_PID}" ]]; then
    kill "${TUNNEL_PID}" 2>/dev/null || true
    wait "${TUNNEL_PID}" 2>/dev/null || true
  fi
  run_unset
}
trap cleanup EXIT INT TERM

echo ""
echo "Starting brand-capture tunnel (Playwright worker + Cloudflare)…"
bash scripts/brand-capture-tunnel.sh &
TUNNEL_PID=$!

echo "Starting Astro…"
astro dev
