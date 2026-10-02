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

export type PinBillingProviderResult =
  | { ok: true }
  | { ok: false; reason: "ls_subscription_active" | "dodo_subscription_active" };

/** Staff cannot pin dodo while LS Pro is still the live entitlement. */
export function canPinBillingProvider(args: {
  next: BillingProviderId;
  lsStatus?: string | null;
  dodoStatus?: string | null;
}): PinBillingProviderResult {
  if (args.next === "dodo" && isActiveSubscriptionStatus(args.lsStatus)) {
    return { ok: false, reason: "ls_subscription_active" };
  }
  if (args.next === "lemon" && isActiveSubscriptionStatus(args.dodoStatus)) {
    return { ok: false, reason: "dodo_subscription_active" };
  }
  return { ok: true };
}

/**
 * LS platform events: promotions no-op on a dodo pin (no dual charge).
 * Demotions always apply so stale lsSubscriptionStatus cannot keep Pro.
 */
export function lsPlatformEventAction(args: {
  provider: BillingProviderId;
  nextPlan: "free" | "pro" | null;
}): "apply" | "skip_promote" | "ignore" {
  if (!args.nextPlan) return "ignore";
  if (args.nextPlan === "pro" && args.provider === "dodo") {
    return "skip_promote";
  }
  return "apply";
}

export function dodoPlatformEventAction(args: {
  provider: BillingProviderId;
  nextPlan: "free" | "pro" | null;
}): "apply" | "skip_promote" | "ignore" {
  if (!args.nextPlan) return "ignore";
  if (args.nextPlan === "pro" && args.provider === "lemon") {
    return "skip_promote";
  }
  return "apply";
}

/** After an LS demotion, keep Pro only if Dodo is still active. */
export function planAfterForeignDemotion(args: {
  nextPlan: "free" | "pro";
  otherMorActive: boolean;
}): "free" | "pro" {
  if (args.nextPlan === "free" && args.otherMorActive) return "pro";
  return args.nextPlan;
}

/** Block opening a MoR checkout while the other MoR is still entitled. */
export function otherMorBlocksCheckout(args: {
  target: BillingProviderId;
  lsActive: boolean;
  dodoActive: boolean;
}): boolean {
  if (args.target === "dodo" && args.lsActive) return true;
  if (args.target === "lemon" && args.dodoActive) return true;
  return false;
}

export function hasDualActiveSubscriptions(args: {
  lsActive: boolean;
  dodoActive: boolean;
}): boolean {
  return args.lsActive && args.dodoActive;
}

/** Usage ingest is not a paid confirmation — never settle/block a fee period on it. */
export function usageIngestSettlesFeePeriod(): boolean {
  return false;
}

export const DECLINE_PACK_EXTRA_DECLINES = 10;

export function packExtraDeclines(quantity: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  const clamped = Math.min(20, Math.floor(quantity));
  return clamped * DECLINE_PACK_EXTRA_DECLINES;
}

export function nextDeclinePackExtra(
  current: number | undefined,
  quantity: number,
): number {
  const base =
    typeof current === "number" && Number.isFinite(current) && current > 0
      ? Math.floor(current)
      : 0;
  return base + packExtraDeclines(quantity);
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
