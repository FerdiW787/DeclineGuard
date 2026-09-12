# DeclineGuard — MVP readiness roadmap

Deep-dive of the current product vs what is required to launch a credible founding-store MVP. Based on the codebase as of mid‑2026 (Astro + Clerk + Convex + Resend + Lemon Squeezy).

---

## 1. Recommended MVP definition

**MVP = a Lemon Squeezy merchant can sign up, connect a store, receive failed-payment webhooks, automatically send a 3‑email recovery sequence that looks like their brand, see recoveries in a dashboard, and (for Free) you can collect the 10% recovery fee somehow.**

Everything else (Pro billing, custom sequences, CSV export, multi-store polish, marketing polish) can ship after first paying / founding users validate the core loop.

### In scope for MVP launch

| Capability | Status today |
| --- | --- |
| Auth (sign up / sign in / Google SSO) | Working |
| Connect Lemon Squeezy via API key | Working |
| Webhooks: fail + recover | Working |
| Day 0 → 2 → 5 recovery emails (Resend) | Working (needs production From domain) |
| Brand / footer customizations | Working (UI + persistence) |
| Dashboard: overview, recoveries, sequences preview, settings | Working (mostly read-only / preview for sequences) |
| Free-tier DeclineGuard footer badge | Hardcoded on (billing not wired) |
| Collect 10% on Free recoveries | **Missing** |
| Pro upgrade (€8.99, 0% fee, no badge) | **Missing** (UI stubs only) |
| Email volume / store limits | **Missing** (marketed, not enforced) |
| Legal pages, support channel, ops runbooks | **Missing / thin** |

---

## 2. What already works (concrete)

### Auth & accounts
- Clerk custom sign-up / sign-in (`src/components/auth/*`), SSO callback.
- Clerk → Convex user sync via `/clerk` webhook (`convex/clerk.ts`).
- Dashboard gated on signed-in + LS connected.

### Lemon Squeezy connection
- Encrypt API key (`LS_TOKEN_ENCRYPTION_KEY`), store connection + store bindings.
- Multi-store pick at connect time; sidebar store list on connection.
- Disconnect mutation exists.
- Onboarding simplified to: **link → wiring animation → dashboard** (`LsSetupFlow.tsx`). Defaults saved for brand + template.

### Webhooks
- `POST /lemonsqueezy` with HMAC verification (`LEMONSQUEEZY_WEBHOOK_SECRET`).
- Idempotency via `lemonWebhookEvents`.
- Handles `subscription_payment_failed` and `subscription_payment_recovered`.
- Extracts `update_payment_method` URL for CTAs.
- Unbound stores ack 200 (no infinite LS retries).
- Docs: `docs/lemon-squeezy-webhooks.md`.

### Recovery sequence
- Day 0 immediate → Day 2 → Day 5 via Convex scheduler.
- Idempotent per step; cancel jobs on recover; restart on new invoice.
- Fast mode for local testing (`RECOVERY_SEQUENCE_FAST`).
- Docs + simulate script: `docs/recovery-emails.md`, `scripts/simulate-ls-payment-failed.mjs`.

### Email product
- HTML + text templates with brand colors, socials, support, store name/logo (`convex/lib/recoveryEmailTemplate.ts`).
- From display name + Reply-To from Settings.
- Production vs test From detection in Settings UI.
- Customizations page live-previews and saves.

### Dashboard product surface
- Overview hub (KPIs, chart, open failures, activity, deep links).
- Recoveries page (open list + history + chart).
- Sequences page (read-only default flow + email preview).
- Customizations (colors, support, socials).
- Settings (webhook credentials, sender, appearance, disconnect).
- Dark-first UI; marketing homepage already dark.

### Marketing
- Landing page with pricing narrative (Free 10% / Pro €8.99), FAQ, CTAs.
- Welcome intro on `/?welcome=true`.

---

## 3. Gaps — prioritized

### P0 — Blockers for a real founding launch

These must be true before inviting merchants who will rely on you with live money.

#### P0.1 — Monetization for Free (10% per recovery)
**Problem:** Homepage and sign-up promise “10% only when we recover.” There is **no** schema field, job, or Stripe/LS billing path that charges merchants after a recovery.

Evidence:
- `planTier = "Free"` hardcoded in `Dashboard.tsx`.
- `showDeclineGuardBadge = true` hardcoded in `recoveryEmails.ts` (“until billing lands”).
- “Get Pro” / “Upgrade” buttons do nothing.

