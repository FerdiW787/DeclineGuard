import type { LayoutPresetId, RecoveryDayId } from "./emailLayoutPresets";
import { DEFAULT_EMAIL_COPY } from "./recoveryEmailCopy";

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
  Record<RecoveryDayId, EmailCopyOverride>
>;

type CopyVars = {
  product: string;
  amount: string;
  firstName?: string;
  storeName?: string;
};

/**
 * Recovery sequence copy (Day 0 / Day 2 / Day 5) — not lifecycle email kinds.
 * Headline / body / CTA stay in sync with `DEFAULT_EMAIL_COPY`.
 */
const BASE_BY_DAY: Record<RecoveryDayId, EmailLayoutCopy> = {
  gentle: {
    eyebrow: "Day 0",
    headline: DEFAULT_EMAIL_COPY.gentle.headline,
    body: DEFAULT_EMAIL_COPY.gentle.body,
    cta: DEFAULT_EMAIL_COPY.gentle.cta,
    secondaryLink: "Review billing",
    support: [
      "Takes about a minute",
      "Your access stays on while you update",
    ],
    status: "Payment needs an update",
  },
  direct: {
    eyebrow: "Day 2",
    headline: DEFAULT_EMAIL_COPY.direct.headline,
    body: DEFAULT_EMAIL_COPY.direct.body,
    cta: DEFAULT_EMAIL_COPY.direct.cta,
    secondaryLink: "Open billing",
    support: [
      "Same billing page as last time",
      "Access stays on after a successful update",
    ],
    status: "Still waiting on billing",
  },
  urgent: {
    eyebrow: "Day 5",
    headline: DEFAULT_EMAIL_COPY.urgent.headline,
    body: DEFAULT_EMAIL_COPY.urgent.body,
    cta: DEFAULT_EMAIL_COPY.urgent.cta,
    secondaryLink: "Need more time?",
    support: [
      "Update now to avoid a pause",
      "Your data stays if access stops",
    ],
    status: "Last notice",
  },
};

/** Layout chrome only — DeclineGuard / merchant voice, not cloned marketing copy. */
const LAYOUT_CHROME: Record<
  LayoutPresetId,
  Partial<Record<RecoveryDayId, Partial<EmailLayoutCopy>>>
> = {
  sonos: {
    gentle: {
      eyebrow: "A quick update",
    },
  },
  avocode: {},
  benchmark: {
    gentle: {
      status: "Your data is safe",
    },
    direct: {
      status: "Your data is safe",
    },
    urgent: {
      status: "Your data is still safe",
    },
  },
  fontbase: {},
  "nordvpn-structure": {
    urgent: {
      status: "Access may pause soon",
    },
  },
};

export function defaultLayoutCopy(
  layoutPresetId: LayoutPresetId,
  recoveryDay: RecoveryDayId,
): EmailLayoutCopy {
  const base = BASE_BY_DAY[recoveryDay];
  const chrome = LAYOUT_CHROME[layoutPresetId][recoveryDay];
  return {
    ...base,
    ...chrome,
    support: chrome?.support ?? base.support,
  };
}

export function resolveLayoutCopy(
  layoutPresetId: LayoutPresetId,
  recoveryDay: RecoveryDayId,
  overrides?: EmailCopyOverride | null,
): EmailLayoutCopy {
  const base = defaultLayoutCopy(layoutPresetId, recoveryDay);
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

export function recoveryDayNumber(recoveryDay: RecoveryDayId): 0 | 2 | 5 {
  switch (recoveryDay) {
    case "gentle":
      return 0;
    case "direct":
      return 2;
    case "urgent":
      return 5;
    default: {
      const _exhaustive: never = recoveryDay;
      return _exhaustive;
    }
  }
}

export function recoveryDayLabel(recoveryDay: RecoveryDayId): string {
  switch (recoveryDay) {
    case "gentle":
      return "Day 0";
    case "direct":
      return "Day 2";
    case "urgent":
      return "Day 5";
    default: {
      const _exhaustive: never = recoveryDay;
      return _exhaustive;
    }
  }
}
