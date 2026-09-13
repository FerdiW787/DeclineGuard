#!/usr/bin/env bash
# Cloud Agent terminal: run the local (anonymous) Convex backend + function watcher.
# Re-provisions and re-pushes on every boot, so it works even when the local
# deployment data (./.convex) was not carried over from a snapshot.
set -euo pipefail
cd "$(dirname "$0")/.."

export CONVEX_AGENT_MODE=anonymous

# Provision the local deployment first (idempotent; re-creates it if ./.convex was
# not carried over from a snapshot). This initial push may warn that the auth env
# var is unset — expected on a fresh deployment.
npx convex dev --once || true

# The auth config reads CLERK_FRONTEND_API_URL from the deployment; set it now
# that the deployment exists, then hand off to the watcher.
npx convex env set CLERK_FRONTEND_API_URL \
  "${CLERK_FRONTEND_API_URL:-https://example.clerk.accounts.dev}" || true

exec npx convex dev
