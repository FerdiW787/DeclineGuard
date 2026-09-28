/**
 * Starter block kits — 1:1 structure of the RGE templates Fendem locked.
 *   sonos              https://reallygoodemails.com/emails/verify-your-email-sonos
 *   avocode            https://reallygoodemails.com/emails/your-avocode-trial-ended
 *   benchmark          https://reallygoodemails.com/emails/dont-worry-your-data-is-safe
 *   fontbase           https://reallygoodemails.com/emails/upcoming-renewal
 *   nordvpn-structure  https://reallygoodemails.com/emails/your-account-has-expired
 *
 * Day 0 / 2 / 5 reuse the same kit chrome with gentle / direct / urgent copy.
 * Switching kits rebuilds blocks from clean slots — never re-ingest the
 * billing link into body (that stacked "Or update billing" on every pick).
 */

import {
  createBillingLinkTextBlock,
  createButtonBlock,
  createDividerBlock,
  createTextBlock,
  type BlockAlign,
  type EmailBlock,
  type EmailDocument,
  type TextBlock,
} from "./emailBuilder";
import { PAYMENT_UPDATE_HREF } from "./emailRichText";
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
  showAccentBar: boolean;
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
    showAccentBar: false,
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
    showAccentBar: false,
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
    showAccentBar: false,
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
    logoAlign: "left",
    showStoreName: true,
    showGreeting: false,
    showAccentBar: false,
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
    logoAlign: "left",
    showStoreName: true,
    showGreeting: false,
    showAccentBar: true,
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

const CHROME_LINE =
  /^(what.?s ending|what.?s included|nothing here is gone|paused|access stays on|card details stay|same plan|change the card|update billing so|keep access|or\s)/i;

const BILLING_ECHO =
  /open the billing page|to update your card|to continue\.?/i;

function boldTokens(plain: string): string {
  return plain
    .replace(/\{\{product\}\}/g, "**{{product}}**")
    .replace(/\{\{amount\}\}/g, "**{{amount}}**");
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function isBillingLinkBlock(block: EmailBlock): block is TextBlock {
  return block.type === "text" && block.html.includes(PAYMENT_UPDATE_HREF);
}

function hasBillingEcho(value: string): boolean {
  return BILLING_ECHO.test(value) || /^or\s+/i.test(value.trim());
}

function stripBillingEcho(value: string): string {
  return value
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !hasBillingEcho(part) && !CHROME_LINE.test(part))
    .join("\n\n")
    .trim();
}

function cleanField(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return fallback;
  const stripped = stripBillingEcho(trimmed);
  if (!stripped || CHROME_LINE.test(stripped) || hasBillingEcho(stripped)) {
    return fallback;
  }
  return stripped;
}

function linkLabelFromHtml(html: string): string {
  const match = html.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i);
  return match?.[1] ? stripTags(match[1]) : "";
}

export function kitCopyFromDocument(
  day: RecoveryTemplateId,
  doc?: EmailDocument | null,
): KitCopy {
  const fallback = DAY_COPY[day];
  if (!doc) return { ...fallback };

  const billing = doc.blocks.find(isBillingLinkBlock);
  const button = doc.blocks.find((block) => block.type === "button");
  const contentTexts = doc.blocks.filter(
    (block): block is TextBlock =>
      block.type === "text" && !isBillingLinkBlock(block),
  );

  const headline = cleanField(doc.headline, fallback.headline);
  const body = cleanField(doc.body, fallback.body);
  const subject = cleanField(doc.subject, fallback.subject);
  const cta = cleanField(button?.type === "button" ? button.label : doc.cta, fallback.cta);
  const link = cleanField(
    billing ? linkLabelFromHtml(billing.html) : undefined,
    fallback.link,
  );

  const first = contentTexts[0] ? stripTags(contentTexts[0].html) : "";
  const eyebrow =
    first &&
    first !== headline &&
    first !== body &&
    !CHROME_LINE.test(first) &&
    !hasBillingEcho(first)
      ? first
      : fallback.eyebrow;

  return { subject, eyebrow, headline, body, cta, link };
}

function divider(marginTop: number, marginBottom: number): EmailBlock {
  return { ...createDividerBlock(), marginTop, marginBottom };
}

