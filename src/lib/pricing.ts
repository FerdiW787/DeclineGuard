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

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "Start without a card. Pay only when we recover.",
    monthlyPriceUsd: 0,
    recoveryFeePercent: 10,
    includedRecoveryEmails: 100,
    emailOveragePackSize: 10,
    emailOveragePackPriceUsd: 3,
    includedStores: 1,
    extraStorePriceUsd: 5,
    extraStoreOneTime: true,
    showDeclineGuardBadge: true,
    features: [
      "1 Lemon Squeezy store (+ $5 one-time per extra store)",
      "100 recovery emails per month",
      "3-step branded recovery sequence (Day 0, 2, 5)",
      "Logo, colors, and copy in every email",
      "Recovery dashboard & activity timeline",
      "10% fee only when we recover after our sequence starts",
      "DeclineGuard badge in email footer",
    ],
    cta: "Start free",
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "Lower fees, higher volume, unlimited stores.",
    monthlyPriceUsd: 29.99,
    recoveryFeePercent: 4,
    includedRecoveryEmails: 500,
    emailOveragePackSize: 30,
    emailOveragePackPriceUsd: 3,
    includedStores: Number.POSITIVE_INFINITY,
    extraStorePriceUsd: null,
    extraStoreOneTime: false,
    showDeclineGuardBadge: false,
    features: [
      "Unlimited Lemon Squeezy stores",
      "500 recovery emails per month",
      "4% recovery fee (vs 10% on Free)",
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
    q: "When do you charge the recovery fee?",
    a: "Only after DeclineGuard’s email sequence has started and the payment actually comes back. If Lemon Squeezy retries successfully before our first email, you owe nothing — on Free or Pro.",
  },
  {
    q: "When does Pro save me money?",
    a: "Pro lowers your recovery fee from 10% to 4%. At about $500 recovered per month, Pro’s subscription plus 4% usually costs less than Free’s 10% alone. Use the calculator above with your numbers.",
  },
  {
    q: "What counts as a recovery email?",
    a: "Each email we send to a subscriber with a failed renewal — your 3-step sequence (Day 0, 2, and 5) uses up to 3 emails per failed payment. Resends and test previews don’t count toward your limit.",
  },
  {
    q: "What happens if I go over my email limit?",
    a: "Free adds $3/month per extra block of 10 emails. Pro adds $3/month per extra block of 30 emails. You can add packs from your dashboard before you hit the cap.",
  },
  {
    q: "Can I connect more than one store on Free?",
    a: "Free includes one Lemon Squeezy store. Each additional store is a one-time $5 add-on. Pro includes unlimited stores at no extra charge.",
  },
  {
    q: "Is there a contract or setup fee?",
    a: "No. Free is $0/month with no card required. Pro is $29.99/month, cancel anytime from your dashboard.",
  },
] as const;

export type PlanCostInput = {
  recoveredUsd: number;
  recoveryEmailsSent: number;
  extraStoresOnFree?: number;
};

export type PlanCostBreakdown = {
  baseUsd: number;
  recoveryFeeUsd: number;
  emailOverageUsd: number;
  extraStoresOneTimeUsd: number;
  totalMonthlyUsd: number;
  totalFirstMonthUsd: number;
};

function emailOverageCost(plan: PlanDefinition, emailsSent: number): number {
  if (emailsSent <= plan.includedRecoveryEmails) return 0;
  const over = emailsSent - plan.includedRecoveryEmails;
  const packs = Math.ceil(over / plan.emailOveragePackSize);
  return packs * plan.emailOveragePackPriceUsd;
}

/** Monthly cost estimate (excludes one-time store add-ons in totalMonthlyUsd). */
export function calculatePlanCost(
  planId: PlanId,
  input: PlanCostInput,
): PlanCostBreakdown {
  const plan = PLANS[planId];
  const recoveredUsd = Math.max(0, input.recoveredUsd);
  const emailsSent = Math.max(0, input.recoveryEmailsSent);
  const extraStores = Math.max(0, input.extraStoresOnFree ?? 0);

  const baseUsd = plan.monthlyPriceUsd;
  const recoveryFeeUsd = (recoveredUsd * plan.recoveryFeePercent) / 100;
  const emailOverageUsd = emailOverageCost(plan, emailsSent);
  const extraStoresOneTimeUsd =
    plan.id === "free" && plan.extraStorePriceUsd != null
      ? extraStores * plan.extraStorePriceUsd
      : 0;

  const totalMonthlyUsd = baseUsd + recoveryFeeUsd + emailOverageUsd;
  const totalFirstMonthUsd = totalMonthlyUsd + extraStoresOneTimeUsd;

  return {
    baseUsd,
    recoveryFeeUsd,
    emailOverageUsd,
    extraStoresOneTimeUsd,
    totalMonthlyUsd,
    totalFirstMonthUsd,
  };
}

/** Approximate recovered $/mo where Pro total ≤ Free total (fees only, no overage). */
export function proBreakevenRecoveredUsd(): number {
  const free = PLANS.free;
  const pro = PLANS.pro;
  const delta =
    (free.recoveryFeePercent - pro.recoveryFeePercent) / 100;
  if (delta <= 0) return Number.POSITIVE_INFINITY;
  return pro.monthlyPriceUsd / delta;
}

export function getRecommendedPlan(input: PlanCostInput): PlanId {
  const freeTotal = calculatePlanCost("free", input).totalMonthlyUsd;
  const proTotal = calculatePlanCost("pro", input).totalMonthlyUsd;
  return proTotal < freeTotal ? "pro" : "free";
}

export function formatUsd(amount: number, options?: { cents?: boolean }): string {
  const value = options?.cents ? amount / 100 : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}
