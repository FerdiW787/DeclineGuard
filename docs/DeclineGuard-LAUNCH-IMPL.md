# DeclineGuard — Launch implementation notes

**What this is:** How P0 → P1 → P2 were implemented (2026-09-15).  
**What this is not:** The status checklist. That stays [DeclineGuard-LAUNCH.md](DeclineGuard-LAUNCH.md).  
**Audience:** Nix (defects), Ash (FULL security), Sha (merge).  
**No P3.** There is no P3 list.

**Ship gate (locked):**

| Gate | Path | Ash? |
|---|---|---|
| **FULL** | Nix → Ash → Sha | Yes — tip Ash |
| **LEAN** | Nix → Sha | Skip Ash |

**Tip Ash FULL (not LEAN):** E2, E6, P1.1, P1.2 (audit query/index), P2.2, P2.3. Also review E1/E4/F5 if fee or retry copy can lie.

---

## Leftovers (cannot code — Fendem ops)

These are **not** shipped. Do not mark them done in review.

| ID | Still needed |
|---|---|
| **F1** | Click **Refresh webhook** once per **existing** live store so `subscription_updated` is on the LS endpoint. Product button is shipped. |
| **F2** | Resend Pro (or paid equivalent). Code already logs `resend_quota_blocked`. |
| **F3** | Confirm `RECOVERY_SEQUENCE_FAST` is **unset** on **prod** Convex. Code also ignores fast mode when `CONVEX_DEPLOYMENT` starts with `prod:`. |
| **F4** | Clerk Dashboard: only admins can edit `private_metadata.role`. Code already reads private metadata only. |
| **F6** | Fill `src/lib/legal.ts` + Privacy / DPA / Impressum placeholders. Deferred until entity details exist. |
| **F7** | Cursor usage / on-demand if cloud agents are needed again. |

---

## P0 — Must before live merchants

### F5 — 30-day attribution (FULL if fee-lying)

- **Status:** shipped
- **What we did:** Fee is owed only if Day-0 was sent **and** recovery lands within 30 days of that send. Terms and marketing use the same number.
- **Where:**
  - `ATTRIBUTION_WINDOW_DAYS = 30` in [convex/lib/accountGuard.ts](../convex/lib/accountGuard.ts) and [src/lib/pricing.ts](../src/lib/pricing.ts) (Convex cannot import `src/` — keep both in sync)
  - `isWithinAttributionWindow` in fee insert on recover ([convex/functions/recoveries.ts](../convex/functions/recoveries.ts))
  - Copy: [src/pages/legal/terms.astro](../src/pages/legal/terms.astro), BillingTab, FAQ / homepage
- **Locks:** Do not charge if `day0SentAt` is null. Do not charge if `recoveredAt - day0SentAt > 30d`. Do not invent a second window.
- **How to check:** Recover a failure with no Day-0 → no `recoveryFees` row. Recover 31 days after Day-0 → skip fee; activity says outside the window.

### F3 — Prod blocks fast sequence (LEAN / ops)

- **Status:** code shipped; **env still Fendem**
- **What we did:** Fast Day-0/2/5 timing never runs on a `prod:` Convex deployment, even if the env var is set by mistake.
- **Where:** `isFastSequence()` in [convex/functions/recoveries.ts](../convex/functions/recoveries.ts)
- **Locks:** Do not add a client-side fast-mode toggle. Do not treat this as “env is unset” — still confirm prod env.
- **How to check:** On a non-prod deploy with `RECOVERY_SEQUENCE_FAST=1`, delays are short. On `CONVEX_DEPLOYMENT=prod:…`, delays stay Day 0 / 2 / 5.

### F1 — Webhook refresh + `subscription_updated` (LEAN product; ops leftover)

- **Status:** product shipped; **existing stores still need one click**
- **What we did:** Settings → Webhooks lists `subscription_updated` and a **Refresh webhook** control that calls `installStoreWebhook`. Marketing preview is read-only (`useAction` only when `!readOnly`).
- **Where:** [src/components/dashboard/settings/WebhooksTab.tsx](../src/components/dashboard/settings/WebhooksTab.tsx) (`WebhookRefreshControls`), [convex/functions/lemonSqueezyActions.ts](../convex/functions/lemonSqueezyActions.ts) `installStoreWebhook`
- **Locks:** Do not put `useAction` on the public dashboard preview. New installs already require `subscription_updated`.
- **How to check:** Connected store → Refresh → LS webhook events include `subscription_updated`. Existing live stores: confirm after the merchant clicks Refresh.

### E1 — Recoveries Retry CTA (LEAN)

