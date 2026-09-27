/**
 * Compatibility barrel — token/resolveTheme + locked recovery-layout ids
 * (`sonos` | `avocode` | `benchmark` | `fontbase` | `nordvpn-structure`).
 */

export {
  DEFAULT_LAYOUT_PRESET_ID,
  DEFAULT_STYLING_MODE,
  LAYOUT_PRESET_CATALOG,
  LAYOUT_PRESET_IDS,
  LIFECYCLE_EMAIL_TYPES,
  NEW_MERCHANT_THEME_DEFAULTS,
  SONOS_LAYOUT_ID,
  SONOS_TOKENS,
  fromBackendLayoutPresetId,
  toBackendLayoutPresetId,
  assertKnownLayoutPresetId,
  configuredTokensFromSettings,
  getLayoutPreset,
  inferStylingMode,
  isLayoutPresetId,
  isLifecycleEmailType,
  isStylingMode,
  listLayoutPresets,
  normalizeLayoutPresetId,
  normalizeStylingMode,
  recoveryColorsFromTheme,
  resolveLayoutPresetId,
  resolveLifecycleEmailTheme,
  resolveTheme,
  resolveThemeFromSettings,
  type EmailThemeTokens,
  type LayoutPreset,
  type LayoutPresetId,
  type LifecycleEmailType,
  type RecoverySettingsLayoutFields,
  type ResolveThemeInput,
  type ResolvedEmailTheme,
  type SettingsTokenSource,
  type StylingMode,
} from "./emailTheme";

export {
  buildLifecycleEmail,
  listLifecycleEmailTypes,
  type BuiltLifecycleEmail,
  type LifecycleEmailVars,
} from "./lifecycleEmailTemplate";

export {
  emailThemeApiLive,
  emailThemeRefs,
  type EmailThemeSettings,
  type LifecycleEmailPreview,
} from "./emailThemeApi";
