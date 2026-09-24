/** Block-based recovery email document model (Customizations builder). */

import {
  escapeHtml,
  richTextToHtml,
  richTextToPlain,
  ensurePaymentLinkSpacing,
  PAYMENT_UPDATE_HREF,
  styleEmailAnchors,
} from "./emailRichText";

export {
  escapeHtml,
  PAYMENT_UPDATE_HREF,
  richTextToHtml,
  richTextToPlain,
  styleEmailAnchors,
};

export type RecoveryTemplateId = "gentle" | "direct" | "urgent";

export type LegacyEmailCopy = {
  subject: string;
  headline: string;
  body: string;
  cta: string;
};

export type BlockAlign = "left" | "center" | "right";

export type EmailBlockBase = {
  id: string;
  marginTop: number;
  marginBottom: number;
};

export type TextBlock = EmailBlockBase & {
  type: "text";
  /** Supports **bold** markers, HTML subset, and newlines */
  html: string;
  fontSize: number;
  color: "default" | "muted" | "link";
  /** Optional hex override for the whole block */
  hexColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align: BlockAlign;
};

export const TEXT_SIZE_OPTIONS = [13, 15, 17, 20, 24] as const;

const EMAIL_HEX_RE = /#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/gi;

function normalizeEmailHex(hex: string): string | null {
  const h = hex.trim().toLowerCase();
  const short = h.match(/^#([0-9a-f]{3})$/);
  if (short?.[1]) {
    const [a, b, c] = short[1];
    if (a && b && c) return `#${a}${a}${b}${b}${c}${c}`;
  }
  return /^#[0-9a-f]{6}$/.test(h) ? h : null;
}

/** Unique hex colors already used in this email, for the color picker. */
export function collectEmailColors(
  doc: EmailDocument,
  extras: string[] = [],
): string[] {
  const found: string[] = [];
  const add = (raw?: string) => {
    if (!raw) return;
    for (const match of raw.match(EMAIL_HEX_RE) ?? []) {
      const hex = normalizeEmailHex(match);
      if (hex && !found.includes(hex)) found.push(hex);
    }
  };
  add(doc.linkColor);
  add(doc.shellBackground);
  add(doc.shellBorderColor);
  for (const extra of extras) add(extra);
  for (const block of doc.blocks) {
    switch (block.type) {
      case "text":
        add(block.hexColor);
        add(block.html);
        break;
      case "button":
        add(block.backgroundColor);
        break;
      case "image":
        add(block.shadowColor);
        add(block.borderColor);
        break;
      case "linkRow":
      case "spacer":
      case "divider":
        break;
      default: {
        const _never: never = block;
        void _never;
      }
    }
  }
  return found;
}

export function resolveTextBlockColor(
  block: Pick<TextBlock, "color" | "hexColor">,
  fallbacks: { body: string; muted: string; link: string },
): string {
  const hex = block.hexColor?.trim();
  if (hex && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return hex;
  if (block.color === "muted") return fallbacks.muted;
  if (block.color === "link") return fallbacks.link;
  return fallbacks.body;
}

export function textBlockFaceStyle(
  block: TextBlock,
  fallbacks: { body: string; muted: string; link: string },
): {
  fontSize: number;
  color: string;
  fontWeight: number | undefined;
  fontStyle: "italic" | undefined;
  textDecoration: "underline" | undefined;
  textAlign: BlockAlign;
  lineHeight: number;
} {
  return {
    fontSize: block.fontSize,
    color: resolveTextBlockColor(block, fallbacks),
    fontWeight: block.bold ? 700 : undefined,
    fontStyle: block.italic ? "italic" : undefined,
    textDecoration: block.underline ? "underline" : undefined,
    textAlign: block.align,
    lineHeight: 1.6,
  };
}

export type ImageShape = "square" | "circle" | "pill" | "star" | "triangle";
export type ImageFit = "adjust" | "stretch";

export type ImageBlock = EmailBlockBase & {
  type: "image";
  src: string;
  alt: string;
  width: number;
  align: BlockAlign;
  /** Crop frame height in px. Missing = default banner height. */
  heightPx?: number;
  /** Scale inside the crop frame. 1 = fill, higher = zoom in. */
  zoom?: number;
  /** Corner radius in px. Missing = 8. Pill = half the shorter visible side. */
  radius?: number;
  /** Pixels cut from the top of the uncropped frame. */
  cropTop?: number;
  /** Pixels cut from the bottom of the uncropped frame. */
  cropBottom?: number;
  /** Percent of uncropped width cut from the left. */
  cropLeft?: number;
  /** Percent of uncropped width cut from the right. */
  cropRight?: number;
  /** Drop shadow around the visible frame. Missing = off. */
  shadow?: boolean;
  /** Shadow tint (hex). Missing = black. */
  shadowColor?: string;
  /** Stroke around the visible frame. Missing = off. */
  border?: boolean;
  borderColor?: string;
  borderWidth?: number;
  /** Clip the frame to a preset. Missing = rounded rectangle. */
  shape?: ImageShape;
  /** Adjust = photo scales with the frame. Stretch = photo stays column-wide and the frame crops it. */
  fit?: ImageFit;
  /** Horizontal photo position, 0 = left, 100 = right. Missing = 50. */
  panX?: number;
  /** Horizontal frame position in leftover space, 0 = left, 50 = center, 100 = right. */
  offsetX?: number;
};

export type ButtonBlock = EmailBlockBase & {
  type: "button";
  label: string;
  /** Empty = use brand primary */
  backgroundColor: string;
  align: BlockAlign;
};

export type SpacerBlock = EmailBlockBase & {
  type: "spacer";
  height: number;
};

export type DividerBlock = EmailBlockBase & {
  type: "divider";
};

export type LinkRowBlock = EmailBlockBase & {
  type: "linkRow";
  /** Text before the link */
  prefix: string;
  linkLabel: string;
  /** Text after the link */
  suffix: string;
};

export type EmailBlock =
  | TextBlock
  | ImageBlock
  | ButtonBlock
  | SpacerBlock
  | DividerBlock
  | LinkRowBlock;

export type EmailDocument = LegacyEmailCopy & {
  blocks: EmailBlock[];
  linkColor: string;
  emailPadding: number;
  /** Card fill. Empty = white / brand email background. */
  shellBackground?: string;
  /** Card stroke. Empty = store primary. */
  shellBorderColor?: string;
  /** When false, the template card has no stroke. Default true. */
  shellBorder?: boolean;
  /** Card stroke width in px. Default 1. */
  shellBorderWidth?: number;
  /** Corner radius in px, applied to every corner. */
  shellRadius?: number;
};

const BASE_COPY: Record<RecoveryTemplateId, LegacyEmailCopy> = {
  gentle: {
    subject: "Your payment for {{product}} didn’t go through",
    headline: "Quick update on your subscription",
    body: "The payment of {{amount}} for {{product}} didn't go through. Update your card below — takes about a minute.",
    cta: "Update payment method",
  },
  direct: {
    subject: "2nd notice: payment still needed for {{product}}",
    headline: "Still need an updated card",
    body: "Your payment for {{product}} ({{amount}}) is still pending. Update billing so your access stays on.",
    cta: "Update billing",
  },
  urgent: {
    subject: "Final notice: need updated billing for {{product}}",
    headline: "Last chance to keep access",
    body: "Without an updated card, {{product}} ({{amount}}) may pause soon. Fix payment now to stay uninterrupted.",
    cta: "Fix payment now",
  },
};

export type EmailBlockType = EmailBlock["type"];

let blockSeq = 0;

export function newBlockId(prefix = "b"): string {
  blockSeq += 1;
  return `${prefix}_${Date.now().toString(36)}_${blockSeq}`;
}

export const DEFAULT_LINK_COLOR = "#6b6b70";
export const DEFAULT_EMAIL_PADDING = 24;
export const DEFAULT_SHELL_BACKGROUND = "#ffffff";
export const DEFAULT_SHELL_BORDER = true;
export const DEFAULT_SHELL_BORDER_WIDTH = 1;
export const SHELL_BORDER_WIDTH_MAX = 8;
export const DEFAULT_SHELL_RADIUS = 0;
export const SHELL_RADIUS_MAX = 48;

export function resolveShellBackground(
  doc: Pick<EmailDocument, "shellBackground">,
  fallback = DEFAULT_SHELL_BACKGROUND,
): string {
  const hex = doc.shellBackground?.trim();
  return hex && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex) ? hex : fallback;
}

export function resolveShellBorderColor(
  doc: Pick<EmailDocument, "shellBorderColor">,
  fallback: string,
): string {
  const hex = doc.shellBorderColor?.trim();
  return hex && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex) ? hex : fallback;
}

