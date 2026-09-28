import type { BlockAlign, EmailBlock } from "./emailBlocks";
import {
  normalizeLayoutPresetId,
  type LayoutPresetId,
} from "./emailTheme";

export type RecoveryKitTemplateId = "gentle" | "direct" | "urgent";

export type KitCopy = {
  subject: string;
  eyebrow: string;
  headline: string;
  body: string;
  cta: string;
  link: string;
};

export type BlockKitSpec = {
  align: BlockAlign;
  ctaAlign: BlockAlign;
  emailPadding: number;
  shellBorder: boolean;
  shellBorderWidth: number;
  shellRadius: number;
  eyebrowSize: number;
  headlineSize: number;
  bodySize: number;
};

/** Mirror of FE `BLOCK_KIT_SPEC` chrome that send can apply. */
export const BLOCK_KIT_SPEC: Record<LayoutPresetId, BlockKitSpec> = {
  sonos: {
    align: "center",
    ctaAlign: "center",
    emailPadding: 48,
    shellBorder: false,
    shellBorderWidth: 1,
    shellRadius: 0,
    eyebrowSize: 11,
    headlineSize: 28,
    bodySize: 15,
  },
  avocode: {
    align: "left",
    ctaAlign: "left",
    emailPadding: 28,
    shellBorder: false,
    shellBorderWidth: 1,
    shellRadius: 0,
    eyebrowSize: 13,
    headlineSize: 22,
    bodySize: 15,
  },
  benchmark: {
    align: "left",
    ctaAlign: "left",
    emailPadding: 32,
    shellBorder: false,
    shellBorderWidth: 1,
    shellRadius: 12,
    eyebrowSize: 12,
    headlineSize: 22,
    bodySize: 15,
  },
  fontbase: {
    align: "left",
    ctaAlign: "left",
    emailPadding: 32,
    shellBorder: false,
    shellBorderWidth: 1,
    shellRadius: 0,
    eyebrowSize: 11,
    headlineSize: 28,
    bodySize: 15,
  },
  "nordvpn-structure": {
    align: "left",
    ctaAlign: "left",
    emailPadding: 28,
    shellBorder: true,
    shellBorderWidth: 4,
    shellRadius: 0,
    eyebrowSize: 11,
    headlineSize: 22,
    bodySize: 15,
  },
};

const DAY_COPY: Record<RecoveryKitTemplateId, KitCopy> = {
  gentle: {
    subject: "Your payment for {{product}} didn’t go through",
    eyebrow: "A quick update",
    headline: "Your payment didn’t go through",
    body: "The payment of {{amount}} for {{product}} didn't go through. Update your card below — takes about a minute.",
    cta: "Update payment method",
    link: "Open the billing page",
  },
  direct: {
    subject: "2nd notice: payment still needed for {{product}}",
    eyebrow: "Still pending",
    headline: "Still need an updated card",
    body: "Your payment for {{product}} ({{amount}}) is still pending. Update billing so your access stays on.",
    cta: "Update billing",
    link: "Open the billing page",
  },
  urgent: {
    subject: "Final notice: need updated billing for {{product}}",
    eyebrow: "Last chance",
    headline: "Last chance to keep access",
    body: "Without an updated card, {{product}} ({{amount}}) may pause soon. Fix payment now to stay uninterrupted.",
    cta: "Fix payment now",
    link: "Open the billing page",
  },
};

function boldTokens(plain: string): string {
  return plain
    .replace(/\{\{product\}\}/g, "**{{product}}**")
    .replace(/\{\{amount\}\}/g, "**{{amount}}**");
}

function textBlock(
  id: string,
  html: string,
  fontSize: number,
  opts?: {
    color?: "default" | "muted" | "link";
    align?: BlockAlign;
    bold?: boolean;
    hexColor?: string;
    copySlot?: "eyebrow" | "headline" | "body";
    marginTop?: number;
    marginBottom?: number;
  },
): EmailBlock {
  return {
    id,
    type: "text",
    html,
    fontSize,
    color: opts?.color ?? "default",
    hexColor: opts?.hexColor,
    align: opts?.align ?? "left",
    bold: opts?.bold,
    copySlot: opts?.copySlot,
    marginTop: opts?.marginTop ?? 0,
    marginBottom: opts?.marginBottom ?? 16,
  };
}

