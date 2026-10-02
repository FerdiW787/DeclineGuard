/**
 * Recovery starter kits — structure only. Hard reset (not RGE remixes).
 * Colors/CTA come from resolveTheme. Do not bake brand hex into blocks.
 *
 *   poster-notice     one announcement, then the button
 *   amount-due        money first, then the problem
 *   plain-letter      a short letter, then the ask
 *   what-happened     two beats: happened, then do
 *   quiet-column      wide type, almost nothing else
 *   italic-lead       italic problem line as the hero
 *   status-word       one status word, then the ask
 *   deck-headline     tiny deck, then a large left hed
 *   hold-open         reassurance first, then the problem
 *   folio-mark        right folio, then a left notice
 *
 * Day 0 / 2 / 5 reuse the same kit chrome with gentle / direct / urgent copy.
 */

import {
  createBillingLinkTextBlock,
  createButtonBlock,
  createDividerBlock,
  createSpacerBlock,
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
  "poster-notice": {
    align: "center",
    ctaAlign: "center",
    logoAlign: "center",
    showStoreName: false,
    showGreeting: false,
    showAccentBar: false,
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
    logoAlign: "left",
    showStoreName: true,
    showGreeting: false,
    showAccentBar: false,
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
    logoAlign: "left",
    showStoreName: true,
    showGreeting: true,
    showAccentBar: false,
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
    logoAlign: "left",
    showStoreName: true,
    showGreeting: false,
    showAccentBar: false,
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
    logoAlign: "left",
    showStoreName: false,
    showGreeting: false,
    showAccentBar: false,
    emailPadding: 64,
    shellBorder: false,
    shellBorderWidth: 1,
    shellRadius: 0,
    eyebrowSize: 11,
    headlineSize: 32,
    bodySize: 18,
  },
  "italic-lead": {
    align: "left",
    ctaAlign: "left",
    logoAlign: "left",
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
  "status-word": {
    align: "left",
    ctaAlign: "left",
    logoAlign: "left",
    showStoreName: true,
    showGreeting: false,
    showAccentBar: false,
    emailPadding: 36,
    shellBorder: false,
    shellBorderWidth: 1,
    shellRadius: 0,
    eyebrowSize: 11,
    headlineSize: 20,
    bodySize: 15,
  },
  "deck-headline": {
    align: "left",
    ctaAlign: "left",
    logoAlign: "left",
    showStoreName: false,
    showGreeting: false,
    showAccentBar: false,
    emailPadding: 52,
    shellBorder: false,
    shellBorderWidth: 1,
    shellRadius: 0,
    eyebrowSize: 11,
    headlineSize: 36,
    bodySize: 15,
  },
  "hold-open": {
    align: "left",
    ctaAlign: "left",
    logoAlign: "left",
    showStoreName: true,
    showGreeting: false,
    showAccentBar: false,
    emailPadding: 44,
    shellBorder: false,
    shellBorderWidth: 1,
    shellRadius: 0,
    eyebrowSize: 11,
    headlineSize: 18,
    bodySize: 15,
  },
  "folio-mark": {
    align: "left",
    ctaAlign: "left",
    logoAlign: "left",
    showStoreName: true,
    showGreeting: false,
    showAccentBar: false,
    emailPadding: 40,
    shellBorder: false,
    shellBorderWidth: 1,
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
  /^(what happened|what to do|amount due|payment failed|thanks,?|p\.?s\.|access stays on|access is still on|your workspace stays|updating the card|nothing else changes|open billing|card update needed|failed$|notice$|or\s)/i;

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

function blocksForPosterNotice(spec: BlockKitSpec, copy: KitCopy): EmailBlock[] {
  return [
    createSpacerBlock(8),
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
      marginBottom: 0,
    }),
    createSpacerBlock(36),
    createButtonBlock(copy.cta, { align: "center", marginBottom: 16 }),
    createBillingLinkTextBlock({
      prefix: "",
      linkLabel: copy.link,
      suffix: "",
      align: "center",
    }),
  ];
}

function blocksForAmountDue(spec: BlockKitSpec, copy: KitCopy): EmailBlock[] {
  return [
    createTextBlock("Amount due", {
      fontSize: spec.eyebrowSize,
      color: "muted",
      align: "left",
      marginTop: 0,
      marginBottom: 6,
    }),
    createTextBlock("{{amount}}", {
      fontSize: 42,
      color: "default",
      bold: true,
      align: "left",
      marginTop: 0,
      marginBottom: 4,
    }),
    createTextBlock("{{product}}", {
      fontSize: 14,
      color: "muted",
      align: "left",
      marginTop: 0,
      marginBottom: 28,
    }),
    createTextBlock(copy.headline, {
      copySlot: "headline",
      fontSize: spec.headlineSize,
      color: "default",
      bold: true,
      align: "left",
      marginTop: 0,
      marginBottom: 8,
    }),
    createTextBlock("Update the card to keep access on — about a minute.", {
      copySlot: "body",
      fontSize: spec.bodySize,
      color: "muted",
      align: "left",
      marginTop: 0,
      marginBottom: 24,
    }),
    createButtonBlock(copy.cta, { align: "left", marginBottom: 14 }),
    createBillingLinkTextBlock({
      prefix: "",
      linkLabel: copy.link,
      suffix: "",
      align: "left",
    }),
  ];
}

function blocksForPlainLetter(spec: BlockKitSpec, copy: KitCopy): EmailBlock[] {
  return [
    createTextBlock(copy.headline, {
      copySlot: "headline",
      fontSize: spec.headlineSize,
      color: "default",
      bold: true,
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
      marginBottom: 16,
    }),
    createTextBlock(
      "Updating the card keeps **{{product}}** on. Nothing else changes.",
      {
        fontSize: spec.bodySize,
        color: "muted",
        align: "left",
        marginTop: 0,
        marginBottom: 20,
      },
    ),
    createTextBlock("Thanks,", {
      fontSize: spec.bodySize,
      color: "default",
      align: "left",
      marginTop: 0,
      marginBottom: 0,
    }),
    createSpacerBlock(28),
    createButtonBlock(copy.cta, { align: "left", marginBottom: 14 }),
    createBillingLinkTextBlock({
      prefix: "",
      linkLabel: copy.link,
      suffix: "",
      align: "left",
    }),
  ];
}

function blocksForItalicLead(spec: BlockKitSpec, copy: KitCopy): EmailBlock[] {
  return [
    createTextBlock(copy.headline, {
      copySlot: "headline",
      fontSize: spec.headlineSize,
      color: "default",
      italic: true,
      align: "left",
      marginTop: 8,
      marginBottom: 16,
    }),
    createTextBlock("Update the card to keep **{{product}}** on — about a minute.", {
      copySlot: "body",
      fontSize: spec.bodySize,
      color: "muted",
      align: "left",
      marginTop: 0,
      marginBottom: 0,
    }),
    createSpacerBlock(28),
    createButtonBlock(copy.cta, { align: "left", marginBottom: 14 }),
    createBillingLinkTextBlock({
      prefix: "",
      linkLabel: copy.link,
      suffix: "",
      align: "left",
    }),
  ];
}

function blocksForStatusWord(spec: BlockKitSpec, copy: KitCopy): EmailBlock[] {
  return [
    createTextBlock("Failed", {
      fontSize: 40,
      color: "default",
      bold: true,
      align: "left",
      marginTop: 0,
      marginBottom: 6,
    }),
    createTextBlock("{{product}}", {
      fontSize: 14,
      color: "muted",
      align: "left",
      marginTop: 0,
      marginBottom: 22,
    }),
    createTextBlock(copy.headline, {
      copySlot: "headline",
      fontSize: spec.headlineSize,
      color: "default",
      bold: true,
      align: "left",
      marginTop: 0,
      marginBottom: 8,
    }),
    createTextBlock("The charge of **{{amount}}** didn’t go through.", {
      copySlot: "body",
      fontSize: spec.bodySize,
      color: "muted",
      align: "left",
      marginTop: 0,
      marginBottom: 24,
    }),
    createButtonBlock(copy.cta, { align: "left", marginBottom: 14 }),
    createBillingLinkTextBlock({
      prefix: "",
      linkLabel: copy.link,
      suffix: "",
      align: "left",
    }),
  ];
}

function blocksForDeckHeadline(spec: BlockKitSpec, copy: KitCopy): EmailBlock[] {
  return [
    createTextBlock("Card update needed", {
      fontSize: spec.eyebrowSize,
      color: "muted",
      align: "left",
      marginTop: 4,
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
    createTextBlock("Takes about a minute to keep **{{product}}** on.", {
      copySlot: "body",
      fontSize: spec.bodySize,
      color: "muted",
      align: "left",
      marginTop: 0,
      marginBottom: 0,
    }),
    createSpacerBlock(28),
    createButtonBlock(copy.cta, { align: "left", marginBottom: 14 }),
    createBillingLinkTextBlock({
      prefix: "",
      linkLabel: copy.link,
      suffix: "",
      align: "left",
    }),
  ];
}

function blocksForHoldOpen(spec: BlockKitSpec, copy: KitCopy): EmailBlock[] {
  return [
    createTextBlock("Access is still on.", {
      fontSize: 24,
      color: "default",
      align: "left",
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
      marginBottom: 8,
    }),
    createTextBlock(boldTokens(copy.body), {
      copySlot: "body",
      fontSize: spec.bodySize,
      color: "muted",
      align: "left",
      marginTop: 0,
      marginBottom: 24,
    }),
    createButtonBlock(copy.cta, { align: "left", marginBottom: 14 }),
    createBillingLinkTextBlock({
      prefix: "",
      linkLabel: copy.link,
      suffix: "",
      align: "left",
    }),
  ];
}

function blocksForFolioMark(spec: BlockKitSpec, copy: KitCopy): EmailBlock[] {
  return [
    createTextBlock("Notice", {
      fontSize: spec.eyebrowSize,
      color: "muted",
      align: "right",
      marginTop: 0,
      marginBottom: 20,
    }),
    createTextBlock(copy.headline, {
      copySlot: "headline",
      fontSize: spec.headlineSize,
      color: "default",
      bold: true,
      align: "left",
      marginTop: 0,
      marginBottom: 10,
    }),
    createTextBlock(boldTokens(copy.body), {
      copySlot: "body",
      fontSize: spec.bodySize,
      color: "muted",
      align: "left",
      marginTop: 0,
      marginBottom: 24,
    }),
    createButtonBlock(copy.cta, { align: "left", marginBottom: 14 }),
    createBillingLinkTextBlock({
      prefix: "",
      linkLabel: copy.link,
      suffix: "",
      align: "left",
    }),
  ];
}

function blocksForWhatHappened(spec: BlockKitSpec, copy: KitCopy): EmailBlock[] {
  return [
    createTextBlock(copy.headline, {
      copySlot: "headline",
      fontSize: spec.headlineSize,
      color: "default",
      bold: true,
      align: "left",
      marginTop: 0,
      marginBottom: 24,
    }),
    createTextBlock("WHAT HAPPENED", {
      fontSize: 11,
      color: "muted",
      align: "left",
      marginTop: 0,
      marginBottom: 6,
    }),
    createTextBlock(boldTokens(copy.body), {
      copySlot: "body",
      fontSize: spec.bodySize,
      color: "default",
      align: "left",
      marginTop: 0,
      marginBottom: 0,
    }),
    divider(18, 18),
    createTextBlock("WHAT TO DO", {
      fontSize: 11,
      color: "muted",
      align: "left",
      marginTop: 0,
      marginBottom: 6,
    }),
    createTextBlock("Open billing and update the card.", {
      fontSize: spec.bodySize,
      color: "default",
      align: "left",
      marginTop: 0,
      marginBottom: 24,
    }),
    createButtonBlock(copy.cta, { align: "left", marginBottom: 14 }),
    createBillingLinkTextBlock({
      prefix: "",
      linkLabel: copy.link,
      suffix: "",
      align: "left",
    }),
  ];
}

function blocksForQuietColumn(spec: BlockKitSpec, copy: KitCopy): EmailBlock[] {
  return [
    createTextBlock(copy.headline, {
      copySlot: "headline",
      fontSize: spec.headlineSize,
      color: "default",
      bold: true,
      align: "left",
      marginTop: 8,
      marginBottom: 16,
    }),
    createTextBlock(boldTokens(copy.body), {
      copySlot: "body",
      fontSize: spec.bodySize,
      color: "muted",
      align: "left",
      marginTop: 0,
      marginBottom: 0,
    }),
    createSpacerBlock(32),
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
    case "italic-lead":
      return blocksForItalicLead(spec, copy);
    case "status-word":
      return blocksForStatusWord(spec, copy);
    case "deck-headline":
      return blocksForDeckHeadline(spec, copy);
    case "hold-open":
      return blocksForHoldOpen(spec, copy);
    case "folio-mark":
      return blocksForFolioMark(spec, copy);
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
