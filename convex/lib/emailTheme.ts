import { v } from "convex/values";
import {
  DEFAULT_EMAIL_FONT,
  emailFontValidator,
  normalizeEmailFont,
  type EmailFontId,
} from "./emailFonts";

/**
 * Shared email theme contract for Jules + send paths.
 *
 * Import:
 *   import { resolveTheme, type EmailThemeTokens } from "../../convex/lib/emailTheme";
 *
 * One global `layoutPresetId` selects layout structure for ALL lifecycle emails.
 * `stylingMode` only swaps token source: catalog (preset) vs merchant BrandKit
 * (configured). Token field names match recoverySettings / BrandKit — do not
 * invent a parallel primary/background alias set.
 */

export const STYLING_MODES = ["preset", "configured"] as const;
export type StylingMode = (typeof STYLING_MODES)[number];

export const QUIET_VERIFY_LAYOUT_ID = "quiet-verify";

/** MVP lifecycle emails — same layout via the single global layoutPresetId. */
export const LIFECYCLE_EMAIL_TYPES = [
  "verify",
  "decline_pause",
  "trial_ended",
  "renewal",
  "expiry",
] as const;

export type LifecycleEmailType = (typeof LIFECYCLE_EMAIL_TYPES)[number];

export const stylingModeValidator = v.union(
  v.literal("preset"),
  v.literal("configured"),
);

export const lifecycleEmailTypeValidator = v.union(
  v.literal("verify"),
  v.literal("decline_pause"),
  v.literal("trial_ended"),
  v.literal("renewal"),
  v.literal("expiry"),
);

/**
 * Visual tokens applied to lifecycle + recovery emails.
 * Field names match persisted BrandKit / recoverySettings columns.
 */
export type EmailThemeTokens = {
  brandColor: string;
  secondaryColor: string;
  mutedTextColor: string;
  linkColor: string;
  pageBackgroundColor: string;
  pageTextColor: string;
  emailBackgroundColor: string;
  emailTextColor: string;
  ctaBackgroundColor: string;
  ctaTextColor: string;
  ctaBorderRadiusPx: number;
  emailFont: EmailFontId;
  fontFamilyRaw: string | null;
};

export const emailThemeTokensValidator = v.object({
  brandColor: v.string(),
  secondaryColor: v.string(),
  mutedTextColor: v.string(),
  linkColor: v.string(),
  pageBackgroundColor: v.string(),
  pageTextColor: v.string(),
  emailBackgroundColor: v.string(),
  emailTextColor: v.string(),
  ctaBackgroundColor: v.string(),
  ctaTextColor: v.string(),
  ctaBorderRadiusPx: v.number(),
  emailFont: emailFontValidator,
  fontFamilyRaw: v.union(v.string(), v.null()),
});

/** Quiet Verify — muted, trustworthy verify aesthetic. */
export const QUIET_VERIFY_TOKENS: EmailThemeTokens = {
  brandColor: "#3d5248",
  secondaryColor: "#7a756c",
  mutedTextColor: "#7a756c",
  linkColor: "#3d5248",
  pageBackgroundColor: "#f6f4f0",
  pageTextColor: "#2c2a26",
  emailBackgroundColor: "#f6f4f0",
  emailTextColor: "#2c2a26",
  ctaBackgroundColor: "#3d5248",
  ctaTextColor: "#f7f6f3",
  ctaBorderRadiusPx: 8,
  emailFont: "georgia",
  fontFamilyRaw: null,
};

export type LayoutPreset = {
  id: string;
  name: string;
  description: string;
  tokens: EmailThemeTokens;
};

export const LAYOUT_PRESET_CATALOG: Record<string, LayoutPreset> = {
  [QUIET_VERIFY_LAYOUT_ID]: {
    id: QUIET_VERIFY_LAYOUT_ID,
    name: "Quiet Verify",
    description:
      "Muted, trustworthy verify layout for all lifecycle emails (verify, decline/pause, trial ended, renewal, expiry).",
    tokens: QUIET_VERIFY_TOKENS,
  },
};

export const NEW_MERCHANT_THEME_DEFAULTS = {
  stylingMode: "preset" as const,
  layoutPresetId: QUIET_VERIFY_LAYOUT_ID,
};

export type ResolveThemeInput = {
  stylingMode?: StylingMode | string | null;
  layoutPresetId?: string | null;
  configured?: Partial<EmailThemeTokens> | null;
};

export type ResolvedEmailTheme = {
  stylingMode: StylingMode;
  layoutPresetId: string;
  tokens: EmailThemeTokens;
};

export function isStylingMode(value: unknown): value is StylingMode {
  return value === "preset" || value === "configured";
}