function blocksForSonos(spec: BlockKitSpec, copy: KitCopy): EmailBlock[] {
  return [
    createTextBlock(copy.eyebrow, {
      copySlot: "eyebrow",
      fontSize: spec.eyebrowSize,
      color: "muted",
      align: "center",
      marginTop: 8,
      marginBottom: 10,
    }),
    createTextBlock(copy.headline, {
      copySlot: "headline",
      fontSize: spec.headlineSize,
      color: "default",
      bold: true,
      align: "center",
      marginTop: 0,
      marginBottom: 14,
    }),
    createTextBlock(boldTokens(copy.body), {
      copySlot: "body",
      fontSize: spec.bodySize,
      color: "muted",
      align: "center",
      marginTop: 0,
      marginBottom: 28,
    }),
    createButtonBlock(copy.cta, { align: "center", marginBottom: 20 }),
    createBillingLinkTextBlock({
      prefix: "Or",
      linkLabel: copy.link,
      suffix: "to continue.",
      align: "center",
    }),
  ];
}

function blocksForAvocode(spec: BlockKitSpec, copy: KitCopy): EmailBlock[] {
  return [
    createTextBlock(copy.eyebrow, {
      copySlot: "eyebrow",
      fontSize: spec.eyebrowSize,
      color: "muted",
      align: "left",
      marginTop: 0,
      marginBottom: 8,
    }),
    createTextBlock(copy.headline, {
      copySlot: "headline",
      fontSize: spec.headlineSize,
      color: "default",
      bold: true,
      align: "left",
      marginTop: 0,
      marginBottom: 16,
    }),
    createTextBlock("What's ending", {
      fontSize: 12,
      color: "muted",
      align: "left",
      marginTop: 4,
      marginBottom: 6,
    }),
    createTextBlock("{{product}}", {
      fontSize: 15,
      color: "default",
      bold: true,
      align: "left",
      marginTop: 0,
      marginBottom: 2,
    }),
    createTextBlock("{{amount}}", {
      fontSize: 13,
      color: "muted",
      align: "left",
      marginTop: 0,
      marginBottom: 16,
    }),
    createTextBlock(boldTokens(copy.body), {
      copySlot: "body",
      fontSize: spec.bodySize,
      color: "default",
      align: "left",
      marginTop: 0,
      marginBottom: 24,
    }),
    createButtonBlock(copy.cta, { align: "left", marginBottom: 16 }),
    createBillingLinkTextBlock({
      prefix: "",
      linkLabel: copy.link,
      suffix: "",
      align: "left",
    }),
  ];
}

function blocksForBenchmark(spec: BlockKitSpec, copy: KitCopy): EmailBlock[] {
  return [
    createTextBlock(copy.eyebrow, {
      copySlot: "eyebrow",
      fontSize: 11,
      color: "muted",
      align: "left",
      hexColor: "#1f7a4d",
      marginTop: 0,
      marginBottom: 14,
    }),
    createTextBlock(copy.headline, {
      copySlot: "headline",
      fontSize: spec.headlineSize,
      color: "default",
      bold: true,
      align: "left",
      marginTop: 0,
      marginBottom: 12,
    }),
    createTextBlock(boldTokens(copy.body), {
      copySlot: "body",
      fontSize: spec.bodySize,
      color: "default",
      align: "left",
      marginTop: 0,
      marginBottom: 18,
    }),
    createTextBlock("Nothing here is gone", {
      fontSize: 13,
      color: "default",
      bold: true,
      align: "left",
      marginTop: 4,
      marginBottom: 6,
    }),
    createTextBlock("Access stays on while you update.", {
      fontSize: 13,
      color: "muted",
      align: "left",
      marginTop: 0,
      marginBottom: 2,
    }),
    createTextBlock("Card details stay on your billing page.", {
      fontSize: 13,
      color: "muted",
      align: "left",
      marginTop: 0,
      marginBottom: 24,
    }),
    createButtonBlock(copy.cta, { align: "left", marginBottom: 16 }),
    createBillingLinkTextBlock({
      prefix: "",
      linkLabel: copy.link,
      suffix: "",
      align: "left",
    }),
  ];
}

