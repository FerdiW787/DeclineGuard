/**
 * Picker labels + recovery-step display. IDs/tokens live in `emailTheme.ts`.
 */

export {
  DEFAULT_LAYOUT_PRESET_ID,
  DEFAULT_RECOVERY_SEQUENCE_STEP,
  DEFAULT_STYLING_MODE,
  LAYOUT_PRESET_IDS,
  RECOVERY_SEQUENCE_STEPS,
  isLayoutPresetId,
  isRecoverySequenceStep,
  isStylingMode,
  resolveLayoutPresetId,
  type LayoutPresetId,
  type RecoverySequenceStep,
  type RecoverySettingsLayoutFields,
  type StylingMode,
} from "./emailTheme";

import {
  LAYOUT_PRESET_CATALOG,
  LAYOUT_PRESET_IDS,
  type LayoutPresetId,
  type RecoverySequenceStep,
} from "./emailTheme";

export type LayoutPresetMeta = {
  id: LayoutPresetId;
  label: string;
  structure: string;
};

export const LAYOUT_PRESET_META: readonly LayoutPresetMeta[] =
  LAYOUT_PRESET_IDS.map((id) => {
    const preset = LAYOUT_PRESET_CATALOG[id];
    return {
      id,
      label: preset.name,
      structure: preset.description,
    };
  });

export const RECOVERY_STEP_META: Record<
  RecoverySequenceStep,
  { label: string; hint: string }
> = {
  day0: { label: "Day 0", hint: "Gentle — first notice" },
  day2: { label: "Day 2", hint: "Direct — second notice" },
  day5: { label: "Day 5", hint: "Urgent — final notice" },
};

export function layoutPresetMeta(id: string): LayoutPresetMeta {
  const found = LAYOUT_PRESET_META.find((item) => item.id === id);
  return found ?? LAYOUT_PRESET_META[0]!;
}

export function recoveryStepMeta(step: RecoverySequenceStep): {
  label: string;
  hint: string;
} {
  return RECOVERY_STEP_META[step];
}
