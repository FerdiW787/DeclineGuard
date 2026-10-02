# Dodo Payments — DeclineGuard merchant billing

DeclineGuard charging **merchants** (Pro $29.99/mo + recovery-fee invoices).
Merchant store recovery emails stay on Lemon Squeezy. No PayPal. No price changes.

## Feature flag (no dual charge)

| Control | Default | Effect |
| --- | --- | --- |
| Convex `BILLING_PROVIDER=lemon\|dodo` | `lemon` | New checkouts / fee invoices without a per-user pin |
| `users.billingProvider` | unset | Wins over env. Staff: `adminSetBillingProvider` |
| Active LS Pro + unset user flag | — | Stays **lemon** even if env is `dodo` (grandfather) |

When the resolved provider is `dodo`, Lemon `createProCheckout` / fee checkout / platform-store plan webhooks **no-op** for that merchant. Merchant-store LS recovery webhooks still run.

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
npx convex env set DODO_PAYMENTS_FEE_PRODUCT_ID "prod_..."
# optional — $0.99 +10 decline pack (one-time)
npx convex env set DODO_PAYMENTS_PACK_PRODUCT_ID "prod_..."
# optional — 4% recovered volume on the Pro subscription
npx convex env set DODO_PAYMENTS_USAGE_EVENT_NAME "recovery_fee_cents"
# optional docs-only meter id
npx convex env set DODO_PAYMENTS_METER_ID "mtr_..."
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

1. **Pro $29.99/mo** subscription product → `DODO_PAYMENTS_PRO_PRODUCT_ID`
2. **Recovery-fee** one-time product (amount override in cents) → `DODO_PAYMENTS_FEE_PRODUCT_ID`
3. **Usage meter** on the Pro product (event name + sum of `fee_cents`) if we want one monthly invoice = Pro + 4%. Without it, fees use a separate one-time checkout.
4. **Pack** product if `$0.99 +10` should charge on Dodo → `DODO_PAYMENTS_PACK_PRODUCT_ID`
5. Webhook signing secret → `DODO_PAYMENTS_WEBHOOK_KEY`

## Migration / grandfather

Dodo has no subscription import. Approach: **soft per-user flag + migrate-on-next-renewal / admin-assisted**.

1. Ship with `BILLING_PROVIDER=lemon`. Existing LS Pro keeps working.
2. Smoke Dodo on staff accounts via `adminSetBillingProvider({ billingProvider: "dodo" })` then `createProCheckout`.
3. Global cutover: `BILLING_PROVIDER=dodo`. Active LS Pro still resolves to lemon until they cancel or staff pins `dodo`.
4. After LS period ends, merchant checks out on Dodo (new customer + subscription). Staff may pin `dodo` once the Dodo webhook has written `dodoSubscriptionId`.

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
| `convex/functions/dodoBilling.ts` | Apply sub, webhook claim, per-user resolve |
| `convex/functions/dodoBillingActions.ts` | Checkout / portal / pack |
| `convex/dodoWebhook.ts` | `POST /dodo` |
| `convex/functions/lemonSqueezyActions.ts` | Stable `createProCheckout` / `createBillingPortal` |
| `convex/functions/feeBillingActions.ts` | Fee path switches on resolved provider |

## Asserts

```bash
npx tsx scripts/assert-dodo-billing.ts
npx tsx scripts/assert-ls-test-billing.ts
```
