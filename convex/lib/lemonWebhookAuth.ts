import {
  orderCoversClaimedCents,
  parseFeeInvoiceClaimKey,
} from "./feeBilling";

/** Lemon signing-secret max length is 40; 16 random bytes → 32 hex chars. */
export const MERCHANT_WEBHOOK_SECRET_BYTES = 16;

export type LemonWebhookSecretChoice = "platform" | "merchant" | "reject";

/**
 * Bind verification to the store on the payload.
 * The platform secret only verifies DeclineGuard’s own store.
 * A merchant secret only verifies that merchant’s store.
 * No store id → cannot bind → reject.
 */
export function lemonWebhookSecretChoice(args: {
  storeId: string | null;
  platformStoreId: string | null;
}): LemonWebhookSecretChoice {
  if (!args.storeId) return "reject";
  if (args.platformStoreId && args.storeId === args.platformStoreId) {
    return "platform";
  }
  return "merchant";
}

/** Platform-secret match must not record a recovered payment for a merchant store. */
export function merchantRecoveredPaymentAuthorized(
  choice: LemonWebhookSecretChoice,
): boolean {
  return choice === "merchant";
}

export function generateMerchantWebhookSecret(randomBytes: Uint8Array): string {
  if (randomBytes.length < MERCHANT_WEBHOOK_SECRET_BYTES) {
    throw new Error("Merchant webhook secret requires 16 random bytes");
  }
  return [...randomBytes.subarray(0, MERCHANT_WEBHOOK_SECRET_BYTES)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type VerifiedLemonOrder = {
  orderId: string;
  storeId: string;
  status: string;
  testMode: boolean;
  subtotalCents: number;
  totalCents: number;
  variantId: string | null;
  productName: string | null;
  checkoutId: string | null;
  paidAtMs: number;
};

export type VerifiedLemonSubscription = {
  subscriptionId: string;
  storeId: string;
  status: string;
  testMode: boolean;
  variantId: string | null;
  productId: string | null;
};

export type PlatformBillingUserSource =
  | "lsSubscriptionId"
  | "checkoutNonce"
  | "bodyUserId"
  | "none";

function asCents(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.round(n);
  }
  return 0;
}

function stringifyId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
}

function parseIsoMs(value: unknown, fallbackMs: number): number {
  if (typeof value !== "string" || !value) return fallbackMs;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : fallbackMs;
}

/**
 * Parse a Lemon GET /v1/orders/:id body. Returns null when the payload is
 * not a usable order (missing id / store). Does not consult webhook custom
 * data — that field is not returned by the API.
 */
export function parseLemonOrderForFeeInvoice(
  json: unknown,
): VerifiedLemonOrder | null {
  if (typeof json !== "object" || json === null) return null;
  const data = (json as { data?: unknown }).data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return null;
  }
  const rec = data as { id?: unknown; attributes?: unknown };
  const orderId = stringifyId(rec.id);
  const attrs =
    rec.attributes && typeof rec.attributes === "object"
      ? (rec.attributes as Record<string, unknown>)
      : null;
  if (!orderId || !attrs) return null;
  const storeId = stringifyId(attrs.store_id);
  if (!storeId) return null;

  const firstItem =
    attrs.first_order_item && typeof attrs.first_order_item === "object"
      ? (attrs.first_order_item as Record<string, unknown>)
      : null;
  const variantId = stringifyId(firstItem?.variant_id);
  const productName =
    typeof firstItem?.product_name === "string" && firstItem.product_name.trim()
      ? firstItem.product_name.trim()
      : typeof attrs.product_name === "string" && attrs.product_name.trim()
        ? attrs.product_name.trim()
        : null;
  const rel = (
    data as {
      relationships?: { checkout?: { data?: { id?: unknown } } };
    }
  ).relationships;
  const checkoutId =
    stringifyId(attrs.checkout_id) ?? stringifyId(rel?.checkout?.data?.id);

  const fallbackMs = 0;
  return {
    orderId,
    storeId,
    status: typeof attrs.status === "string" ? attrs.status : "",
    testMode: attrs.test_mode === true,
    subtotalCents: asCents(attrs.subtotal),
    totalCents: asCents(attrs.total),
    variantId,
    productName,
    checkoutId,
    paidAtMs: parseIsoMs(
      typeof attrs.updated_at === "string" ? attrs.updated_at : attrs.created_at,
      fallbackMs,
    ),
  };
}

/** Claim key embedded in the fee-checkout product name we created. */
export function claimKeyFromFeeOrderProductName(
  productName: string | null,
): string | null {
  if (!productName) return null;
  const match = /fee-invoice:[^:]+:\d{4}-\d{2}/.exec(productName);
  if (!match) return null;
  return parseFeeInvoiceClaimKey(match[0]) ? match[0] : null;
}

