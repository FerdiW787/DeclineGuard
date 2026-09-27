import type { LayoutPresetId, RecoverySequenceStep } from "./emailLayoutPresets";

export type EmailLayoutCopy = {
  eyebrow: string;
  headline: string;
  body: string;
  cta: string;
  secondaryLink: string;
  support: readonly string[];
  status: string;
};

export type EmailCopyOverride = {
  headline?: string;
  body?: string;
  cta?: string;
  secondaryLink?: string;
};

export type EmailLayoutCopyOverrides = Partial<
  Record<RecoverySequenceStep, EmailCopyOverride>
>;

type CopyVars = {
  product: string;
  amount: string;
  firstName?: string;
  storeName?: string;
};

const BASE_BY_STEP: Record<RecoverySequenceStep, EmailLayoutCopy> = {
  day0: {
    eyebrow: "Day 0",
    headline: "Quick update on your subscription",
    body: "The payment of {{amount}} for {{product}} didn't go through. Update your card below — takes about a minute.",
    cta: "Update payment method",
    secondaryLink: "Open billing",
    support: [
      "Takes about a minute",
      "Access stays on while you update",
    ],
    status: "First notice",
  },
  day2: {
    eyebrow: "Day 2",
    headline: "Still need an updated card",
    body: "Your payment for {{product}} ({{amount}}) is still pending. Update billing so your access stays on.",
    cta: "Update billing",
    secondaryLink: "Open billing",
    support: [
      "Second notice",
      "Same billing page as before",
    ],
    status: "Still pending",
  },
  day5: {
    eyebrow: "Day 5",
    headline: "Last chance to keep access",
    body: "Without an updated card, {{product}} ({{amount}}) may pause soon. Fix payment now to stay uninterrupted.",
    cta: "Fix payment now",
    secondaryLink: "Open billing",
    support: [
      "Final notice",
      "Restore from the same billing page",
    ],
    status: "Final notice",
  },
};

const LAYOUT_CHROME: Record<
  LayoutPresetId,
  Partial<Record<RecoverySequenceStep, Partial<EmailLayoutCopy>>>
> = {
  sonos: {
    day0: { eyebrow: "A quiet note" },
  },
  avocode: {
    day2: { eyebrow: "Account · Day 2" },
  },
  benchmark: {
    day0: { eyebrow: "Recovery · Day 0" },
  },
  fontbase: {
    day0: { headline: "A payment needs a moment" },
  },
  "nordvpn-structure": {
    day5: { eyebrow: "Secure billing · Day 5" },
  },
};

export function defaultLayoutCopy(
  layoutPresetId: LayoutPresetId,
  step: RecoverySequenceStep,
): EmailLayoutCopy {
  const base = BASE_BY_STEP[step];
  const chrome = LAYOUT_CHROME[layoutPresetId][step];
  return {
    ...base,
    ...chrome,
    support: chrome?.support ?? base.support,
  };
}

export function resolveLayoutCopy(
  layoutPresetId: LayoutPresetId,
  step: RecoverySequenceStep,
  overrides?: EmailCopyOverride | null,
): EmailLayoutCopy {
  const base = defaultLayoutCopy(layoutPresetId, step);
  return {
    ...base,
    headline: overrides?.headline?.trim() || base.headline,
    body: overrides?.body?.trim() || base.body,
    cta: overrides?.cta?.trim() || base.cta,
    secondaryLink: overrides?.secondaryLink?.trim() || base.secondaryLink,
  };
}

export function applyLayoutCopyVars(text: string, vars: CopyVars): string {
  const first = vars.firstName?.trim() || "there";
  const store = vars.storeName?.trim() || "your store";
  return text
    .replace(/\{\{product\}\}/g, vars.product)
    .replace(/\{\{amount\}\}/g, vars.amount)
    .replace(/\{\{first_name\}\}/g, first)
    .replace(/\{\{store\}\}/g, store);
}
