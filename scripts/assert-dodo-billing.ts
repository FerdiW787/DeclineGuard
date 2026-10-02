/**
 * Pure-function checks for Dodo billing flag, no dual-charge, webhook keys.
 * Run: npx tsx scripts/assert-dodo-billing.ts
 */
import {
  canPinBillingProvider,
  dodoPlatformEventAction,
  dodoPlatformPathBlocked,
  hasDualActiveSubscriptions,
  isActiveSubscriptionStatus,
  lemonPlatformPathBlocked,
  lsPlatformEventAction,
  nextDeclinePackExtra,
  otherMorBlocksCheckout,
  packExtraDeclines,
  parseBillingProvider,
  parseBillingProviderEnv,
  planAfterForeignDemotion,
  resolveBillingProvider,
  shouldSkipDodoPlatformCharge,
  shouldSkipLemonPlatformCharge,
  usageIngestSettlesFeePeriod,
} from "../convex/lib/billingProvider";
import { existingClaimBlocksNewCharge } from "../convex/lib/feeBilling";
import {
  dodoUsageEventId,
  extractDodoUserRefs,
  isDodoTestBillingAllowed,
  planFromDodoStatus,
  shouldIgnoreDodoTestEvent,
  statusFromDodoEvent,
} from "../convex/lib/dodoPayments";
import {
  dodoWebhookEventKey,
  hmacSha256Base64,
  parseStandardWebhookSecret,
  parseStandardWebhookSignatures,
  standardWebhookTimestampOk,
  verifyStandardWebhook,
} from "../convex/lib/standardWebhooks";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

assert(parseBillingProvider("lemon") === "lemon", "parse lemon");
assert(parseBillingProvider("DODO") === "dodo", "parse dodo case-insensitive");
assert(parseBillingProvider("stripe") === null, "unknown provider is null");
assert(parseBillingProviderEnv(undefined) === "lemon", "env default is lemon");
assert(parseBillingProviderEnv("") === "lemon", "empty env default is lemon");
assert(parseBillingProviderEnv("dodo") === "dodo", "env dodo");

assert(
  resolveBillingProvider({}) === "lemon",
  "no flags → lemon (safe default)",
);
assert(
  resolveBillingProvider({ envProvider: "dodo" }) === "dodo",
  "flag on → dodo path",
);
assert(
  resolveBillingProvider({ envProvider: "dodo", userProvider: "lemon" }) ===
    "lemon",
  "per-user lemon wins over env dodo (grandfather)",
);
assert(
  resolveBillingProvider({ envProvider: "lemon", userProvider: "dodo" }) ===
    "dodo",
  "per-user dodo wins over env lemon",
);
assert(
  resolveBillingProvider({
    envProvider: "dodo",
    hasActiveLemonSubscription: true,
  }) === "lemon",
  "active LS Pro grandfathers onto lemon when env is dodo",
);
assert(
  resolveBillingProvider({
    envProvider: "lemon",
    hasActiveDodoSubscription: true,
  }) === "dodo",
  "active Dodo sub stays on dodo when env is lemon",
);

assert(
  shouldSkipLemonPlatformCharge("dodo") === true,
  "dodo flag skips Lemon checkout/fee",
);
assert(
  shouldSkipDodoPlatformCharge("lemon") === true,
  "lemon flag skips Dodo checkout/fee",
);
assert(
  lemonPlatformPathBlocked("dodo") && !lemonPlatformPathBlocked("lemon"),
  "no dual charge: lemon path only when provider is lemon",
);
assert(
  dodoPlatformPathBlocked("lemon") && !dodoPlatformPathBlocked("dodo"),
  "no dual charge: dodo path only when provider is dodo",
);
assert(
  !(lemonPlatformPathBlocked("dodo") === false && dodoPlatformPathBlocked("dodo") === false),
  "no dual charge when flag set to dodo",
);
assert(
  lemonPlatformPathBlocked("dodo") !== dodoPlatformPathBlocked("dodo"),
  "exactly one MoR path when provider is dodo",
);
assert(
  lemonPlatformPathBlocked("lemon") !== dodoPlatformPathBlocked("lemon"),
  "exactly one MoR path when provider is lemon",
);

assert(isActiveSubscriptionStatus("active"), "active status");
assert(isActiveSubscriptionStatus("paid"), "paid status");
assert(!isActiveSubscriptionStatus("cancelled"), "cancelled is not active");

assert(planFromDodoStatus("active") === "pro", "dodo active → pro");
assert(planFromDodoStatus("on_hold") === "free", "dodo on_hold → free");
assert(planFromDodoStatus("cancelled") === "free", "dodo cancelled → free");
assert(planFromDodoStatus("updated") === null, "unknown dodo status ignored");
assert(
  statusFromDodoEvent("subscription.active", "") === "active",
  "event name fills empty status",
);

const pinWhileLsActive = canPinBillingProvider({
  next: "dodo",
  lsStatus: "active",
});
assert(
  pinWhileLsActive.ok === false &&
    pinWhileLsActive.reason === "ls_subscription_active",
  "refuse pin to dodo while LS Pro is active",
);
assert(
  canPinBillingProvider({ next: "dodo", lsStatus: "cancelled" }).ok === true,
  "pin to dodo ok after LS cancel",
);
assert(
  canPinBillingProvider({ next: "lemon", dodoStatus: "active" }).ok === false,
  "refuse pin to lemon while Dodo Pro is active",
);

