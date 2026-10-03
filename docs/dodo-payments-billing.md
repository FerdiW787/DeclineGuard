# Dodo Payments — DeclineGuard merchant billing

DeclineGuard charging **merchants** (Pro $29.99/mo + 4% recovery usage on that same invoice).
Merchant store recovery emails stay on Lemon Squeezy. No PayPal. No price changes.

## Feature flag (no dual charge)

| Control | Default | Effect |
| --- | --- | --- |
| Convex `BILLING_PROVIDER=lemon\|dodo` | `lemon` | New checkouts / fee invoices without a per-user pin |
| `users.billingProvider` | unset | Wins over env. Staff: `adminSetBillingProvider` |
| Active LS Pro + unset user flag | — | Stays **lemon** even if env is `dodo` (grandfather) |

When the resolved provider is `dodo`, Lemon **checkout and fee invoice** paths no-op (no dual charge). LS **cancel/expire demotions still apply** so a stale `lsSubscriptionStatus=active` cannot keep Pro. Staff cannot pin `dodo` while LS Pro is still active/paid. Portal falls back to LS until `dodoCustomerId` exists. Merchant-store LS recovery webhooks still run.

## Jules FE contract (names unchanged)

```ts
api.functions.lemonSqueezyActions.createProCheckout({ returnUrl? })
  → { checkoutUrl: string }

api.functions.lemonSqueezyActions.createBillingPortal({ returnUrl? })
  → { portalUrl: string }

api.functions.dodoBillingActions.createPackCheckout({ returnUrl?, quantity? })
  → { checkoutUrl: string }

api.functions.billing.getMyBilling({})
  → {
      plan, billingProvider, hasActivePro, portalAvailable,
      lsSubscriptionId, lsSubscriptionStatus,
      dodoCustomerId, dodoSubscriptionId, dodoSubscriptionStatus
    }
```

`returnUrl` must be https on an allowlisted app host (`PUBLIC_APP_URL` / `PUBLIC_APP_URLS`).

## Convex env checklist (Fendem / CoS)

Do not commit secrets. Set on the Convex deployment:

```bash
npx convex env set BILLING_PROVIDER lemon          # keep lemon until smoke
npx convex env set DODO_PAYMENTS_API_KEY "..."
npx convex env set DODO_PAYMENTS_WEBHOOK_KEY "whsec_..."
# optional rotation:
# npx convex env set DODO_PAYMENTS_WEBHOOK_KEY_PREVIOUS "whsec_..."
npx convex env set DODO_PAYMENTS_ENVIRONMENT test_mode   # or live_mode
npx convex env set DODO_PAYMENTS_PRO_PRODUCT_ID "prod_..."
npx convex env set DODO_PAYMENTS_FEE_PRODUCT_ID "prod_..."  # not the Dodo Pro 4% path
# optional — $0.99 +10 decline pack (one-time)
npx convex env set DODO_PAYMENTS_PACK_PRODUCT_ID "prod_..."
# 4% recovered volume on the Pro subscription invoice (default if unset)
npx convex env set DODO_PAYMENTS_USAGE_EVENT_NAME "recovery.fee"
# Pro-invoice usage meter (test). Code reads this; do not invent another id.
npx convex env set DODO_PAYMENTS_METER_ID "mtr_0NottfCQQuRMUjzfjZgJY"
# isolated preview only — never production
npx convex env set ALLOW_DODO_TEST_BILLING true
```

Webhook URL in the Dodo dashboard:

```
https://<deployment>.convex.site/dodo
```

Subscribe: `subscription.active`, `subscription.renewed`, `subscription.on_hold`,
`subscription.cancelled`, `subscription.failed`, `subscription.updated`,
`payment.succeeded`.

## Dashboard product IDs still required (blockers)

Until these exist in the live/test Dodo business, checkout/fees throw “not configured”:

