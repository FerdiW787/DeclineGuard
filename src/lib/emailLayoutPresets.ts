/**
 * Picker labels + lifecycle display. IDs/tokens live in `emailTheme.ts`
 * (Riley public API mirror).
 */

export {
  BE_LAYOUT_PRESET_IDS,
  DEFAULT_LAYOUT_PRESET_ID,
  DEFAULT_LIFECYCLE_EMAIL_TYPE,
  DEFAULT_STYLING_MODE,
  LAYOUT_PRESET_IDS,
  LIFECYCLE_EMAIL_TYPES,
  isLayoutPresetId,
  isLifecycleEmailType,
  isStylingMode,
  resolveLayoutPresetId,
  type LayoutPresetId,
  type LifecycleEmailType,
  type RecoverySettingsLayoutFields,
  type StylingMode,
} from "./emailTheme";

import {
  LAYOUT_PRESET_CATALOG,
  LAYOUT_PRESET_IDS,
  type LayoutPresetId,
  type LifecycleEmailType,
} from "./emailTheme";

export type LayoutPresetMeta = {
  id: LayoutPresetId;
  label: string;
  structure: string;
};

export const LAYOUT_PRESET_META: readonly LayoutPresetMeta[] =
  LAYOUT_PRESET_IDS.map((id) => {
    const preset = LAYOUT_PRESET_CATALOG[id]!;
    return {
      id,
      label: preset.name,
      structure: preset.description,
    };
  });

/** Labels describe structure — not RGE refs or Quiet Verify. */
export const LAYOUT_PRESET_STRUCTURE_META: Record<
  LayoutPresetId,
  { label: string; hint: string }
> = {
  "poster-notice": { label: "Poster notice", hint: "Centered announcement" },
  "amount-due": { label: "Amount due", hint: "Money first" },
  "plain-letter": { label: "Plain letter", hint: "Two paragraphs" },
  "what-happened": { label: "What happened", hint: "Two labeled beats" },
  "quiet-column": { label: "Quiet column", hint: "Wide type only" },
};

export const LIFECYCLE_EMAIL_META: Record<
  LifecycleEmailType,
  { label: string; hint: string }
> = {
  verify: { label: "Verify", hint: "Confirm the address" },
  decline_pause: { label: "Decline / pause", hint: "Payment failed or paused" },
  trial_ended: { label: "Trial ended", hint: "Trial wrapped up" },
  renewal: { label: "Renewal", hint: "Upcoming or due" },
  expiry: { label: "Expiry", hint: "Access is ending" },
};

export function layoutPresetMeta(id: string): LayoutPresetMeta {
  const found = LAYOUT_PRESET_META.find((item) => item.id === id);
  return found ?? LAYOUT_PRESET_META[0]!;
}