**MVP options (pick one):**
1. **Manual / invoice for founding cohort** — track recoveries, invoice monthly offline; document the process. Fastest, ugly.
2. **Stripe Invoice / PaymentIntent after each recovery** (or weekly batch) — proper automation.
3. **Lemon Squeezy as your own store** — sell Pro + somehow bill Free fees (awkward for % fees).

**Ship criteria:** After a `subscription_payment_recovered` event, you either (a) create a charge/invoice for 10% of recovered amount, or (b) log a `recoveryFees` row and have an ops path that bills it within X days — with merchant visibility (“Fees owed this month”).

#### P0.2 — Production email (verified domain)
**Problem:** Without `RESEND_FROM_EMAIL` on a verified domain, Resend only delivers to the account owner. Merchants’ customers will not get mail.

**Ship criteria:**
- Domain verified in Resend.
- `RESEND_API_KEY` + `RESEND_FROM_EMAIL` set on **production** Convex.
- End-to-end test: fail a real/test-mode renewal → customer inbox receives Day 0 with correct From / Reply-To.
- Settings clearly shows Production vs Test; block or loudly warn if still on `onboarding@resend.dev` when `testMode === false` on the LS connection.

#### P0.3 — Production Convex + app deploy
**Problem:** No `vercel.json` / deploy docs in-repo; no evidence of production env checklist beyond scattered docs.

**Ship criteria:**
- Production Convex deployment with all secrets (see §6).
- Astro app on Vercel (or similar) with Clerk production keys, `PUBLIC_CONVEX_URL`, correct redirect URLs.
- Clerk production instance + webhook to production `/clerk`.
- LS webhook pointing at production `.convex.site/lemonsqueezy`.
- Smoke script runbook after deploy.

#### P0.4 — Webhook & connect reliability under merchant setup mistakes
**Problem:** Merchants must manually create the LS webhook. Easy to misconfigure (wrong secret, missing events, wrong URL). Failures fail open from their POV (dashboard empty).

**Ship criteria:**
- First-run checklist in Settings / empty Overview: “Webhook not verified yet” until first successful event (or a signed ping).
- Optional: “Send test event” instructions + last webhook received timestamp.
- Clear error if `LEMONSQUEEZY_WEBHOOK_SECRET` missing (already logs 500).

#### P0.5 — Support + trust basics
**Problem:** No privacy policy, terms, imprint, or support email path beyond product copy.

**Ship criteria (minimum for EU/SaaS):**
- `/privacy` and `/terms` (even if short).
- Public support email (and Reply-To guidance for merchants).
- Status / “what we store” note (API keys encrypted, no card data).

---

### P1 — Important for MVP quality (ship with or immediately after P0)

#### P1.1 — Wire Free badge + plan model for real
- Add `plan: "free" | "pro"` (and maybe `founding`) on `users` or a `billing` table.
- Drive `showDeclineGuardBadge` from plan (not hardcoded `true`).
- Drive sidebar “Free” / “Get Pro” from the same source.
- Enforce: Free always shows badge; Pro removes it.

#### P1.2 — Enforce marketed limits (or change the marketing)
Homepage promises:
- Free: 1 store, 50 recovery emails / month, DeclineGuard footer, 10% fee.
- Pro: up to 3 stores, 150 emails / month, no badge, 0% fee, CSV.

Today: **none of this is enforced**.

Minimum for MVP honesty:
- Either implement Free caps (1 active connection / store, 50 emails/month with a clear “limit reached” state), **or** soften homepage copy to “fair-use founding” until metering ships.
- Prefer soft cap + warning for founding MVP if metering is hard; never promise hard numbers you don’t enforce.

#### P1.3 — Pro checkout (even if fee automation lags)
- “Get Pro” / Sequences “Upgrade” must open a real checkout (Stripe Checkout or LS product).
- Webhook / success path sets `plan = "pro"`.
- Cancel / past_due handling.

#### P1.4 — Observability for the money path
- Alert on Resend failures (today: `console.error` only — email silently skipped).
- Alert on webhook signature failures spike.
- Dashboard or admin view: emails sent / failed last 24h.
- Consider Sentry (or Convex logs + a simple Slack webhook) for production actions.

#### P1.5 — Empty / error states for the critical path
- Overview when webhook never received: guided setup, not a blank “waiting” forever.
- Resend misconfiguration: surface in Settings (partially there) and Overview banner.
- Recoveries: no CTA to open customer billing URL from the table (URL is stored — use it).

#### P1.6 — Dark mode consistency on dashboard chrome
- Several shell pieces still assume light (mobile top bar `bg-white`, some KPI cards, disconnect menus). Not a launch blocker, but hurts the “dark product” story you’re shipping.

