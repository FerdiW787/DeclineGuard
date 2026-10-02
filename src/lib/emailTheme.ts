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
export const SONOS_LAYOUT_ID = "sonos";

/**
 * Starter block kits — structure only.
 * First five match the RGE refs. Five more are FE structural variants.
 * Legacy quiet-verify → sonos. Default remains sonos.
 *
 * FE catalog is 10. Riley BE `LAYOUT_PRESET_IDS` / recoveryBlockKits
 * currently accept the first five only. New ids stay on the local draft
 * until Convex validators catch up — do not remap on hydrate.
 *
 * FE+BE parity target (comment only; do not invent a BE palette here):
 *   sonos | avocode | benchmark | fontbase | nordvpn-structure
 *   invoice-stack | checklist-card | split-banner | step-rail | tight-notice
 */
export const LAYOUT_PRESET_IDS = [
  "sonos",
  "avocode",
  "benchmark",
  "fontbase",
  "nordvpn-structure",
  "invoice-stack",
  "checklist-card",
  "split-banner",
  "step-rail",
  "tight-notice",
] as const;

/** IDs Riley BE is expected to accept today. New FE kits persist locally. */
export const BE_LAYOUT_PRESET_IDS = [
  "sonos",
  "avocode",
  "benchmark",
  "fontbase",
  "nordvpn-structure",
] as const;

export type LayoutPresetId = (typeof LAYOUT_PRESET_IDS)[number];

export const DEFAULT_LAYOUT_PRESET_ID: LayoutPresetId = SONOS_LAYOUT_ID;
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

/** Sonos verify — black/white, super-pill CTA (RGE: verify-your-email-sonos). */
export const SONOS_TOKENS: EmailThemeTokens = {
  brandColor: "#000000",
  secondaryColor: "#6b6b6b",
  mutedTextColor: "#6b6b6b",
  linkColor: "#000000",
  pageBackgroundColor: "#ffffff",
  pageTextColor: "#000000",
  emailBackgroundColor: "#ffffff",
  emailTextColor: "#000000",
  ctaBackgroundColor: "#c8ff00",
  ctaTextColor: "#000000",
  ctaBorderRadiusPx: 9999,
  emailFont: "system",
  fontFamilyRaw: null,
};

/** @deprecated Use SONOS_TOKENS. Kept for Riley catalog mirrors. */
export const QUIET_VERIFY_TOKENS: EmailThemeTokens = SONOS_TOKENS;

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
  sonos: {
    id: "sonos",
    name: "Sonos",
    description: "Centered verify — logo, headline, pill CTA.",
    tokens: SONOS_TOKENS,
  },
  avocode: {
    id: "avocode",
    name: "Avocode",
    description: "Left-aligned trial-ended stack.",
    tokens: layoutTokens({
      brandColor: "#2b6cff",
      secondaryColor: "#6b7280",
      mutedTextColor: "#6b7280",
      linkColor: "#2b6cff",
      pageBackgroundColor: "#ffffff",
      pageTextColor: "#111827",
      emailBackgroundColor: "#ffffff",
      emailTextColor: "#111827",
      ctaBackgroundColor: "#2b6cff",
      ctaTextColor: "#ffffff",
      ctaBorderRadiusPx: 6,
    }),
  },
  benchmark: {
    id: "benchmark",
    name: "Benchmark",
    description: "Reassuring pause — your data is safe.",
    tokens: layoutTokens({
      brandColor: "#1f7a4d",
      secondaryColor: "#5c6b61",
      mutedTextColor: "#5c6b61",
      linkColor: "#1f7a4d",
      pageBackgroundColor: "#f7faf7",
      pageTextColor: "#173322",
      emailBackgroundColor: "#f7faf7",
      emailTextColor: "#173322",
      ctaBackgroundColor: "#1f7a4d",
      ctaTextColor: "#f7faf7",
      ctaBorderRadiusPx: 8,
    }),
  },
  fontbase: {
    id: "fontbase",
    name: "FontBase",
    description: "Editorial upcoming renewal.",
    tokens: layoutTokens({
      brandColor: "#111111",
      secondaryColor: "#6b6b6b",
      mutedTextColor: "#6b6b6b",
      linkColor: "#111111",
      pageBackgroundColor: "#fafafa",
      pageTextColor: "#111111",
      emailBackgroundColor: "#fafafa",
      emailTextColor: "#111111",
      ctaBackgroundColor: "#111111",
      ctaTextColor: "#fafafa",
      ctaBorderRadiusPx: 4,
    }),
  },
  "nordvpn-structure": {
    id: "nordvpn-structure",
    name: "NordVPN",
    description: "Expired account — accent frame, next step.",
    tokens: layoutTokens({
      brandColor: "#4687ff",
      secondaryColor: "#5b6475",
      mutedTextColor: "#5b6475",
      linkColor: "#4687ff",
      pageBackgroundColor: "#ffffff",
      pageTextColor: "#0e1a33",
      emailBackgroundColor: "#ffffff",
      emailTextColor: "#0e1a33",
      ctaBackgroundColor: "#4687ff",
      ctaTextColor: "#ffffff",
      ctaBorderRadiusPx: 8,
    }),
  },
  // Structure-only kits. Catalog tokens reuse Sonos so we never invent a
  // parallel brand palette. Configured/scrape BrandKit tokens win via
  // resolveTheme({ stylingMode: "configured" }).
  "invoice-stack": {
    id: "invoice-stack",
    name: "Invoice stack",
    description: "Receipt meta first — amount, then copy.",
    tokens: SONOS_TOKENS,
  },
  "checklist-card": {
    id: "checklist-card",
    name: "Checklist card",
    description: "Rounded card — greeting, then checklist.",
    tokens: SONOS_TOKENS,
  },
  "split-banner": {
    id: "split-banner",
    name: "Split banner",
    description: "Right-aligned — headline, then eyebrow.",
    tokens: SONOS_TOKENS,
  },
  "step-rail": {
    id: "step-rail",
    name: "Step rail",
    description: "Numbered path first, then the ask.",
    tokens: SONOS_TOKENS,
  },
  "tight-notice": {
    id: "tight-notice",
    name: "Tight notice",
    description: "Compact bands — CTA, then a reassurance row.",
    tokens: SONOS_TOKENS,
  },
};

export const NEW_MERCHANT_THEME_DEFAULTS = {
  stylingMode: "preset" as const,
  layoutPresetId: SONOS_LAYOUT_ID,
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
  "quiet-verify": "sonos",
  quiet_verify: "sonos",
  "soft-expire": "avocode",
  soft_expire: "avocode",
  "safe-pause": "benchmark",
  safe_pause: "benchmark",
  "soft-renew": "fontbase",
  soft_renew: "fontbase",
  "alert-expire": "nordvpn-structure",
  alert_expire: "nordvpn-structure",
  nordvpn: "nordvpn-structure",
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
  return SONOS_LAYOUT_ID;
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
    LAYOUT_PRESET_CATALOG[id] ?? LAYOUT_PRESET_CATALOG[SONOS_LAYOUT_ID]!
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
