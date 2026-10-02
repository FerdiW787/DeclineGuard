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

/** Product labels match the RGE refs — never Quiet Verify / Soft Expire. */
export const LAYOUT_PRESET_STRUCTURE_META: Record<
  LayoutPresetId,
  { label: string; hint: string }
> = {
  sonos: { label: "Sonos", hint: "Verify your email" },
  avocode: { label: "Avocode", hint: "Your trial ended" },
  benchmark: { label: "Benchmark", hint: "Your data is safe" },
  fontbase: { label: "FontBase", hint: "Upcoming renewal" },
  "nordvpn-structure": { label: "NordVPN", hint: "Your account has expired" },
  "invoice-stack": { label: "Invoice stack", hint: "Receipt meta first" },
  "checklist-card": { label: "Checklist card", hint: "Rounded card + list" },
  "split-banner": { label: "Split banner", hint: "Right-aligned headline" },
  "step-rail": { label: "Step rail", hint: "Numbered path first" },
  "tight-notice": { label: "Tight notice", hint: "Compact bands" },
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