- **Status:** shipped
- **What we did:** Case panel **Retry payment link** calls the public `retryFailedPayment` action. Marketing / staff sim pass `allowRetry={false}` so Convex is not invoked without a session.
- **Where:** `RetryPaymentButton` in [src/components/dashboard/RecoveriesPage.tsx](../src/components/dashboard/RecoveriesPage.tsx) → `api.functions.lemonSqueezyActions.retryFailedPayment`
- **Locks:** UI must not call `retryFailedPaymentInternal` or any `internal.*`. Ownership + rate limits stay on the public action.
- **How to check:** Signed-in merchant, open case, click Retry → status `ok` and a fresh https payment URL. Homepage Recoveries mock has no Retry button.

### E2 — Expose `plan` + fee % (FULL)

- **Status:** shipped
- **What we did:** Product queries return the **merchant** plan (not the admin during takeover) and the matching fee percent (Free 10 / Pro 4).
- **Where:**
  - `getCurrentUser` in [convex/functions/user.ts](../convex/functions/user.ts) — `plan`, `recoveryFeePercent`
  - `getFeesSummary` in [convex/functions/recoveries.ts](../convex/functions/recoveries.ts) — same fields via `resolveProductUserOrNull`
- **Locks:** Merchants cannot set plan (`setUserPlan` stays admin-only). Takeover must bill the merchant, not the staff actor.
- **How to check:** Pro merchant dashboard shows 4%. Admin takeover of a Free store still shows 10%.

### E3 — Billing / Overview use real plan % (LEAN; FULL if fee-lying)

- **Status:** shipped
- **What we did:** Dashboard, Billing, and Overview read `recoveryFeePercent` from E2 queries instead of hardcoded Free / 10%.
- **Where:** [src/components/dashboard/Dashboard.tsx](../src/components/dashboard/Dashboard.tsx), [src/components/dashboard/settings/BillingTab.tsx](../src/components/dashboard/settings/BillingTab.tsx), [src/components/dashboard/OverviewHub.tsx](../src/components/dashboard/OverviewHub.tsx)
- **Locks:** Do not fall back to 10% when `getFeesSummary` already returned a Pro percent.
- **How to check:** Pro user: Billing copy says 4%; Overview fee line matches.

### E4 — `listRecentRecovered` includes `feeCents` (LEAN/FULL)

- **Status:** shipped
- **What we did:** Recent wins join `recoveryFees` and return `feeCents` (`number | null`).
- **Where:** `listRecentRecovered` + `recoveredWinValidator` in [convex/functions/recoveries.ts](../convex/functions/recoveries.ts); `RecoveredWinRow` in [src/components/dashboard/dashboardUi.tsx](../src/components/dashboard/dashboardUi.tsx)
- **Locks:** `null` when no fee row (no Day-0 or outside window). Do not invent a client-side 10% of `amountCents`.
- **How to check:** Win with a fee row → `feeCents > 0`. Win with no fee → `feeCents` is null.

### E5 — Terms / FAQ / Billing copy (LEAN/FULL)

- **Status:** shipped
- **What we did:** Attribution window copy is 30 days everywhere the merchant can read policy.
- **Where:** [src/pages/legal/terms.astro](../src/pages/legal/terms.astro), [src/lib/pricing.ts](../src/lib/pricing.ts) FAQ strings, BillingTab, homepage FAQ
- **Locks:** Same number as `ATTRIBUTION_WINDOW_DAYS`. Do not say “fee whenever LS recovers.”
- **How to check:** Terms + FAQ + Billing all say 30 days from the first recovery email.

### E6 — Clerk + Resend dual webhook secrets (FULL)

- **Status:** shipped
- **What we did:** Both webhooks accept current secret plus optional previous secret for zero-downtime rotation.
- **Where:** [convex/lib/svixRotate.ts](../convex/lib/svixRotate.ts) (`webhookSecrets`, `verifySvixPayload`); [convex/clerk.ts](../convex/clerk.ts); [convex/resendWebhook.ts](../convex/resendWebhook.ts); `.env.example` (`CLERK_WEBHOOK_SECRET_PREVIOUS`, `RESEND_WEBHOOK_SECRET_PREVIOUS`)
- **Locks:** Verify-then-parse. Empty previous is fine. Do not log raw secrets.
- **How to check:** With only current secret, webhooks still verify. With previous set to the old secret, rotate current without dropping events.

### E7 — CI `contents: read` (LEAN)

- **Status:** shipped
- **What we did:** Workflow default token is read-only.
- **Where:** [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) top-level `permissions: contents: read`
- **Locks:** Do not grant `contents: write` unless a job truly needs it.
- **How to check:** Open the workflow file; `permissions` is at the top, not only on one job.

