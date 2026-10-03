/**
 * Pure-function checks for Dodo billing flag, no dual-charge, webhook keys.
 * Run: npx tsx scripts/assert-dodo-billing.ts
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
import {
  dodoIngestPeriodKey,
  dodoUsagePeriodKey,
  existingClaimBlocksNewCharge,
  previousUtcPeriodKey,
  utcPeriodKey,
} from "../convex/lib/feeBilling";
import {
  availableDeclineCapacity,
  clampPackQuantity,
  declineCapacity,
  dodoPackCreditDecision,
  includedDeclinesPerMonth,
  heldRowsToRelease,
  holdQueueNowMs,
  matchesPackProduct,
  packQuantityPreferringCart,
  quotaHeldAfterLazyRelease,
  releaseSchedulesEmail,
  shouldHoldNewDecline,
  shouldUnholdOnMonthRollover,
  shouldUnholdOnPlanPromote,
  utcMonthStartMs,
  webhookSchedulesAfterUpsert,
  webhookSendsAfterUpsert,
} from "../convex/lib/declineCapacity";
import {
  DEFAULT_DODO_USAGE_EVENT_NAME,
  DODO_TEST_USAGE_METER_ID,
  assertUsdMeterAggregationKey,
  dodoFeePathDecision,
  dodoMeterAggregationKeyFromResponse,
  dodoPaymentAmountCents,
  dodoUsageChargeKind,
  dodoUsageEventId,
  dodoUsageMerchantMatch,
  dodoUsageMeterDecision,
  dodoPaymentProductIds,
  dodoUsageSettleFromPayment,
  dodoUsageSettlePayloadDecision,
  extractDodoUserRefs,
  feeCentsToUsageUsd,
  invoiceMatchesUsageCharge,
  usageCreditAppliesToInvoice,
  isDodoTestBillingAllowed,
  isDodoUpdatePaymentMethod,
  parseIsoMsStrict,
  pickUniqueDodoCustomerUser,
  planFromDodoStatus,
  resolveDodoUsageEventName,
  shouldIgnoreDodoTestEvent,
  shouldOpenDodoFeeCheckout,
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
assert(
  resolveDodoUsageEventName(undefined) === "recovery.fee",
  "unset usage event name is recovery.fee",
);
assert(
  resolveDodoUsageEventName("") === "recovery.fee",
  "empty usage event name is recovery.fee",
);
assert(
  resolveDodoUsageEventName("recovery.fee") === "recovery.fee",
  "env recovery.fee is used as-is",
);
assert(
  resolveDodoUsageEventName("recovery_fee_cents") === "recovery.fee",
  "must not emit recovery_fee_cents",
);
assert(
  DEFAULT_DODO_USAGE_EVENT_NAME === "recovery.fee",
  "default event name is recovery.fee",
);
assert(
  DODO_TEST_USAGE_METER_ID === "mtr_0NottfCQQuRMUjzfjZgJY",
  "known test meter id is not invented",
);
assert(
  feeCentsToUsageUsd(199) === 1.99 && feeCentsToUsageUsd(100) === 1,
  "fee cents convert to USD dollars once",
);
assert(
  dodoFeePathDecision({
    dodoCustomerId: "cus_1",
    dodoSubscriptionId: "sub_1",
    hasActivePro: true,
  }).path === "usage",
  "Dodo Pro with customer+sub takes usage path",
);
assert(
  dodoFeePathDecision({
    dodoCustomerId: null,
    dodoSubscriptionId: "sub_1",
    hasActivePro: true,
  }).reason === "missing_dodo_customer",
  "no Dodo customer fails closed",
);
assert(
  dodoFeePathDecision({
    dodoCustomerId: "cus_1",
    dodoSubscriptionId: null,
    hasActivePro: true,
  }).reason === "missing_dodo_subscription",
  "no Dodo subscription fails closed",
);
assert(
  shouldOpenDodoFeeCheckout({ canTakeUsage: true }) === false,
  "Dodo Pro 4% must not also open one-time fee checkout",
);
assert(
  shouldOpenDodoFeeCheckout({ canTakeUsage: false }) === false,
  "missing usage target must not silently fall back to fee checkout",
);
assert(
  dodoUsageEventId({
    invoiceId: "inv_1",
    claimKey: "fee-invoice:user:2026-10",
  }) === "fee-usage:fee-invoice:user:2026-10:inv_1",
  "usage event id is deterministic (idempotent ingest)",
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

assert(includedDeclinesPerMonth("free") === 50, "Free included declines is 50");
assert(includedDeclinesPerMonth("pro") === 500, "Pro included declines is 500");
assert(
  declineCapacity({ plan: "free", packExtra: 0 }) === 50,
  "Free capacity without packs is 50",
);
assert(
  declineCapacity({ plan: "pro", packExtra: 0 }) === 500,
  "Pro capacity without packs is 500",
);
const usedAtFreeCap = 50;
const capacityBeforePack = availableDeclineCapacity({
  plan: "free",
  packExtra: 0,
  usedActive: usedAtFreeCap,
});
const capacityAfterPack = availableDeclineCapacity({
  plan: "free",
  packExtra: packExtraDeclines(1),
  usedActive: usedAtFreeCap,
});
assert(
  capacityBeforePack === 0 && capacityAfterPack === 10,
  "packExtraDeclines increases available decline capacity (not a dead write)",
);
assert(
  shouldHoldNewDecline({
    usedActive: usedAtFreeCap,
    capacity: declineCapacity({ plan: "free", packExtra: 0 }),
  }),
  "new declines hold at Free 50 without a pack",
);
assert(
  !shouldHoldNewDecline({
    usedActive: usedAtFreeCap,
    capacity: declineCapacity({
      plan: "free",
      packExtra: packExtraDeclines(1),
    }),
  }),
  "purchased +10 unblocks hold-queue capacity",
);

assert(clampPackQuantity(100) === 20, "pack quantity clamps at 20");
assert(packExtraDeclines(100) === 200, "credit quantity clamp is ≤20 packs");
assert(
  packQuantityPreferringCart({ cartQuantity: 3, metadataQuantity: 99 }) === 3,
  "product_cart qty wins over metadata",
);
assert(
  packQuantityPreferringCart({ cartQuantity: null, metadataQuantity: 2 }) === 2,
  "metadata qty is fallback when cart missing",
);
assert(
  matchesPackProduct({
    productId: "pack_live",
    expectedProductId: "pack_live",
  }),
  "pack product id match",
);
assert(
  !matchesPackProduct({
    productId: "fee_live",
    expectedProductId: "pack_live",
  }),
  "pack product id mismatch",
);
assert(
  !matchesPackProduct({ productId: "pack_live", expectedProductId: null }),
  "unset PACK_PRODUCT_ID cannot credit",
);

const ignoredPack = dodoPackCreditDecision({
  testMode: true,
  allowTestBilling: undefined,
  productId: "pack_live",
  expectedProductId: "pack_live",
  quantity: 1,
});
assert(
  ignoredPack.credit === false && ignoredPack.reason === "test_mode_ignored",
  "pack credit uses same test_mode_ignored contract as applyDodoSubscription",
);
assert(
  dodoPackCreditDecision({
    testMode: true,
    allowTestBilling: "true",
    productId: "pack_live",
    expectedProductId: "pack_live",
    quantity: 1,
  }).credit === true,
  "ALLOW_DODO_TEST_BILLING=true applies pack credit",
);
assert(
  dodoPackCreditDecision({
    testMode: false,
    productId: "other",
    expectedProductId: "pack_live",
    quantity: 1,
  }).reason === "product_mismatch",
  "pack credit requires PACK_PRODUCT_ID match",
);
assert(
  dodoPackCreditDecision({
    testMode: false,
    productId: "pack_live",
    expectedProductId: "pack_live",
    quantity: 99,
  }).extraDeclines === 200,
  "pack credit clamps quantity ≤20",
);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const packActionsSrc = readFileSync(
  join(repoRoot, "convex/functions/dodoBillingActions.ts"),
  "utf8",
);
const creditSrc = readFileSync(
  join(repoRoot, "convex/functions/dodoBilling.ts"),
  "utf8",
);
const recoveriesSrc = readFileSync(
  join(repoRoot, "convex/functions/recoveries.ts"),
  "utf8",
);
assert(
  packActionsSrc.includes("export const createPackCheckout"),
  "Jules createPackCheckout still exists",
);
assert(
  packActionsSrc.includes("DODO_PAYMENTS_PACK_PRODUCT_ID"),
  "createPackCheckout throws not-configured when PACK_PRODUCT_ID unset",
);
assert(
  !packActionsSrc.includes("Pack checkout is disabled until"),
  "createPackCheckout is not hard-disabled (capacity consumer shipped)",
);
assert(
  creditSrc.includes("dodoPackCreditDecision") &&
    creditSrc.includes("releaseHeldAndSchedule"),
  "pack webhook credits through decision + hold-queue release",
);
assert(
  recoveriesSrc.includes("shouldHoldInsert") &&
    recoveriesSrc.includes("quotaHeld") &&
    recoveriesSrc.includes("releaseHeldAndSchedule"),
  "upsertFailedPayment consumes decline capacity / hold-queue + lazy month unhold",
);

const jan = Date.UTC(2026, 0, 15);
const feb = Date.UTC(2026, 1, 2);
assert(
  utcMonthStartMs(feb) !== utcMonthStartMs(jan),
  "February is a new UTC month vs January",
);
assert(
  shouldUnholdOnMonthRollover({
    lastReleasedMonthStart: utcMonthStartMs(jan),
    nowMs: feb,
  }),
  "month rollover must unhold when last release was prior month",
);
assert(
  !shouldUnholdOnMonthRollover({
    lastReleasedMonthStart: utcMonthStartMs(feb),
    nowMs: feb,
  }),
  "same-month stamp skips a second rollover unhold",
);
const rolloverSlots = availableDeclineCapacity({
  plan: "free",
  packExtra: 0,
  usedActive: 0,
});
assert(
  rolloverSlots === 50 &&
    heldRowsToRelease({ heldCount: 20, availableSlots: rolloverSlots }) === 20,
  "month rollover drains held backlog when capacity is available",
);
assert(
  heldRowsToRelease({ heldCount: 80, availableSlots: rolloverSlots }) === 50,
  "month rollover unhold is still capped by monthly capacity",
);

assert(
  shouldUnholdOnPlanPromote({ priorPlan: "free", nextPlan: "pro" }),
  "Free→Pro promote must unhold",
);
assert(
  !shouldUnholdOnPlanPromote({ priorPlan: "pro", nextPlan: "free" }),
  "Pro→Free demote must not unhold",
);
assert(
  !shouldUnholdOnPlanPromote({ priorPlan: "pro", nextPlan: "pro" }),
  "Pro renewal is not a capacity-increase unhold",
);
const promoteSlots = availableDeclineCapacity({
  plan: "pro",
  packExtra: 0,
  usedActive: 50,
});
assert(
  availableDeclineCapacity({
    plan: "free",
    packExtra: 0,
    usedActive: 50,
  }) === 0 &&
    promoteSlots === 450 &&
    heldRowsToRelease({ heldCount: 20, availableSlots: promoteSlots }) === 20,
  "Free→Pro capacity increase drains Free hold backlog",
);

const cronsSrc = readFileSync(join(repoRoot, "convex/crons.ts"), "utf8");
const billingSrc = readFileSync(
  join(repoRoot, "convex/functions/billing.ts"),
  "utf8",
);
assert(
  cronsSrc.includes("runMonthlyHeldDeclineRelease"),
  "monthly cron drains held backlog",
);
const holdActionsSrc = readFileSync(
  join(repoRoot, "convex/functions/declineHoldActions.ts"),
  "utf8",
);
assert(
  holdActionsSrc.includes("runMonthlyHeldDeclineRelease") &&
    recoveriesSrc.includes("releaseHeldDeclinesForUser"),
  "month-boundary release mutation/action exist",
);
assert(
  billingSrc.includes("shouldUnholdOnPlanPromote") &&
    billingSrc.includes("releaseHeldAndSchedule"),
  "LS plan promote unholds hold-queue",
);
assert(
  creditSrc.includes("shouldUnholdOnPlanPromote") &&
    creditSrc.includes("releaseHeldAndSchedule") &&
    creditSrc.includes("dodoProductId: args.productId") &&
    creditSrc.includes("dodoOnDemand"),
  "Dodo plan promote unholds hold-queue; off-Pro product is persisted",
);
assert(
  creditSrc.includes("allWithPayment") &&
    creditSrc.includes("already_credited"),
  "pack credit OCC-dedupes concurrent paymentId inserts",
);

const waitToNudgeHeld = quotaHeldAfterLazyRelease({ rowStillHeld: false });
assert(
  waitToNudgeHeld === false,
  "wait→nudge at month boundary returns quotaHeld false after release",
);
assert(
  webhookSendsAfterUpsert({
    quotaHeld: waitToNudgeHeld,
    recoveryAction: "nudge_update_pm",
  }),
  "wait→nudge at month boundary schedules/sends after lazy unhold",
);
assert(
  !releaseSchedulesEmail("wait") &&
    webhookSchedulesAfterUpsert({
      quotaHeld: false,
      recoveryAction: "nudge_update_pm",
      releaseScheduledThisFailure: false,
    }),
  "wait→nudge: release does not schedule; webhook sends once",
);
const dualHeldNudgeRelease = releaseSchedulesEmail("nudge_update_pm");
const dualHeldNudgeWebhook = webhookSchedulesAfterUpsert({
  quotaHeld: false,
  recoveryAction: "nudge_update_pm",
  releaseScheduledThisFailure: dualHeldNudgeRelease,
});
assert(
  dualHeldNudgeRelease && !dualHeldNudgeWebhook,
  "held open already nudge + lazy unhold: release sends, webhook must not dual-schedule",
);
assert(
  releaseSchedulesEmail("push_update_pm") &&
    !webhookSchedulesAfterUpsert({
      quotaHeld: false,
      recoveryAction: "push_update_pm",
      releaseScheduledThisFailure: true,
    }),
  "held open already push + lazy unhold: no dual sendForFailure",
);
assert(
  !webhookSendsAfterUpsert({
    quotaHeld: quotaHeldAfterLazyRelease({ rowStillHeld: true }),
    recoveryAction: "nudge_update_pm",
  }),
  "still-held nudge must not send",
);
assert(
  recoveriesSrc.includes("afterRelease") &&
    recoveriesSrc.includes("quotaHeldAfterLazyRelease"),
  "upsert re-reads quotaHeld after lazy release (not pre-release open doc)",
);

const packPaidAt = Date.UTC(2026, 0, 31, 23, 0, 0);
const packNow = Date.UTC(2026, 1, 1, 0, 5, 0);
assert(
  holdQueueNowMs(packNow) === packNow &&
    holdQueueNowMs(packNow) !== packPaidAt &&
    utcMonthStartMs(holdQueueNowMs(packNow)) !== utcMonthStartMs(packPaidAt),
  "pack hold clock is wall nowMs, not paidAt (no month rewind)",
);
assert(
  !creditSrc.includes("nowMs: args.paidAt"),
  "pack release must not pass paidAt as nowMs",
);
assert(
  creditSrc.includes("holdQueueNowMs(Date.now())") &&
    creditSrc.includes("creditedAt: args.paidAt"),
  "pack uses Date.now() for hold release; paidAt is creditedAt only",
);
assert(
  recoveriesSrc.includes("listHeldDeclineUserPage") &&
    holdActionsSrc.includes("paginationOpts"),
  "month cron paginates held users (no take(2000) cap)",
);
const lemonWebhookSrc = readFileSync(
  join(repoRoot, "convex/lemonWebhook.ts"),
  "utf8",
);
assert(
  recoveriesSrc.includes("releaseScheduledEmail") &&
    recoveriesSrc.includes("scheduledFailureIds") &&
    lemonWebhookSrc.includes("releaseScheduledEmail"),
  "upsert returns releaseScheduledEmail; webhook skips dual sendForFailure",
);

const feeActionsSrc = readFileSync(
  join(repoRoot, "convex/functions/feeBillingActions.ts"),
  "utf8",
);
const dodoPaymentsSrc = readFileSync(
  join(repoRoot, "convex/lib/dodoPayments.ts"),
  "utf8",
);
const docsSrc = readFileSync(
  join(repoRoot, "docs/dodo-payments-billing.md"),
  "utf8",
);
assert(
  feeActionsSrc.includes("ingestDodoUsageEvents") &&
    feeActionsSrc.includes("attachDodoUsageSubmitted") &&
    feeActionsSrc.includes("dodoFeePathDecision"),
  "Dodo Pro 4% emits usage; one-time checkout is not the only path",
);
assert(
  !feeActionsSrc.includes("createDodoCheckoutSession"),
  "Dodo Pro fee path must not open FEE_PRODUCT checkout",
);
assert(
  !feeActionsSrc.includes("markBillingInvoicePaid"),
  "usage ingest must not mark the fee period paid",
);
assert(
  feeActionsSrc.includes("usageIngestSettlesFeePeriod") &&
    dodoPaymentsSrc.includes('DEFAULT_DODO_USAGE_EVENT_NAME = "recovery.fee"'),
  "ingest settlement guard + recovery.fee default are wired",
);
assert(
  !dodoPaymentsSrc.includes('event_name: "recovery_fee_cents"') &&
    !feeActionsSrc.includes("recovery_fee_cents"),
  "must not hardcode recovery_fee_cents as the emitted event",
);
assert(
  docsSrc.includes("recovery.fee") &&
    docsSrc.includes("mtr_0NottfCQQuRMUjzfjZgJY") &&
    docsSrc.includes("Ingest is not paid") &&
    !docsSrc.includes("recovery_fee_cents") &&
    !docsSrc.includes("docs-only meter"),
  "docs: recovery.fee + test meter are the Pro-invoice path",
);
assert(
  parseBillingProviderEnv(undefined) === "lemon",
  "BILLING_PROVIDER default stays lemon",
);

const janUsageSubmittedAt = Date.UTC(2026, 0, 15);
const decUsageSubmittedAt = Date.UTC(2025, 11, 15);
const subscriptionSignupAt = Date.UTC(2025, 5, 1);
const day1FebIngestAt = Date.UTC(2026, 1, 1, 6, 0, 0);
const day1FebChargeAt = Date.UTC(2026, 1, 1, 0, 30, 0);
const februaryRenewalAt = Date.UTC(2026, 1, 20, 15, 0, 0);
const midJanForceRunAt = Date.UTC(2026, 0, 15, 12, 0, 0);
assert(
  utcPeriodKey(day1FebIngestAt) === "2026-02" &&
    dodoUsagePeriodKey(day1FebIngestAt) === "2026-01" &&
    previousUtcPeriodKey(februaryRenewalAt) === "2026-01" &&
    dodoUsagePeriodKey(februaryRenewalAt) === "2026-01" &&
    dodoUsagePeriodKey(day1FebChargeAt) === "2026-01" &&
    dodoUsagePeriodKey(day1FebIngestAt) ===
      dodoUsagePeriodKey(februaryRenewalAt),
  "day-1 ingest period equals the period a later Pro charge in that cycle settles",
);
assert(
  dodoIngestPeriodKey({
    nowMs: day1FebIngestAt,
    scheduledMonthClose: true,
  }) === "2026-01" &&
    dodoIngestPeriodKey({
      nowMs: midJanForceRunAt,
      scheduledMonthClose: false,
    }) === "2026-01" &&
    dodoIngestPeriodKey({
      nowMs: midJanForceRunAt,
      scheduledMonthClose: true,
    }) === "2025-12",
  "only scheduled month-close stamps the previous month; force-run stamps the current month",
);
assert(
  parseIsoMsStrict(null) === null &&
    parseIsoMsStrict("") === null &&
    parseIsoMsStrict(subscriptionSignupAt) === null,
  "usage paidAt parser never falls back to Date.now() or non-ISO values",
);
assert(
  parseIsoMsStrict("2026-02-20T15:00:00.000Z") === februaryRenewalAt &&
    parseIsoMsStrict("2026-02-01T00:30:00.000Z") === day1FebChargeAt,
  "payment created_at is the usage paidAt",
);

function proRenewalPayment(overrides: Record<string, unknown> = {}) {
  return {
    payment_id: "pay_renewal",
    subscription_id: "sub_pro",
    customer_id: "cus_1",
    total_amount: 2999,
    currency: "USD",
    status: "succeeded",
    created_at: "2026-02-20T15:00:00.000Z",
    ...overrides,
  };
}

const proRenewal = dodoUsageSettleFromPayment({
  eventType: "payment.succeeded",
  payment: proRenewalPayment(),
  hasFeeClaimKey: false,
  expectedProProductId: "prod_pro",
  merchantProSubscriptionId: "sub_pro",
  merchantProductId: "prod_pro",
});
assert(
  proRenewal.settle === true &&
    proRenewal.coveredPeriodKey === dodoUsagePeriodKey(day1FebIngestAt) &&
    proRenewal.paidAt === februaryRenewalAt &&
    proRenewal.paidAt !== subscriptionSignupAt,
  "this merchant's Pro renewal settles the day-1 ingested usage month",
);
assert(
  invoiceMatchesUsageCharge({
    status: "created",
    periodKey: "2026-01",
    coveredPeriodKey: proRenewal.settle ? proRenewal.coveredPeriodKey : "",
    dodoUsageSubmittedAt: janUsageSubmittedAt,
  }),
  "January usage ingested after signup is on the February Pro charge",
);

const day1Charge = dodoUsageSettleFromPayment({
  eventType: "payment.succeeded",
  payment: proRenewalPayment({
    payment_id: "pay_feb1",
    created_at: "2026-02-01T00:30:00.000Z",
  }),
  hasFeeClaimKey: false,
  expectedProProductId: "prod_pro",
  merchantProSubscriptionId: "sub_pro",
  merchantProductId: "prod_pro",
});
assert(
  day1Charge.settle === true &&
    day1Charge.coveredPeriodKey === "2026-01" &&
    day1Charge.paidAt === day1FebChargeAt,
  "00:30 UTC 1 Feb charge keys January, paidAt is payment created_at",
);
assert(
  invoiceMatchesUsageCharge({
    status: "created",
    periodKey: "2026-01",
    coveredPeriodKey: day1Charge.settle ? day1Charge.coveredPeriodKey : "",
    dodoUsageSubmittedAt: day1FebIngestAt,
  }),
  "January usage submitted after the 00:30 charge is still the row that charge collected",
);
assert(
  usageCreditAppliesToInvoice({
    invoicePeriodKey: "2026-01",
    invoiceStatus: "created",
    creditPeriodKey: "2026-01",
    creditPaidAt: day1FebChargeAt,
  }),
  "charge-first credit applies when ingest later stamps January",
);
assert(
  !usageCreditAppliesToInvoice({
    invoicePeriodKey: "2026-02",
    invoiceStatus: "created",
    creditPeriodKey: "2026-01",
    creditPaidAt: day1FebChargeAt,
  }),
  "January credit must not settle a February ingest row",
);

for (const eventType of [
  "subscription.active",
  "subscription.renewed",
  "subscription.updated",
] as const) {
  const activation = dodoUsageSettleFromPayment({
    eventType,
    payment: proRenewalPayment({
      created_at: "2025-06-01T00:00:00.000Z",
    }),
    hasFeeClaimKey: false,
    expectedProProductId: "prod_pro",
    merchantProSubscriptionId: "sub_pro",
    merchantProductId: "prod_pro",
  });
  assert(
    activation.settle === false &&
      activation.reason === "not_payment_succeeded",
    `${eventType} must not mark usage paid`,
  );
}

assert(
  !invoiceMatchesUsageCharge({
    status: "created",
    periodKey: "2025-12",
    coveredPeriodKey: "2026-01",
    dodoUsageSubmittedAt: decUsageSubmittedAt,
  }),
  "one February payment must not close December",
);

const updatePm = dodoUsageSettleFromPayment({
  eventType: "payment.succeeded",
  payment: proRenewalPayment({
    total_amount: 0,
    is_update_payment_method: true,
  }),
  hasFeeClaimKey: false,
  expectedProProductId: "prod_pro",
  merchantProSubscriptionId: "sub_pro",
  merchantProductId: "prod_pro",
});
assert(
  updatePm.settle === false &&
    updatePm.reason === "update_payment_method" &&
    isDodoUpdatePaymentMethod({ is_update_payment_method: true }) &&
    dodoPaymentAmountCents({ total_amount: 0 }) === 0,
  "$0 update-payment-method must not settle usage",
);
assert(
  dodoUsageSettleFromPayment({
    eventType: "payment.succeeded",
    payment: proRenewalPayment({ created_at: undefined }),
    hasFeeClaimKey: false,
    expectedProProductId: "prod_pro",
    merchantProSubscriptionId: "sub_pro",
    merchantProductId: "prod_pro",
  }).reason === "missing_payment_created_at",
  "missing payment created_at must not settle (no Date.now())",
);
assert(
  dodoUsageSettleFromPayment({
    eventType: "payment.succeeded",
    payment: proRenewalPayment({ total_amount: 199 }),
    hasFeeClaimKey: true,
    expectedProProductId: "prod_pro",
    merchantProSubscriptionId: "sub_pro",
    merchantProductId: "prod_pro",
  }).reason === "fee_claim_key",
  "fee claim_key must not settle usage",
);

const nonProProduct = dodoUsageSettleFromPayment({
  eventType: "payment.succeeded",
  payment: proRenewalPayment({
    product: { product_id: "prod_addon" },
    total_amount: 500,
  }),
  hasFeeClaimKey: false,
  expectedProProductId: "prod_pro",
  merchantProSubscriptionId: "sub_pro",
  merchantProductId: "prod_pro",
});
assert(
  nonProProduct.settle === false && nonProProduct.reason === "non_pro_product",
  "a non-Pro product id on nested product does not settle",
);
assert(
  dodoPaymentProductIds({
    product: { id: "prod_addon" },
  }).includes("prod_addon"),
  "product id is read from nested product when product_cart is absent",
);

const subWithoutPro = dodoUsageSettleFromPayment({
  eventType: "payment.succeeded",
  payment: proRenewalPayment({ subscription_id: "sub_other" }),
  hasFeeClaimKey: false,
  expectedProProductId: "prod_pro",
  merchantProSubscriptionId: null,
});
assert(
  subWithoutPro.settle === false &&
    subWithoutPro.reason === "subscription_not_merchant_pro",
  "subscription_id without Pro does not settle",
);
assert(
  dodoUsageSettlePayloadDecision({
    eventType: "payment.succeeded",
    hasFeeClaimKey: false,
    subscriptionId: "sub_other",
    productIds: [],
    expectedProProductId: "prod_pro",
    chargeKind: "recurring",
    isUpdatePaymentMethod: false,
    amountCents: 2999,
    paymentCreatedAtMs: februaryRenewalAt,
  }).settle === true &&
    dodoUsageMerchantMatch({
      paymentSubscriptionId: "sub_other",
      merchantProSubscriptionId: "sub_pro",
    }).ok === false,
  "payload may look like a subscription charge; merchant Pro-sub match still rejects",
);

assert(
  dodoUsageChargeKind({
    payment: proRenewalPayment(),
  }) === "recurring",
  "real renewal (subscription_id, no cart) is recurring",
);
assert(
  dodoUsageChargeKind({
    payment: proRenewalPayment({
      on_demand: true,
      is_proration: true,
      addon: true,
      payment_type: "on_demand",
    }),
  }) === "recurring",
  "invented payment flags must not classify a real renewal",
);
assert(
  dodoUsageChargeKind({
    payment: proRenewalPayment({
      product_cart: [{ addon_id: "addon_1", quantity: 1 }],
    }),
  }) === "addon" &&
    dodoUsageSettleFromPayment({
      eventType: "payment.succeeded",
      payment: proRenewalPayment({
        product_cart: [{ addon_id: "addon_1", quantity: 1 }],
        total_amount: 500,
      }),
      hasFeeClaimKey: false,
      expectedProProductId: "prod_pro",
      merchantProSubscriptionId: "sub_pro",
      merchantProductId: "prod_pro",
    }).reason === "not_pro_recurring_charge",
  "addon_id on product_cart does not settle",
);
assert(
  dodoUsageChargeKind({
    payment: proRenewalPayment({
      product_cart: [
        { product_id: "prod_pro", addons: [{ addon_id: "addon_1" }] },
      ],
    }),
  }) === "addon",
  "nested cart addons are addons",
);
assert(
  dodoUsageChargeKind({
    payment: proRenewalPayment({
      product_cart: [{ product_id: "prod_other", quantity: 1 }],
    }),
  }) === "proration" &&
    dodoUsageSettleFromPayment({
      eventType: "payment.succeeded",
      payment: proRenewalPayment({
        product_cart: [{ product_id: "prod_other", quantity: 1 }],
      }),
      hasFeeClaimKey: false,
      expectedProProductId: "prod_pro",
      merchantProSubscriptionId: "sub_pro",
      merchantProductId: "prod_pro",
    }).reason === "not_pro_recurring_charge",
  "product_cart + subscription_id is proration, not a renewal",
);
assert(
  dodoUsageChargeKind({
    payment: {
      payment_id: "pay_one",
      product_cart: [{ product_id: "prod_fee", quantity: 1 }],
      total_amount: 199,
      created_at: "2026-02-20T15:00:00.000Z",
    },
  }) === "one_time",
  "cart without subscription_id is one-time",
);
assert(
  dodoUsageChargeKind({
    payment: proRenewalPayment(),
    subscriptionOnDemand: true,
  }) === "on_demand" &&
    dodoUsageSettleFromPayment({
      eventType: "payment.succeeded",
      payment: proRenewalPayment(),
      hasFeeClaimKey: false,
      expectedProProductId: "prod_pro",
      merchantProSubscriptionId: "sub_pro",
      merchantProductId: "prod_pro",
      merchantOnDemand: true,
    }).settle === false &&
    dodoUsageSettlePayloadDecision({
      eventType: "payment.succeeded",
      hasFeeClaimKey: false,
      subscriptionId: "sub_pro",
      productIds: [],
      expectedProProductId: "prod_pro",
      chargeKind: "recurring",
      isUpdatePaymentMethod: false,
      amountCents: 2999,
      paymentCreatedAtMs: februaryRenewalAt,
    }).settle === true &&
    dodoUsageMerchantMatch({
      paymentSubscriptionId: "sub_pro",
      merchantProSubscriptionId: "sub_pro",
      merchantProductId: "prod_pro",
      expectedProProductId: "prod_pro",
      merchantOnDemand: true,
    }).ok === false,
  "subscription.on_demand is read from the stored subscription, not invented payment flags",
);
assert(
  dodoUsageSettleFromPayment({
    eventType: "payment.succeeded",
    payment: proRenewalPayment(),
    hasFeeClaimKey: false,
    expectedProProductId: "prod_pro",
    merchantProSubscriptionId: "sub_pro",
    merchantProductId: "prod_other",
  }).reason === "subscription_not_merchant_pro",
  "after the stored product changes off Pro, usage does not settle",
);
assert(
  dodoUsageSettleFromPayment({
    eventType: "payment.succeeded",
    payment: proRenewalPayment(),
    hasFeeClaimKey: false,
    expectedProProductId: "prod_pro",
    merchantProSubscriptionId: "sub_pro",
    merchantProductId: "prod_pro",
  }).settle === true,
  "renewal of the stored Pro subscription with no payment product_id still settles",
);
assert(
  pickUniqueDodoCustomerUser({
    users: [{ dodoSubscriptionId: "sub_other" }],
    dodoSubscriptionId: "sub_pro",
  }) === null &&
    dodoUsageMerchantMatch({
      paymentSubscriptionId: "sub_pro",
      merchantProSubscriptionId: "sub_other",
    }).ok === false,
  "one customer row with a different subscription id does not settle",
);

const missingMeter = dodoUsageMeterDecision({
  meterId: null,
  aggregationKey: "usd",
});
assert(
  missingMeter.ingest === false &&
    missingMeter.reason === "missing_dodo_meter_id",
  "missing meter id must not ingest or mark submitted",
);
assert(
  dodoUsageMeterDecision({ meterId: "", aggregationKey: "usd" }).ingest ===
    false,
  "empty meter id fails closed",
);
const omittedKey = dodoUsageMeterDecision({
  meterId: DODO_TEST_USAGE_METER_ID,
  aggregationKey: null,
});
assert(
  omittedKey.ingest === false &&
    omittedKey.reason === "invalid_dodo_meter_aggregation_key",
  "omitted aggregation key must not invent usd",
);
assert(
  dodoUsageMeterDecision({
    meterId: DODO_TEST_USAGE_METER_ID,
    aggregationKey: "tokens",
  }).ingest === false,
  "non-usd aggregation key fails closed",
);
assert(
  dodoMeterAggregationKeyFromResponse({ aggregation: { type: "sum" } }) ===
    null &&
    dodoMeterAggregationKeyFromResponse({ name: "recovery.fee" }) === null,
  "GET without aggregation.key does not fall back to usd",
);
try {
  assertUsdMeterAggregationKey(null);
  throw new Error("expected assertUsdMeterAggregationKey to throw");
} catch (err) {
  assert(
    err instanceof Error &&
      err.message === "invalid_dodo_meter_aggregation_key",
    "null aggregation key throws rather than inventing usd",
  );
}
assert(
  dodoUsageMeterDecision({
    meterId: DODO_TEST_USAGE_METER_ID,
    aggregationKey: "usd",
  }).ingest === true,
  "known usd meter may ingest",
);
assert(
  pickUniqueDodoCustomerUser({
    users: [
      { dodoSubscriptionId: "sub_a" },
      { dodoSubscriptionId: "sub_b" },
    ],
    dodoSubscriptionId: undefined,
  }) === null,
  "ambiguous by_dodoCustomerId must not pick .first()",
);

const dodoWebhookSrc = readFileSync(
  join(repoRoot, "convex/dodoWebhook.ts"),
  "utf8",
);
const feeBillingSrc = readFileSync(
  join(repoRoot, "convex/functions/feeBilling.ts"),
  "utf8",
);
assert(
  feeBillingSrc.includes("usageCreditAppliesToInvoice") &&
    feeBillingSrc.includes("dodoUsageCreditPaidAt"),
  "ingest applies a same-period charge credit with payment created_at",
);
const subHandler = dodoWebhookSrc.slice(
  dodoWebhookSrc.indexOf("async function handleSubscriptionEvent"),
  dodoWebhookSrc.indexOf("async function handlePaymentEvent"),
);
assert(
  !subHandler.includes("settleDodoUsageFeeInvoices"),
  "subscription.active/renewed/updated must not call usage settle",
);
assert(
  dodoWebhookSrc.includes("parseIsoMsStrict(data.created_at)") &&
    dodoWebhookSrc.includes("coveredPeriodKey: decision.coveredPeriodKey") &&
    dodoWebhookSrc.includes("dodoUsageSettlePayloadDecision") &&
    dodoWebhookSrc.includes("dodoPaymentProductIds") &&
    dodoWebhookSrc.includes("dodoUsageChargeKind({ payment: data })") &&
    dodoWebhookSrc.includes("onDemand:") &&
    !dodoWebhookSrc.includes("dodoUsageChargeKind(data)") &&
    !dodoWebhookSrc.includes("hasSubscriptionId") &&
    !dodoWebhookSrc.includes("matchesProProduct"),
  "usage settle uses payment created_at + Pro payload gate, not signup/now",
);
const settleFn = feeBillingSrc.slice(
  feeBillingSrc.indexOf("export const settleDodoUsageFeeInvoices"),
  feeBillingSrc.indexOf("export const recordCheckoutEmailSent"),
);
assert(
  settleFn.includes("coveredPeriodKey") &&
    settleFn.includes("invoiceMatchesUsageCharge") &&
    settleFn.includes("dodoUsageMerchantMatch") &&
    settleFn.includes("dodoUsageCreditPeriodKey") &&
    settleFn.includes('.eq("periodKey", coveredPeriodKey)') &&
    !settleFn.includes(".take(24)") &&
    !settleFn.includes(".first()"),
  "settle matches the covered period instead of scanning oldest 24",
);
assert(
  feeActionsSrc.includes("dodoIngestPeriodKey({ nowMs, scheduledMonthClose })") &&
    feeActionsSrc.includes("invoiceMerchantViaDodo") &&
    feeActionsSrc.includes("scheduledMonthClose: boolean") &&
    !feeActionsSrc.includes("dodoUsagePeriodKey(nowMs),"),
  "scheduled Dodo ingest uses the closed month; force-run does not",
);
assert(
  feeActionsSrc.includes("requireDodoUsageMeterId") &&
    feeActionsSrc.includes("missing_dodo_meter_id") &&
    !feeActionsSrc.includes(": DEFAULT_DODO_USAGE_AGGREGATION_KEY"),
  "missing meter id must not ingest with invented usd",
);
assert(
  dodoPaymentsSrc.includes("assertUsdMeterAggregationKey") &&
    !dodoPaymentsSrc.includes(
      ": DEFAULT_DODO_USAGE_AGGREGATION_KEY;",
    ),
  "meter GET must not fall back to inventing usd",
);
assert(
  !dodoPaymentsSrc
    .slice(
      dodoPaymentsSrc.indexOf("export function dodoUsageSettleDecision"),
      dodoPaymentsSrc.indexOf("export function invoiceMatchesUsageCharge"),
    )
    .includes("Date.now()"),
  "settle decision paidAt is never Date.now()",
);

console.log("assert-dodo-billing: ok");
