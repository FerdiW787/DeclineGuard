# Lemon Squeezy webhooks (Step 1)

DeclineGuard ingests failed / recovered subscription payments from Lemon Squeezy.

## In-app setup (recommended)

During onboarding, use **Install webhook for me** — DeclineGuard creates the
Lemon Squeezy webhook via API (URL, secret, payment events) and sends a signed
test ping. Manual copy/paste remains available as a fallback (also in
**Dashboard → Settings**).

## Endpoint

```
POST https://<your-deployment>.convex.site/lemonsqueezy
```

`CONVEX_SITE_URL` is a built-in Convex env (e.g. `https://savory-antelope-128.eu-west-1.convex.site`). The Settings query appends `/lemonsqueezy`.

## Convex env

```bash
# LS signing secret max length is 40 — hex 16 = 32 chars
npx convex env set LEMONSQUEEZY_WEBHOOK_SECRET "$(openssl rand -hex 16)"
```

Use that same secret in Lemon Squeezy (or copy it from Dashboard → Settings).

## Create the webhook in Lemon Squeezy

1. Lemon Squeezy → **Settings → Webhooks** → **Create webhook**
2. **Callback URL:** from DeclineGuard Settings (or `https://<deployment>.convex.site/lemonsqueezy`)
3. **Signing secret:** from DeclineGuard Settings (same as `LEMONSQUEEZY_WEBHOOK_SECRET`)
4. Subscribe at least to:
   - `subscription_payment_failed`
   - `subscription_payment_recovered`
   - `subscription_updated`
5. Save

## Store binding

Webhooks are routed by `store_id` on the payload. Every store on a connected LS account is registered when the merchant connects (or refreshes stores). Connecting a store claims it exclusively so events don’t route to an old account.

If events arrive for a store that isn’t linked, we ack `200` and ignore (so LS doesn’t retry forever).

## What gets stored

| Event | Effect |
| --- | --- |
| `subscription_payment_failed` | Upserts an **open** `failedPayments` row + activity item |
| `subscription_payment_recovered` | Marks that subscription’s open failure as **recovered** + activity item |
| `subscription_updated` | Stops recovery sequences when subscription is cancelled/expired/unpaid |

## DeclineGuard Pro billing (platform store)

Merchant recovery webhooks and DeclineGuard’s own Pro subscription share
`POST /lemonsqueezy`. Plan changes run **only** when `store_id` equals
`LEMONSQUEEZY_STORE_ID` (DeclineGuard’s store), never from a merchant store.

| Env | Purpose |
| --- | --- |
| `LEMONSQUEEZY_API_KEY` | Create Pro checkouts (`createProCheckout`) |
| `LEMONSQUEEZY_STORE_ID` | Identify platform-store webhook events |
| `LEMONSQUEEZY_PRO_VARIANT_ID` | $29.99/mo variant (required) |
| `LEMONSQUEEZY_PRO_PRODUCT_ID` | Product id (recommended verification) |

On the platform store webhook, also subscribe to `subscription_created`,
`subscription_cancelled`, `subscription_expired`, and
`subscription_payment_success` / `subscription_payment_failed`.

| Platform event / status | Effect |
| --- | --- |
| `active` or `paid` | `users.plan = pro` + store `lsSubscriptionId` |
| `cancelled`, `expired`, `unpaid`, `past_due`, failed payment | `users.plan = free` |

Checkout creation does **not** set plan. Merchants cannot self-set plan.
Staff `setUserPlan` remains gated with an audit log; the next matching
webhook still overwrites plan.

`createProCheckout` return/receipt URLs must pass `allowAppHttpsUrl`: https
plus an allowlisted DeclineGuard origin (`PUBLIC_APP_URL` / `PUBLIC_APP_URLS`
or `declineguard.com` / `www` / `app`). Arbitrary https hosts are rejected.

Platform-store `order_created` is handled separately for monthly recovery-fee
invoices (claim/release + mark paid). That path is unchanged.

## Dashboard queries

- `api.functions.recoveries.listOpenFailures`
- `api.functions.recoveries.listRecentActivity`
- `api.functions.recoveries.getRecoverySummary`
- `api.functions.lemonSqueezy.getWebhookSetup` (Settings — URL + secret when connected)

## Test

Use Lemon Squeezy → Webhooks → **Send test event**, the simulate script, or fail a test-mode renewal. Then check Convex data for `failedPayments` / `activityEvents`.
