# DeclineGuard — Pre-Launch Checklist

**Repo:** `FerdiW787/DeclineGuard`  
**Baseline:** `main` @ `fe675d3` (as of 2026-09-14)  
**Owner:** Fendem · **Coordinator:** Chief of Staff  
**Sources:** Riley (BE), Jules (FE), Ash (Security) lane checklists  
**Implementation notes:** [docs/DeclineGuard-LAUNCH-IMPL.md](DeclineGuard-LAUNCH-IMPL.md)

---

## How to use this doc

| Priority | Meaning |
|---|---|
| **P0** | Ship-blocker — do not put live merchants on the product without this |
| **P1** | Strongly recommended before public launch |
| **P2** | Should / polish — can slip post-MVP if needed |

| Owner | Meaning |
|---|---|
| **Fendem** | Only you can do this (billing, Clerk dashboard, legal, env, LS store re-install) |
| **Riley** | Backend (Convex / webhooks / APIs) — FULL gate unless noted |
| **Jules** | Frontend — LEAN unless fee-copy can lie (then FULL) |
| **Ash** | Security review on FULL diffs; spot-check LEAN in digest |

**Ship gate (locked):**  
- **FULL** = Nix → Ash → Sha (money / auth / webhooks / secrets)  
- **LEAN** = Nix → Sha (docs / UI polish)  
- Merges batch weekdays **09:30** Europe/Vienna (URGENT escape for live security/payment breaks)

**Current blocker:** Cursor cloud-agent usage exhausted — code items below wait on Fendem enabling usage/on-demand unless done by hand.

---

## Already on `main` (do not redo)

### Platform / CI
| Item | PR / evidence |
|---|---|
| `.env.example` | #2 |
| CI typecheck + `PUBLIC_`/`VITE_` + SECRET\|API_KEY scan | #3 |

### Recovery engine & payments policy
| Item | PR / evidence |
|---|---|
| Preview recipient = identity email + rate limits | #5 |
| Day‑0 fee gate (`day0SentAt` null → $0 fee) | #6 |
| `subscription_updated` required on **new** LS webhook install | #7 |
| Plan-aware fees Free 10% / Pro 4%; `users.plan`; ops invoiced/waived (Staff/Admin only) | #8 |
| LS dual-secret + atomic claim/release | #9 |
| `sequence_stopped` + richer recovered activity | #10 |
| Resend 429/quota → `resend_quota_blocked` audit + `lastEmailError` (no retry storm) | #12 |
| Merchant Retry API `retryFailedPayment({ failureId })` — ownership + https sanitize | #13 |
| Engine: attempt‑1 wait (no stack on LS fail email); recover cancels Day‑2/5; lifecycle stop when webhook has the event | recoveries + lemonWebhook |
| Clerk roles from `private_metadata` only (not public) | `convex/clerk.ts` |

### Frontend
| Item | PR / evidence |
|---|---|
| Recoveries skeletons + a11y + in-app legal links | #4 |
| Pro upgrade CTAs → “Coming soon”; OverviewHub fees; BillingTab uses `PLANS.free` % | #11 |
| Activity UI for `sequence_stopped` + `retry_requested` | #10, #13 |
| Sequences preview labeled; Update payment https link | RecoveriesPage |
| Marketing pricing from `src/lib/pricing.ts` | PricingPage |

### Security posture (assessed good)
- LS / Clerk / Resend: verify-then-parse  
- LS API keys encrypted at rest; client gets publishable/URL only  
- Merchant retry: `failureId` only + ownership  
- Ops fee waive: Staff/Admin only (no merchant self-waive)

---

## P0 — Must before live merchants

### A. Fendem only (ops / product / legal)

| # | Item | Why | Done when |
|---|---|---|---|
| F1 | **Re-install / refresh LS webhooks** on every **existing** store | Settings → Webhooks now has Refresh + `subscription_updated`; still click once per live store | All live stores list `subscription_updated` |
| F2 | **Resend → Pro** (or equivalent paid tier) | Free = 100/day; sequences die silently at scale (ops signal exists, capacity does not) | Paid plan active; no daily 100 cap |
| F3 | **Prod Convex:** `RECOVERY_SEQUENCE_FAST` **unset** | Code ignores fast mode when `CONVEX_DEPLOYMENT` is `prod:`; still unset the env | Env confirmed empty/absent in prod |
| F4 | **Clerk Dashboard:** `private_metadata.role` **admin-only** | Code trusts this for Staff/Admin | No user-editable path to staff/admin |
| F5 | **Set attribution window (30 days)** | **Done in code** — Terms + fee ledger skip recoveries after 30 days from Day-0 | Number in Terms + engine |
| F6 | **Fill `src/lib/legal.ts` + Privacy retention / DPO / authority placeholders** | Impressum/Privacy/DPA show `[PLACEHOLDER]` junk — **deferred** until entity details | Legal pages show real entity data |
| F7 | **Enable Cursor usage / on-demand** | Riley/Jules blocked from next FULL/LEAN cloud work | Agents can launch again |

### B. Engineering (after F7)

