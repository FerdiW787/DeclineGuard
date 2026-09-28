/**
 * Layout presets influence block document structure (align, shell, padding).
 * Persisted IDs stay on Riley’s contract (`quiet-verify`, …). Incoming
 * `sonos` / `avocode` aliases resolve in `emailTheme`.
 */

import type { BlockAlign, EmailBlock, EmailDocument } from "./emailBuilder";
import { EMAIL_TEMPLATE_ORDER, type EmailCopyByTemplate } from "./emailStyleSync";
import type { LayoutPresetId } from "./emailLayoutPresets";

export type LayoutStructureSpec = {
  align: BlockAlign;
  ctaAlign: BlockAlign;
  emailPadding: number;
  shellBorder: boolean;
  shellBorderWidth: number;
  shellRadius: number;
};

export const LAYOUT_STRUCTURE_SPEC: Record<LayoutPresetId, LayoutStructureSpec> =
  {
    "quiet-verify": {
      align: "center",
      ctaAlign: "center",
      emailPadding: 32,
      shellBorder: false,
      shellBorderWidth: 1,
      shellRadius: 0,
    },
    "soft-expire": {
      align: "left",
      ctaAlign: "left",
      emailPadding: 28,
      shellBorder: true,
      shellBorderWidth: 1,
      shellRadius: 12,
    },
    "safe-pause": {
      align: "left",
      ctaAlign: "left",
      emailPadding: 36,
      shellBorder: false,
      shellBorderWidth: 1,
      shellRadius: 8,
    },
    "soft-renew": {
      align: "left",
      ctaAlign: "left",
      emailPadding: 24,
      shellBorder: false,
      shellBorderWidth: 1,
      shellRadius: 0,
    },
    "alert-expire": {
      align: "left",
      ctaAlign: "left",
      emailPadding: 24,
      shellBorder: true,
      shellBorderWidth: 3,
      shellRadius: 0,
    },
  };

function applyAlign(block: EmailBlock, spec: LayoutStructureSpec): EmailBlock {
  switch (block.type) {
    case "text":
    case "image":
      return { ...block, align: spec.align };
    case "button":
      return { ...block, align: spec.ctaAlign };
    case "linkRow":
    case "spacer":
    case "divider":
      return block;
    default: {
      const _never: never = block;
      return _never;
    }
  }
}

export function applyLayoutStructure(
  doc: EmailDocument,
  presetId: LayoutPresetId,
): EmailDocument {
  const spec = LAYOUT_STRUCTURE_SPEC[presetId];
  return {
    ...doc,
    emailPadding: spec.emailPadding,
    shellBorder: spec.shellBorder,
    shellBorderWidth: spec.shellBorderWidth,
    shellRadius: spec.shellRadius,
    blocks: doc.blocks.map((block) => applyAlign(block, spec)),
  };
}

export function applyLayoutStructureToCopy(
  copy: EmailCopyByTemplate,
  presetId: LayoutPresetId,
): EmailCopyByTemplate {
  const next = { ...copy };
  for (const id of EMAIL_TEMPLATE_ORDER) {
    next[id] = applyLayoutStructure(copy[id], presetId);
  }
  return next;
}
