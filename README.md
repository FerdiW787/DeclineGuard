# DeclineGuard

Astro + React + Clerk + Convex. Recovers failed Lemon Squeezy subscription payments with branded email sequences.

## Setup

1. `npm install`
2. Copy env:
   ```bash
   cp .env.example .env.local
   ```
3. Fill Clerk keys (`PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) and Convex URL.
4. `npm run dev` — starts Astro, Convex, and the brand-capture tunnel. Set Convex env:
   - `CLERK_FRONTEND_API_URL` (Clerk Frontend API URL)
   - `CLERK_WEBHOOK_SECRET`
5. In Clerk: JWT template named **`convex`**, webhook → `https://<deployment>.convex.site/clerk` for `user.created` / `user.updated`.

## Flow

Homepage → Sign up → Connect Lemon Squeezy → Import brand → Recoveries dashboard.
