/**
 * FE email theme + recovery-layout catalog.
 *
 * Token / resolveTheme contract still mirrors Riley (`convex/lib/emailTheme.ts`).
 * `layoutPresetId` on the FE is a **recovery-layout template id** (structure),
 * not a lifecycle email type. Riley’s catalog currently only accepts
 * `quiet-verify` — map through `toBackendLayoutPresetId` before Convex writes.
 *
 * Recovery-layout id ↔ reference structure (visual only; no third-party brands):
 *   calm-verify       → 01-sonos-verify-your-email.png
 *   account-expired   → 02-nordvpn-your-account-has-expired.png
 *   trial-ended       → 03-avocode-trial-ended.png
 *   upcoming-renewal  → 04-fontbase-upcoming-renewal.png
 *   data-safe         → 05-benchmark-dont-worry-your-data-is-safe.png
 */

import {
  DEFAULT_EMAIL_FONT,
  normalizeEmailFont,
  type EmailFontId,
} from "./emailFonts";

export const STYLING_MODES = ["preset", "configured"] as const;
export type StylingMode = (typeof STYLING_MODES)[number];

/**
 * Only id Riley’s `assertKnownLayoutPresetId` accepts today.
 * Do not show this string as product language.
 */
export const BE_LAYOUT_PRESET_ID = "quiet-verify";

/** @deprecated BE-only id. Use CALM_VERIFY_LAYOUT_ID in product UI. */
export const QUIET_VERIFY_LAYOUT_ID = BE_LAYOUT_PRESET_ID;

export const CALM_VERIFY_LAYOUT_ID = "calm-verify";

export const LAYOUT_PRESET_IDS = [
  "calm-verify",
  "account-expired",
  "trial-ended",
  "upcoming-renewal",
  "data-safe",
] as const;

export type LayoutPresetId = (typeof LAYOUT_PRESET_IDS)[number];

export const DEFAULT_LAYOUT_PRESET_ID: LayoutPresetId = CALM_VERIFY_LAYOUT_ID;
export const DEFAULT_STYLING_MODE: StylingMode = "preset";

/**
 * Riley preview-query types — not a product email catalog.
 * Do not surface these as picker labels or preview switcher options.
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

/**
 * Visual tokens applied to recovery emails.
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

/** Default recovery-layout tokens (calm-verify / Sonos-structure). */
export const CALM_VERIFY_TOKENS: EmailThemeTokens = layoutTokens({
  brandColor: "#0c0c0c",
  secondaryColor: "#6b6b70",
  mutedTextColor: "#6b6b70",
  linkColor: "#0c0c0c",
  pageBackgroundColor: "#f4f4f4",
  pageTextColor: "#0c0c0c",
  emailBackgroundColor: "#ffffff",
  emailTextColor: "#0c0c0c",
  ctaBackgroundColor: "#0c0c0c",
  ctaTextColor: "#ffffff",
  ctaBorderRadiusPx: 999,
});

/** Alias for older FE imports — same tokens as calm-verify. */
export const QUIET_VERIFY_TOKENS = CALM_VERIFY_TOKENS;

export type LayoutPreset = {
  id: string;
  name: string;
  description: string;
  tokens: EmailThemeTokens;
};