export function resolveShellBorder(
  doc: Pick<EmailDocument, "shellBorder">,
): boolean {
  return doc.shellBorder !== false;
}

export function resolveShellBorderWidth(
  doc: Pick<EmailDocument, "shellBorderWidth">,
): number {
  const n = doc.shellBorderWidth;
  if (typeof n !== "number" || !Number.isFinite(n)) {
    return DEFAULT_SHELL_BORDER_WIDTH;
  }
  return Math.max(1, Math.min(SHELL_BORDER_WIDTH_MAX, Math.round(n)));
}

export function resolveShellRadius(
  doc: Pick<EmailDocument, "shellRadius">,
): number {
  const n = doc.shellRadius;
  if (typeof n !== "number" || !Number.isFinite(n)) return DEFAULT_SHELL_RADIUS;
  return Math.max(0, Math.min(SHELL_RADIUS_MAX, Math.round(n)));
}

export const IMAGE_CROP_HEIGHT_MIN = 80;
export const IMAGE_CROP_HEIGHT_MAX = 560;
export const IMAGE_CROP_HEIGHT_DEFAULT = 180;
export const IMAGE_ZOOM_MIN = 1;
export const IMAGE_ZOOM_MAX = 2.4;
export const IMAGE_ZOOM_DEFAULT = 1;
export const IMAGE_RADIUS_DEFAULT = 8;
export const IMAGE_VISIBLE_MIN = 32;
export const IMAGE_CROP_PCT_MAX = 80;
export const IMAGE_SHADOW_DEFAULT = false;
export const IMAGE_SHADOW_COLOR_DEFAULT = "#000000";
export const IMAGE_BORDER_DEFAULT = false;
export const IMAGE_BORDER_COLOR_DEFAULT = "#e5e5e5";
export const IMAGE_BORDER_WIDTH_DEFAULT = 1;
export const IMAGE_BORDER_WIDTH_MAX = 8;