/**
 * Lookup keys taken only from the Lemon order GET — never webhook custom data.
 */
export function lemonFeeInvoiceLookupFromOrder(order: VerifiedLemonOrder): {
  lsOrderId: string;
  claimKey: string | null;
  lsCheckoutId: string | null;
} {
  return {
    lsOrderId: order.orderId,
    claimKey: claimKeyFromFeeOrderProductName(order.productName),
    lsCheckoutId: order.checkoutId,
  };
}

/** The invoice that gets marked paid must own this verified order. */
export function invoiceOwnsVerifiedLemonOrder(args: {
  invoice: {
    claimKey: string;
    lsOrderId?: string | null;
    lsCheckoutId?: string | null;
  };
  order: VerifiedLemonOrder;
}): boolean {
  if (args.invoice.lsOrderId) {
    return args.invoice.lsOrderId === args.order.orderId;
  }
  const named = claimKeyFromFeeOrderProductName(args.order.productName);
  if (named && named === args.invoice.claimKey) return true;
  if (
    args.order.checkoutId &&
    args.invoice.lsCheckoutId &&
    args.order.checkoutId === args.invoice.lsCheckoutId
  ) {
    return true;
  }
  return false;
}

export function parseLemonSubscription(
  json: unknown,
): VerifiedLemonSubscription | null {
  if (typeof json !== "object" || json === null) return null;
  const data = (json as { data?: unknown }).data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return null;
  }
  const rec = data as { id?: unknown; attributes?: unknown };
  const subscriptionId = stringifyId(rec.id);
  const attrs =
    rec.attributes && typeof rec.attributes === "object"
      ? (rec.attributes as Record<string, unknown>)
      : null;
  if (!subscriptionId || !attrs) return null;
  const storeId = stringifyId(attrs.store_id);
  if (!storeId) return null;
  return {
    subscriptionId,
    storeId,
    status: typeof attrs.status === "string" ? attrs.status : "",
    testMode: attrs.test_mode === true,
    variantId: stringifyId(attrs.variant_id),
    productId: stringifyId(attrs.product_id),
  };
}

/**
 * A body user id + catalog variant must not promote. The subscription GET
 * has to succeed, and the user must come from our stored sub id or nonce.
 */
export function applyPlatformSubscriptionAllowed(args: {
  verifiedFromLemonApi: boolean;
  userResolvedBy: PlatformBillingUserSource;
  nextPlan: "pro" | "free" | null;
}): { allow: boolean; reason: string } {
  if (!args.verifiedFromLemonApi) {
    return { allow: false, reason: "subscription_not_verified" };
  }
  if (args.nextPlan === "pro" && args.userResolvedBy === "bodyUserId") {
    return { allow: false, reason: "body_user_id" };
  }
  if (args.nextPlan === "pro" && args.userResolvedBy === "none") {
    return { allow: false, reason: "user_not_found" };
  }
  if (args.nextPlan == null) {
    return { allow: false, reason: "status_ignored" };
  }
  return { allow: true, reason: "ok" };
}

export type FeeInvoicePaidDecision =
  | { accept: true }
  | { accept: false; reason: string };

/**
 * A fee invoice is paid only from a real Lemon order for our store.
 * Custom data that merely has the fee-invoice prefix and a covering
 * amount is not enough — `verifiedOrder` must come from GET /v1/orders/:id.
 */
export function feeInvoicePaidFromVerifiedOrder(args: {
  secretChoice: LemonWebhookSecretChoice;
  platformStoreId: string | null;
  feeVariantId: string | null;
  verifiedOrder: VerifiedLemonOrder | null;
  claimedCents: number;
}): FeeInvoicePaidDecision {
  if (args.secretChoice !== "platform") {
    return { accept: false, reason: "not_platform_secret" };
  }
  if (!args.verifiedOrder) {
    return { accept: false, reason: "order_not_found" };
  }
  const order = args.verifiedOrder;
  if (!args.platformStoreId || order.storeId !== args.platformStoreId) {
    return { accept: false, reason: "store_mismatch" };
  }
  if (!args.feeVariantId || !order.variantId) {
    return { accept: false, reason: "variant_unconfigured" };
  }
  if (order.variantId !== args.feeVariantId) {
    return { accept: false, reason: "variant_mismatch" };
  }
  if (order.testMode) {
    return { accept: false, reason: "test_mode" };
  }
  if (order.status.trim().toLowerCase() !== "paid") {
    return { accept: false, reason: "not_paid" };
  }
  if (
    !orderCoversClaimedCents(
      args.claimedCents,
      order.subtotalCents,
      order.totalCents,
    )
  ) {
    return { accept: false, reason: "amount_below" };
  }
  return { accept: true };
}
