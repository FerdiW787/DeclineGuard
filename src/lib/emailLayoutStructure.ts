/**
 * Layout kits influence block document structure (align, shell, padding).
 * Canonical IDs: poster-notice | amount-due | plain-letter | what-happened
 *   | quiet-column. Merchants do not pick a kit.
 *
 * Kit ids are FE-local until Riley’s BE catalog accepts Set A.
 * FE does not persist a merchant-chosen template id.
 */

import {
  defaultEmailDocument,
  documentEquals,
  type EmailDocument,
} from "./emailBuilder";
import { documentForKit, seedCopyWithKit } from "./emailBlockKits";
import type { LayoutPresetId } from "./emailLayoutPresets";
import type { RecoveryTemplateId } from "./recoveryEmailCopy";
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

/**
 * Uncustomized = missing/empty blocks, or the factory legacy document
 * (`text,text,button,text`, pad 24). Brand-stamped `linkColor` is ignored
 * so first-paint docs from `emailCopyFromSettings(null)` still match.
 * Any other block shape, padding, copy, or shell is treated as explicit
 * and left alone.
 */
export function isUncustomizedEmailDocument(
  day: RecoveryTemplateId,
  doc?: EmailDocument | null,
): boolean {
  if (!doc || doc.blocks.length === 0) return true;
  const factory = defaultEmailDocument(day);
  return documentEquals({ ...doc, linkColor: factory.linkColor }, factory);
}

/**
 * Seed Set A onto empty days and factory legacy defaults.
 * Does not overwrite explicitly customized persisted docs.
 */
export function seedEmptyDaysWithKit(
  copy: EmailCopyByTemplate,
  presetId: LayoutPresetId,
): EmailCopyByTemplate {
  let changed = false;
  const next = { ...copy };
  for (const day of EMAIL_TEMPLATE_ORDER) {
    const doc = copy[day];
    if (!isUncustomizedEmailDocument(day, doc)) continue;
    next[day] = documentForKit(day, presetId, doc);
    changed = true;
  }
  return changed ? next : copy;
}
