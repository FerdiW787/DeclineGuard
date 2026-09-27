/**
 * Riley email-layout contract (FE scaffold).
 *
 * When Convex tips the same names, switch call sites to
 * `convex/lib/emailLayoutContract` (or the shared path Riley lands).
 * Do not invent schema here — recoverySettings persist is additive on Riley’s side:
 *   stylingMode: "preset" | "configured"
 *   layoutPresetId: string (default "quiet-verify")
 */

import type { EmailFontId } from "./emailFonts";

export const LAYOUT_PRESET_IDS = [
  "quiet-verify",
  "soft-expire",
  "safe-pause",
  "soft-renew",
  "alert-expire",
] as const;

export type LayoutPresetId = (typeof LAYOUT_PRESET_IDS)[number];

export const DEFAULT_LAYOUT_PRESET_ID: LayoutPresetId = "quiet-verify";

export type StylingMode = "preset" | "configured";

export const DEFAULT_STYLING_MODE: StylingMode = "preset";

/** Additive fields Riley will store on recoverySettings. */
export type RecoverySettingsLayoutFields = {
  stylingMode: StylingMode;
  layoutPresetId: LayoutPresetId;
};

/**
 * Resolved tokens for render. Configured source is BrandKit / crawler
 * (Lemon storefront URL). Optional fields match recoverySettings.
 */
export type EmailThemeTokens = {
  brandColor: string;
  secondaryColor?: string;
  emailBackgroundColor: string;
  emailTextColor: string;
  pageBackgroundColor?: string;
  pageTextColor?: string;
  mutedTextColor: string;
  linkColor: string;
  ctaBackgroundColor: string;
  ctaTextColor: string;
  ctaBorderRadiusPx: number;
  emailFont?: EmailFontId;
  /** Merchant-owned mark only — never a third-party logo. */
  logoUrl?: string | null;
};

export type ResolveThemeInput = {
  stylingMode: StylingMode;
  layoutPresetId: string;
  configured?: Partial<EmailThemeTokens> | null;
};

/** Snake_case IDs from the first FE scaffold — coerce to Riley kebab-case. */
const LEGACY_LAYOUT_PRESET_IDS: Record<string, LayoutPresetId> = {
  quiet_verify: "quiet-verify",
  soft_expire: "soft-expire",
  safe_pause: "safe-pause",
  soft_renew: "soft-renew",
  alert_expire: "alert-expire",
};

export function isLayoutPresetId(value: string): value is LayoutPresetId {
  return (LAYOUT_PRESET_IDS as readonly string[]).includes(value);
}

export function isStylingMode(value: string): value is StylingMode {
  return value === "preset" || value === "configured";
}

export function resolveLayoutPresetId(id: string): LayoutPresetId {
  if (isLayoutPresetId(id)) return id;
  const mapped = LEGACY_LAYOUT_PRESET_IDS[id];
  if (mapped) return mapped;
  return DEFAULT_LAYOUT_PRESET_ID;
}

function hexOr(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? "";
  if (/^#([0-9a-fA-F]{6})$/.test(trimmed)) return trimmed;
  return fallback;
}

function radiusOr(value: number | null | undefined, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(9999, value));
}

/** DeclineGuard theme per catalog layout (`stylingMode: "preset"`). */
export const PRESET_THEMES: Record<LayoutPresetId, EmailThemeTokens> = {
  "quiet-verify": {
    brandColor: "#1c1917",
    secondaryColor: "#78716c",
    emailBackgroundColor: "#f7f6f3",
    emailTextColor: "#1c1917",
    mutedTextColor: "#78716c",
    linkColor: "#44403c",
    ctaBackgroundColor: "#1c1917",
    ctaTextColor: "#fafaf9",
    ctaBorderRadiusPx: 999,
    logoUrl: null,
  },
  "soft-expire": {
    brandColor: "#111827",
    secondaryColor: "#6b7280",
    emailBackgroundColor: "#f4f5f7",
    emailTextColor: "#111827",
    mutedTextColor: "#6b7280",
    linkColor: "#374151",
    ctaBackgroundColor: "#1f2937",
    ctaTextColor: "#f9fafb",
    ctaBorderRadiusPx: 10,
    logoUrl: null,
  },
  "safe-pause": {
    brandColor: "#2f3a2a",
    secondaryColor: "#6b7264",
    emailBackgroundColor: "#f6f7f4",
    emailTextColor: "#1a1f16",
    mutedTextColor: "#6b7264",
    linkColor: "#3f4a38",
    ctaBackgroundColor: "#2f3a2a",
    ctaTextColor: "#f7f8f5",
    ctaBorderRadiusPx: 12,
    logoUrl: null,
  },
  "soft-renew": {
    brandColor: "#3f3a33",
    secondaryColor: "#7c746a",
    emailBackgroundColor: "#faf8f5",
    emailTextColor: "#1c1917",
    mutedTextColor: "#7c746a",
    linkColor: "#4a433b",
    ctaBackgroundColor: "#3f3a33",
    ctaTextColor: "#faf8f5",
    ctaBorderRadiusPx: 8,
    logoUrl: null,
  },
  "alert-expire": {
    brandColor: "#18181b",
    secondaryColor: "#71717a",
    emailBackgroundColor: "#ffffff",
    emailTextColor: "#18181b",
    mutedTextColor: "#71717a",
    linkColor: "#3f3f46",
    ctaBackgroundColor: "#18181b",
    ctaTextColor: "#fafafa",
    ctaBorderRadiusPx: 8,
    logoUrl: null,
  },
};

/**
 * Toggle only swaps the theme *source*. Layout stays.
 * - preset: catalog tokens for layoutPresetId (ignore configured shell/CTA colors)
 * - configured: merchant BrandKit / crawler tokens; layoutPresetId still picks structure
 */
export function resolveTheme(input: ResolveThemeInput): EmailThemeTokens {
  const layoutId = resolveLayoutPresetId(input.layoutPresetId);
  const preset = PRESET_THEMES[layoutId];
  const configured = input.configured ?? {};
  const logoUrl = configured.logoUrl?.trim() || null;
  const emailFont = configured.emailFont ?? preset.emailFont;

  if (input.stylingMode === "preset") {
    return {
      ...preset,
      logoUrl,
      emailFont,
    };
  }

  const pageBg = hexOr(
    configured.pageBackgroundColor,
    hexOr(configured.emailBackgroundColor, preset.emailBackgroundColor),
  );
  const pageText = hexOr(
    configured.pageTextColor,
    hexOr(configured.emailTextColor, preset.emailTextColor),
  );
  const muted = hexOr(
    configured.mutedTextColor,
    hexOr(configured.secondaryColor, preset.mutedTextColor),
  );

  return {
    brandColor: hexOr(configured.brandColor, preset.brandColor),
    secondaryColor: hexOr(configured.secondaryColor, muted),
    emailBackgroundColor: hexOr(configured.emailBackgroundColor, pageBg),
    emailTextColor: hexOr(configured.emailTextColor, pageText),
    pageBackgroundColor: pageBg,
    pageTextColor: pageText,
    mutedTextColor: muted,
    linkColor: hexOr(configured.linkColor, preset.linkColor),
    ctaBackgroundColor: hexOr(
      configured.ctaBackgroundColor,
      preset.ctaBackgroundColor,
    ),
    ctaTextColor: hexOr(configured.ctaTextColor, preset.ctaTextColor),
    ctaBorderRadiusPx: radiusOr(
      configured.ctaBorderRadiusPx,
      preset.ctaBorderRadiusPx,
    ),
    emailFont,
    logoUrl,
  };
}