export const IMAGE_SHAPE_OPTIONS: { id: ImageShape; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "circle", label: "Circle" },
  { id: "pill", label: "Pill" },
  { id: "star", label: "Star" },
  { id: "triangle", label: "Triangle" },
];

export function resolveImageFit(input?: { fit?: string }): ImageFit {
  return input?.fit === "stretch" ? "stretch" : "adjust";
}

export function resolveImagePanX(input?: { panX?: number }): number {
  const n = input?.panX;
  if (typeof n !== "number" || !Number.isFinite(n)) return 50;
  return clamp(n, 0, 100);
}

export function resolveImageOffsetX(input?: {
  offsetX?: number;
  align?: string;
}): number {
  const n = input?.offsetX;
  if (typeof n === "number" && Number.isFinite(n)) return clamp(n, 0, 100);
  if (input?.align === "center") return 50;
  if (input?.align === "right") return 100;
  return 0;
}

export function alignFromOffsetX(offsetX: number): BlockAlign {
  if (offsetX >= 99) return "right";
  if (Math.abs(offsetX - 50) <= 2.5) return "center";
  return "left";
}

/** Left margin as % of the email column so offsetX 50 sits dead-center. */
export function imageOffsetMarginPct(
  visibleWidthPct: number,
  offsetX: number,
): number {
  const leftover = Math.max(0, 100 - visibleWidthPct);
  return leftover * (clamp(offsetX, 0, 100) / 100);
}

/** Convert box size/position when switching Adjust ↔ Stretch so the frame can still grow. */
export function imageFitSwitchPatch(
  block: ImageBlock,
  next: ImageFit,
): Partial<ImageBlock> {
  const current = resolveImageFit(block);
  if (current === next) return { fit: next };
  const layout = resolveImageLayout(block);
  if (next === "stretch") {
    const visibleW = layout.visibleWidthPct;
    const leftPct = imageOffsetMarginPct(visibleW, resolveImageOffsetX(block));
    const rightPct = Math.max(0, 100 - visibleW - leftPct);
    const visibleH = layout.visibleHeight;
    const extraH = Math.max(0, IMAGE_CROP_HEIGHT_MAX - visibleH);
    const cropTop = Math.round(extraH / 2);
    return {
      fit: "stretch",
      width: 100,
      offsetX: 50,
      align: "left",
      cropLeft: clamp(leftPct, 0, IMAGE_CROP_PCT_MAX),
      cropRight: clamp(rightPct, 0, IMAGE_CROP_PCT_MAX),
      heightPx: IMAGE_CROP_HEIGHT_MAX,
      cropTop,
      cropBottom: extraH - cropTop,
    };
  }
  const visibleW = layout.visibleWidthPct;
  const cropSlack = layout.cropLeft + layout.cropRight;
  const leftPct =
    cropSlack < 0.2
      ? imageOffsetMarginPct(visibleW, resolveImageOffsetX(block))
      : (layout.cropLeft * layout.widthPct) / 100;
  const leftover = Math.max(0, 100 - visibleW);
  const offsetX = leftover < 1 ? 0 : clamp((leftPct / leftover) * 100, 0, 100);
  return {
    fit: "adjust",
    width: clamp(visibleW, 20, 100),
    offsetX,
    align: alignFromOffsetX(offsetX),
    cropLeft: 0,
    cropRight: 0,
    heightPx: clamp(
      layout.visibleHeight,
      IMAGE_CROP_HEIGHT_MIN,
      IMAGE_CROP_HEIGHT_MAX,
    ),
    cropTop: 0,
    cropBottom: 0,
  };
}

export function resolveImageShape(input?: { shape?: string }): ImageShape | null {
  switch (input?.shape) {
    case "square":
    case "circle":
    case "pill":
    case "star":
    case "triangle":
      return input.shape;
    default:
      return null;
  }
}

export function imageLocksAspect(shape: ImageShape | null): boolean {
  return shape === "square" || shape === "circle";
}

export function imageShowsCornerHandles(shape: ImageShape | null): boolean {
  return shape == null || shape === "square";
}

export function imageShapeClipPath(shape: ImageShape | null): string | undefined {
  switch (shape) {
    case "star":
      return "polygon(50% 0%, 61.8% 35.4%, 98.2% 35.4%, 68.2% 57.6%, 79.4% 91.2%, 50% 70%, 20.6% 91.2%, 31.8% 57.6%, 1.8% 35.4%, 38.2% 35.4%)";
    case "triangle":
      return "polygon(50% 0%, 0% 100%, 100% 100%)";
    default:
      return undefined;
  }
}

export function imageShapeRadius(
  shape: ImageShape | null,
  userRadius: number,
): number {
  if (shape === "circle" || shape === "pill") return 9999;
  if (shape === "square" || shape === "star" || shape === "triangle") {
    return shape === "square" ? userRadius : 0;
  }
  return userRadius;
}

function hexOr(value: string | undefined, fallback: string): string {
  const hex = value?.trim() ?? "";
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex) ? hex : fallback;
}

export function resolveImageShadow(input?: { shadow?: boolean }): boolean {
  return input?.shadow === true;
}

