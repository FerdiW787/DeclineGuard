/**
 * Picker labels + lifecycle display. IDs/tokens live in `emailTheme.ts`
 * (Riley public API mirror).
 */

export {
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

/** Merchant-facing structure names — never Quiet Verify / Soft Expire. */
export const LAYOUT_PRESET_STRUCTURE_META: Record<
  LayoutPresetId,
  { label: string; hint: string }
> = {
  "quiet-verify": { label: "Centered", hint: "Stacked on center" },
  "soft-expire": { label: "Card", hint: "Bordered, left-aligned" },
  "safe-pause": { label: "Soft stack", hint: "Open, more space" },
  "soft-renew": { label: "Editorial", hint: "Flush left, no stroke" },
  "alert-expire": { label: "Accent", hint: "Stronger frame" },
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
