import type { Plan } from "./accountGuard";
import type { BillingProviderId } from "./billingProvider";
import { dodoUsagePeriodKey } from "./feeBilling";

/**
 * Dodo Payments env (Convex dashboard — do not invent secrets in code):
 *
 *   DODO_PAYMENTS_API_KEY              Bearer token
 *   DODO_PAYMENTS_WEBHOOK_KEY          Standard Webhooks signing secret (whsec_…)
 *   DODO_PAYMENTS_WEBHOOK_KEY_PREVIOUS Optional rotation secret
 *   DODO_PAYMENTS_ENVIRONMENT          test_mode | live_mode (default test_mode)
 *   DODO_PAYMENTS_PRO_PRODUCT_ID       Pro $29.99/mo subscription product
 *   DODO_PAYMENTS_FEE_PRODUCT_ID       One-time recovery-fee product (amount override)
 *   DODO_PAYMENTS_PACK_PRODUCT_ID      Optional $0.99 +10 decline pack (one-time)
 *   DODO_PAYMENTS_USAGE_EVENT_NAME     Meter event name (default recovery.fee)
 *   DODO_PAYMENTS_METER_ID             Pro-invoice usage meter (test: mtr_0NottfCQQuRMUjzfjZgJY)
 *   ALLOW_DODO_TEST_BILLING            true|1 — let test_mode write users.plan
 *
 * Dashboard blockers until Fendem/CoS create the products + webhook:
 * Pro product id, fee product id, pack product id (if packs go live on Dodo),
 * usage meter (recovery.fee on the Pro invoice) + webhook → POST /dodo.
 */

export type DodoEnvironment = "test_mode" | "live_mode";

export type DodoPaymentsConfig = {
  apiKey: string;
  environment: DodoEnvironment;
  baseUrl: string;
  proProductId: string;
  feeProductId: string | null;
  packProductId: string | null;
  usageEventName: string;
  meterId: string | null;
};

const PROMOTE_STATUSES = new Set(["active", "renewed", "paid"]);
const DEMOTE_STATUSES = new Set([
  "cancelled",
  "canceled",
  "expired",
  "failed",
  "on_hold",
  "onhold",
  "paused",
  "unpaid",
  "past_due",
  "past-due",
]);

export const DODO_SUBSCRIPTION_EVENT_TYPES = [
  "subscription.active",
  "subscription.renewed",
  "subscription.on_hold",
  "subscription.cancelled",
  "subscription.failed",
  "subscription.expired",
  "subscription.plan_changed",
  "subscription.updated",
] as const;

export const DODO_PAYMENT_EVENT_TYPES = [
  "payment.succeeded",
  "payment.failed",
  "payment.cancelled",
] as const;

export function parseDodoEnvironment(
  raw: string | undefined,
): DodoEnvironment {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === "live_mode" || normalized === "live") return "live_mode";
  return "test_mode";
}

export function dodoApiBaseUrl(environment: DodoEnvironment): string {
  return environment === "live_mode"
    ? "https://live.dodopayments.com"
    : "https://test.dodopayments.com";
}

export function getDodoPaymentsConfig(
  env: NodeJS.ProcessEnv = process.env,
): DodoPaymentsConfig | null {
  const apiKey = env.DODO_PAYMENTS_API_KEY?.trim();
  const proProductId = env.DODO_PAYMENTS_PRO_PRODUCT_ID?.trim();
  if (!apiKey || !proProductId) return null;
  const environment = parseDodoEnvironment(env.DODO_PAYMENTS_ENVIRONMENT);
  return {
    apiKey,
    environment,
    baseUrl: dodoApiBaseUrl(environment),
    proProductId,
    feeProductId: env.DODO_PAYMENTS_FEE_PRODUCT_ID?.trim() || null,
    packProductId: env.DODO_PAYMENTS_PACK_PRODUCT_ID?.trim() || null,
    usageEventName: resolveDodoUsageEventName(env.DODO_PAYMENTS_USAGE_EVENT_NAME),
    meterId: env.DODO_PAYMENTS_METER_ID?.trim() || null,
  };
}