export function resolveImageShadowColor(input?: { shadowColor?: string }): string {
  return hexOr(input?.shadowColor, IMAGE_SHADOW_COLOR_DEFAULT);
}

export function resolveImageBorder(input?: { border?: boolean }): boolean {
  return input?.border === true;
}

export function resolveImageBorderColor(input?: { borderColor?: string }): string {
  return hexOr(input?.borderColor, IMAGE_BORDER_COLOR_DEFAULT);
}

export function resolveImageBorderWidth(input?: { borderWidth?: number }): number {
  const n = input?.borderWidth;
  if (typeof n !== "number" || !Number.isFinite(n)) {
    return IMAGE_BORDER_WIDTH_DEFAULT;
  }
  return Math.max(1, Math.min(IMAGE_BORDER_WIDTH_MAX, Math.round(n)));
}

export function imageBoxShadow(color: string): string {
  const hex = resolveImageShadowColor({ shadowColor: color });
  const raw = hex.slice(1);
  const full =
    raw.length === 3
      ? `${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`
      : raw;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return `0 8px 24px rgba(${r},${g},${b},0.28)`;
}

export function createTextBlock(
  html: string,
  opts: Partial<Omit<TextBlock, "type" | "id" | "html">> = {},
): TextBlock {
  return {
    id: newBlockId("text"),
    type: "text",
    html,
    fontSize: opts.fontSize ?? 15,
    color: opts.color ?? "default",
    hexColor: opts.hexColor,
    bold: opts.bold,
    italic: opts.italic,
    underline: opts.underline,
    align: opts.align ?? "left",
    marginTop: opts.marginTop ?? 0,
    marginBottom: opts.marginBottom ?? 16,
  };
}

export function createImageBlock(
  opts: Partial<Omit<ImageBlock, "type" | "id">> = {},
): ImageBlock {
  return {
    id: newBlockId("img"),
    type: "image",
    src: opts.src ?? "",
    alt: opts.alt ?? "",
    width: opts.width ?? 100,
    align: opts.align ?? "left",
    heightPx: opts.heightPx ?? IMAGE_CROP_HEIGHT_DEFAULT,
    zoom: opts.zoom ?? IMAGE_ZOOM_DEFAULT,
    radius: opts.radius ?? IMAGE_RADIUS_DEFAULT,
    cropTop: opts.cropTop ?? 0,
    cropBottom: opts.cropBottom ?? 0,
    cropLeft: opts.cropLeft ?? 0,
    cropRight: opts.cropRight ?? 0,
    offsetX: opts.offsetX,
    shadow: opts.shadow ?? IMAGE_SHADOW_DEFAULT,
    shadowColor: opts.shadowColor ?? IMAGE_SHADOW_COLOR_DEFAULT,
    border: opts.border ?? IMAGE_BORDER_DEFAULT,
    borderColor: opts.borderColor ?? IMAGE_BORDER_COLOR_DEFAULT,
    borderWidth: opts.borderWidth ?? IMAGE_BORDER_WIDTH_DEFAULT,
    marginTop: opts.marginTop ?? 0,
    marginBottom: opts.marginBottom ?? 16,
  };
}

export function createButtonBlock(
  label: string,
  opts: Partial<Omit<ButtonBlock, "type" | "id" | "label">> = {},
): ButtonBlock {
  return {
    id: newBlockId("btn"),
    type: "button",
    label,
    backgroundColor: opts.backgroundColor ?? "",
    align: opts.align ?? "left",
    marginTop: opts.marginTop ?? 0,
    marginBottom: opts.marginBottom ?? 20,
  };
}

export function createSpacerBlock(height = 16): SpacerBlock {
  return {
    id: newBlockId("sp"),
    type: "spacer",
    height,
    marginTop: 0,
    marginBottom: 0,
  };
}

export function createDividerBlock(): DividerBlock {
  return {
    id: newBlockId("hr"),
    type: "divider",
    marginTop: 8,
    marginBottom: 24,
  };
}

export function createLinkRowBlock(
  opts: Partial<Omit<LinkRowBlock, "type" | "id">> = {},
): LinkRowBlock {
  return {
    id: newBlockId("link"),
    type: "linkRow",
    prefix: opts.prefix ?? "Or ",
    linkLabel: opts.linkLabel ?? "open the billing page",
    suffix: opts.suffix ?? " to update your card.",
    marginTop: opts.marginTop ?? 0,
    marginBottom: opts.marginBottom ?? 8,
  };
}

export function createBillingLinkTextBlock(
  opts: Partial<Omit<TextBlock, "type" | "id" | "html">> & {
    prefix?: string;
    linkLabel?: string;
    suffix?: string;
  } = {},
): TextBlock {
  const prefix = padLinkPrefix(opts.prefix ?? "Or");
  const label = (opts.linkLabel ?? "open the billing page").trim();
  const suffix = padLinkSuffix(opts.suffix ?? "to update your card.");
  return createTextBlock(
    `${escapeHtml(prefix)}<a href="${PAYMENT_UPDATE_HREF}">${escapeHtml(label)}</a>${escapeHtml(suffix)}`,
    {
      fontSize: opts.fontSize ?? 15,
      color: opts.color ?? "muted",
      align: opts.align ?? "left",
      marginTop: opts.marginTop ?? 0,
      marginBottom: opts.marginBottom ?? 8,
    },
  );
}

