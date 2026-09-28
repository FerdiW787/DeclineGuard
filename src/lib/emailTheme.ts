/**
 * Thin FE mirror of Riley’s public API (`convex/lib/emailTheme.ts` @ d87c049).
 * After that branch merges to `dev`, re-export from convex/lib/emailTheme.
 * Do not import Convex validators here.
 */

import {
  DEFAULT_EMAIL_FONT,
  normalizeEmailFont,
  type EmailFontId,
} from "./emailFonts";

export const STYLING_MODES = ["preset", "configured"] as const;
export type StylingMode = (typeof STYLING_MODES)[number];

export const QUIET_VERIFY_LAYOUT_ID = "quiet-verify";

export const LAYOUT_PRESET_IDS = [
  "quiet-verify",
  "soft-expire",
  "safe-pause",
  "soft-renew",
  "alert-expire",
] as const;

export type LayoutPresetId = (typeof LAYOUT_PRESET_IDS)[number];

export const DEFAULT_LAYOUT_PRESET_ID: LayoutPresetId = QUIET_VERIFY_LAYOUT_ID;
export const DEFAULT_STYLING_MODE: StylingMode = "preset";

/** MVP lifecycle emails — same layout via the single global layoutPresetId. */
export const LIFECYCLE_EMAIL_TYPES = [
  "verify",
  "decline_pause",
  "trial_ended",
  "renewal",
  "expiry",
] as const;

export type LifecycleEmailType = (typeof LIFECYCLE_EMAIL_TYPES)[number];

export const DEFAULT_LIFECYCLE_EMAIL_TYPE: LifecycleEmailType = "verify";

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

/** Quiet Verify — muted, trustworthy verify aesthetic (Riley catalog). */
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

function layoutTokens(
  partial: Omit<EmailThemeTokens, "fontFamilyRaw" | "emailFont"> & {
    emailFont?: EmailFontId;
  },
): EmailThemeTokens {
  return {
    ...partial,
    emailFont: partial.emailFont ?? "system",
    fontFamilyRaw: null,
  };
}

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
  "soft-expire": {
    id: "soft-expire",
    name: "Soft Expire",
    description: "What’s ending, then a calm restore.",
    tokens: layoutTokens({
      brandColor: "#111827",
      secondaryColor: "#6b7280",
      mutedTextColor: "#6b7280",
      linkColor: "#374151",
      pageBackgroundColor: "#f4f5f7",
      pageTextColor: "#111827",
      emailBackgroundColor: "#f4f5f7",
      emailTextColor: "#111827",
      ctaBackgroundColor: "#1f2937",
      ctaTextColor: "#f9fafb",
      ctaBorderRadiusPx: 10,
    }),
  },
  "safe-pause": {
    id: "safe-pause",
    name: "Safe Pause",
    description: "Paused — data stays, resume when ready.",
    tokens: layoutTokens({
      brandColor: "#2f3a2a",
      secondaryColor: "#6b7264",
      mutedTextColor: "#6b7264",
      linkColor: "#3f4a38",
      pageBackgroundColor: "#f6f7f4",
      pageTextColor: "#1a1f16",
      emailBackgroundColor: "#f6f7f4",
      emailTextColor: "#1a1f16",
      ctaBackgroundColor: "#2f3a2a",
      ctaTextColor: "#f7f8f5",
      ctaBorderRadiusPx: 12,
    }),
  },
  "soft-renew": {
    id: "soft-renew",
    name: "Soft Renew",
    description: "Upcoming renewal, what’s included.",
    tokens: layoutTokens({
      brandColor: "#3f3a33",
      secondaryColor: "#7c746a",
      mutedTextColor: "#7c746a",
      linkColor: "#4a433b",
      pageBackgroundColor: "#faf8f5",
      pageTextColor: "#1c1917",
      emailBackgroundColor: "#faf8f5",
      emailTextColor: "#1c1917",
      ctaBackgroundColor: "#3f3a33",
      ctaTextColor: "#faf8f5",
      ctaBorderRadiusPx: 8,
    }),
  },
  "alert-expire": {
    id: "alert-expire",
    name: "Alert Expire",
    description: "Accent bar, what happens next.",
    tokens: layoutTokens({
      brandColor: "#18181b",
      secondaryColor: "#71717a",
      mutedTextColor: "#71717a",
      linkColor: "#3f3f46",
      pageBackgroundColor: "#ffffff",
      pageTextColor: "#18181b",
      emailBackgroundColor: "#ffffff",
      emailTextColor: "#18181b",
      ctaBackgroundColor: "#18181b",
      ctaTextColor: "#fafafa",
      ctaBorderRadiusPx: 8,
    }),
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

export type RecoverySettingsLayoutFields = {
  stylingMode: StylingMode;
  layoutPresetId: string;
};

const LEGACY_LAYOUT_PRESET_IDS: Record<string, LayoutPresetId> = {
  quiet_verify: "quiet-verify",
  sonos: "quiet-verify",
  soft_expire: "soft-expire",
  avocode: "soft-expire",
  safe_pause: "safe-pause",
  benchmark: "safe-pause",
  soft_renew: "soft-renew",
  fontbase: "soft-renew",
  alert_expire: "alert-expire",
  "nordvpn-structure": "alert-expire",
  nordvpn: "alert-expire",
};

export function isStylingMode(value: unknown): value is StylingMode {
  return value === "preset" || value === "configured";
}

export function isLayoutPresetId(value: string): value is LayoutPresetId {
  return (LAYOUT_PRESET_IDS as readonly string[]).includes(value);
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
  const raw = value?.trim() ?? "";
  const id = LEGACY_LAYOUT_PRESET_IDS[raw] ?? raw;
  if (id && LAYOUT_PRESET_CATALOG[id]) return id;
  return QUIET_VERIFY_LAYOUT_ID;
}

export function resolveLayoutPresetId(id: string): LayoutPresetId {
  const normalized = normalizeLayoutPresetId(id);
  return isLayoutPresetId(normalized)
    ? normalized
    : DEFAULT_LAYOUT_PRESET_ID;
}

export function getLayoutPreset(layoutPresetId: string): LayoutPreset {
  const id = normalizeLayoutPresetId(layoutPresetId);
  return (
    LAYOUT_PRESET_CATALOG[id] ?? LAYOUT_PRESET_CATALOG[QUIET_VERIFY_LAYOUT_ID]!
  );
}

export function assertKnownLayoutPresetId(value: string): string {
  const id = normalizeLayoutPresetId(value);
  if (!LAYOUT_PRESET_CATALOG[id]) {
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

/** Infer mode for rows created before stylingMode existed. */
export function inferStylingMode(row: {
  stylingMode?: string | null;
  brandImportCompletedAt?: number | null;
}): StylingMode {
  if (isStylingMode(row.stylingMode)) return row.stylingMode;
  return row.brandImportCompletedAt != null ? "configured" : "preset";
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
