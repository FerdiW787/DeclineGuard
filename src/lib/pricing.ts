/**
 * DeclineGuard plan definitions — single source of truth for marketing + billing UI.
 * Pro checkout is Lemon Squeezy $29.99/mo (see createProCheckout).
 */

export type PlanId = "free" | "pro";

export type PlanDefinition = {
  id: PlanId;
  name: string;
  tagline: string;
  monthlyPriceUsd: number;
  /** Charged only on amounts recovered after our sequence started */
  recoveryFeePercent: number;
  /** Monthly decline bucket (new failed payments that enter recovery) */
  includedDeclinesPerMonth: number;
  includedRecoveryEmails: number;
  emailOveragePackSize: number;
  emailOveragePackPriceUsd: number;
  includedStores: number;
  /** Free only: one-time charge per additional LS store */
  extraStorePriceUsd: number | null;
  extraStoreOneTime: boolean;
  showDeclineGuardBadge: boolean;
  features: readonly string[];
  cta: string;
};

/** Stackable capacity add-on — decline packs, not email packs. */
export const DECLINE_ADDON = {
  extraDeclines: 10,
  monthlyPriceUsd: 0.99,
} as const;

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "Start without a card. 50 declines each month.",
    monthlyPriceUsd: 0,
    recoveryFeePercent: 10,
    includedDeclinesPerMonth: 50,
    includedRecoveryEmails: 100,
    emailOveragePackSize: 10,
    emailOveragePackPriceUsd: 3,
    includedStores: 1,
    extraStorePriceUsd: 5,
    extraStoreOneTime: true,
    showDeclineGuardBadge: true,
    features: [
      "50 declines per month",
      "Stackable +10 declines for $0.99/mo",
      "Over quota, new declines wait in the hold queue",
      "3-step branded recovery sequence (Day 0, 2, 5)",
      "Logo, colors, and copy in every email",
      "Recovery dashboard & activity timeline",
      "1 Lemon Squeezy store",
    ],
    cta: "Start free",
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "500 declines a month for stores that outgrow Free.",
    monthlyPriceUsd: 29.99,
    recoveryFeePercent: 4,
    includedDeclinesPerMonth: 500,
    includedRecoveryEmails: 500,
    emailOveragePackSize: 30,
    emailOveragePackPriceUsd: 3,
    includedStores: Number.POSITIVE_INFINITY,
    extraStorePriceUsd: null,
    extraStoreOneTime: false,
    showDeclineGuardBadge: false,
    features: [
      "500 declines per month",
      "Same stackable +10 decline add-on",
      "Over quota, new declines wait in the hold queue",
      "Unlimited Lemon Squeezy stores",
      "No DeclineGuard branding in emails",
      "Full email customization & block editor",
      "Recovery history, charts & CSV export",
      "Priority support",
    ],
    cta: "Get Pro",
  },
} as const;

export const PRICING_FAQS = [
  {
    q: "What counts as a decline?",
    a: "Each failed renewal that enters DeclineGuard is one decline toward your monthly bucket — not each email in the sequence. A 3-step sequence for one failed payment still uses one decline.",
  },
  {
    q: "What happens when I hit my monthly quota?",
    a: "New declines go to a hold queue until the next month or you add capacity. Sequences already in flight are not killed mid-way.",
  },
  {
    q: "How do decline add-ons work?",
    a: `Stack +${DECLINE_ADDON.extraDeclines} declines for $${DECLINE_ADDON.monthlyPriceUsd}/mo on Free or Pro. Add as many packs as you need — they stack on top of your plan bucket.`,
  },
  {
    q: "What’s the difference between Free and Pro?",
    a: "Free is $0 with 50 declines per month. Pro is $29.99/mo with 500 declines per month, unlimited stores, no DeclineGuard badge, and fuller email customization. Over quota, both plans hold new declines instead of killing a sequence mid-flight.",
  },
  {
    q: "Is there a contract or setup fee?",
    a: "No. Free is $0/month with no card required. Pro is $29.99/month, cancel anytime from your dashboard.",
  },
] as const;

export function formatUsd(amount: number, options?: { cents?: boolean }): string {
  const value = options?.cents ? amount / 100 : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDeclineQuota(declines: number): string {
  return `${declines.toLocaleString("en-US")} declines / month`;
}

export function formatDeclineAddon(): string {
  return `+${DECLINE_ADDON.extraDeclines} declines for ${formatUsd(DECLINE_ADDON.monthlyPriceUsd)}/mo`;
}
