/**
 * Picker labels + recovery-day preview meta.
 * IDs/tokens live in `emailTheme.ts`.
 *
 * Recovery-layout id ↔ reference structure:
 *   calm-verify       → 01-sonos-verify-your-email.png
 *   account-expired   → 02-nordvpn-your-account-has-expired.png
 *   trial-ended       → 03-avocode-trial-ended.png
 *   upcoming-renewal  → 04-fontbase-upcoming-renewal.png
 *   data-safe         → 05-benchmark-dont-worry-your-data-is-safe.png
 */

export {
  DEFAULT_LAYOUT_PRESET_ID,
  DEFAULT_STYLING_MODE,
  LAYOUT_PRESET_IDS,
  isLayoutPresetId,
  isStylingMode,
  resolveLayoutPresetId,
  type LayoutPresetId,
  type RecoverySettingsLayoutFields,
  type StylingMode,
} from "./emailTheme";

import {
  LAYOUT_PRESET_CATALOG,
  LAYOUT_PRESET_IDS,
  type LayoutPresetId,
} from "./emailTheme";
import {
  TEMPLATE_META,
  type RecoveryTemplateId,
} from "./recoveryEmailCopy";

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

export const RECOVERY_DAY_IDS = ["gentle", "direct", "urgent"] as const;

export type RecoveryDayId = RecoveryTemplateId;

export const DEFAULT_RECOVERY_DAY: RecoveryDayId = "gentle";

export const RECOVERY_DAY_META: Record<
  RecoveryDayId,
  { label: string; hint: string; day: string }
> = {
  gentle: {
    label: "Day 0",
    hint: TEMPLATE_META.gentle.when,
    day: TEMPLATE_META.gentle.day,
  },
  direct: {
    label: "Day 2",
    hint: TEMPLATE_META.direct.when,
    day: TEMPLATE_META.direct.day,
  },
  urgent: {
    label: "Day 5",
    hint: TEMPLATE_META.urgent.when,
    day: TEMPLATE_META.urgent.day,
  },
};

export const RECOVERY_DAY_OPTIONS = RECOVERY_DAY_IDS.map((id) => ({
  id,
  label: RECOVERY_DAY_META[id].label,
}));

export function isRecoveryDayId(value: unknown): value is RecoveryDayId {
  return (
    typeof value === "string" &&
    (RECOVERY_DAY_IDS as readonly string[]).includes(value)
  );
}

export function layoutPresetMeta(id: string): LayoutPresetMeta {
  const found = LAYOUT_PRESET_META.find((item) => item.id === id);
  return found ?? LAYOUT_PRESET_META[0]!;
}