export function linkRowToTextBlock(block: LinkRowBlock): TextBlock {
  return {
    ...createBillingLinkTextBlock({
      prefix: block.prefix,
      linkLabel: block.linkLabel,
      suffix: block.suffix,
      marginTop: block.marginTop,
      marginBottom: block.marginBottom,
    }),
    id: block.id,
  };
}

export function migrateEmailBlocks(blocks: EmailBlock[]): EmailBlock[] {
  return blocks.map((block) => {
    if (block.type === "linkRow") return linkRowToTextBlock(block);
    if (block.type === "text" && block.html.includes(PAYMENT_UPDATE_HREF)) {
      return { ...block, html: ensurePaymentLinkSpacing(block.html) };
    }
    return block;
  });
}

function padLinkPrefix(value: string): string {
  const pre = value.replace(/\s+$/g, "");
  return pre ? `${pre} ` : "";
}

function padLinkSuffix(value: string): string {
  const suf = value.replace(/^\s+/g, "");
  return suf ? ` ${suf}` : "";
}

export function createEmptyBlock(type: EmailBlockType): EmailBlock {
  switch (type) {
    case "text":
      return createTextBlock("New paragraph — click to edit.");
    case "image":
      return createImageBlock();
    case "button":
      return createButtonBlock("Update payment method");
    case "spacer":
      return createSpacerBlock(24);
    case "divider":
      return createDividerBlock();
    case "linkRow":
      return createBillingLinkTextBlock();
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

/** Build default blocks that mirror the classic headline/body/cta layout. */
export function blocksFromLegacyCopy(copy: LegacyEmailCopy): EmailBlock[] {
  return [
    createTextBlock(copy.headline, {
      fontSize: 15,
      color: "muted",
      marginTop: 0,
      marginBottom: 8,
    }),
    createTextBlock(plainToBoldMarkers(copy.body), {
      fontSize: 15,
      color: "default",
      marginTop: 16,
      marginBottom: 24,
    }),
    createButtonBlock(copy.cta, { marginBottom: 20 }),
    createBillingLinkTextBlock(),
  ];
}

export function defaultEmailDocument(
  templateId: RecoveryTemplateId,
): EmailDocument {
  const base = BASE_COPY[templateId];
  return {
    ...base,
    blocks: blocksFromLegacyCopy(base),
    linkColor: DEFAULT_LINK_COLOR,
    emailPadding: DEFAULT_EMAIL_PADDING,
    shellBorder: DEFAULT_SHELL_BORDER,
    shellBorderWidth: DEFAULT_SHELL_BORDER_WIDTH,
    shellRadius: DEFAULT_SHELL_RADIUS,
  };
}

/** Wrap {{product}} / {{amount}} in **bold** for default body text. */
function plainToBoldMarkers(plain: string): string {
  return plain
    .replace(/\{\{product\}\}/g, "**{{product}}**")
    .replace(/\{\{amount\}\}/g, "**{{amount}}**");
}

/** Convert stored **markers** or HTML → safe HTML subset for email/preview. */
export function markersToHtml(text: string): string {
  return richTextToHtml(text);
}

/** Convert a limited HTML subset back to **bold** markers for editing. */
export function htmlToMarkers(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(?:strong|b)>/gi, "**")
    .replace(/<\/?(?:em|i)>/gi, "*")
    .replace(/<\/?u>/gi, "__")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

/** Strip markers / tags for plain-text derivation. */
export function markersToPlain(text: string): string {
  return richTextToPlain(text);
}

/** Derive classic fields from blocks for backward-compatible persistence. */
export function deriveLegacyFromBlocks(
  subject: string,
  blocks: EmailBlock[],
  fallback: LegacyEmailCopy,
): LegacyEmailCopy {
  const texts = blocks.filter((b): b is TextBlock => b.type === "text");
  const button = blocks.find((b): b is ButtonBlock => b.type === "button");
  const headline = texts[0]?.html
    ? markersToPlain(texts[0].html).trim()
    : fallback.headline;
  const bodyParts = texts.slice(1).map((t) => markersToPlain(t.html).trim());
  const body =
    bodyParts.filter(Boolean).join("\n\n") || fallback.body;
  return {
    subject: subject.trim() || fallback.subject,
    headline: headline || fallback.headline,
    body: body || fallback.body,
    cta: button?.label.trim() || fallback.cta,
  };
}

export function documentEquals(a: EmailDocument, b: EmailDocument): boolean {
  if (
    a.subject.trim() !== b.subject.trim() ||
    a.linkColor.trim().toLowerCase() !== b.linkColor.trim().toLowerCase() ||
    a.emailPadding !== b.emailPadding ||
    resolveShellBackground(a) !== resolveShellBackground(b) ||
    resolveShellBorderColor(a, "") !== resolveShellBorderColor(b, "") ||
    resolveShellBorder(a) !== resolveShellBorder(b) ||
    resolveShellBorderWidth(a) !== resolveShellBorderWidth(b) ||
    resolveShellRadius(a) !== resolveShellRadius(b) ||
    a.blocks.length !== b.blocks.length
  ) {
    return false;
  }
  return JSON.stringify(normalizeBlocksForCompare(a.blocks)) ===
    JSON.stringify(normalizeBlocksForCompare(b.blocks));
}

function normalizeBlocksForCompare(blocks: EmailBlock[]): unknown[] {
  return blocks.map((b) => {
    const { id: _id, ...rest } = b;
    return rest;
  });
}

export function resolveEmailDocument(
  templateId: RecoveryTemplateId,
  overrides?: Partial<EmailDocument> | null,
): EmailDocument {
  const base = defaultEmailDocument(templateId);
  if (!overrides) return base;

  const subject = overrides.subject?.trim() || base.subject;
  const headline = overrides.headline?.trim() || base.headline;
  const body = overrides.body?.trim() || base.body;
  const cta = overrides.cta?.trim() || base.cta;
  const legacy: LegacyEmailCopy = { subject, headline, body, cta };

  const blocks =
    overrides.blocks && overrides.blocks.length > 0
      ? cloneBlocks(overrides.blocks)
      : blocksFromLegacyCopy(legacy);

  return {
    subject,
    headline,
    body,
    cta,
    blocks,
    linkColor: overrides.linkColor?.trim() || base.linkColor,
    emailPadding:
      typeof overrides.emailPadding === "number"
        ? clamp(overrides.emailPadding, 12, 48)
        : base.emailPadding,
    shellBackground:
      overrides.shellBackground?.trim() || base.shellBackground,
    shellBorderColor: overrides.shellBorderColor?.trim() || undefined,
    shellBorder:
      typeof overrides.shellBorder === "boolean"
        ? overrides.shellBorder
        : base.shellBorder,
    shellBorderWidth:
      typeof overrides.shellBorderWidth === "number"
        ? clamp(overrides.shellBorderWidth, 1, SHELL_BORDER_WIDTH_MAX)
        : base.shellBorderWidth,
    shellRadius:
      typeof overrides.shellRadius === "number"
        ? clamp(overrides.shellRadius, 0, SHELL_RADIUS_MAX)
        : base.shellRadius,
  };
}

export function cloneBlocks(blocks: EmailBlock[]): EmailBlock[] {
  return migrateEmailBlocks(blocks).map((b) => ({
    ...b,
    id: b.id || newBlockId(b.type),
  }));
}

/** Copy a block with a fresh id (for duplicate). */
export function duplicateBlock(block: EmailBlock): EmailBlock {
  return { ...block, id: newBlockId(block.type) } as EmailBlock;
}

/** Friendly text presets so clients don't fiddle with raw sizes. */
export type TextPresetId = "heading" | "body" | "small";

export const TEXT_PRESETS: Record<
  TextPresetId,
  { label: string; fontSize: number; color: TextBlock["color"] }
> = {
  heading: { label: "Heading", fontSize: 20, color: "default" },
  body: { label: "Body", fontSize: 15, color: "default" },
  small: { label: "Small", fontSize: 13, color: "muted" },
};

/** Best-effort match of a text block to a preset for active highlighting. */
export function matchTextPreset(block: TextBlock): TextPresetId | null {
  for (const id of Object.keys(TEXT_PRESETS) as TextPresetId[]) {
    const p = TEXT_PRESETS[id];
    if (block.fontSize === p.fontSize && block.color === p.color) return id;
  }
  return null;
}

/**
 * Guided (constrained) content model. This is the small, safe surface the
 * merchant edits — a locked, proven layout they can personalise but not
 * dismantle. It maps deterministically onto the block model for rendering.
 */
export type GuidedContent = {
  headline: string;
  /** Message body — supports **bold** markers + {{variables}} */
  body: string;
  ctaLabel: string;
  image: {
    enabled: boolean;
    src: string;
    alt: string;
    heightPx: number;
    zoom: number;
  };
  secondaryLink: {
    enabled: boolean;
    prefix: string;
    label: string;
    suffix: string;
  };
};

/** Canonical, deliverability-safe block order derived from guided content. */
export function blocksFromGuided(content: GuidedContent): EmailBlock[] {
  const blocks: EmailBlock[] = [];
  const hasHeadline = content.headline.trim().length > 0;

  if (content.image.enabled) {
    blocks.push(
      createImageBlock({
        src: content.image.src,
        alt: content.image.alt,
        width: 100,
        align: "center",
        heightPx: content.image.heightPx,
        zoom: content.image.zoom,
        marginTop: 0,
        marginBottom: 20,
      }),
    );
  }
  if (hasHeadline) {
    blocks.push(
      createTextBlock(content.headline, {
        color: "muted",
        fontSize: 15,
        marginTop: 0,
        marginBottom: 8,
      }),
    );
  }
  blocks.push(
    createTextBlock(content.body, {
      color: "default",
      fontSize: 15,
      marginTop: hasHeadline ? 16 : 0,
      marginBottom: 24,
    }),
  );
  blocks.push(
    createButtonBlock(content.ctaLabel, {
      marginBottom: content.secondaryLink.enabled ? 16 : 20,
    }),
  );
  if (content.secondaryLink.enabled) {
    blocks.push(
      createBillingLinkTextBlock({
        prefix: content.secondaryLink.prefix,
        linkLabel: content.secondaryLink.label,
        suffix: content.secondaryLink.suffix,
      }),
    );
  }
  return blocks;
}

/** Best-effort read of guided content from a document's blocks (or legacy). */
export function guidedFromDocument(doc: EmailDocument): GuidedContent {
  const image = doc.blocks.find((b): b is ImageBlock => b.type === "image");
  const link = doc.blocks.find((b): b is LinkRowBlock => b.type === "linkRow");
  const billingText = doc.blocks.find(
    (b): b is TextBlock =>
      b.type === "text" && b.html.includes(PAYMENT_UPDATE_HREF),
  );
  const button = doc.blocks.find((b): b is ButtonBlock => b.type === "button");
  const texts = doc.blocks.filter((b): b is TextBlock => b.type === "text");
  const headlineBlock = texts.find((t) => t.color === "muted");
  const bodyBlock =
    texts.find((t) => t !== headlineBlock && t.color !== "muted") ??
    texts.find((t) => t !== headlineBlock);

  return {
    headline: headlineBlock?.html ?? doc.headline ?? "",
    body: bodyBlock?.html ?? doc.body ?? "",
    ctaLabel: button?.label ?? doc.cta ?? "",
    image: {
      enabled: image != null,
      src: image?.src ?? "",
      alt: image?.alt ?? "",
      heightPx: image?.heightPx ?? IMAGE_CROP_HEIGHT_DEFAULT,
      zoom: image?.zoom ?? IMAGE_ZOOM_DEFAULT,
    },
    secondaryLink: {
      enabled: link != null || billingText != null,
      prefix: link?.prefix ?? "Or ",
      label: link?.linkLabel ?? "open the billing page",
      suffix: link?.suffix ?? " to update your card.",
    },
  };
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function resolveImageCrop(input?: {
  heightPx?: number;
  zoom?: number;
}): { heightPx: number; zoom: number } {
  return {
    heightPx: clamp(
      input?.heightPx ?? IMAGE_CROP_HEIGHT_DEFAULT,
      IMAGE_CROP_HEIGHT_MIN,
      IMAGE_CROP_HEIGHT_MAX,
    ),
    zoom: clamp(
      input?.zoom ?? IMAGE_ZOOM_DEFAULT,
      IMAGE_ZOOM_MIN,
      IMAGE_ZOOM_MAX,
    ),
  };
}

export type ImageLayout = {
  widthPct: number;
  heightPx: number;
  zoom: number;
  radius: number;
  shape: ImageShape | null;
  cropTop: number;
  cropBottom: number;
  cropLeft: number;
  cropRight: number;
  visibleHeight: number;
  visibleWidthPct: number;
  imgWidthPctOfWrap: number;
  imgHeight: number;
  shiftLeftPct: number;
  shiftTop: number;
};

export function resolveImageLayout(input?: {
  width?: number;
  heightPx?: number;
  zoom?: number;
  radius?: number;
  shape?: ImageShape;
  cropTop?: number;
  cropBottom?: number;
  cropLeft?: number;
  cropRight?: number;
}): ImageLayout {
  const { heightPx, zoom } = resolveImageCrop(input);
  const widthPct = clamp(input?.width ?? 100, 20, 100);
  const maxCropH = Math.max(0, heightPx - IMAGE_VISIBLE_MIN);
  const cropTop = clamp(Math.round(input?.cropTop ?? 0), 0, maxCropH);
  const cropBottom = clamp(
    Math.round(input?.cropBottom ?? 0),
    0,
    Math.max(0, maxCropH - cropTop),
  );
  const cropLeft = clamp(input?.cropLeft ?? 0, 0, IMAGE_CROP_PCT_MAX);
  const cropRight = clamp(
    input?.cropRight ?? 0,
    0,
    Math.max(0, IMAGE_CROP_PCT_MAX - cropLeft),
  );
  const visibleFrac = Math.max(0.2, 1 - cropLeft / 100 - cropRight / 100);
  const visibleHeight = Math.max(
    IMAGE_VISIBLE_MIN,
    heightPx - cropTop - cropBottom,
  );
  const visibleWidthPct = widthPct * visibleFrac;
  const imgWidthPctOfWrap = 100 / visibleFrac;
  const imgHeight = Math.round(heightPx * zoom);
  const shiftTop = -cropTop - (zoom > 1 ? Math.round(((zoom - 1) / 2) * heightPx) : 0);
  const shiftLeftPct = -(cropLeft / visibleFrac);
  const radiusRaw =
    typeof input?.radius === "number" && Number.isFinite(input.radius)
      ? input.radius
      : IMAGE_RADIUS_DEFAULT;
  const shape = resolveImageShape(input);
  return {
    widthPct,
    heightPx,
    zoom,
    radius: Math.max(0, Math.round(imageShapeRadius(shape, radiusRaw))),
    shape,
    cropTop,
    cropBottom,
    cropLeft,
    cropRight,
    visibleHeight,
    visibleWidthPct,
    imgWidthPctOfWrap,
    imgHeight,
    shiftLeftPct,
    shiftTop,
  };
}

export function imagePillRadius(visibleWidth: number, visibleHeight: number): number {
  return Math.max(0, Math.floor(Math.min(visibleWidth, visibleHeight) / 2));
}

/** Preview crop: frame size + image scales to fill the frame. */
export function imageCropPreviewStyles(input?: {
  width?: number;
  heightPx?: number;
  zoom?: number;
  radius?: number;
  shape?: ImageShape;
  cropTop?: number;
  cropBottom?: number;
  cropLeft?: number;
  cropRight?: number;
  shadow?: boolean;
  shadowColor?: string;
  border?: boolean;
  borderColor?: string;
  borderWidth?: number;
  fit?: ImageFit;
  panX?: number;
  offsetX?: number;
  align?: BlockAlign;
}): {
  wrap: Record<string, string | number>;
  img: Record<string, string | number>;
} {
  const layout = resolveImageLayout(input);
  const borderOn = resolveImageBorder(input);
  const shadowOn = resolveImageShadow(input);
  const clip = imageShapeClipPath(layout.shape);
  const lock = imageLocksAspect(layout.shape);
  const zoom = layout.zoom;
  const shadowCss = imageBoxShadow(resolveImageShadowColor(input));
  const stretch = resolveImageFit(input) === "stretch";
  const wrapChrome = {
    position: "relative" as const,
    overflow: "hidden",
    width: `${layout.visibleWidthPct}%`,
    borderRadius: layout.radius,
    lineHeight: 0,
    boxSizing: "border-box" as const,
    borderStyle: "solid",
    borderWidth: borderOn ? resolveImageBorderWidth(input) : 0,
    borderColor: resolveImageBorderColor(input),
    boxShadow: clip ? "none" : shadowOn ? shadowCss : "none",
    filter: clip && shadowOn ? `drop-shadow(${shadowCss})` : "none",
    clipPath: clip ?? "none",
    WebkitClipPath: clip ?? "none",
  };
  if (stretch) {
    const cropSlack = layout.cropLeft + layout.cropRight;
    const marginLeft =
      cropSlack < 0.2
        ? imageOffsetMarginPct(
            layout.visibleWidthPct,
            resolveImageOffsetX(input),
          )
        : (layout.cropLeft * layout.widthPct) / 100;
    return {
      wrap: {
        ...wrapChrome,
        marginLeft: `${marginLeft}%`,
        ...(lock
          ? { aspectRatio: "1 / 1", height: "auto" }
          : { height: layout.visibleHeight }),
      },
      img: {
        position: "absolute",
        display: "block",
        left: `${layout.shiftLeftPct}%`,
        top: layout.shiftTop,
        width: `${layout.imgWidthPctOfWrap}%`,
        height: "auto",
        maxWidth: "none",
      },
    };
  }
  return {
    wrap: {
      ...wrapChrome,
      marginLeft: `${imageOffsetMarginPct(
        layout.visibleWidthPct,
        resolveImageOffsetX(input),
      )}%`,
      ...(lock
        ? { aspectRatio: "1 / 1", height: "auto" }
        : { height: layout.visibleHeight }),
    },
    img: {
      position: "absolute",
      display: "block",
      inset: zoom > 1 ? "auto" : 0,
      left: zoom > 1 ? "50%" : 0,
      top: zoom > 1 ? "50%" : 0,
      width: zoom > 1 ? `${zoom * 100}%` : "100%",
      height: zoom > 1 ? `${zoom * 100}%` : "100%",
      maxWidth: "none",
      objectFit: "cover",
      objectPosition: `${resolveImagePanX(input)}% center`,
      transform: zoom > 1 ? "translate(-50%, -50%)" : "none",
    },
  };
}

export function moveBlock(
  blocks: EmailBlock[],
  fromIndex: number,
  toIndex: number,
): EmailBlock[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= blocks.length ||
    toIndex >= blocks.length ||
    fromIndex === toIndex
  ) {
    return blocks;
  }
  const next = [...blocks];
  const [item] = next.splice(fromIndex, 1);
  if (!item) return blocks;
  next.splice(toIndex, 0, item);
  return next;
}

export function insertBlockAt(
  blocks: EmailBlock[],
  index: number,
  block: EmailBlock,
): EmailBlock[] {
  const next = [...blocks];
  next.splice(Math.max(0, Math.min(index, next.length)), 0, block);
  return next;
}

export function updateBlock(
  blocks: EmailBlock[],
  id: string,
  patch: Partial<EmailBlock>,
): EmailBlock[] {
  return blocks.map((b) => {
    if (b.id !== id) return b;
    return { ...b, ...patch, type: b.type, id: b.id } as EmailBlock;
  });
}

export function removeBlock(blocks: EmailBlock[], id: string): EmailBlock[] {
  return blocks.filter((b) => b.id !== id);
}

export const BLOCK_TYPE_META: Record<
  EmailBlockType,
  { label: string; description: string }
> = {
  text: { label: "Text", description: "Paragraph or headline" },
  image: { label: "Image", description: "HTTPS image URL" },
  button: { label: "Button", description: "Primary CTA" },
  spacer: { label: "Spacer", description: "Vertical space" },
  divider: { label: "Divider", description: "Hairline rule" },
  linkRow: { label: "Link row", description: "Secondary text link" },
};

/** Apply contentEditable bold wrapping around a selection in marker text. */
export function wrapSelectionWithBold(
  text: string,
  start: number,
  end: number,
): { text: string; start: number; end: number } {
  if (start === end) {
    const insert = "****";
    const next = text.slice(0, start) + insert + text.slice(end);
    return { text: next, start: start + 2, end: start + 2 };
  }
  const selected = text.slice(start, end);
  const wrapped = `**${selected}**`;
  const next = text.slice(0, start) + wrapped + text.slice(end);
  return { text: next, start: start + 2, end: end + 2 };
}