function buttonBlock(
  id: string,
  label: string,
  align: BlockAlign,
  marginBottom = 16,
): EmailBlock {
  return {
    id,
    type: "button",
    label,
    backgroundColor: "",
    align,
    marginTop: 0,
    marginBottom,
  };
}

function billingLink(
  id: string,
  prefix: string,
  label: string,
  suffix: string,
  align: BlockAlign,
): EmailBlock {
  const pre = prefix.replace(/\s+$/g, "");
  const suf = suffix.replace(/^\s+/g, "");
  const html = `${pre ? `${pre} ` : ""}<a href="#update-payment">${label}</a>${suf ? ` ${suf}` : ""}`;
  return textBlock(id, html, 15, {
    color: "muted",
    align,
    marginTop: 0,
    marginBottom: 8,
  });
}

function blocksForSonos(spec: BlockKitSpec, copy: KitCopy): EmailBlock[] {
  return [
    textBlock("sonos-eyebrow", copy.eyebrow, spec.eyebrowSize, {
      copySlot: "eyebrow",
      color: "muted",
      align: "center",
      marginTop: 8,
      marginBottom: 10,
    }),
    textBlock("sonos-headline", copy.headline, spec.headlineSize, {
      copySlot: "headline",
      bold: true,
      align: "center",
      marginBottom: 14,
    }),
    textBlock("sonos-body", boldTokens(copy.body), spec.bodySize, {
      copySlot: "body",
      color: "muted",
      align: "center",
      marginBottom: 28,
    }),
    buttonBlock("sonos-cta", copy.cta, "center", 20),
    billingLink("sonos-billing", "Or", copy.link, "to continue.", "center"),
  ];
}

function blocksForAvocode(spec: BlockKitSpec, copy: KitCopy): EmailBlock[] {
  return [
    textBlock("avocode-eyebrow", copy.eyebrow, spec.eyebrowSize, {
      copySlot: "eyebrow",
      color: "muted",
      align: "left",
      marginBottom: 8,
    }),
    textBlock("avocode-headline", copy.headline, spec.headlineSize, {
      copySlot: "headline",
      bold: true,
      align: "left",
      marginBottom: 16,
    }),
    textBlock("avocode-ending", "What's ending", 12, {
      color: "muted",
      marginTop: 4,
      marginBottom: 6,
    }),
    textBlock("avocode-product", "{{product}}", 15, {
      bold: true,
      marginBottom: 2,
    }),
    textBlock("avocode-amount", "{{amount}}", 13, {
      color: "muted",
      marginBottom: 16,
    }),
    textBlock("avocode-body", boldTokens(copy.body), spec.bodySize, {
      copySlot: "body",
      marginBottom: 24,
    }),
    buttonBlock("avocode-cta", copy.cta, "left", 16),
    billingLink("avocode-billing", "", copy.link, "", "left"),
  ];
}

function blocksForBenchmark(spec: BlockKitSpec, copy: KitCopy): EmailBlock[] {
  return [
    textBlock("benchmark-eyebrow", copy.eyebrow, 11, {
      copySlot: "eyebrow",
      color: "muted",
      hexColor: "#1f7a4d",
      marginBottom: 14,
    }),
    textBlock("benchmark-headline", copy.headline, spec.headlineSize, {
      copySlot: "headline",
      bold: true,
      marginBottom: 12,
    }),
    textBlock("benchmark-body", boldTokens(copy.body), spec.bodySize, {
      copySlot: "body",
      marginBottom: 18,
    }),
    textBlock("benchmark-safe", "Nothing here is gone", 13, {
      bold: true,
      marginTop: 4,
      marginBottom: 6,
    }),
    textBlock("benchmark-access", "Access stays on while you update.", 13, {
      color: "muted",
      marginBottom: 2,
    }),
    textBlock(
      "benchmark-card",
      "Card details stay on your billing page.",
      13,
      { color: "muted", marginBottom: 24 },
    ),
    buttonBlock("benchmark-cta", copy.cta, "left", 16),
    billingLink("benchmark-billing", "", copy.link, "", "left"),
  ];
}