export function isLifecycleEmailType(
  value: unknown,
): value is LifecycleEmailType {
  return (
    typeof value === "string" &&
    (LIFECYCLE_EMAIL_TYPES as readonly string[]).includes(value)
  );
}

export function normalizeStylingMode(
  value: string | null | undefined,
  fallback: StylingMode = "preset",
): StylingMode {
  return isStylingMode(value) ? value : fallback;
}

export function normalizeLayoutPresetId(
  value: string | null | undefined,
): string {
  const id = value?.trim();
  if (id && LAYOUT_PRESET_CATALOG[id]) return id;
  return QUIET_VERIFY_LAYOUT_ID;
}

export function getLayoutPreset(layoutPresetId: string): LayoutPreset {
  const id = normalizeLayoutPresetId(layoutPresetId);
  return LAYOUT_PRESET_CATALOG[id] ?? LAYOUT_PRESET_CATALOG[QUIET_VERIFY_LAYOUT_ID]!;
}

export function assertKnownLayoutPresetId(value: string): string {
  const id = value.trim();
  if (!id || !LAYOUT_PRESET_CATALOG[id]) {
    throw new Error(
      `Unknown layout preset. Valid ids: ${Object.keys(LAYOUT_PRESET_CATALOG).join(", ")}`,
    );
  }
  return id;
}

function pickToken(
  value: string | null | undefined,
  fallback: string,
): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function mergeConfiguredTokens(
  catalog: EmailThemeTokens,
  configured: Partial<EmailThemeTokens> | null | undefined,
): EmailThemeTokens {
  if (!configured) return catalog;
  const muted = pickToken(
    configured.mutedTextColor ?? configured.secondaryColor,
    catalog.mutedTextColor,
  );
  const pageBg = pickToken(
    configured.pageBackgroundColor ?? configured.emailBackgroundColor,
    catalog.pageBackgroundColor,
  );
  const pageText = pickToken(
    configured.pageTextColor ?? configured.emailTextColor,
    catalog.pageTextColor,
  );
  const emailBg = pickToken(configured.emailBackgroundColor, pageBg);
  const emailText = pickToken(configured.emailTextColor, pageText);
  const brand = pickToken(configured.brandColor, catalog.brandColor);
  const radius =
    typeof configured.ctaBorderRadiusPx === "number" &&
    Number.isFinite(configured.ctaBorderRadiusPx)
      ? Math.max(0, Math.min(9999, Math.round(configured.ctaBorderRadiusPx)))
      : catalog.ctaBorderRadiusPx;
  const raw = configured.fontFamilyRaw?.trim();

  return {
    brandColor: brand,
    secondaryColor: muted,
    mutedTextColor: muted,
    linkColor: pickToken(configured.linkColor, brand),
    pageBackgroundColor: pageBg,
    pageTextColor: pageText,
    emailBackgroundColor: emailBg,
    emailTextColor: emailText,
    ctaBackgroundColor: pickToken(configured.ctaBackgroundColor, brand),
    ctaTextColor: pickToken(configured.ctaTextColor, catalog.ctaTextColor),
    ctaBorderRadiusPx: radius,
    emailFont: normalizeEmailFont(configured.emailFont ?? DEFAULT_EMAIL_FONT),
    fontFamilyRaw: raw ? raw : null,
  };
}

/**
 * Resolve tokens for send + preview.
 * Layout id always selects structure; stylingMode only swaps token source.
 */
export function resolveTheme(input: ResolveThemeInput): ResolvedEmailTheme {
  const layoutPresetId = normalizeLayoutPresetId(input.layoutPresetId);
  const stylingMode = normalizeStylingMode(input.stylingMode);
  const catalog = getLayoutPreset(layoutPresetId);

  if (stylingMode === "preset") {
    return {
      stylingMode: "preset",
      layoutPresetId,
      tokens: catalog.tokens,
    };
  }

  return {
    stylingMode: "configured",
    layoutPresetId,
    tokens: mergeConfiguredTokens(catalog.tokens, input.configured),
  };
}

/**
 * Infer mode for rows created before stylingMode existed.
 * Unset → configured (legacy preserve: saveEmailColors / customizations
 * without brand import must keep BrandKit tokens, not Quiet Verify).
 * New merchants write explicit stylingMode: "preset" on insert.
 */
export function inferStylingMode(row: {
  stylingMode?: string | null;
  brandImportCompletedAt?: number | null;
}): StylingMode {
  if (isStylingMode(row.stylingMode)) return row.stylingMode;
  return "configured";
}

export type SettingsTokenSource = {
  brandColor?: string | null;
  secondaryColor?: string | null;
  mutedTextColor?: string | null;
  linkColor?: string | null;
  pageBackgroundColor?: string | null;
  pageTextColor?: string | null;
  emailBackgroundColor?: string | null;
  emailTextColor?: string | null;
  ctaBackgroundColor?: string | null;
  ctaTextColor?: string | null;
  ctaBorderRadiusPx?: number | null;
  emailFont?: string | null;
  fontFamilyRaw?: string | null;
};