---

## P1 — Strongly recommended before public launch

### P1.1 — Monthly email quota, soft overage (FULL + LEAN UI)

- **Status:** shipped
- **What we did:** Meter 100 (Free) / 500 (Pro) recovery emails per calendar month. Hitting the cap does **not** skip Day 0/2/5. Overage is counted in packs ($3 / 10 Free, $3 / 30 Pro) for invoicing. Resend HTTP 429 still skips the send and logs `resend_quota_blocked`.
- **Where:**
  - `includedRecoveryEmails`, `emailOveragePackSize`, `EMAIL_OVERAGE_PACK_PRICE_USD` in [convex/lib/accountGuard.ts](../convex/lib/accountGuard.ts) (mirrored in [src/lib/pricing.ts](../src/lib/pricing.ts))
  - `getEmailQuotaStatus` in [convex/functions/recoveries.ts](../convex/functions/recoveries.ts) — counts `activityEvents` type `email_sent`, scan cap 2000
  - Comment in [convex/functions/recoveryEmails.ts](../convex/functions/recoveryEmails.ts): merchant quota is soft
- **Locks:** Never add a `sent >= included` return before Resend. Soft overage ≠ Resend 429. Keep Convex and `src/` limits in sync.
- **How to check:** Free merchant at 100+ sends: next Day-2 still goes out; meter shows overage packs. Force Resend 429: send skipped, audit `resend_quota_blocked`.

### P1.2 — Staff view for `resend_quota_blocked` (FULL/LEAN)

- **Status:** shipped
- **What we did:** Staff can list quota-block audits without scanning the whole log. Merchant history has a Quota chip; Merchants has a Resend quota list.
- **Where:**
  - Schema index `auditLogs.by_action_createdAt`
  - `listResendQuotaBlocked` in [convex/functions/admin.ts](../convex/functions/admin.ts) (`requireStaff`)
  - [src/components/admin/AdminConsole.tsx](../src/components/admin/AdminConsole.tsx), [src/components/admin/LiveStaffLog.tsx](../src/components/admin/LiveStaffLog.tsx) — `humanAction` label
- **Locks:** Staff-only. Do not expose this query to merchants.
- **How to check:** After a 429, Admin → Merchants / history shows “Resend quota blocked.”

### P1.3 — Fee owed per win (LEAN)

- **Status:** shipped
- **What we did:** Recent wins show a muted `Fee $x` line when `feeCents > 0`.
- **Where:** Recent-wins row in [src/components/dashboard/RecoveriesPage.tsx](../src/components/dashboard/RecoveriesPage.tsx)
- **Locks:** No extra line when `feeCents` is null or 0 (no Day-0 / outside window).
- **How to check:** Fee win shows the line; no-fee win does not.

### P1.4 — Settings email meter (LEAN)

- **Status:** shipped
- **What we did:** Billing shows `sent / included` plus a bar. Overview emails-sent hint uses the same included number (e.g. `47 / 100`).
- **Where:** [src/components/dashboard/Dashboard.tsx](../src/components/dashboard/Dashboard.tsx) (`monthStartMs` → `getEmailQuotaStatus`) → SettingsModule → [BillingTab.tsx](../src/components/dashboard/settings/BillingTab.tsx); OverviewHub hint
- **Locks:** Overview and Billing must share one quota query. Bar caps visually at 100%; overage copy is separate.
- **How to check:** Free at 0 sends: `0 / 100`. Over 100: bar full + “N over · packs · $”.

---

## P2 — Should / polish

Ash / Nix (2026-09-15): **FULL = P2.2 + P2.3.** **LEAN = P2.1 + P2.4 + P2.5.**

### P2.3 — `adminListFeesForUser` target guard (FULL — shipped first)

- **Status:** shipped
- **What we did:** Staff listing another user’s fees now uses the same target-role guard as fee status updates. Staff can only list **merchant** (`user`) fees. Admins may list anyone.
- **Where:** `adminListFeesForUser` in [convex/functions/recoveries.ts](../convex/functions/recoveries.ts) — `requireStaff` → load target → 404 if missing → `assertCanActOnTarget` from [convex/lib/admin.ts](../convex/lib/admin.ts)
- **Locks:** Same message as other staff-on-staff denies. Do not drop the load-or-404 (unguessable id still must exist).
- **How to check:** Staff calling this with another staff/admin `userId` throws. Staff listing a merchant succeeds.

### P2.2 — Shared Resend errors + retry core (FULL)