export const LAYOUT_PRESET_CATALOG: Record<string, LayoutPreset> = {
  "calm-verify": {
    id: "calm-verify",
    name: "Calm verify",
    description: "Centered wordmark, hero, pill CTA.",
    tokens: CALM_VERIFY_TOKENS,
  },
  "account-expired": {
    id: "account-expired",
    name: "Account expired",
    description: "Header bar, dark hero, rounded CTA.",
    tokens: layoutTokens({
      brandColor: "#0c0c0c",
      secondaryColor: "#6b6b70",
      mutedTextColor: "#5c5c5c",
      linkColor: "#0c0c0c",
      pageBackgroundColor: "#f4f4f4",
      pageTextColor: "#0c0c0c",
      emailBackgroundColor: "#ffffff",
      emailTextColor: "#0c0c0c",
      ctaBackgroundColor: "#ff5a6a",
      ctaTextColor: "#ffffff",
      ctaBorderRadiusPx: 24,
    }),
  },
  "trial-ended": {
    id: "trial-ended",
    name: "Trial ended",
    description: "Centered icon, compact card, pill CTA.",
    tokens: layoutTokens({
      brandColor: "#2563eb",
      secondaryColor: "#6b7280",
      mutedTextColor: "#6b7280",
      linkColor: "#2563eb",
      pageBackgroundColor: "#f3f4f6",
      pageTextColor: "#111827",
      emailBackgroundColor: "#ffffff",
      emailTextColor: "#111827",
      ctaBackgroundColor: "#2563eb",
      ctaTextColor: "#ffffff",
      ctaBorderRadiusPx: 999,
    }),
  },
  "upcoming-renewal": {
    id: "upcoming-renewal",
    name: "Upcoming renewal",
    description: "Dark frame, date lockup, centered type.",
    tokens: layoutTokens({
      brandColor: "#0c0c0c",
      secondaryColor: "#6b6b70",
      mutedTextColor: "#52525b",
      linkColor: "#2563eb",
      pageBackgroundColor: "#111111",
      pageTextColor: "#fafafa",
      emailBackgroundColor: "#ffffff",
      emailTextColor: "#0c0c0c",
      ctaBackgroundColor: "#0c0c0c",
      ctaTextColor: "#ffffff",
      ctaBorderRadiusPx: 8,
    }),
  },
  "data-safe": {
    id: "data-safe",
    name: "Data safe",
    description: "Greeting, two help cards, P.S.",
    tokens: layoutTokens({
      brandColor: "#2563eb",
      secondaryColor: "#6b7280",
      mutedTextColor: "#52525b",
      linkColor: "#2563eb",
      pageBackgroundColor: "#ffffff",
      pageTextColor: "#0c0c0c",
      emailBackgroundColor: "#ffffff",
      emailTextColor: "#0c0c0c",
      ctaBackgroundColor: "#2563eb",
      ctaTextColor: "#ffffff",
      ctaBorderRadiusPx: 8,
    }),
  },
};

export const NEW_MERCHANT_THEME_DEFAULTS = {
  stylingMode: "preset" as const,
  layoutPresetId: DEFAULT_LAYOUT_PRESET_ID,
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

/**
 * Old FE catalog + snake_case drafts → recovery-layout ids.
 * `quiet-verify` is also the current BE write target.
 */
const LEGACY_LAYOUT_PRESET_IDS: Record<string, LayoutPresetId> = {
  "quiet-verify": "calm-verify",
  quiet_verify: "calm-verify",
  "soft-expire": "account-expired",
  soft_expire: "account-expired",
  "safe-pause": "data-safe",
  safe_pause: "data-safe",
  "soft-renew": "upcoming-renewal",
  soft_renew: "upcoming-renewal",
  "alert-expire": "trial-ended",
  alert_expire: "trial-ended",
};

/** Persist any FE recovery-layout id as the only BE-known catalog id. */
export function toBackendLayoutPresetId(
  _layoutPresetId: string | null | undefined,
): string {
  return BE_LAYOUT_PRESET_ID;
}

/**
 * Read a BE/local id into a FE recovery-layout id.
 * When BE returns only `quiet-verify`, keep a valid local FE selection.
 */
export function fromBackendLayoutPresetId(
  backendId: string | null | undefined,
  localFeId?: string | null,
): LayoutPresetId {
  const local = localFeId ? resolveLayoutPresetId(localFeId) : null;
  const raw = backendId?.trim() ?? "";
  if (!raw || raw === BE_LAYOUT_PRESET_ID || raw === "quiet-verify") {
    return local ?? DEFAULT_LAYOUT_PRESET_ID;
  }
  return resolveLayoutPresetId(raw);
}

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
  return DEFAULT_LAYOUT_PRESET_ID;
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
    LAYOUT_PRESET_CATALOG[id] ?? LAYOUT_PRESET_CATALOG[DEFAULT_LAYOUT_PRESET_ID]!
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
