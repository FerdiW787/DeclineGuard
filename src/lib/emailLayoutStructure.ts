/**
 * Layout kits influence block document structure (align, shell, padding).
 * Canonical IDs: sonos | avocode | benchmark | fontbase | nordvpn-structure.
 */

import { seedCopyWithKit } from "./emailBlockKits";
import type { LayoutPresetId } from "./emailLayoutPresets";
import type { EmailCopyByTemplate } from "./emailStyleSync";

export function applyLayoutStructureToCopy(
  copy: EmailCopyByTemplate,
  presetId: LayoutPresetId,
): EmailCopyByTemplate {
  return seedCopyWithKit(copy, presetId);
}