- **Status:** shipped
- **What we did:** One parser for Resend errors; one private retry helper for LS URL refresh. Public and internal wrappers keep their own auth / lookup / copy.
- **Where:**
  - [convex/lib/resendErrors.ts](../convex/lib/resendErrors.ts) — `parseResendError`, `isResendQuotaError`
  - Imported by [recoveryEmails.ts](../convex/functions/recoveryEmails.ts) and [previewSequenceEmails.ts](../convex/functions/previewSequenceEmails.ts)
  - Private `runRetryFailedPayment` in [lemonSqueezyActions.ts](../convex/functions/lemonSqueezyActions.ts) — not exported
- **Locks (Ash):**
  - `allowHttpsUrl` stays on the **shared** retry path (sanitize before store)
  - `retryFailedPaymentInternal` stays `internalAction` only — **no `api.*` wrap**
  - Retry behavior unchanged (status codes, ownership, rate limits, no extra emails)
- **How to check:** Public retry still returns the same statuses. Grep: `retryFailedPaymentInternal` is only the `internalAction` export. Recovery + preview still treat 429 / quota names as quota errors.

### P2.1 — Mobile Recoveries polish (LEAN)

- **Status:** shipped
- **What we did:** Queue filters can swipe on a narrow phone. Rows, filter tabs, and back buttons are 44px tap targets. Selecting a row does not `scrollIntoView` below `lg` (mobile case overlay).
- **Where:** [src/components/dashboard/RecoveriesPage.tsx](../src/components/dashboard/RecoveriesPage.tsx), [src/components/dashboard/SegmentedControl.tsx](../src/components/dashboard/SegmentedControl.tsx) (`max-lg:min-h-11` only)
- **Locks:** Light Linear. Do not rewrite the rail. Do not change desktop chrome.
- **How to check:** Phone width: filters overflow-x scroll; rows/back ≥ 44px; tap a row → overlay, page does not jump.

### P2.4 — Internal retry not public (LEAN)

- **Status:** verified
- **What we did:** Confirmed `retryFailedPaymentInternal` is `internalAction` only. Merchant UI uses public `retryFailedPayment` with ownership. Added: “Internal only — do not wrap as a public action.”
- **Where:** Comment on `retryFailedPaymentInternal` in [lemonSqueezyActions.ts](../convex/functions/lemonSqueezyActions.ts)
- **Locks:** Same as P2.2 — no new public export.
- **How to check:** Client bundle / `api.functions.lemonSqueezyActions` has `retryFailedPayment` only.

### P2.5 — SES evaluation (LEAN)

- **Status:** deferred (docs)
- **What we did:** Stay on Resend. No SES code, no migration.
- **Evaluation:**
  - Sends + webhooks are Resend-native
  - Volume is still 100/500 emails per merchant-month; Resend Pro (**F2**) is the right next step
  - Revisit SES only if volume and ops cost justify a full webhook/DKIM rewrite
  - **Decision: defer. No migration for launch.**
- **Where:** This section + [DeclineGuard-LAUNCH.md](DeclineGuard-LAUNCH.md) P2.5
- **Locks:** Do not add SES SDK or dual-provider send paths in this launch.
- **How to check:** Repo has no SES client; recovery send still `api.resend.com`.

---

## Review table

Leave **Findings** blank for Nix / Ash / Sha.

| ID | Gate | Tip Ash? | Leftover? | Findings |
|---|---|---|---|---|
| F5 | FULL if fee-lying | If reviewing fees | No | |
| F3 | LEAN (code) | No | Yes — unset prod env | |
| F1 | LEAN (product) | No | Yes — click per live store | |
| F2 | ops | No | Yes — Resend Pro | |
| F4 | ops | No | Yes — Clerk Dashboard | |
| F6 | ops | No | Yes — legal entity | |
| F7 | ops | No | Yes — Cursor usage | |
| E1 | LEAN | Spot-check retry | No | |
| E2 | FULL | Yes | No | |
| E3 | LEAN→FULL if fee-lying | If E2 | No | |
| E4 | LEAN/FULL | Spot-check fees | No | |
| E5 | LEAN/FULL | If copy can lie | No | |
| E6 | FULL | Yes | No | |
| E7 | LEAN | No | No | |
| P1.1 | FULL + LEAN UI | Yes | No | |
| P1.2 | FULL/LEAN | Yes (query/index) | No | |
| P1.3 | LEAN | No | No | |
| P1.4 | LEAN | No | No | |
| P2.1 | LEAN | No | No | |
| P2.2 | FULL | Yes | No | |
| P2.3 | FULL | Yes | No | |
| P2.4 | LEAN | No | No | |
| P2.5 | LEAN | No | Deferred (Resend) | |

*Written 2026-09-15. Checklist status: [DeclineGuard-LAUNCH.md](DeclineGuard-LAUNCH.md).*
