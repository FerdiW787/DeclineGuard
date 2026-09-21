# Recovery emails (Steps 3–4)

When Lemon Squeezy sends `subscription_payment_failed`, DeclineGuard:

1. Stores / updates an open `failedPayments` row
2. Sends **Day 0** recovery email (gentle) via Resend
3. Schedules **Day 2** (direct) and **Day 5** (urgent) follow-ups
4. Logs each send as `email_sent` activity
5. On `subscription_payment_recovered`, cancels any pending follow-ups

## Sequence

| Step | When | Template |
| --- | --- | --- |
| Day 0 | Immediately | gentle |
| Day 2 | +2 days (or +1 min in fast mode) | direct |
| Day 5 | +5 days (or +1 min after Day 2 in fast mode) | urgent |

Brand colors, support email, and social links come from **Dashboard → Customizations**. From display name + Reply-To come from **Dashboard → Settings**. Free-tier emails include a “Recovery sent by DeclineGuard” footer line.

## Merchant preview sequence

From **Dashboard → Sequences → Send preview to me**:

1. Email 1 (gentle) sends immediately to your **verified** signed-in account email
2. Email 2 (direct) +30 seconds later
3. Email 3 (urgent) +30 seconds after that

Uses your store branding + sample customer (“Maya” / Pro Monthly). Subjects are prefixed with `[Preview]`. Does **not** touch real customer recoveries or count toward “emails sent this month.”

Limits: email must be verified; Lemon store required.

> **Testing:** preview start rate limits are currently **disabled**. Re-enable
> the `consumeRateLimit` calls in `convex/functions/previewSequence.ts` before
> production.

## Production email (verified domain)

Resend’s default `onboarding@resend.dev` can only send to **your Resend account email**. For real customers:

1. In [Resend → Domains](https://resend.com/domains), add your domain and add the DNS records they show.
2. Wait until the domain status is **Verified**.
3. Set the from address on Convex (must use that domain):

```bash
npx convex env set RESEND_FROM_EMAIL "DeclineGuard <noreply@yourdomain.com>"
```

4. Open **Dashboard → Settings → Recovery email** — status should show **Production**, and you can set:
   - **From display name** (appears as `Your Store <noreply@…>`)
   - **Reply-To** (optional support inbox)

Also required:

```bash
npx convex env set RESEND_API_KEY "re_xxxxxxxx"
```

## Deliverability (Resend webhooks)

DeclineGuard stores each Resend message id and updates delivery status when Resend posts events.

1. In [Resend → Webhooks](https://resend.com/webhooks), create an endpoint:
   - URL: `https://<your-deployment>.convex.site/resend`
   - Events: `email.delivered`, `email.bounced`, `email.complained` (optional: `email.failed`)
2. Copy the signing secret and set it on Convex:

```bash
npx convex env set RESEND_WEBHOOK_SECRET "whsec_xxxxxxxx"
```

Optional previous secret for zero-downtime rotation (`RESEND_WEBHOOK_SECRET_PREVIOUS`): set the new secret as current, keep the old as previous, update Resend, then remove previous after retries settle. See `.env.example`.

Dashboard → Settings shows the callback URL under **Recovery email → Deliverability webhook**. Open failures show Delivered / Bounced chips once events arrive.

## Convex env

```bash
# Required
npx convex env set RESEND_API_KEY "re_xxxxxxxx"

# Production — after domain verify (see above)
npx convex env set RESEND_FROM_EMAIL "DeclineGuard <noreply@yourdomain.com>"

# Deliverability webhooks (see above)
npx convex env set RESEND_WEBHOOK_SECRET "whsec_xxxxxxxx"
# Optional rotation window — see .env.example
# npx convex env set RESEND_WEBHOOK_SECRET_PREVIOUS "whsec_xxxxxxxx"

# Dev only — Email 1 immediate, Email 2 +1 min, Email 3 +1 min after Email 2
npx convex env set RECOVERY_SEQUENCE_FAST 1
```

Unset fast mode for real delays:
```bash
npx convex env remove RECOVERY_SEQUENCE_FAST
```

## Idempotency

- Same LS webhook event is not processed twice (`lemonWebhookEvents`)
- Each sequence step sends at most once per open failure
- Recovered failures skip / cancel remaining steps

## Test full sequence (fast)

```bash
npx convex env set RECOVERY_SEQUENCE_FAST 1

CUSTOMER_EMAIL=you@yourdomain.com \
node scripts/simulate-ls-payment-failed.mjs
```

Then watch:

- Resend → Email 1 now → Email 2 ~1 min later → Email 3 ~1 min after that
- Convex → Schedule for Email 2; Email 3 is scheduled when Email 2 sends
- `activityEvents` → `Email 1 · Day 0`, then Day 2, then Day 5

Simulate recovery (cancels pending jobs):

```bash
CUSTOMER_EMAIL=you@yourdomain.com \
EVENT=subscription_payment_recovered \
node scripts/simulate-ls-payment-failed.mjs
```
