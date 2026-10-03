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
import { existingClaimBlocksNewCharge } from "../convex/lib/feeBilling";
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
  dodoFeePathDecision,
  dodoUsageEventId,
  extractDodoUserRefs,
  feeCentsToUsageUsd,
  isDodoTestBillingAllowed,
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
    creditSrc.includes("releaseHeldAndSchedule"),
  "Dodo plan promote unholds hold-queue",
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

console.log("assert-dodo-billing: ok");
