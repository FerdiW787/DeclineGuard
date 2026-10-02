/**
 * Layout kits influence block document structure (align, shell, padding).
 * Canonical IDs: sonos | avocode | benchmark | fontbase | nordvpn-structure
 *   | invoice-stack | checklist-card | split-banner | step-rail | tight-notice.
 *
 * Kit ids are FE-local until Riley’s BE catalog accepts the full 10.
 * Persist may fail on the five new ids — keep the local draft and surface
 * that error; do not remap on hydrate.
 */

import { documentForKit, seedCopyWithKit } from "./emailBlockKits";
import type { LayoutPresetId } from "./emailLayoutPresets";
import {
  EMAIL_TEMPLATE_ORDER,
  type EmailCopyByTemplate,
} from "./emailStyleSync";

/** Full rebuild — only for an explicit kit click. */
export function applyLayoutStructureToCopy(
  copy: EmailCopyByTemplate,
  presetId: LayoutPresetId,
): EmailCopyByTemplate {
  return seedCopyWithKit(copy, presetId);
}

/** First-time / empty days only. Never overwrites persisted blocks. */
export function seedEmptyDaysWithKit(
  copy: EmailCopyByTemplate,
  presetId: LayoutPresetId,
): EmailCopyByTemplate {
  let changed = false;
  const next = { ...copy };
  for (const day of EMAIL_TEMPLATE_ORDER) {
    const doc = copy[day];
    if (doc?.blocks && doc.blocks.length > 0) continue;
    next[day] = documentForKit(day, presetId, doc);
    changed = true;
  }
  return changed ? next : copy;
}
