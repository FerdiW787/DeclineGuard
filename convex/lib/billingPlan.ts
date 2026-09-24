import type { Plan } from "./accountGuard";

/** LS statuses that grant Pro. "paid" covers invoice/payment events. */
const PROMOTE_STATUSES = new Set(["active", "paid"]);

/** LS statuses that must not leave plan=pro. */
const DEMOTE_STATUSES = new Set([
  "cancelled",
  "canceled",
  "expired",
  "unpaid",
  "past_due",
  "past-due",
  "failed",
  "paused",
]);

export const PLATFORM_BILLING_EVENT_NAMES = [
  "subscription_created",
  "subscription_updated",
  "subscription_cancelled",
  "subscription_expired",
  "subscription_paused",
  "subscription_unpaused",
  "subscription_resumed",
  "subscription_payment_success",
  "subscription_payment_recovered",
  "subscription_payment_failed",
] as const;

export type PlatformBillingEventName =
  (typeof PLATFORM_BILLING_EVENT_NAMES)[number];

export function isPlatformBillingEventName(
  eventName: string,
): eventName is PlatformBillingEventName {
  return (PLATFORM_BILLING_EVENT_NAMES as readonly string[]).includes(
    eventName,
  );
}

/** True when this store_id is DeclineGuard’s own LS store (Pro product). */
export function isPlatformBillingStore(storeId: string | null): boolean {
  const configured = process.env.LEMONSQUEEZY_STORE_ID?.trim();
  return Boolean(configured && storeId && configured === storeId);
}

export function getPlatformBillingConfig(): {
  storeId: string;
  variantId: string;
  productId: string | null;
  apiKey: string | null;
} | null {
  const storeId = process.env.LEMONSQUEEZY_STORE_ID?.trim();
  const variantId = process.env.LEMONSQUEEZY_PRO_VARIANT_ID?.trim();
  if (!storeId || !variantId) return null;
  const productId = process.env.LEMONSQUEEZY_PRO_PRODUCT_ID?.trim() || null;
  const apiKey = process.env.LEMONSQUEEZY_API_KEY?.trim() || null;
  return { storeId, variantId, productId, apiKey };
}

export function normalizeLsStatus(status: string): string {
  return status.trim().toLowerCase().replace(/-/g, "_");
}

/**
 * Map an LS subscription/invoice status to a DeclineGuard plan.
 * Returns null when the status should not change plan (e.g. on_trial).
 */
export function planFromLsStatus(status: string): Plan | null {
  const normalized = normalizeLsStatus(status);
  if (PROMOTE_STATUSES.has(normalized)) return "pro";
  if (DEMOTE_STATUSES.has(normalized)) return "free";
  return null;
}

/** Prefer payload status; fall back from the event name when LS omits it. */
export function statusFromBillingEvent(
  eventName: string,
  attrsStatus: string,
): string {
  const fromAttrs = attrsStatus.trim();
  if (fromAttrs) return fromAttrs;
  switch (eventName) {
    case "subscription_payment_failed":
      return "past_due";
    case "subscription_payment_success":
    case "subscription_payment_recovered":
      return "paid";
    case "subscription_cancelled":
      return "cancelled";
    case "subscription_expired":
      return "expired";
    case "subscription_paused":
      return "paused";
    default:
      return fromAttrs;
  }
}

export function stringifyLsId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
}

export function extractVariantId(
  attrs: Record<string, unknown>,
): string | null {
  const direct = stringifyLsId(attrs.variant_id);
  if (direct) return direct;
  const item = attrs.first_subscription_item;
  if (item && typeof item === "object") {
    return stringifyLsId((item as Record<string, unknown>).variant_id);
  }
  return null;
}

export function extractProductId(
  attrs: Record<string, unknown>,
): string | null {
  const direct = stringifyLsId(attrs.product_id);
  if (direct) return direct;
  const item = attrs.first_subscription_item;
  if (item && typeof item === "object") {
    return stringifyLsId((item as Record<string, unknown>).product_id);
  }
  return null;
}

export function extractCustomUserRefs(meta: {
  custom_data?: unknown;
}): { convexUserId: string | null; clerkUserId: string | null } {
  const custom = meta.custom_data;
  if (!custom || typeof custom !== "object") {
    return { convexUserId: null, clerkUserId: null };
  }
  const rec = custom as Record<string, unknown>;
  const convexUserId =
    stringifyLsId(rec.convex_user_id) ??
    stringifyLsId(rec.user_id) ??
    stringifyLsId(rec.convexUserId);
  const clerkUserId =
    stringifyLsId(rec.clerk_user_id) ??
    stringifyLsId(rec.clerkUserId);
  return { convexUserId, clerkUserId };
}

/** Variant/product must match configured Pro ids when the payload includes them. */
export function matchesProCatalog(args: {
  variantId: string | null;
  productId: string | null;
  expectedVariantId: string;
  expectedProductId: string | null;
}): boolean {
  if (args.variantId && args.variantId !== args.expectedVariantId) {
    return false;
  }
  if (
    args.expectedProductId &&
    args.productId &&
    args.productId !== args.expectedProductId
  ) {
    return false;
  }
  // Require at least one catalog id on promote-path payloads.
  return args.variantId != null || args.productId != null;
}
