/**
 * FE contract — re-export Convex source of truth (`convex/lib/emailTheme.ts`).
 * Catalog: sonos | avocode | benchmark | fontbase | nordvpn-structure.
 * Recovery surface: Day 0 / Day 2 / Day 5 only.
 * Locked refs: src/components/dashboard/email-layouts/refs/*.png
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
  SONOS_TOKENS,
  normalizeLayoutPresetId,
  resolveLayoutPresetId,
  type EmailThemeTokens,
  type LayoutPresetId,
} from "../../convex/lib/emailTheme";

export const DEFAULT_RECOVERY_SEQUENCE_STEP = "day0" as const;

/** Legacy alias — maps to sonos via normalizeLayoutPresetId. */
export const QUIET_VERIFY_LAYOUT_ID = "quiet-verify";

/** @deprecated Use SONOS_TOKENS. Kept for Jules Lab/picker fallbacks. */
export const QUIET_VERIFY_TOKENS: EmailThemeTokens = SONOS_TOKENS;

export function toBackendLayoutPresetId(
  layoutPresetId: string | null | undefined,
): string {
  return normalizeLayoutPresetId(layoutPresetId);
}

export function fromBackendLayoutPresetId(
  backendId: string | null | undefined,
  _localFeId?: string | null,
): LayoutPresetId {
  return resolveLayoutPresetId(backendId ?? "");
}

/**
 * Leftover Jules studio keys. Product send is Day 0 / 2 / 5 only —
 * these exist so Lab-adjacent draft files typecheck until Jules drops them.
 */
export const LIFECYCLE_EMAIL_TYPES = [
  "verify",
  "decline_pause",
  "trial_ended",
  "renewal",
  "expiry",
] as const;

export type LifecycleEmailType = (typeof LIFECYCLE_EMAIL_TYPES)[number];

export const DEFAULT_LIFECYCLE_EMAIL_TYPE: LifecycleEmailType = "verify";

export function isLifecycleEmailType(
  value: unknown,
): value is LifecycleEmailType {
  return (
    typeof value === "string" &&
    (LIFECYCLE_EMAIL_TYPES as readonly string[]).includes(value)
  );
}

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