export function configuredTokensFromSettings(
  settings: SettingsTokenSource | null | undefined,
): Partial<EmailThemeTokens> {
  if (!settings) return {};
  const muted =
    settings.mutedTextColor?.trim() ||
    settings.secondaryColor?.trim() ||
    undefined;
  const pageBg =
    settings.pageBackgroundColor?.trim() ||
    settings.emailBackgroundColor?.trim() ||
    undefined;
  const pageText =
    settings.pageTextColor?.trim() ||
    settings.emailTextColor?.trim() ||
    undefined;
  return {
    ...(settings.brandColor?.trim()
      ? { brandColor: settings.brandColor.trim() }
      : {}),
    ...(muted ? { secondaryColor: muted, mutedTextColor: muted } : {}),
    ...(settings.linkColor?.trim()
      ? { linkColor: settings.linkColor.trim() }
      : {}),
    ...(pageBg ? { pageBackgroundColor: pageBg } : {}),
    ...(pageText ? { pageTextColor: pageText } : {}),
    ...(settings.emailBackgroundColor?.trim()
      ? { emailBackgroundColor: settings.emailBackgroundColor.trim() }
      : {}),
    ...(settings.emailTextColor?.trim()
      ? { emailTextColor: settings.emailTextColor.trim() }
      : {}),
    ...(settings.ctaBackgroundColor?.trim()
      ? { ctaBackgroundColor: settings.ctaBackgroundColor.trim() }
      : {}),
    ...(settings.ctaTextColor?.trim()
      ? { ctaTextColor: settings.ctaTextColor.trim() }
      : {}),
    ...(typeof settings.ctaBorderRadiusPx === "number"
      ? { ctaBorderRadiusPx: settings.ctaBorderRadiusPx }
      : {}),
    ...(settings.emailFont
      ? { emailFont: normalizeEmailFont(settings.emailFont) }
      : {}),
    fontFamilyRaw: settings.fontFamilyRaw?.trim() || null,
  };
}

export function resolveThemeFromSettings(settings: {
  stylingMode?: string | null;
  layoutPresetId?: string | null;
  brandImportCompletedAt?: number | null;
} & SettingsTokenSource): ResolvedEmailTheme {
  return resolveTheme({
    stylingMode: inferStylingMode(settings),
    layoutPresetId: settings.layoutPresetId,
    configured: configuredTokensFromSettings(settings),
  });
}

/**
 * All five MVP lifecycle types share one global theme.
 * Stubs until dedicated send paths exist — call this from those hooks.
 */
export function resolveLifecycleEmailTheme(
  emailType: LifecycleEmailType,
  input: ResolveThemeInput,
): ResolvedEmailTheme & { emailType: LifecycleEmailType } {
  if (!isLifecycleEmailType(emailType)) {
    throw new Error("Unknown lifecycle email type");
  }
  const theme = resolveTheme(input);
  return { emailType, ...theme };
}

/** Map resolved tokens onto buildRecoveryEmail color inputs. */
export function recoveryColorsFromTheme(tokens: EmailThemeTokens): {
  primaryColor: string;
  secondaryColor: string;
  ctaBackgroundColor: string;
  ctaTextColor: string;
  ctaBorderRadiusPx: number;
  emailBackgroundColor: string;
  emailTextColor: string;
  linkColor: string;
  emailFont: EmailFontId;
  fontFamilyRaw: string | null;
} {
  return {
    primaryColor: tokens.brandColor,
    secondaryColor: tokens.mutedTextColor,
    ctaBackgroundColor: tokens.ctaBackgroundColor,
    ctaTextColor: tokens.ctaTextColor,
    ctaBorderRadiusPx: tokens.ctaBorderRadiusPx,
    emailBackgroundColor: tokens.emailBackgroundColor,
    emailTextColor: tokens.emailTextColor,
    linkColor: tokens.linkColor,
    emailFont: tokens.emailFont,
    fontFamilyRaw: tokens.fontFamilyRaw,
  };
}

export const catalogSummaryValidator = v.array(
  v.object({
    id: v.string(),
    name: v.string(),
    description: v.string(),
  }),
);

export function listLayoutPresets(): Array<{
  id: string;
  name: string;
  description: string;
}> {
  return Object.values(LAYOUT_PRESET_CATALOG).map((preset) => ({
    id: preset.id,
    name: preset.name,
    description: preset.description,
  }));
}

export const resolvedEmailThemeValidator = v.object({
  stylingMode: stylingModeValidator,
  layoutPresetId: v.string(),
  tokens: emailThemeTokensValidator,
});
