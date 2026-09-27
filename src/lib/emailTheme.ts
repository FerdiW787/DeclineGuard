/**
 * FE contract — re-export Convex source of truth (`convex/lib/emailTheme.ts`).
 * Catalog: sonos | avocode | benchmark | fontbase | nordvpn-structure.
 * Recovery surface: Day 0 / Day 2 / Day 5 only.
 */

export {
  DEFAULT_LAYOUT_PRESET_ID,
  DEFAULT_STYLING_MODE,
  LAYOUT_PRESET_CATALOG,
  LAYOUT_PRESET_IDS,
  NEW_MERCHANT_THEME_DEFAULTS,
  RECOVERY_SEQUENCE_STEPS,
  RECOVERY_STEP_TEMPLATE,
  SONOS_LAYOUT_ID,
  SONOS_TOKENS,
  STYLING_MODES,
  assertKnownLayoutPresetId,
  configuredTokensFromSettings,
  getLayoutPreset,
  inferStylingMode,
  isLayoutPresetId,
  isRecoverySequenceStep,
  isStylingMode,
  listLayoutPresets,
  normalizeLayoutPresetId,
  normalizeStylingMode,
  recoveryColorsFromTheme,
  resolveLayoutPresetId,
  resolveRecoveryEmailTheme,
  resolveTheme,
  resolveThemeFromSettings,
  type EmailThemeTokens,
  type LayoutPreset,
  type LayoutPresetId,
  type RecoverySequenceStep,
  type ResolveThemeInput,
  type ResolvedEmailTheme,
  type SettingsTokenSource,
  type StylingMode,
} from "../../convex/lib/emailTheme";

import {
  LAYOUT_PRESET_CATALOG,
  type EmailThemeTokens,
} from "../../convex/lib/emailTheme";

export const DEFAULT_RECOVERY_SEQUENCE_STEP = "day0" as const;

export type RecoverySettingsLayoutFields = {
  stylingMode: import("../../convex/lib/emailTheme").StylingMode;
  layoutPresetId: string;
};

/** Convenience map for picker thumbs — same tokens as the catalog. */
export const PRESET_THEMES: Record<string, EmailThemeTokens> = Object.fromEntries(
  Object.values(LAYOUT_PRESET_CATALOG).map((preset) => [
    preset.id,
    preset.tokens,
  ]),
);

export function isDarkHex(hex: string | null | undefined): boolean {
  if (!hex) return false;
  const n = hex.trim().toLowerCase();
  const m = n.match(/^#([0-9a-f]{6})$/);
  if (!m?.[1]) return false;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.35;
}