#### P1.7 — Remove / quarantine non-product surface
- Schema still has `pixelPaints` + `paintings` functions / editor routes (`/a/editor`, `/a/generate`, `dev/generate-preview`). Noise for MVP; hide routes or delete before launch to reduce attack surface and confusion.

#### P1.8 — Testing
- **Zero** automated tests in repo.
- Minimum: scripted e2e of webhook → email (you have simulate scripts — wrap in CI with Convex test deploy or documented manual QA checklist).
- Unit-test signature verification + sequence scheduling edge cases if time allows.

---

### P2 — Post-MVP / Pro differentiators

| Item | Notes |
| --- | --- |
| Custom sequences (copy + timing) | UI teases Pro; no data model for custom steps |
| CSV export | Marketed on Pro; not implemented |
| Multi-store polish | Partial (bindings + picker); claiming exclusivity exists — UX for “add store” / switch active store needs product pass |
| Per-merchant webhook secrets | Today one global `LEMONSQUEEZY_WEBHOOK_SECRET` — fine for MVP if every merchant pastes the same secret from Settings; later isolate |
| Deliverability (SPF/DKIM alignment, bounce handling) | Domain verify is P0; bounce webhooks / suppression list is P2 |
| Customer preference / unsubscribe | Not present; may be legally wise for EU |
| Rate limiting on public HTTP | Convex + Clerk help; still consider abuse on connect action |
| i18n / non-EUR copy | Templates are English; amounts use invoice currency |
| Mobile nav polish | Works; not as refined as desktop |
| Welcome / marketing A11y & SEO | Meta exists; no sitemap/og images audit |
| Admin console | No internal tools for support to inspect a merchant |

---

## 4. Architecture snapshot (for planning)

```
Merchant browser (Astro)
  → Clerk auth
  → Convex queries/mutations (dashboard)
Lemon Squeezy
  → HTTPS webhook → Convex /lemonsqueezy
  → upsert failure → schedule recoveryEmails action
  → Resend API → customer inbox
On recover
  → cancel scheduled jobs + activity
  → (MISSING) fee / billing hook
```

**Env surface (production):**

| Variable | Where | Purpose |
| --- | --- | --- |
| `CLERK_*` / publishable keys | Astro + Clerk | Auth |
| `CLERK_WEBHOOK_SECRET` | Convex | User sync |
| `CLERK_FRONTEND_API_URL` | Convex auth config | JWT validation |
| `LS_TOKEN_ENCRYPTION_KEY` | Convex | Encrypt LS API keys |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Convex (+ pasted into LS) | Verify webhooks |
| `RESEND_API_KEY` | Convex | Send mail |
| `RESEND_FROM_EMAIL` | Convex | Production From |
| `RECOVERY_SEQUENCE_FAST` | Convex | **Must be unset in prod** |
| `PUBLIC_CONVEX_URL` / deploy URL | Astro | Client |

---

## 5. Phased roadmap

### Phase A — “First merchant can recover” (1–2 weeks if focused)

Goal: one founding store on production, live fail → 3 emails → recover → visible in dashboard.

1. Production deploy (Convex + Astro + Clerk prod).
2. Resend domain verified + `RESEND_FROM_EMAIL`.
3. Unset `RECOVERY_SEQUENCE_FAST` on prod.
4. End-to-end test with LS test mode, then one live store.
5. Settings checklist + “last webhook at” / empty states.
6. Privacy + Terms + support email.
7. Hide painting/editor routes.
8. Manual fee tracking spreadsheet or simple `recoveryFees` table + monthly invoice process (document in ops runbook).

**Exit:** You can demo a real recovery on a founding store without shame.

### Phase B — “Founding Free is honest” (2–4 weeks)

Goal: product matches Free marketing enough that you won’t get angry emails.

1. Plan field on user; badge driven by plan.
2. Soft or hard email/month + store caps with UI.
3. Fee ledger: on recover, insert `fees` row (amount, currency, status). Merchant “Billing” stub page listing owed fees.
4. Automate fee collection (Stripe) **or** keep manual invoices with clear “you owe €X” UI.
5. Basic alerting (Resend failures, webhook errors).
6. QA checklist + simulate scripts in `docs/ops.md`.

**Exit:** 5–20 founding stores can run without you babysitting every email.

### Phase C — “Pro is real” (parallel or after B)

1. Stripe (or LS) Checkout for €8.99/mo.
2. Webhook → `plan = pro`; remove badge; stop accruing 10% fees.
3. Upgrade buttons wired everywhere.
4. Cancellation / grace period.