function blocksForFontbase(spec: BlockKitSpec, copy: KitCopy): EmailBlock[] {
  return [
    textBlock("fontbase-eyebrow", copy.eyebrow, spec.eyebrowSize, {
      copySlot: "eyebrow",
      color: "muted",
      marginBottom: 10,
    }),
    textBlock("fontbase-headline", copy.headline, spec.headlineSize, {
      copySlot: "headline",
      bold: true,
      marginBottom: 14,
    }),
    textBlock("fontbase-body", boldTokens(copy.body), spec.bodySize, {
      copySlot: "body",
      color: "muted",
      marginBottom: 8,
    }),
    {
      id: "fontbase-rule",
      type: "divider",
      marginTop: 12,
      marginBottom: 16,
    },
    textBlock("fontbase-included", "What's included", 12, {
      color: "muted",
      marginBottom: 8,
    }),
    textBlock("fontbase-plan", "Same plan and workspace", 14, {
      marginBottom: 4,
    }),
    textBlock(
      "fontbase-card",
      "Change the card anytime before renewal",
      14,
      { marginBottom: 16 },
    ),
    textBlock("fontbase-meta", "{{product}}  ·  {{amount}}", 13, {
      color: "muted",
      marginBottom: 24,
    }),
    buttonBlock("fontbase-cta", copy.cta, "left", 16),
    billingLink("fontbase-billing", "", copy.link, "", "left"),
  ];
}

function blocksForNordvpn(spec: BlockKitSpec, copy: KitCopy): EmailBlock[] {
  return [
    textBlock("nordvpn-eyebrow", copy.eyebrow, spec.eyebrowSize, {
      copySlot: "eyebrow",
      color: "muted",
      marginBottom: 8,
    }),
    textBlock("nordvpn-headline", copy.headline, spec.headlineSize, {
      copySlot: "headline",
      bold: true,
      marginBottom: 12,
    }),
    textBlock("nordvpn-body", boldTokens(copy.body), spec.bodySize, {
      copySlot: "body",
      marginBottom: 18,
    }),
    textBlock("nordvpn-step1", "1. Update billing", 14, {
      bold: true,
      marginBottom: 6,
    }),
    textBlock("nordvpn-step2", "2. Keep access on", 14, {
      bold: true,
      marginBottom: 24,
    }),
    buttonBlock("nordvpn-cta", copy.cta, "left", 16),
    billingLink("nordvpn-billing", "", copy.link, "", "left"),
  ];
}

/**
 * Starter block kits — same shapes as FE `emailBlockKits`.
 * Same structure across Day 0 / 2 / 5; copy/step labels change.
 */
export function starterBlocksForKit(
  layoutPresetId: string | null | undefined,
  templateId: RecoveryKitTemplateId,
): EmailBlock[] {
  const kit = normalizeLayoutPresetId(layoutPresetId);
  const spec = BLOCK_KIT_SPEC[kit];
  const copy = DAY_COPY[templateId] ?? DAY_COPY.gentle;
  switch (kit) {
    case "sonos":
      return blocksForSonos(spec, copy);
    case "avocode":
      return blocksForAvocode(spec, copy);
    case "benchmark":
      return blocksForBenchmark(spec, copy);
    case "fontbase":
      return blocksForFontbase(spec, copy);
    case "nordvpn-structure":
      return blocksForNordvpn(spec, copy);
    default: {
      const _exhaustive: never = kit;
      return _exhaustive;
    }
  }
}

export function kitShellSpec(layoutPresetId: string | null | undefined): BlockKitSpec {
  return BLOCK_KIT_SPEC[normalizeLayoutPresetId(layoutPresetId)];
}

export function kitVisibleFingerprint(kit: LayoutPresetId): string {
  switch (kit) {
    case "sonos":
      return "A quick update";
    case "avocode":
      return "What's ending";
    case "benchmark":
      return "Nothing here is gone";
    case "fontbase":
      return "What's included";
    case "nordvpn-structure":
      return "1. Update billing";
    default: {
      const _exhaustive: never = kit;
      return _exhaustive;
    }
  }
}