assert(
  lsPlatformEventAction({ provider: "dodo", nextPlan: "pro" }) ===
    "skip_promote",
  "LS promote no-ops when provider is dodo",
);
assert(
  lsPlatformEventAction({ provider: "dodo", nextPlan: "free" }) === "apply",
  "LS demotion still applies when provider is dodo",
);
assert(
  planAfterForeignDemotion({ nextPlan: "free", otherMorActive: false }) ===
    "free",
  "LS demotion clears Pro when Dodo is not active",
);
assert(
  planAfterForeignDemotion({ nextPlan: "free", otherMorActive: true }) ===
    "pro",
  "LS demotion keeps Pro only if Dodo is still active",
);
assert(
  dodoPlatformEventAction({ provider: "lemon", nextPlan: "pro" }) ===
    "skip_promote",
  "Dodo promote no-ops when provider is lemon",
);

assert(
  usageIngestSettlesFeePeriod() === false,
  "fee path never settles on usage ingest",
);

assert(packExtraDeclines(1) === 10, "one pack credits +10 declines");
assert(packExtraDeclines(2) === 20, "two packs credit +20 declines");
assert(
  nextDeclinePackExtra(10, 1) === 20,
  "pack payment stacks extra declines",
);
const packRefs = extractDodoUserRefs({
  convex_user_id: "user123",
  billing_kind: "pack",
  quantity: "2",
});
assert(packRefs.billingKind === "pack", "pack payment carries billing_kind");

assert(
  otherMorBlocksCheckout({
    target: "dodo",
    lsActive: true,
    dodoActive: false,
  }) === true,
  "block Dodo checkout while LS is still active",
);
assert(
  otherMorBlocksCheckout({
    target: "lemon",
    lsActive: false,
    dodoActive: true,
  }) === true,
  "block Lemon checkout while Dodo is still active",
);
assert(
  hasDualActiveSubscriptions({ lsActive: true, dodoActive: true }) === true,
  "dual-sub is detected so activate must clear the other MoR",
);
assert(
  !otherMorBlocksCheckout({
    target: "dodo",
    lsActive: false,
    dodoActive: false,
  }),
  "checkout allowed when the other MoR is not active",
);

assert(!isDodoTestBillingAllowed(undefined), "unset must not allow test billing");
assert(isDodoTestBillingAllowed("true"), "true allows test billing");
assert(
  shouldIgnoreDodoTestEvent(true, undefined),
  "test_mode without allow env must be ignored",
);
assert(
  !shouldIgnoreDodoTestEvent(true, "true"),
  "test_mode with ALLOW_DODO_TEST_BILLING=true must apply",
);

const usageId = dodoUsageEventId({
  invoiceId: "inv_1",
  claimKey: "fee-invoice:user:2026-10",
});
assert(
  usageId === "fee-usage:fee-invoice:user:2026-10:inv_1",
  "usage event id is deterministic (idempotent ingest)",
);

assert(
  dodoWebhookEventKey({
    webhookId: "msg_123",
    eventType: "subscription.active",
    resourceId: "sub_1",
  }) === "dodo:msg_123",
  "webhook-id is the idempotency key",
);
assert(
  dodoWebhookEventKey({
    webhookId: "",
    eventType: "payment.succeeded",
    resourceId: "pay_9",
  }) === "dodo:payment.succeeded:pay_9",
  "fallback event key uses type + resource",
);

const refs = extractDodoUserRefs({
  convex_user_id: "user123",
  clerk_user_id: "clerk123",
  checkout_nonce: "abc",
  claim_key: "fee-invoice:user:2026-10",
  billing_kind: "pro",
});
assert(refs.convexUserId === "user123", "extract convex_user_id");
assert(refs.checkoutNonce === "abc", "extract checkout_nonce");
assert(refs.claimKey === "fee-invoice:user:2026-10", "extract claim_key");

assert(
  existingClaimBlocksNewCharge("created", 1, true) === true,
  "created + checkout id blocks second charge",
);
assert(
  existingClaimBlocksNewCharge("paid", 1, false) === true,
  "paid blocks second charge",
);
assert(
  existingClaimBlocksNewCharge("failed", 0, false) === false,
  "failed is retryable",
);
assert(
  existingClaimBlocksNewCharge("claiming", 0, false) === false,
  "empty claiming is retryable",
);
assert(
  existingClaimBlocksNewCharge("claiming", 0, true) === true,
  "claiming with provider checkout id blocks dual charge",
);

assert(
  parseStandardWebhookSignatures("v1,abc v1,def")[0] === "abc",
  "parse v1 signatures",
);
assert(
  standardWebhookTimestampOk("1000", 1000, 300),
  "matching timestamp is ok",
);
assert(
  !standardWebhookTimestampOk("1000", 2000, 300),
  "stale timestamp is rejected",
);

const secretBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
const secretB64 = btoa(String.fromCharCode(...secretBytes));
const parsedSecret = parseStandardWebhookSecret(`whsec_${secretB64}`);
assert(parsedSecret != null && parsedSecret.length === 8, "parse whsec secret");

const nowSec = 1_700_000_000;
const body = '{"type":"subscription.active"}';
const signed = `wh_1.${nowSec}.${body}`;
const expected = await hmacSha256Base64(secretBytes, signed);
assert(
  await verifyStandardWebhook({
    rawBody: body,
    headers: {
      id: "wh_1",
      timestamp: String(nowSec),
      signature: `v1,${expected}`,
    },
    secrets: [`whsec_${secretB64}`],
    nowSec,
  }),
  "valid Standard Webhooks signature must pass",
);
assert(
  !(await verifyStandardWebhook({
    rawBody: body,
    headers: {
      id: "wh_1",
      timestamp: String(nowSec),
      signature: "v1,aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa=",
    },
    secrets: [`whsec_${secretB64}`],
    nowSec,
  })),
  "invalid signature must fail",
);

console.log("assert-dodo-billing: ok");