| # | Item | Owner | Gate | Notes |
|---|---|---|---|---|
| E1 | **Recoveries Retry CTA** — wire button to `retryFailedPayment({ failureId })` | Jules | LEAN | **Done** — Case panel “Retry payment link” |
| E2 | **Expose merchant `plan` + fee %** on product query (e.g. `getCurrentUser`) | Riley | FULL | **Done** — read-only `plan` + `recoveryFeePercent` |
| E3 | **BillingTab / OverviewHub use real plan fee %** | Jules | LEAN→FULL if fee-lying | **Done** — driven from `getCurrentUser` |
| E4 | **`listRecentRecovered` include `feeCents`** | Riley | LEAN/FULL | **Done** — joined from `recoveryFees` |
| E5 | **Terms / Billing / FAQ copy alignment** after F5 | Jules (+ Riley if needed) | LEAN/FULL | **Done** — 30-day window in Terms, FAQ, Billing |
| E6 | **Clerk + Resend dual webhook secrets** (`*_WEBHOOK_SECRET_PREVIOUS`) | Riley | FULL | **Done** — `convex/lib/svixRotate.ts` |
| E7 | **CI:** top-level `permissions: contents: read` on `.github/workflows/ci.yml` | Riley | LEAN | **Done** |

---

## P1 — Strongly recommended before public launch

| # | Item | Owner | Gate | Notes |
|---|---|---|---|---|
| P1.1 | Merchant **monthly email quota** vs `pricing.ts` (100 Free / 500 Pro) | Riley + Jules | FULL + LEAN UI | **Done** — `getEmailQuotaStatus`; soft overage (no send block) |
| P1.2 | Staff view for `auditLogs` where `action = resend_quota_blocked` | Riley (+ Jules if UI) | FULL/LEAN | **Done** — Merchants Resend quota list + history filter |
| P1.3 | Fee owed per win in Recoveries UI | Jules | LEAN | **Done** — Recent wins show Fee when `feeCents > 0` |
| P1.4 | Email quota meter in Settings | Jules | LEAN | **Done** — Billing tab meter + Overview `sent / included` |

---

## P2 — Should / polish

| # | Item | Owner | Gate | Notes |
|---|---|---|---|---|
| P2.1 | Mobile Recoveries scan polish | Jules | LEAN | **Done** — filter swipe, 44px taps, no mobile `scrollIntoView` |
| P2.2 | Dedupe `parseResendError` / retry action bodies (Nix nits) | Riley | FULL | **Done** — `convex/lib/resendErrors.ts` + private `runRetryFailedPayment`; `allowHttpsUrl` on shared path; `retryFailedPaymentInternal` stays `internalAction` only |
| P2.3 | `adminListFeesForUser` + `assertCanActOnTarget` | Ash / Riley | FULL | **Done** — load-or-404 target, then same guard as `adminUpdateFeeStatus` |
| P2.4 | Ensure no public wrapper exposes `retryFailedPaymentInternal` raw | Ash on review | LEAN | **Verified** — `internalAction` only; UI uses public `retryFailedPayment` with ownership |
| P2.5 | SES migration evaluation | CoS / Fendem | LEAN | **Deferred** — stay on Resend (see Evaluation below) |

### P2.5 Evaluation

Sends and webhooks are Resend-native. Volume is still 100/500 emails per merchant-month; Resend Pro (F2) is the right next step. Revisit SES only if volume and ops cost justify a full webhook/DKIM rewrite.

**Decision: defer. No migration for launch.**

---

## Suggested launch order

1. **Fendem:** F7 (usage) → F2 (Resend Pro) → F3 + F4 (prod env + Clerk) → F1 (LS webhook refresh) → F5 + F6 (legal)  
2. **Riley (unblocked):** E6 → E2 → E4 → E7  
3. **Jules (parallel where possible):** E1 → E3/E5 (after F5/E2) → P1.3/P1.4  
4. **Ash:** FULL-gate E2/E6/Retry edge; LEAN UI can skip  
5. **Go/no-go:** all P0 checked; P1 agreed or explicitly deferred in writing

---

## Go / no-go checklist (sign-off)

- [ ] F1 LS webhooks refreshed on all existing stores (product Refresh button shipped)  
- [ ] F2 Resend Pro live  
- [ ] F3 `RECOVERY_SEQUENCE_FAST` unset in prod (code also blocks `prod:` deployments)  
- [ ] F4 Clerk role admin-only  
- [x] F5 Attribution window in Terms (30 days + fee engine)  
- [ ] F6 Legal placeholders filled  
- [x] E1 Retry CTA live  
- [x] E2+E3 Plan fee % truthful in UI  
- [x] E4 feeCents on recent wins  
- [x] E5 Policy copy aligned  
- [x] E6 Clerk/Resend dual secrets  
- [x] E7 CI permissions harden  
- [x] P1.1 Monthly email quota (soft overage)  
- [x] P1.2 Staff Resend quota-block view  
- [x] P1.3 Fee per win on Recoveries  
- [x] P1.4 Settings email quota meter  
- [x] P2.1 Mobile Recoveries polish  
- [x] P2.2 Shared Resend/retry helpers  
- [x] P2.3 Fee-list `assertCanActOnTarget`  
- [x] P2.4 Internal retry stays internal  
- [x] P2.5 SES deferred (Resend)  
- [ ] Smoke: fail → wait → Day‑0 → recover / LS recover → sequence stops → fee rules correct  
- [ ] Smoke: cancel/expired subscription stops sequence  

---

## Out of scope for this launch doc

- KT / other products  
- Changing ship gate or usage-ops rules (already locked elsewhere)  
- Hiring more agents  

*Last updated: 2026-09-15 — P0–P2 code shipped; F2/F4/F6/F7 remain Fendem ops. Tip Ash FULL for P2.2 + P2.3.*
