#!/usr/bin/env bash
# Cloud Agent install phase: install dependencies and prepare a local dev env
# that boots without real third-party secrets. Idempotent and safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/.."

# 1. Dependencies.
npm install

# 2. Local dev env file so the Astro/Clerk frontend can boot without real keys.
#    If a real value is supplied as a Cloud Agent secret (env var), it is used;
#    otherwise a valid-format dummy Clerk key lets the app render.
#    `convex dev` (install step 3 / the convex terminal) appends the Convex URLs.
touch .env.local
if ! grep -q '^PUBLIC_CLERK_PUBLISHABLE_KEY=' .env.local; then
  echo "PUBLIC_CLERK_PUBLISHABLE_KEY=${PUBLIC_CLERK_PUBLISHABLE_KEY:-pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk}" >> .env.local
fi
if ! grep -q '^CLERK_SECRET_KEY=' .env.local; then
  echo "CLERK_SECRET_KEY=${CLERK_SECRET_KEY:-sk_test_dummydummydummydummydummydummydummy00}" >> .env.local
fi
# The Astro frontend reads PUBLIC_CONVEX_URL. Seed it so `convex dev` updates this
# var (rather than writing a generic CONVEX_URL the frontend would ignore). The
# local anonymous deployment always serves on 127.0.0.1:3210.
if ! grep -q '^PUBLIC_CONVEX_URL=' .env.local; then
  echo "PUBLIC_CONVEX_URL=http://127.0.0.1:3210" >> .env.local
fi

# 3. Provision the local (anonymous) Convex deployment, set the env var the auth
#    config requires, and push functions once so the backend is ready.
export CONVEX_AGENT_MODE=anonymous
# First push provisions the deployment (writes CONVEX_DEPLOYMENT to .env.local).
# It may warn that CLERK_FRONTEND_API_URL is unset; that is expected here.
npx convex dev --once || true
# Deployment now exists — set the env var the auth config reads, then push cleanly.
npx convex env set CLERK_FRONTEND_API_URL \
  "${CLERK_FRONTEND_API_URL:-https://example.clerk.accounts.dev}"
npx convex dev --once

echo "Cloud Agent install complete."
