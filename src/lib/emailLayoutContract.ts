/**
 * Compatibility barrel — Convex theme contract + recovery send/preview builders.
 * Catalog: sonos | avocode | benchmark | fontbase | nordvpn-structure.
 */

export {
  DEFAULT_LAYOUT_PRESET_ID,
  DEFAULT_RECOVERY_SEQUENCE_STEP,
  DEFAULT_STYLING_MODE,
  BE_LAYOUT_PRESET_IDS,
  LAYOUT_PRESET_CATALOG,
  LAYOUT_PRESET_IDS,
  NEW_MERCHANT_THEME_DEFAULTS,
  RECOVERY_SEQUENCE_STEPS,
  SONOS_LAYOUT_ID,
  SONOS_TOKENS,
  assertKnownLayoutPresetId,
  configuredTokensFromSettings,
  fromBackendLayoutPresetId,
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
  toBackendLayoutPresetId,
  type EmailThemeTokens,
  type LayoutPreset,
  type LayoutPresetId,
  type RecoverySequenceStep,
  type RecoverySettingsLayoutFields,
  type ResolveThemeInput,
  type ResolvedEmailTheme,
  type SettingsTokenSource,
  type StylingMode,
} from "./emailTheme";

export {
  buildRecoveryEmail,
  type RecoveryEmailVars,
  type RecoveryTemplateId,
} from "../../convex/lib/recoveryEmailTemplate";

export {
  emailThemeApiLive,
  emailThemeRefs,
  type EmailThemeSettings,
  type RecoveryEmailPreview,
} from "./emailThemeApi";