1. **Pro $29.99/mo** subscription product → `DODO_PAYMENTS_PRO_PRODUCT_ID` (meter `mtr_0NottfCQQuRMUjzfjZgJY` attached; Sum over `customer_id`, unit `usd`)
2. **4% recovery fee for Dodo Pro** is unpaid usage on that Pro invoice. Event name is exactly `recovery.fee` (or `DODO_PAYMENTS_USAGE_EVENT_NAME` if set). Amount is USD dollars (cents ÷ 100 once). Idempotent `event_id`. **Ingest is not paid** — `usageIngestSettlesFeePeriod` stays false. Missing `DODO_PAYMENTS_METER_ID` or a meter whose aggregation key is not `usd` fails closed (no ingest, no submitted row). Only the scheduled day-1 06:00 UTC close stamps `dodoUsagePeriodKey(now)` (the month that just closed). A mid-month staff force-run stamps the current UTC month so a January charge cannot mark a December row paid. The scheduled close reclaims that unpaid Dodo usage row and recomputes the finished month (delta ingest). A charge does not mark a mid-month force-run paid; only a month-closed row is settleable. A failed or skipped scheduled close keeps previously accepted cents settleable and does not emit them again. A throw after Dodo accepts a delta does not roll those cents back or re-ingest them. Persist after accept must commit accepted cents and monthClosed before reporting created; a failed persist returns failed. The last-ditch pending marker writes those settle fields and applies a same-period charge credit (no second POST) because the monthly owed-fee scan skips fees that already have billingInvoiceId. A credit-apply throw rolls that pending mutation back so the row is not left monthClosed without a later apply. If the marker throws, the accepted event is stamped (including on a created reclaim row) so the next day-1 leftover finish can apply the credit locally. A throw before accept still rolls the reclaim back to the previously accepted meter amount and does not unlink those fees. Paid only from `payment.succeeded` for this merchant's Pro recurring charge (payment `subscription_id` equals `users.dodoSubscriptionId`; stored `dodoProductId` must still be Pro; product id on the payment — `product_id`, nested `product`, or `product_cart[].product_id` — must be absent or Pro; a cart whose only product is Pro is the renewal; addon_id / nested addons / a non-Pro cart line / subscription `on_demand` do not settle; amount > 0; not `is_update_payment_method`) using the payment's `created_at` and that same period key. A charge before ingest stores a usage credit; ingest of that period still marks paid with the payment `created_at` only when the stored product is still Pro (same merchant match as settle). Same-period usage submitted after the charge is still that charge's row. A later subscription event whose `product_id` is not Pro is persisted so settle and credit apply stop. Activation / `subscription.updated` / `subscription.renewed` do not mark paid. One charge settles that period only.
3. **Do not also open** `DODO_PAYMENTS_FEE_PRODUCT_ID` checkout for a Dodo Pro customer who can take usage. No customer/subscription → fail closed (no silent one-time-fee fallback). Lemon-resolved merchants still use Lemon fee checkout.
4. **Pack** product if `$0.99 +10` should charge on Dodo → `DODO_PAYMENTS_PACK_PRODUCT_ID`. `payment.succeeded` credits `users.declinePackExtra` only when the product id matches (cart qty preferred, clamp ≤20). Extra declines raise Free 50 / Pro 500 hold-queue capacity and unhold oldest held rows. Test-mode packs use the same `test_mode_ignored` gate as plan webhooks. Month rollover (cron + lazy first-touch) and Free→Pro promote call the same unhold + email schedule.
5. Webhook signing secret → `DODO_PAYMENTS_WEBHOOK_KEY`

## Migration / grandfather

Dodo has no subscription import. Approach: **soft per-user flag + migrate-on-next-renewal / admin-assisted**.

1. Ship with `BILLING_PROVIDER=lemon`. Existing LS Pro keeps working.
2. Smoke Dodo on staff accounts that do **not** have an active LS Pro (`adminSetBillingProvider` refuses `dodo` while LS is active/paid).
3. Global cutover: `BILLING_PROVIDER=dodo`. Active LS Pro still resolves to lemon until they cancel. Activating Dodo clears LS entitlement; checkout is blocked while the other MoR is still active.
4. After LS period ends, merchant checks out on Dodo. Staff may pin `dodo` only after LS is no longer active/paid.

## Tear-down (after smoke; do not delete LS merchant recovery)

1. Confirm zero `users` with lemon-resolved Pro (`lsSubscriptionId` + unset/lemon flag).
2. `BILLING_PROVIDER=dodo`.
3. Remove `LEMONSQUEEZY_PRO_VARIANT_ID`, `LEMONSQUEEZY_PRO_PRODUCT_ID`, `LEMONSQUEEZY_FEE_VARIANT_ID` from Convex. Keep merchant LS env (`LS_TOKEN_ENCRYPTION_KEY`, `LEMONSQUEEZY_WEBHOOK_SECRET`, per-store keys).
4. Leave `POST /lemonsqueezy` for merchant recovery. Delete platform LS checkout helpers only when grandfather count is zero.

## Provider files

| Path | Role |
| --- | --- |
| `convex/lib/billingProvider.ts` | Flag resolve + no-dual-charge |
| `convex/lib/dodoPayments.ts` | HTTP adapter (checkout, portal, usage) |
| `convex/lib/standardWebhooks.ts` | Svix-style signature + event key |
| `convex/lib/declineCapacity.ts` | Free 50 / Pro 500 + pack extra hold-queue math |
| `convex/lib/declineHoldQueue.ts` | Count used declines; hold inserts; unhold on pack / promote / month |
| `convex/functions/dodoBilling.ts` | Apply sub, webhook claim, pack credit + unhold |
| `convex/functions/dodoBillingActions.ts` | Checkout / portal / pack |
| `convex/dodoWebhook.ts` | `POST /dodo` |
| `convex/functions/lemonSqueezyActions.ts` | Stable `createProCheckout` / `createBillingPortal` |
| `convex/functions/feeBillingActions.ts` | Lemon fee checkout; Dodo Pro 4% = `recovery.fee` usage |

## Asserts

```bash
npx tsx scripts/assert-dodo-billing.ts
npx tsx scripts/assert-ls-test-billing.ts
```