export function collectDodoWebhookSecrets(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  return [env.DODO_PAYMENTS_WEBHOOK_KEY, env.DODO_PAYMENTS_WEBHOOK_KEY_PREVIOUS]
    .map((s) => s?.trim())
    .filter((s): s is string => typeof s === "string" && s.length > 0);
}

export function isDodoTestBillingAllowed(
  envValue: string | undefined = process.env.ALLOW_DODO_TEST_BILLING,
): boolean {
  const raw = envValue?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}

export function shouldIgnoreDodoTestEvent(
  testMode: boolean,
  envValue?: string,
): boolean {
  return testMode && !isDodoTestBillingAllowed(envValue);
}

export function normalizeDodoStatus(status: string): string {
  return status.trim().toLowerCase().replace(/-/g, "_");
}

export function planFromDodoStatus(status: string): Plan | null {
  const normalized = normalizeDodoStatus(status);
  if (PROMOTE_STATUSES.has(normalized)) return "pro";
  if (DEMOTE_STATUSES.has(normalized)) return "free";
  return null;
}

export function statusFromDodoEvent(
  eventType: string,
  payloadStatus: string,
): string {
  const fromPayload = payloadStatus.trim();
  if (fromPayload) return fromPayload;
  switch (eventType) {
    case "subscription.active":
    case "subscription.renewed":
      return "active";
    case "subscription.on_hold":
      return "on_hold";
    case "subscription.cancelled":
      return "cancelled";
    case "subscription.failed":
      return "failed";
    case "subscription.expired":
      return "expired";
    default:
      return fromPayload;
  }
}

export function isDodoSubscriptionEvent(eventType: string): boolean {
  return (DODO_SUBSCRIPTION_EVENT_TYPES as readonly string[]).includes(
    eventType,
  );
}

export function isDodoPaymentEvent(eventType: string): boolean {
  return (DODO_PAYMENT_EVENT_TYPES as readonly string[]).includes(eventType);
}

/** Dashboard meter event name. Never emit `recovery_fee_cents`. */
export const DEFAULT_DODO_USAGE_EVENT_NAME = "recovery.fee";
const LEGACY_CENTS_USAGE_EVENT_NAME = "recovery_fee_cents";

/** Test-env meter id (Fendem). Read from env; do not invent a different id. */
export const DODO_TEST_USAGE_METER_ID = "mtr_0NottfCQQuRMUjzfjZgJY";

/** Sum-over property this meter bills. Do not invent it when GET omits the key. */
export const DEFAULT_DODO_USAGE_AGGREGATION_KEY = "usd";

export function resolveDodoUsageEventName(
  raw: string | undefined | null = process.env.DODO_PAYMENTS_USAGE_EVENT_NAME,
): string {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed === LEGACY_CENTS_USAGE_EVENT_NAME) {
    return DEFAULT_DODO_USAGE_EVENT_NAME;
  }
  return trimmed;
}

/** Cents → USD dollars once. Do not divide again. */
export function feeCentsToUsageUsd(cents: number): number {
  if (!Number.isFinite(cents) || cents <= 0) return 0;
  return Math.round(cents) / 100;
}

export function dodoFeePathDecision(args: {
  dodoCustomerId: string | null;
  dodoSubscriptionId: string | null;
  hasActivePro: boolean;
}): { path: "usage"; reason: "ok" } | { path: "fail_closed"; reason: string } {
  if (!args.dodoCustomerId) {
    return { path: "fail_closed", reason: "missing_dodo_customer" };
  }
  if (!args.dodoSubscriptionId) {
    return { path: "fail_closed", reason: "missing_dodo_subscription" };
  }
  if (!args.hasActivePro) {
    return { path: "fail_closed", reason: "dodo_pro_inactive" };
  }
  return { path: "usage", reason: "ok" };
}

