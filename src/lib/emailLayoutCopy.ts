import type { LayoutPresetId, LifecycleEmailType } from "./emailLayoutPresets";

export type EmailLayoutCopy = {
  eyebrow: string;
  headline: string;
  body: string;
  cta: string;
  secondaryLink: string;
  /** Layout-specific supporting lines (lists, chips, notes). */
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
  Record<LifecycleEmailType, EmailCopyOverride>
>;

type CopyVars = {
  product: string;
  amount: string;
  firstName?: string;
  storeName?: string;
};

const BASE_BY_TYPE: Record<LifecycleEmailType, EmailLayoutCopy> = {
  verify: {
    eyebrow: "A quick check",
    headline: "Confirm this is you",
    body: "We only need a moment to make sure {{first_name}} still wants email from {{store}}.",
    cta: "Confirm email",
    secondaryLink: "This wasn’t me",
    support: [
      "Takes a few seconds",
      "You can unsubscribe anytime",
    ],
    status: "Waiting to confirm",
  },
  decline_pause: {
    eyebrow: "Payment update",
    headline: "Your payment didn’t go through",
    body: "The charge of {{amount}} for {{product}} failed. Update billing to keep access.",
    cta: "Update payment",
    secondaryLink: "Open billing",
    support: [
      "Access stays on while you update",
      "Card details stay on your billing page",
    ],
    status: "Payment paused",
  },
  trial_ended: {
    eyebrow: "Trial wrapped up",
    headline: "Your trial has ended",
    body: "Thanks for trying {{product}}. Subscribe to keep the same workspace and data.",
    cta: "Continue",
    secondaryLink: "Not now",
    support: [
      "Your workspace is still here",
      "Nothing is deleted for sitting this out",
    ],
    status: "Trial ended",
  },
  renewal: {
    eyebrow: "Upcoming renewal",
    headline: "Your renewal is coming up",
    body: "{{product}} renews soon for {{amount}}. You’re all set unless you want to change the card.",
    cta: "Review billing",
    secondaryLink: "Manage plan",
    support: [
      "Same plan and workspace",
      "Change the card anytime before renewal",
    ],
    status: "Renewal scheduled",
  },
  expiry: {
    eyebrow: "Access ending",
    headline: "Access is ending soon",
    body: "{{product}} will stop unless billing is updated. Your data stays until you come back.",
    cta: "Restore access",
    secondaryLink: "Need more time?",
    support: [
      "Workspace data stays put",
      "Restore from the same billing page",
    ],
    status: "Ending soon",
  },
};

/** Layout-specific chrome only — not third-party copy. */
const LAYOUT_CHROME: Record<
  LayoutPresetId,
  Partial<Record<LifecycleEmailType, Partial<EmailLayoutCopy>>>
> = {
  sonos: {
    verify: {
      eyebrow: "Just to be sure",
      headline: "One tap to confirm",
    },
  },
  avocode: {
    trial_ended: {
      eyebrow: "Trial wrapped up",
      headline: "Your trial has ended",
    },
    decline_pause: {
      eyebrow: "Billing needs a moment",
    },
  },
  benchmark: {
    decline_pause: {
      status: "Paused — your data is safe",
      headline: "Don’t worry — your data is safe",
      body: "The payment of {{amount}} for {{product}} didn’t go through. Everything you saved is still here.",
    },
    trial_ended: {
      status: "Paused — your data is safe",
    },
    expiry: {
      status: "Ending — your data is safe",
    },
  },
  fontbase: {
    renewal: {
      eyebrow: "Upcoming renewal",
      headline: "Your renewal is coming up",
    },
  },
  "nordvpn-structure": {
    expiry: {
      eyebrow: "Account expired",
      headline: "Your account has expired",
    },
    decline_pause: {
      eyebrow: "Needs a card update",
    },
  },
};

export function defaultLayoutCopy(
  layoutPresetId: LayoutPresetId,
  emailType: LifecycleEmailType,
): EmailLayoutCopy {
  const base = BASE_BY_TYPE[emailType];
  const chrome = LAYOUT_CHROME[layoutPresetId][emailType];
  return {
    ...base,
    ...chrome,
    support: chrome?.support ?? base.support,
  };
}

export function resolveLayoutCopy(
  layoutPresetId: LayoutPresetId,
  emailType: LifecycleEmailType,
  overrides?: EmailCopyOverride | null,
): EmailLayoutCopy {
  const base = defaultLayoutCopy(layoutPresetId, emailType);
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
