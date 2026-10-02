/**
 * Merchant-billing MoR adapter selector (DeclineGuard charging merchants).
 *
 * Out of scope: merchant Lemon Squeezy store connections / recovery emails.
 * Those stay LS regardless of this flag.
 *
 * Cutover:
 * - Env `BILLING_PROVIDER=lemon|dodo` (default lemon — safe).
 * - Optional per-user `users.billingProvider` wins (grandfather / admin migrate).
 * - Active Lemon Pro without an explicit user flag stays on Lemon so a global
 *   dodo cutover does not dual-charge or drop existing subscribers.
 *
 * Tear-down (after Dodo smoke + no remaining Lemon Pro rows):
 * 1. Set BILLING_PROVIDER=dodo on Convex.
 * 2. adminSetBillingProvider(dodo) for any leftover lemon users after they
 *    cancel LS and complete Dodo checkout (no subscription import).
 * 3. Remove LEMONSQUEEZY_PRO_VARIANT_ID / LEMONSQUEEZY_FEE_VARIANT_ID /
 *    LEMONSQUEEZY_PRO_PRODUCT_ID. Keep merchant LS env (API encrypt key,
 *    webhook secret) — recovery MoR is unchanged.
 * 4. Leave lemonWebhook merchant-store paths. Delete platform LS checkout
 *    helpers only when grandfather count is zero.
 */

export const BILLING_PROVIDERS = ["lemon", "dodo"] as const;

export type BillingProviderId = (typeof BILLING_PROVIDERS)[number];

export type BillingProviderInterface = {
  createCheckout: "createCheckout";
  createFeeInvoice: "createFeeInvoice";
  reportUsage: "reportUsage";
  verifyWebhook: "verifyWebhook";
  portalUrl: "portalUrl";
};

/** Documented adapter methods — Convex action names stay stable for FE. */
export const BILLING_PROVIDER_METHODS: BillingProviderInterface = {
  createCheckout: "createCheckout",
  createFeeInvoice: "createFeeInvoice",
  reportUsage: "reportUsage",
  verifyWebhook: "verifyWebhook",
  portalUrl: "portalUrl",
};

export function parseBillingProvider(
  raw: string | undefined | null,
): BillingProviderId | null {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === "lemon" || normalized === "dodo") return normalized;
  return null;
}

/** Global default is lemon so production never dual-charges on deploy. */
export function parseBillingProviderEnv(
  raw: string | undefined = undefined,
): BillingProviderId {
  return parseBillingProvider(raw) ?? "lemon";
}

export type ResolveBillingProviderInput = {
  envProvider?: string;
  userProvider?: string | null;
  hasActiveLemonSubscription?: boolean;
  hasActiveDodoSubscription?: boolean;
};

/**
 * Per-user flag wins. Else grandfather an active LS Pro onto lemon.
 * Else an active Dodo sub onto dodo. Else the env default.
 */
export function resolveBillingProvider(
  input: ResolveBillingProviderInput,
): BillingProviderId {
  const user = parseBillingProvider(input.userProvider);
  if (user) return user;

  const lemonSub = input.hasActiveLemonSubscription === true;
  const dodoSub = input.hasActiveDodoSubscription === true;
  if (lemonSub && !dodoSub) return "lemon";
  if (dodoSub && !lemonSub) return "dodo";

  return parseBillingProviderEnv(input.envProvider);
}

export function isActiveSubscriptionStatus(
  status: string | undefined | null,
): boolean {
  const normalized = (status ?? "").trim().toLowerCase().replace(/-/g, "_");
  return normalized === "active" || normalized === "paid";
}

export function shouldSkipLemonPlatformCharge(
  provider: BillingProviderId,
): boolean {
  return provider === "dodo";
}

export function shouldSkipDodoPlatformCharge(
  provider: BillingProviderId,
): boolean {
  return provider === "lemon";
}

/** True when this merchant must not open a Lemon Pro checkout or fee invoice. */
export function lemonPlatformPathBlocked(
  provider: BillingProviderId,
): boolean {
  return shouldSkipLemonPlatformCharge(provider);
}

/** True when this merchant must not open a Dodo Pro checkout or fee invoice. */
export function dodoPlatformPathBlocked(
  provider: BillingProviderId,
): boolean {
  return shouldSkipDodoPlatformCharge(provider);
}
