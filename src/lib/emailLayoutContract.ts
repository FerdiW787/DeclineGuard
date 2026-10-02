/**
 * Compatibility barrel — Riley’s live export is mirrored in `emailTheme.ts`.
 * After `cursor/lifecycle-email-theme-2f33` merges to `dev`, switch to
 * `convex/lib/emailTheme`.
 */

export {
  DEFAULT_LAYOUT_PRESET_ID,
  DEFAULT_STYLING_MODE,
  BE_LAYOUT_PRESET_IDS,
  LAYOUT_PRESET_CATALOG,
  LAYOUT_PRESET_IDS,
  LIFECYCLE_EMAIL_TYPES,
  NEW_MERCHANT_THEME_DEFAULTS,
  QUIET_VERIFY_LAYOUT_ID,
  QUIET_VERIFY_TOKENS,
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