**Exit:** Homepage Pro CTA is not a lie.

### Phase D — Differentiation (post-MVP)

1. Custom sequences (schema + editor).
2. CSV export.
3. Bounce/complaint handling.
4. Per-tenant webhook secrets if needed.
5. Automated tests in CI.
6. Admin support tools.

---

## 6. Suggested MVP “definition of done” checklist

### Product loop
- [ ] Sign up → connect LS → Settings shows webhook URL + secret
- [ ] Merchant creates LS webhook with both payment events
- [ ] Failed renewal creates open failure + Day 0 email in customer inbox
- [ ] Day 2 / Day 5 fire on schedule (prod delays, not fast mode)
- [ ] Recovery marks failure recovered, cancels pending emails, updates KPIs
- [ ] Customizations change CTA color / footer in the next email
- [ ] Settings From name + Reply-To appear on the message

### Business
- [ ] Free plan badge present on emails
- [ ] Recovered € tracked; fee amount computable (even if billed manually)
- [ ] Documented founding terms (10%, what counts as recoverable, payout timing)

### Trust & ops
- [ ] Privacy + Terms live
- [ ] Support inbox monitored
- [ ] Production env checklist completed; `RECOVERY_SEQUENCE_FAST` off
- [ ] Runbook: rotate LS webhook secret, rotate encryption key, revoke merchant

### Explicitly **not** required for MVP DoD
- [ ] Custom sequence editor
- [ ] CSV export
- [ ] Self-serve Pro (nice if ready; not required if founding is invite-only Free)
- [ ] Pixel/paint features
- [ ] Perfect mobile polish

---

## 7. Risks & unknowns

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Deliverability | Recovery email in spam = product failure | Verified domain, warm carefully, monitor Resend |
| Silent Resend failures | Webhook succeeds, customer never emailed | Treat non-OK Resend as alertable; retry queue |
| Global webhook secret | All merchants share one secret in Settings | OK for founding; document; isolate later |
| Fee collection friction | 10% model needs trust + automation | Start founding + invoice; automate in Phase B |
| LS payload variance | Missing `update_payment_method` falls back to generic URL | Log when missing; test across LS versions |
| Over-promised limits | Marketing lists caps you don’t enforce | Soften copy or enforce before public launch |
| Schema leftovers (`pixelPaints`) | Confusion / dead code | Delete or feature-flag before launch |
| No tests | Regressions in sequence/idempotency are costly | At least scripted QA + one CI smoke |

---

## 8. Workstream map (who/what)

| Workstream | P0 tasks | Owner hint |
| --- | --- | --- |
| **Infra** | Prod Convex, Vercel, Clerk prod, secrets | You / DevOps |
| **Email** | Domain, From, deliverability test | You |
| **Billing** | Fee ledger + invoice path; later Stripe | You |
| **Product** | Empty states, checklist, wire Get Pro later | Frontend |
| **Legal** | Privacy, Terms, founding agreement blurb | You / counsel |
| **Ops** | Runbook, support alias, alert webhook | You |

---

## 9. File reference (gaps ↔ code)

| Gap | Where it shows up |
| --- | --- |
| Hardcoded Free plan | `src/components/dashboard/Dashboard.tsx` (`planTier = "Free"`) |
| Hardcoded badge | `convex/functions/recoveryEmails.ts` (`showDeclineGuardBadge = true`) |
| Dead Upgrade CTAs | `Dashboard.tsx` “Get Pro”; `SequencesPage.tsx` “Upgrade” |
| No fee tables | `convex/schema.ts` — no billing/fees |
| Sequence not editable | `SequencesPage.tsx` — preview only; copy locked to Day 0/2/5 |
| Onboarding no longer sets brand/template UI | `LsSetupFlow.tsx` — defaults only; Customizations is the real editor |
| Legacy paint product | `convex/schema.ts` `pixelPaints`; `convex/functions/paintings.ts`; `/a/editor`, `/a/generate` |
| Docs today | `docs/lemon-squeezy-webhooks.md`, `docs/recovery-emails.md` only |

---

## 10. Bottom line

The **technical core of recovery is unusually complete for a pre-billing MVP**: connect → webhook → sequenced Resend emails → dashboard visibility is real and documented.

What is **not** MVP-ready is the **business shell around it**: production email domain, production deploy discipline, fee collection for the Free promise, plan/limit honesty, legal pages, and operational alerting.

**Fastest honest launch path:** Phase A with manual founding fee invoicing + verified Resend domain + production deploy + legal stubs — then Phase B/C before opening the homepage “Grab a founding spot” to a wide audience.
