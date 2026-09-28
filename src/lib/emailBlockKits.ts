/**
 * Starter block kits — 1:1 structure of the RGE templates Fendem locked.
 *   sonos              https://reallygoodemails.com/emails/verify-your-email-sonos
 *   avocode            https://reallygoodemails.com/emails/your-avocode-trial-ended
 *   benchmark          https://reallygoodemails.com/emails/dont-worry-your-data-is-safe
 *   fontbase           https://reallygoodemails.com/emails/upcoming-renewal
 *   nordvpn-structure  https://reallygoodemails.com/emails/your-account-has-expired
 *
 * Day 0 / 2 / 5 reuse the same stacked blocks (logo, eyebrow, headline,
 * body, CTA, link) with gentle / direct / urgent recovery copy.
 */

import {
  createBillingLinkTextBlock,
  createButtonBlock,
  createTextBlock,
  deriveLegacyFromBlocks,
  type BlockAlign,
  type EmailBlock,
  type EmailDocument,
} from "./emailBuilder";
import type { LayoutPresetId } from "./emailLayoutPresets";
import {
  EMAIL_TEMPLATE_ORDER,
  type EmailCopyByTemplate,
} from "./emailStyleSync";
import type { RecoveryTemplateId } from "./recoveryEmailCopy";

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
  logoAlign: BlockAlign;
  showStoreName: boolean;
  showGreeting: boolean;
  emailPadding: number;
  shellBorder: boolean;
  shellBorderWidth: number;
  shellRadius: number;
  eyebrowSize: number;
  headlineSize: number;
  bodySize: number;
};

export const BLOCK_KIT_SPEC: Record<LayoutPresetId, BlockKitSpec> = {
  sonos: {
    align: "center",
    ctaAlign: "center",
    logoAlign: "center",
    showStoreName: false,
    showGreeting: false,
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
    logoAlign: "left",
    showStoreName: true,
    showGreeting: false,
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
    logoAlign: "left",
    showStoreName: true,
    showGreeting: false,
    emailPadding: 32,
    shellBorder: false,
    shellBorderWidth: 1,
    shellRadius: 8,
    eyebrowSize: 12,
    headlineSize: 22,
    bodySize: 15,
  },
  fontbase: {
    align: "left",
    ctaAlign: "left",
    logoAlign: "left",
    showStoreName: true,
    showGreeting: false,
    emailPadding: 28,
    shellBorder: false,
    shellBorderWidth: 1,
    shellRadius: 0,
    eyebrowSize: 11,
    headlineSize: 26,
    bodySize: 15,
  },
  "nordvpn-structure": {
    align: "left",
    ctaAlign: "left",
    logoAlign: "left",
    showStoreName: true,
    showGreeting: false,
    emailPadding: 28,
    shellBorder: true,
    shellBorderWidth: 4,
    shellRadius: 0,
    eyebrowSize: 11,
    headlineSize: 22,
    bodySize: 15,
  },
};

const DAY_COPY: Record<RecoveryTemplateId, KitCopy> = {
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

export function kitCopyFromDocument(
  day: RecoveryTemplateId,
  doc?: EmailDocument | null,
): KitCopy {
  const fallback = DAY_COPY[day];
  if (!doc) return { ...fallback };
  const legacy = deriveLegacyFromBlocks(doc.subject, doc.blocks, {
    subject: doc.subject || fallback.subject,
    headline: doc.headline || fallback.headline,
    body: doc.body || fallback.body,
    cta: doc.cta || fallback.cta,
  });
  const texts = doc.blocks.filter((b) => b.type === "text");
  const eyebrow =
    texts[0] && texts.length >= 2
      ? texts[0].html.replace(/<[^>]+>/g, "").trim()
      : fallback.eyebrow;
  return {
    subject: legacy.subject || fallback.subject,
    eyebrow: eyebrow || fallback.eyebrow,
    headline: legacy.headline || fallback.headline,
    body: legacy.body || fallback.body,
    cta: legacy.cta || fallback.cta,
    link: fallback.link,
  };
}

export function blocksForKit(kitId: LayoutPresetId, copy: KitCopy): EmailBlock[] {
  const spec = BLOCK_KIT_SPEC[kitId];
  return [
    createTextBlock(copy.eyebrow, {
      fontSize: spec.eyebrowSize,
      color: "muted",
      align: spec.align,
      marginTop: 0,
      marginBottom: 8,
    }),
    createTextBlock(copy.headline, {
      fontSize: spec.headlineSize,
      color: "default",
      bold: true,
      align: spec.align,
      marginTop: 0,
      marginBottom: 12,
    }),
    createTextBlock(boldTokens(copy.body), {
      fontSize: spec.bodySize,
      color: "default",
      align: spec.align,
      marginTop: 4,
      marginBottom: 24,
    }),
    createButtonBlock(copy.cta, {
      align: spec.ctaAlign,
      marginBottom: 20,
    }),
    createBillingLinkTextBlock({
      prefix: "Or",
      linkLabel: copy.link,
      suffix: "to continue.",
      align: spec.align,
    }),
  ];
}

export function documentForKit(
  day: RecoveryTemplateId,
  kitId: LayoutPresetId,
  existing?: EmailDocument | null,
): EmailDocument {
  const spec = BLOCK_KIT_SPEC[kitId];
  const copy = kitCopyFromDocument(day, existing);
  const blocks = blocksForKit(kitId, copy);
  const legacy = deriveLegacyFromBlocks(copy.subject, blocks, {
    subject: copy.subject,
    headline: copy.headline,
    body: copy.body,
    cta: copy.cta,
  });
  return {
    ...legacy,
    blocks,
    linkColor: existing?.linkColor ?? "#6b6b70",
    emailPadding: spec.emailPadding,
    shellBorder: spec.shellBorder,
    shellBorderWidth: spec.shellBorderWidth,
    shellRadius: spec.shellRadius,
    shellBackground: existing?.shellBackground,
    shellBorderColor: existing?.shellBorderColor,
  };
}

export function seedCopyWithKit(
  copy: EmailCopyByTemplate,
  kitId: LayoutPresetId,
): EmailCopyByTemplate {
  const next = { ...copy };
  for (const day of EMAIL_TEMPLATE_ORDER) {
    next[day] = documentForKit(day, kitId, copy[day]);
  }
  return next;
}

export function kitLogoAlign(kitId: LayoutPresetId): BlockAlign {
  return BLOCK_KIT_SPEC[kitId].logoAlign;
}

export function kitShowsStoreName(kitId: LayoutPresetId): boolean {
  return BLOCK_KIT_SPEC[kitId].showStoreName;
}

export function kitShowsGreeting(kitId: LayoutPresetId): boolean {
  return BLOCK_KIT_SPEC[kitId].showGreeting;
}
