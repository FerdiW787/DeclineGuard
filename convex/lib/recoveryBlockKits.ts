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

/**
 * Set A chrome — matches FE `src/lib/emailBlockKits.ts` (Jules 59b1ba6).
 *   poster-notice     one announcement, then the button
 *   amount-due        money first, then the problem
 *   plain-letter      a short letter, then the ask
 *   what-happened     two beats: happened, then do
 *   quiet-column      wide type, almost nothing else
 */
export const BLOCK_KIT_SPEC: Record<LayoutPresetId, BlockKitSpec> = {
  "poster-notice": {
    align: "center",
    ctaAlign: "center",
    emailPadding: 64,
    shellBorder: false,
    shellBorderWidth: 1,
    shellRadius: 0,
    eyebrowSize: 11,
    headlineSize: 34,
    bodySize: 16,
  },
  "amount-due": {
    align: "left",
    ctaAlign: "left",
    emailPadding: 40,
    shellBorder: false,
    shellBorderWidth: 1,
    shellRadius: 0,
    eyebrowSize: 11,
    headlineSize: 20,
    bodySize: 15,
  },
  "plain-letter": {
    align: "left",
    ctaAlign: "left",
    emailPadding: 44,
    shellBorder: false,
    shellBorderWidth: 1,
    shellRadius: 0,
    eyebrowSize: 11,
    headlineSize: 22,
    bodySize: 16,
  },
  "what-happened": {
    align: "left",
    ctaAlign: "left",
    emailPadding: 32,
    shellBorder: false,
    shellBorderWidth: 1,
    shellRadius: 0,
    eyebrowSize: 11,
    headlineSize: 22,
    bodySize: 15,
  },
  "quiet-column": {
    align: "left",
    ctaAlign: "left",
    emailPadding: 64,
    shellBorder: false,
    shellBorderWidth: 1,
    shellRadius: 0,
    eyebrowSize: 11,
    headlineSize: 32,
    bodySize: 18,
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

function spacerBlock(id: string, height: number): EmailBlock {
  return {
    id,
    type: "spacer",
    height,
    marginTop: 0,
    marginBottom: 0,
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

function blocksForPosterNotice(spec: BlockKitSpec, copy: KitCopy): EmailBlock[] {
  return [
    spacerBlock("poster-notice-spacer-top", 8),
    textBlock("poster-notice-headline", copy.headline, spec.headlineSize, {
      copySlot: "headline",
      bold: true,
      align: "center",
      marginBottom: 14,
    }),
    textBlock("poster-notice-body", boldTokens(copy.body), spec.bodySize, {
      copySlot: "body",
      color: "muted",
      align: "center",
      marginBottom: 0,
    }),
    spacerBlock("poster-notice-spacer-cta", 36),
    buttonBlock("poster-notice-cta", copy.cta, "center", 16),
    billingLink("poster-notice-billing", "", copy.link, "", "center"),
  ];
}

function blocksForAmountDue(spec: BlockKitSpec, copy: KitCopy): EmailBlock[] {
  return [
    textBlock("amount-due-label", "Amount due", spec.eyebrowSize, {
      color: "muted",
      marginBottom: 6,
    }),
    textBlock("amount-due-amount", "{{amount}}", 42, {
      bold: true,
      marginBottom: 4,
    }),
    textBlock("amount-due-product", "{{product}}", 14, {
      color: "muted",
      marginBottom: 28,
    }),
    textBlock("amount-due-headline", copy.headline, spec.headlineSize, {
      copySlot: "headline",
      bold: true,
      marginBottom: 8,
    }),
    textBlock(
      "amount-due-body",
      "Update the card to keep access on — about a minute.",
      spec.bodySize,
      {
        copySlot: "body",
        color: "muted",
        marginBottom: 24,
      },
    ),
    buttonBlock("amount-due-cta", copy.cta, "left", 14),
    billingLink("amount-due-billing", "", copy.link, "", "left"),
  ];
}

function blocksForPlainLetter(spec: BlockKitSpec, copy: KitCopy): EmailBlock[] {
  return [
    textBlock("plain-letter-headline", copy.headline, spec.headlineSize, {
      copySlot: "headline",
      bold: true,
      marginBottom: 16,
    }),
    textBlock("plain-letter-body", boldTokens(copy.body), spec.bodySize, {
      copySlot: "body",
      marginBottom: 16,
    }),
    textBlock(
      "plain-letter-keep",
      "Updating the card keeps **{{product}}** on. Nothing else changes.",
      spec.bodySize,
      {
        color: "muted",
        marginBottom: 20,
      },
    ),
    textBlock("plain-letter-thanks", "Thanks,", spec.bodySize, {
      marginBottom: 0,
    }),
    spacerBlock("plain-letter-spacer", 28),
    buttonBlock("plain-letter-cta", copy.cta, "left", 14),
    billingLink("plain-letter-billing", "", copy.link, "", "left"),
  ];
}

function blocksForWhatHappened(spec: BlockKitSpec, copy: KitCopy): EmailBlock[] {
  return [
    textBlock("what-happened-headline", copy.headline, spec.headlineSize, {
      copySlot: "headline",
      bold: true,
      marginBottom: 24,
    }),
    textBlock("what-happened-label", "WHAT HAPPENED", 11, {
      color: "muted",
      marginBottom: 6,
    }),
    textBlock("what-happened-body", boldTokens(copy.body), spec.bodySize, {
      copySlot: "body",
      marginBottom: 0,
    }),
    {
      id: "what-happened-rule",
      type: "divider",
      marginTop: 18,
      marginBottom: 18,
    },
    textBlock("what-happened-do-label", "WHAT TO DO", 11, {
      color: "muted",
      marginBottom: 6,
    }),
    textBlock(
      "what-happened-do",
      "Open billing and update the card.",
      spec.bodySize,
      { marginBottom: 24 },
    ),
    buttonBlock("what-happened-cta", copy.cta, "left", 14),
    billingLink("what-happened-billing", "", copy.link, "", "left"),
  ];
}

function blocksForQuietColumn(spec: BlockKitSpec, copy: KitCopy): EmailBlock[] {
  return [
    textBlock("quiet-column-headline", copy.headline, spec.headlineSize, {
      copySlot: "headline",
      bold: true,
      marginTop: 8,
      marginBottom: 16,
    }),
    textBlock("quiet-column-body", boldTokens(copy.body), spec.bodySize, {
      copySlot: "body",
      color: "muted",
      marginBottom: 0,
    }),
    spacerBlock("quiet-column-spacer", 32),
    buttonBlock("quiet-column-cta", copy.cta, "left", 16),
    billingLink("quiet-column-billing", "", copy.link, "", "left"),
  ];
}

/**
 * Starter block kits — same shapes as FE `emailBlockKits`.
 * Send always uses these kits (merchant blocks are not a control surface).
 */
export function starterBlocksForKit(
  layoutPresetId: string | null | undefined,
  templateId: RecoveryKitTemplateId,
): EmailBlock[] {
  const kit = normalizeLayoutPresetId(layoutPresetId);
  const spec = BLOCK_KIT_SPEC[kit];
  const copy = DAY_COPY[templateId] ?? DAY_COPY.gentle;
  switch (kit) {
    case "poster-notice":
      return blocksForPosterNotice(spec, copy);
    case "amount-due":
      return blocksForAmountDue(spec, copy);
    case "plain-letter":
      return blocksForPlainLetter(spec, copy);
    case "what-happened":
      return blocksForWhatHappened(spec, copy);
    case "quiet-column":
      return blocksForQuietColumn(spec, copy);
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
    case "poster-notice":
      return "font-size:34px";
    case "amount-due":
      return "Amount due";
    case "plain-letter":
      return "Thanks,";
    case "what-happened":
      return "WHAT HAPPENED";
    case "quiet-column":
      return "font-size:32px";
    default: {
      const _exhaustive: never = kit;
      return _exhaustive;
    }
  }
}
