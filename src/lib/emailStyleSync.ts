import type { EmailBlock, EmailDocument } from "./emailBuilder";
import type { RecoveryTemplateId } from "./recoveryEmailCopy";

export const EMAIL_TEMPLATE_ORDER: RecoveryTemplateId[] = [
  "gentle",
  "direct",
  "urgent",
];

export type EmailCopyByTemplate = Record<RecoveryTemplateId, EmailDocument>;

const SHARED_DOCUMENT_KEYS = [
  "emailPadding",
  "shellBackground",
  "shellBorderColor",
  "shellBorder",
  "shellBorderWidth",
  "shellRadius",
  "linkColor",
] as const satisfies readonly (keyof EmailDocument)[];

export function sharedDocumentStylePatch(
  patch: Partial<EmailDocument>,
): Partial<EmailDocument> {
  const out: Partial<EmailDocument> = {};
  for (const key of SHARED_DOCUMENT_KEYS) {
    if (key in patch) {
      (out as Record<string, unknown>)[key] = patch[key];
    }
  }
  return out;
}

/** Apply shell / padding / link styles to every recovery email in the sequence. */
export function mergeEmailCopyDocumentPatch(
  copy: EmailCopyByTemplate,
  templateId: RecoveryTemplateId,
  patch: Partial<EmailDocument>,
): EmailCopyByTemplate {
  const stylePatch = sharedDocumentStylePatch(patch);
  const styleKeySet = new Set(
    Object.keys(stylePatch) as (keyof EmailDocument)[],
  );
  const localPatch: Partial<EmailDocument> = {};
  for (const key of Object.keys(patch) as (keyof EmailDocument)[]) {
    if (!styleKeySet.has(key)) {
      (localPatch as Record<string, unknown>)[key] = patch[key];
    }
  }

  let next: EmailCopyByTemplate = { ...copy };
  if (Object.keys(stylePatch).length > 0) {
    const withStyle = { ...next };
    for (const tid of EMAIL_TEMPLATE_ORDER) {
      withStyle[tid] = { ...withStyle[tid], ...stylePatch };
    }
    next = withStyle;
  }

  if (Object.keys(localPatch).length > 0) {
    next = {
      ...next,
      [templateId]: { ...next[templateId], ...localPatch },
    };
  } else if (Object.keys(stylePatch).length === 0) {
    next = {
      ...next,
      [templateId]: { ...next[templateId], ...patch },
    };
  }

  return next;
}

function styleKeysForBlock(block: EmailBlock): Set<string> {
  const base = ["marginTop", "marginBottom"];
  switch (block.type) {
    case "text":
      return new Set([
        ...base,
        "fontSize",
        "color",
        "hexColor",
        "bold",
        "italic",
        "underline",
        "align",
      ]);
    case "image":
      return new Set([
        ...base,
        "radius",
        "shadow",
        "shadowColor",
        "border",
        "borderColor",
        "borderWidth",
        "shape",
        "fit",
        "align",
        "width",
        "heightPx",
        "zoom",
        "panX",
        "offsetX",
      ]);
    case "button":
      return new Set([...base, "backgroundColor", "align"]);
    case "spacer":
      return new Set([...base, "height"]);
    case "divider":
      return new Set(base);
    case "linkRow":
      return new Set(base);
    default: {
      const _never: never = block;
      void _never;
      return new Set(base);
    }
  }
}

function blockFieldEqual(a: unknown, b: unknown): boolean {
  return a === b;
}

/** Style-only delta between two blocks of the same type; null if content changed too. */
export function getBlockStyleOnlyPatch(
  before: EmailBlock,
  after: EmailBlock,
): Partial<EmailBlock> | null {
  if (before.type !== after.type || before.id !== after.id) return null;

  const styleKeys = new Set(styleKeysForBlock(before));
  const patch: Record<string, unknown> = {};
  let styleChanged = false;
  let nonStyleChanged = false;

  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of keys) {
    if (key === "id" || key === "type") continue;
    const prev = (before as Record<string, unknown>)[key];
    const next = (after as Record<string, unknown>)[key];
    if (blockFieldEqual(prev, next)) continue;
    if (styleKeys.has(key)) {
      patch[key as string] = next;
      styleChanged = true;
    } else {
      nonStyleChanged = true;
    }
  }

  if (!styleChanged || nonStyleChanged) return null;
  return patch as Partial<EmailBlock>;
}

export function applyBlockStylePatch(
  block: EmailBlock,
  patch: Partial<EmailBlock>,
): EmailBlock {
  return { ...block, ...patch, type: block.type, id: block.id } as EmailBlock;
}

/** Mirror block style edits at the same index onto the other sequence emails. */
export function syncBlockStylesAcrossTemplates(
  copy: EmailCopyByTemplate,
  sourceId: RecoveryTemplateId,
  prevBlocks: EmailBlock[],
  nextBlocks: EmailBlock[],
): EmailCopyByTemplate {
  if (prevBlocks.length !== nextBlocks.length) return copy;

  let next = copy;
  for (let i = 0; i < nextBlocks.length; i++) {
    const stylePatch = getBlockStyleOnlyPatch(prevBlocks[i], nextBlocks[i]);
    if (!stylePatch) continue;

    for (const tid of EMAIL_TEMPLATE_ORDER) {
      if (tid === sourceId) continue;
      const doc = next[tid];
      const blocks = doc.blocks;
      if (i >= blocks.length || blocks[i].type !== nextBlocks[i].type) {
        continue;
      }
      const updated = applyBlockStylePatch(blocks[i], stylePatch);
      const newBlocks = blocks.slice();
      newBlocks[i] = updated;
      next = {
        ...next,
        [tid]: { ...doc, blocks: newBlocks },
      };
    }
  }

  return next;
}

export function cloneEmailCopy(
  copy: EmailCopyByTemplate,
): EmailCopyByTemplate {
  return {
    gentle: { ...copy.gentle, blocks: copy.gentle.blocks.map((b) => ({ ...b })) },
    direct: { ...copy.direct, blocks: copy.direct.blocks.map((b) => ({ ...b })) },
    urgent: { ...copy.urgent, blocks: copy.urgent.blocks.map((b) => ({ ...b })) },
  };
}