/** Dodo Pro 4% is usage on the Pro invoice — never a second fee checkout. */
export function shouldOpenDodoFeeCheckout(args: {
  canTakeUsage: boolean;
}): boolean {
  if (args.canTakeUsage) return false;
  return false;
}

export function dodoUsageEventId(args: {
  invoiceId: string;
  claimKey: string;
  amountCents?: number;
}): string {
  const base = `fee-usage:${args.claimKey}:${args.invoiceId}`;
  if (args.amountCents != null && Number.isFinite(args.amountCents)) {
    return `${base}:${Math.round(args.amountCents)}`;
  }
  return base;
}

/** Payment created_at only. Never Date.now() and never subscription signup. */
export function parseIsoMsStrict(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const ms = Date.parse(value.trim());
  return Number.isFinite(ms) ? ms : null;
}

export function dodoPaymentAmountCents(data: Record<string, unknown>): number {
  const raw = data.total_amount ?? data.amount ?? data.settlement_amount;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.round(raw);
  }
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw);
    if (Number.isFinite(n)) return Math.round(n);
  }
  return 0;
}

export function isDodoUpdatePaymentMethod(
  data: Record<string, unknown>,
): boolean {
  return data.is_update_payment_method === true;
}

export type DodoUsageChargeKind =
  | "recurring"
  | "addon"
  | "proration"
  | "on_demand"
  | "one_time";

export type DodoUsageSettleDecision =
  | {
      settle: true;
      paidAt: number;
      coveredPeriodKey: string;
      reason: "ok";
    }
  | { settle: false; reason: string };

/** product_id on the payment, nested product, or product_cart lines. */
export function dodoPaymentProductIds(data: Record<string, unknown>): string[] {
  const ids: string[] = [];
  const push = (value: unknown) => {
    const id = stringifyDodoId(value);
    if (id && !ids.includes(id)) ids.push(id);
  };
  push(data.product_id);
  const product = data.product;
  if (product && typeof product === "object") {
    const rec = product as Record<string, unknown>;
    push(rec.product_id);
    push(rec.id);
  }
  const cart = data.product_cart;
  if (Array.isArray(cart)) {
    for (const item of cart) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      push(rec.product_id);
    }
  }
  return ids;
}

export function paymentCartHasAddon(data: Record<string, unknown>): boolean {
  if (Array.isArray(data.addons) && data.addons.length > 0) return true;
  const cart = data.product_cart;
  if (!Array.isArray(cart)) return false;
  for (const item of cart) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (stringifyDodoId(rec.addon_id)) return true;
    if (Array.isArray(rec.addons) && rec.addons.length > 0) return true;
  }
  return false;
}

