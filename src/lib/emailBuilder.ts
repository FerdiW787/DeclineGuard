/** Block-based recovery email document model (Customizations builder). */

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
  /** Supports **bold** markers and newlines */
  html: string;
  fontSize: number;
  color: "default" | "muted" | "link";
  align: BlockAlign;
};

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

export const IMAGE_CROP_HEIGHT_MIN = 80;
export const IMAGE_CROP_HEIGHT_MAX = 320;
export const IMAGE_CROP_HEIGHT_DEFAULT = 180;
export const IMAGE_ZOOM_MIN = 1;
export const IMAGE_ZOOM_MAX = 2.4;
export const IMAGE_ZOOM_DEFAULT = 1;

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
    align: opts.align ?? "center",
    heightPx: opts.heightPx ?? IMAGE_CROP_HEIGHT_DEFAULT,
    zoom: opts.zoom ?? IMAGE_ZOOM_DEFAULT,
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
      return createLinkRowBlock();
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
    createLinkRowBlock(),
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
  };
}

/** Wrap {{product}} / {{amount}} in **bold** for default body text. */
function plainToBoldMarkers(plain: string): string {
  return plain
    .replace(/\{\{product\}\}/g, "**{{product}}**")
    .replace(/\{\{amount\}\}/g, "**{{amount}}**");
}

/** Convert **bold** + newlines → safe HTML subset for email/preview. */
export function markersToHtml(text: string): string {
  const escaped = escapeHtml(text);
  const withBold = escaped.replace(
    /\*\*([^*]+)\*\*/g,
    "<strong>$1</strong>",
  );
  return withBold.replace(/\n/g, "<br />");
}

/** Convert a limited HTML subset back to **bold** markers for editing. */
export function htmlToMarkers(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?strong>/gi, "**")
    .replace(/<\/?b>/gi, "**")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Strip markers for plain-text derivation. */
export function markersToPlain(text: string): string {
  return text.replace(/\*\*/g, "");
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
  };
}

export function cloneBlocks(blocks: EmailBlock[]): EmailBlock[] {
  return blocks.map((b) => ({ ...b, id: b.id || newBlockId(b.type) }));
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
      createLinkRowBlock({
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
      enabled: link != null,
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

/** Preview crop: overflow frame + object-fit cover. */
export function imageCropPreviewStyles(input?: {
  heightPx?: number;
  zoom?: number;
}): {
  wrap: Record<string, string | number>;
  img: Record<string, string | number>;
} {
  const { heightPx, zoom } = resolveImageCrop(input);
  return {
    wrap: {
      overflow: "hidden",
      height: heightPx,
      borderRadius: 8,
      lineHeight: 0,
    },
    img: {
      display: "block",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      objectPosition: "center",
      ...(zoom > 1
        ? { transform: `scale(${zoom})`, transformOrigin: "center center" }
        : {}),
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