function blocksForFontbase(spec: BlockKitSpec, copy: KitCopy): EmailBlock[] {
  return [
    createTextBlock(copy.eyebrow, {
      copySlot: "eyebrow",
      fontSize: spec.eyebrowSize,
      color: "muted",
      align: "left",
      marginTop: 0,
      marginBottom: 10,
    }),
    createTextBlock(copy.headline, {
      copySlot: "headline",
      fontSize: spec.headlineSize,
      color: "default",
      bold: true,
      align: "left",
      marginTop: 0,
      marginBottom: 14,
    }),
    createTextBlock(boldTokens(copy.body), {
      copySlot: "body",
      fontSize: spec.bodySize,
      color: "muted",
      align: "left",
      marginTop: 0,
      marginBottom: 8,
    }),
    divider(12, 16),
    createTextBlock("What's included", {
      fontSize: 12,
      color: "muted",
      align: "left",
      marginTop: 0,
      marginBottom: 8,
    }),
    createTextBlock("Same plan and workspace", {
      fontSize: 14,
      color: "default",
      align: "left",
      marginTop: 0,
      marginBottom: 4,
    }),
    createTextBlock("Change the card anytime before renewal", {
      fontSize: 14,
      color: "default",
      align: "left",
      marginTop: 0,
      marginBottom: 16,
    }),
    createTextBlock("{{product}}  ·  {{amount}}", {
      fontSize: 13,
      color: "muted",
      align: "left",
      marginTop: 0,
      marginBottom: 24,
    }),
    createButtonBlock(copy.cta, { align: "left", marginBottom: 16 }),
    createBillingLinkTextBlock({
      prefix: "",
      linkLabel: copy.link,
      suffix: "",
      align: "left",
    }),
  ];
}

function blocksForNordvpn(spec: BlockKitSpec, copy: KitCopy): EmailBlock[] {
  return [
    createTextBlock(copy.eyebrow, {
      copySlot: "eyebrow",
      fontSize: spec.eyebrowSize,
      color: "muted",
      align: "left",
      marginTop: 0,
      marginBottom: 8,
    }),
    createTextBlock(copy.headline, {
      copySlot: "headline",
      fontSize: spec.headlineSize,
      color: "default",
      bold: true,
      align: "left",
      marginTop: 0,
      marginBottom: 12,
    }),
    createTextBlock(boldTokens(copy.body), {
      copySlot: "body",
      fontSize: spec.bodySize,
      color: "default",
      align: "left",
      marginTop: 0,
      marginBottom: 18,
    }),
    createTextBlock("1. Update billing", {
      fontSize: 14,
      color: "default",
      bold: true,
      align: "left",
      marginTop: 0,
      marginBottom: 6,
    }),
    createTextBlock("2. Keep access on", {
      fontSize: 14,
      color: "default",
      bold: true,
      align: "left",
      marginTop: 0,
      marginBottom: 24,
    }),
    createButtonBlock(copy.cta, { align: "left", marginBottom: 16 }),
    createBillingLinkTextBlock({
      prefix: "",
      linkLabel: copy.link,
      suffix: "",
      align: "left",
    }),
  ];
}

export function blocksForKit(kitId: LayoutPresetId, copy: KitCopy): EmailBlock[] {
  const spec = BLOCK_KIT_SPEC[kitId];
  switch (kitId) {
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
      const _exhaustive: never = kitId;
      return _exhaustive;
    }
  }
}

export function documentForKit(
  day: RecoveryTemplateId,
  kitId: LayoutPresetId,
  existing?: EmailDocument | null,
): EmailDocument {
  const spec = BLOCK_KIT_SPEC[kitId];
  const copy = kitCopyFromDocument(day, existing);
  const blocks = blocksForKit(kitId, copy);
  return {
    subject: copy.subject,
    headline: copy.headline,
    body: copy.body,
    cta: copy.cta,
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

export function kitShowsAccentBar(kitId: LayoutPresetId): boolean {
  return BLOCK_KIT_SPEC[kitId].showAccentBar;
}

export function countBillingLinkBlocks(doc: EmailDocument): number {
  return doc.blocks.filter(isBillingLinkBlock).length;
}