export function dodoCartProductIds(data: Record<string, unknown>): string[] {
  const ids: string[] = [];
  const cart = data.product_cart;
  if (!Array.isArray(cart)) return ids;
  for (const item of cart) {
    if (!item || typeof item !== "object") continue;
    const id = stringifyDodoId((item as Record<string, unknown>).product_id);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * Classify from fields Dodo actually sends.
 * Payment.succeeded has product_cart / subscription_id / created_at.
 * Renewals commonly include product_cart for the subscription product.
 * on_demand lives on the subscription object, not the payment.
 */
export function dodoUsageChargeKind(args: {
  payment: Record<string, unknown>;
  subscriptionOnDemand?: boolean;
  expectedProProductId?: string | null;
}): DodoUsageChargeKind {
  if (args.subscriptionOnDemand === true) return "on_demand";
  if (paymentCartHasAddon(args.payment)) return "addon";
  const cart = args.payment.product_cart;
  const hasCart = Array.isArray(cart) && cart.length > 0;
  const hasSub = stringifyDodoId(args.payment.subscription_id) != null;
  if (hasCart && !hasSub) return "one_time";
  if (hasCart && hasSub) {
    const expectedPro = args.expectedProProductId?.trim() ?? "";
    const cartProducts = dodoCartProductIds(args.payment);
    if (
      expectedPro &&
      cartProducts.some((id) => id.trim() && id.trim() !== expectedPro)
    ) {
      return "proration";
    }
  }
  return "recurring";
}

export function dodoUsageMerchantMatch(args: {
  paymentSubscriptionId: string | null;
  merchantProSubscriptionId: string | null;
  merchantProductId?: string | null;
  expectedProProductId?: string | null;
  merchantOnDemand?: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (args.merchantOnDemand === true) {
    return { ok: false, reason: "on_demand_subscription" };
  }
  const paymentSub = args.paymentSubscriptionId?.trim() ?? "";
  if (!paymentSub) {
    return { ok: false, reason: "missing_subscription_id" };
  }
  const merchantSub = args.merchantProSubscriptionId?.trim() ?? "";
  if (!merchantSub) {
    return { ok: false, reason: "subscription_not_merchant_pro" };
  }
  if (paymentSub !== merchantSub) {
    return { ok: false, reason: "subscription_mismatch" };
  }
  const storedProduct = args.merchantProductId?.trim() ?? "";
  const expectedPro = args.expectedProProductId?.trim() ?? "";
  if (storedProduct && expectedPro && storedProduct !== expectedPro) {
    return { ok: false, reason: "subscription_not_merchant_pro" };
  }
  return { ok: true };
}

/**
 * Usage is paid only by this merchant's Pro recurring invoice for the
 * covered period. subscription_id alone, empty product ids, a non-Pro
 * product, addon / proration / on-demand, activation, and $0 update-PM
 * do not settle.
 */
export function dodoUsageSettleDecision(args: {
  eventType: string;
  hasFeeClaimKey: boolean;
  subscriptionId: string | null;
  productIds: string[];
  expectedProProductId: string | null;
  merchantProSubscriptionId: string | null;
  merchantProductId?: string | null;
  merchantOnDemand?: boolean;
  chargeKind: DodoUsageChargeKind;
  isUpdatePaymentMethod: boolean;
  amountCents: number;
  paymentCreatedAtMs: number | null;
}): DodoUsageSettleDecision {
  const payload = dodoUsageSettlePayloadDecision(args);
  if (!payload.settle) return payload;
  const merchant = dodoUsageMerchantMatch({
    paymentSubscriptionId: args.subscriptionId,
    merchantProSubscriptionId: args.merchantProSubscriptionId,
    merchantProductId: args.merchantProductId,
    expectedProProductId: args.expectedProProductId,
    merchantOnDemand: args.merchantOnDemand,
  });
  if (!merchant.ok) {
    return { settle: false, reason: merchant.reason };
  }
  return payload;
}

/** Payload gate for the webhook. Merchant Pro-sub match happens at settle. */
export function dodoUsageSettlePayloadDecision(args: {
  eventType: string;
  hasFeeClaimKey: boolean;
  subscriptionId: string | null;
  productIds: string[];
  expectedProProductId: string | null;
  chargeKind: DodoUsageChargeKind;
  isUpdatePaymentMethod: boolean;
  amountCents: number;
  paymentCreatedAtMs: number | null;
}): DodoUsageSettleDecision {
  if (args.eventType !== "payment.succeeded") {
    return { settle: false, reason: "not_payment_succeeded" };
  }
  if (args.hasFeeClaimKey) {
    return { settle: false, reason: "fee_claim_key" };
  }
  if (args.isUpdatePaymentMethod) {
    return { settle: false, reason: "update_payment_method" };
  }
  if (args.amountCents <= 0) {
    return { settle: false, reason: "zero_amount" };
  }
  if (args.chargeKind !== "recurring") {
    return { settle: false, reason: "not_pro_recurring_charge" };
  }
  const expectedPro = args.expectedProProductId?.trim() ?? "";
  if (!expectedPro) {
    return { settle: false, reason: "pro_product_unconfigured" };
  }
  const subscriptionId = args.subscriptionId?.trim() ?? "";
  if (!subscriptionId) {
    return { settle: false, reason: "missing_subscription_id" };
  }
  const presentProductIds = args.productIds
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  if (presentProductIds.length === 0) {
    return { settle: false, reason: "missing_product_id" };
  }
  if (presentProductIds.some((id) => id !== expectedPro)) {
    return { settle: false, reason: "non_pro_product" };
  }
  if (args.paymentCreatedAtMs == null) {
    return { settle: false, reason: "missing_payment_created_at" };
  }
  return {
    settle: true,
    paidAt: args.paymentCreatedAtMs,
    coveredPeriodKey: dodoUsagePeriodKey(args.paymentCreatedAtMs),
    reason: "ok",
  };
}

export function dodoUsageSettleFromPayment(args: {
  eventType: string;
  payment: Record<string, unknown>;
  hasFeeClaimKey: boolean;
  expectedProProductId: string | null;
  merchantProSubscriptionId: string | null;
  merchantProductId?: string | null;
  merchantOnDemand?: boolean;
}): DodoUsageSettleDecision {
  return dodoUsageSettleDecision({
    eventType: args.eventType,
    hasFeeClaimKey: args.hasFeeClaimKey,
    subscriptionId: stringifyDodoId(args.payment.subscription_id),
    productIds: dodoPaymentProductIds(args.payment),
    expectedProProductId: args.expectedProProductId,
    merchantProSubscriptionId: args.merchantProSubscriptionId,
    merchantProductId: args.merchantProductId,
    merchantOnDemand: args.merchantOnDemand,
    chargeKind: dodoUsageChargeKind({
      payment: args.payment,
      subscriptionOnDemand: args.merchantOnDemand === true,
      expectedProProductId: args.expectedProProductId,
    }),
    isUpdatePaymentMethod: isDodoUpdatePaymentMethod(args.payment),
    amountCents: dodoPaymentAmountCents(args.payment),
    paymentCreatedAtMs: parseIsoMsStrict(args.payment.created_at),
  });
}

export function invoiceMatchesUsageCharge(args: {
  status: string;
  periodKey: string;
  coveredPeriodKey: string;
  dodoUsageSubmittedAt: number | null | undefined;
  monthClosed?: boolean;
}): boolean {
  if (args.status !== "created") return false;
  if (args.dodoUsageSubmittedAt == null) return false;
  if (args.monthClosed !== true) return false;
  return args.periodKey === args.coveredPeriodKey;
}

export type DodoUsageCredit = {
  periodKey: string;
  paidAt: number;
  paymentId?: string;
};

export function readDodoUsageCredits(user: {
  dodoUsageCredits?: DodoUsageCredit[] | null;
  dodoUsageCreditPeriodKey?: string | null;
  dodoUsageCreditPaidAt?: number | null;
  dodoUsageCreditPaymentId?: string | null;
}): DodoUsageCredit[] {
  if (user.dodoUsageCredits && user.dodoUsageCredits.length > 0) {
    return user.dodoUsageCredits;
  }
  const periodKey = user.dodoUsageCreditPeriodKey?.trim() ?? "";
  if (periodKey && user.dodoUsageCreditPaidAt != null) {
    return [
      {
        periodKey,
        paidAt: user.dodoUsageCreditPaidAt,
        ...(user.dodoUsageCreditPaymentId
          ? { paymentId: user.dodoUsageCreditPaymentId }
          : {}),
      },
    ];
  }
  return [];
}

export function upsertDodoUsageCredit(
  existing: DodoUsageCredit[] | undefined,
  next: DodoUsageCredit,
): DodoUsageCredit[] {
  return [
    ...readDodoUsageCredits({ dodoUsageCredits: existing }).filter(
      (credit) => credit.periodKey !== next.periodKey,
    ),
    next,
  ];
}

export function creditForPeriod(
  credits: DodoUsageCredit[],
  periodKey: string,
): DodoUsageCredit | null {
  return credits.find((credit) => credit.periodKey === periodKey) ?? null;
}

export function removeCreditForPeriod(
  credits: DodoUsageCredit[],
  periodKey: string,
): DodoUsageCredit[] {
  return credits.filter((credit) => credit.periodKey !== periodKey);
}

/** Charge-first credit applies after the scheduled close meters that period. */
export function usageCreditAppliesToInvoice(args: {
  invoicePeriodKey: string;
  invoiceStatus: string;
  monthClosed?: boolean;
  creditPeriodKey: string | null | undefined;
  creditPaidAt: number | null | undefined;
  merchantProSubscriptionId?: string | null;
  merchantProductId?: string | null;
  expectedProProductId?: string | null;
  merchantOnDemand?: boolean;
}): boolean {
  if (args.invoiceStatus === "paid") return false;
  if (args.monthClosed !== true) return false;
  if (args.creditPaidAt == null || !Number.isFinite(args.creditPaidAt)) {
    return false;
  }
  if ((args.creditPeriodKey?.trim() ?? "") !== args.invoicePeriodKey) {
    return false;
  }
  if (args.merchantOnDemand === true) {
    return false;
  }
  const storedProduct = args.merchantProductId?.trim() ?? "";
  const expectedPro = args.expectedProProductId?.trim() ?? "";
  if (storedProduct && expectedPro && storedProduct !== expectedPro) {
    return false;
  }
  if (args.merchantProSubscriptionId !== undefined) {
    const merchant = dodoUsageMerchantMatch({
      paymentSubscriptionId: args.merchantProSubscriptionId,
      merchantProSubscriptionId: args.merchantProSubscriptionId,
      merchantProductId: args.merchantProductId,
      expectedProProductId: args.expectedProProductId,
      merchantOnDemand: args.merchantOnDemand,
    });
    if (!merchant.ok) return false;
  }
  return true;
}

export function pickUniqueDodoCustomerUser<
  T extends { dodoSubscriptionId?: string },
>(args: {
  users: T[];
  dodoSubscriptionId?: string | null;
}): T | null {
  if (args.users.length === 0) return null;
  const sub = args.dodoSubscriptionId?.trim() || null;
  if (sub) {
    const matches = args.users.filter((user) => user.dodoSubscriptionId === sub);
    return matches.length === 1 ? (matches[0] ?? null) : null;
  }
  if (args.users.length === 1) {
    return args.users[0] ?? null;
  }
  return null;
}

export function requireDodoUsageMeterId(
  meterId: string | null | undefined,
): string {
  const trimmed = meterId?.trim() ?? "";
  if (!trimmed) {
    throw new Error("missing_dodo_meter_id");
  }
  return trimmed;
}

export function dodoMeterAggregationKeyFromResponse(
  json: unknown,
): string | null {
  if (!json || typeof json !== "object") return null;
  const rec = json as Record<string, unknown>;
  const aggregation =
    rec.aggregation && typeof rec.aggregation === "object"
      ? (rec.aggregation as Record<string, unknown>)
      : null;
  if (typeof aggregation?.key !== "string") return null;
  const key = aggregation.key.trim();
  return key || null;
}

export function assertUsdMeterAggregationKey(
  key: string | null | undefined,
): string {
  const trimmed = key?.trim() ?? "";
  if (trimmed !== DEFAULT_DODO_USAGE_AGGREGATION_KEY) {
    throw new Error("invalid_dodo_meter_aggregation_key");
  }
  return trimmed;
}

export function dodoUsageMeterDecision(args: {
  meterId: string | null | undefined;
  aggregationKey: string | null | undefined;
}):
  | { ingest: true; meterId: string; aggregationKey: string }
  | { ingest: false; reason: string } {
  const meterId = args.meterId?.trim() ?? "";
  if (!meterId) {
    return { ingest: false, reason: "missing_dodo_meter_id" };
  }
  const key = args.aggregationKey?.trim() ?? "";
  if (key !== DEFAULT_DODO_USAGE_AGGREGATION_KEY) {
    return { ingest: false, reason: "invalid_dodo_meter_aggregation_key" };
  }
  return { ingest: true, meterId, aggregationKey: key };
}

export function stringifyDodoId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
}

export function extractDodoMetadata(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const rec = value as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(rec)) {
    if (typeof raw === "string" && raw.trim()) {
      out[key] = raw.trim();
    } else if (typeof raw === "number" && Number.isFinite(raw)) {
      out[key] = String(raw);
    }
  }
  return out;
}

export function extractDodoUserRefs(metadata: Record<string, string>): {
  convexUserId: string | null;
  clerkUserId: string | null;
  checkoutNonce: string | null;
  claimKey: string | null;
  billingInvoiceId: string | null;
  billingKind: string | null;
} {
  return {
    convexUserId:
      metadata.convex_user_id ?? metadata.convexUserId ?? metadata.user_id ?? null,
    clerkUserId: metadata.clerk_user_id ?? metadata.clerkUserId ?? null,
    checkoutNonce: metadata.checkout_nonce ?? metadata.checkoutNonce ?? null,
    claimKey: metadata.claim_key ?? metadata.claimKey ?? null,
    billingInvoiceId:
      metadata.billing_invoice_id ?? metadata.billingInvoiceId ?? null,
    billingKind: metadata.billing_kind ?? metadata.billingKind ?? null,
  };
}

export function matchesDodoProProduct(args: {
  productId: string | null;
  expectedProductId: string;
}): boolean {
  if (!args.productId) return false;
  return args.productId === args.expectedProductId;
}

export type DodoCheckoutKind = "pro" | "fee" | "pack";

export type DodoCheckoutRequest = {
  kind: DodoCheckoutKind;
  productId: string;
  quantity: number;
  amountCents?: number;
  returnUrl: string | null;
  email?: string;
  name?: string;
  metadata: Record<string, string>;
};

export type DodoCheckoutResponse = {
  checkoutId: string;
  checkoutUrl: string;
};

export type DodoPortalResponse = {
  portalUrl: string;
};

export type DodoUsageMetadataValue = string | number | boolean;

export type DodoUsageEvent = {
  eventId: string;
  customerId: string;
  eventName: string;
  timestampIso?: string;
  metadata: Record<string, DodoUsageMetadataValue>;
};

export function buildRecoveryFeeUsageEvent(args: {
  eventId: string;
  customerId: string;
  eventName: string;
  usd: number;
  aggregationKey: string;
  claimKey: string;
  invoiceId: string;
}): DodoUsageEvent {
  return {
    eventId: args.eventId,
    customerId: args.customerId,
    eventName: args.eventName,
    metadata: {
      [args.aggregationKey]: args.usd,
      claim_key: args.claimKey,
      billing_invoice_id: args.invoiceId,
    },
  };
}

/**
 * Thin HTTP adapter. Callers (Convex actions) pass a configured client.
 * FE keeps calling createProCheckout / createBillingPortal.
 */
export async function dodoFetchJson(
  config: DodoPaymentsConfig,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<unknown> {
  const res = await fetch(`${config.baseUrl}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: init?.body != null ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      json = { message: text };
    }
  }
  if (!res.ok) {
    const message = dodoErrorMessage(json, res.status);
    throw new Error(message);
  }
  return json;
}

function dodoErrorMessage(json: unknown, status: number): string {
  if (json && typeof json === "object") {
    const rec = json as Record<string, unknown>;
    if (typeof rec.message === "string" && rec.message.trim()) {
      return rec.message.trim();
    }
    if (typeof rec.error === "string" && rec.error.trim()) {
      return rec.error.trim();
    }
  }
  return `Dodo Payments error (${status})`;
}

export async function createDodoCheckoutSession(
  config: DodoPaymentsConfig,
  request: DodoCheckoutRequest,
): Promise<DodoCheckoutResponse> {
  const productItem: Record<string, unknown> = {
    product_id: request.productId,
    quantity: request.quantity,
  };
  if (
    request.amountCents != null &&
    Number.isFinite(request.amountCents) &&
    request.amountCents > 0
  ) {
    productItem.amount = request.amountCents;
  }

  const body: Record<string, unknown> = {
    product_cart: [productItem],
    metadata: request.metadata,
  };
  if (request.returnUrl) {
    body.return_url = request.returnUrl;
  }
  if (request.email || request.name) {
    body.customer = {
      ...(request.email ? { email: request.email } : {}),
      ...(request.name ? { name: request.name } : {}),
    };
  }

  const json = await dodoFetchJson(config, "/checkouts", {
    method: "POST",
    body,
  });
  if (!json || typeof json !== "object") {
    throw new Error("Dodo Payments checkout response was empty");
  }
  const rec = json as Record<string, unknown>;
  const checkoutId =
    stringifyDodoId(rec.session_id) ?? stringifyDodoId(rec.checkout_id);
  const checkoutUrl =
    typeof rec.checkout_url === "string" ? rec.checkout_url : null;
  if (!checkoutId || !checkoutUrl) {
    throw new Error("Dodo Payments checkout response missing session id or URL");
  }
  return { checkoutId, checkoutUrl };
}

export async function createDodoCustomerPortal(
  config: DodoPaymentsConfig,
  args: { customerId: string; returnUrl: string | null },
): Promise<DodoPortalResponse> {
  const customerId = encodeURIComponent(args.customerId.trim());
  const query = new URLSearchParams();
  if (args.returnUrl) query.set("return_url", args.returnUrl);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const json = await dodoFetchJson(
    config,
    `/customers/${customerId}/customer-portal/session${suffix}`,
    { method: "POST" },
  );
  if (!json || typeof json !== "object") {
    throw new Error("Dodo Payments portal response was empty");
  }
  const rec = json as Record<string, unknown>;
  const link =
    (typeof rec.link === "string" && rec.link) ||
    (typeof rec.portal_url === "string" && rec.portal_url) ||
    null;
  if (!link) {
    throw new Error("Dodo Payments portal response missing link");
  }
  return { portalUrl: link };
}

export async function fetchDodoMeterAggregationKey(
  config: DodoPaymentsConfig,
  meterId: string,
): Promise<string> {
  const json = await dodoFetchJson(
    config,
    `/meters/${encodeURIComponent(meterId)}`,
  );
  if (!json || typeof json !== "object") {
    throw new Error("Dodo meter response was empty");
  }
  const key = dodoMeterAggregationKeyFromResponse(json);
  return assertUsdMeterAggregationKey(key);
}

export async function ingestDodoUsageEvents(
  config: DodoPaymentsConfig,
  events: DodoUsageEvent[],
): Promise<void> {
  if (events.length === 0) return;
  await dodoFetchJson(config, "/events/ingest", {
    method: "POST",
    body: {
      events: events.map((event) => ({
        event_id: event.eventId,
        customer_id: event.customerId,
        event_name: event.eventName,
        ...(event.timestampIso ? { timestamp: event.timestampIso } : {}),
        metadata: event.metadata,
      })),
    },
  });
}

export function providerLabel(provider: BillingProviderId): string {
  switch (provider) {
    case "lemon":
      return "Lemon Squeezy";
    case "dodo":
      return "Dodo Payments";
    default: {
      const _never: never = provider;
      return _never;
    }
  }
}
