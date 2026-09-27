import {
  DEFAULT_LAYOUT_PRESET_ID,
  isLayoutPresetId,
  type LayoutPresetId,
  type StylingMode,
} from "./emailLayoutPresets";

/**
 * Shared theme tokens for Customizations / onboarding preview
 * (and ready for the send path once Riley’s contract is live).
 * Aligns with BrandKit + recoverySettings — not a parallel token set.
 */
export type EmailThemeTokens = {
  brandColor: string;
  emailBackgroundColor: string;
  emailTextColor: string;
  mutedTextColor: string;
  linkColor: string;
  ctaBackgroundColor: string;
  ctaTextColor: string;
  ctaBorderRadiusPx: number;
  brandDomain: string | null;
  logoUrl: string | null;
};

/** DeclineGuard theme per catalog layout (`stylingMode: "preset"`). */
export const PRESET_THEMES: Record<LayoutPresetId, EmailThemeTokens> = {
  quiet_verify: {
    brandColor: "#1c1917",
    emailBackgroundColor: "#f7f6f3",
    emailTextColor: "#1c1917",
    mutedTextColor: "#78716c",
    linkColor: "#44403c",
    ctaBackgroundColor: "#1c1917",
    ctaTextColor: "#fafaf9",
    ctaBorderRadiusPx: 999,
    brandDomain: null,
    logoUrl: null,
  },
  soft_expire: {
    brandColor: "#111827",
    emailBackgroundColor: "#f4f5f7",
    emailTextColor: "#111827",
    mutedTextColor: "#6b7280",
    linkColor: "#374151",
    ctaBackgroundColor: "#1f2937",
    ctaTextColor: "#f9fafb",
    ctaBorderRadiusPx: 10,
    brandDomain: null,
    logoUrl: null,
  },
  safe_pause: {
    brandColor: "#2f3a2a",
    emailBackgroundColor: "#f6f7f4",
    emailTextColor: "#1a1f16",
    mutedTextColor: "#6b7264",
    linkColor: "#3f4a38",
    ctaBackgroundColor: "#2f3a2a",
    ctaTextColor: "#f7f8f5",
    ctaBorderRadiusPx: 12,
    brandDomain: null,
    logoUrl: null,
  },
  soft_renew: {
    brandColor: "#3f3a33",
    emailBackgroundColor: "#faf8f5",
    emailTextColor: "#1c1917",
    mutedTextColor: "#7c746a",
    linkColor: "#4a433b",
    ctaBackgroundColor: "#3f3a33",
    ctaTextColor: "#faf8f5",
    ctaBorderRadiusPx: 8,
    brandDomain: null,
    logoUrl: null,
  },
  alert_expire: {
    brandColor: "#18181b",
    emailBackgroundColor: "#ffffff",
    emailTextColor: "#18181b",
    mutedTextColor: "#71717a",
    linkColor: "#3f3f46",
    ctaBackgroundColor: "#18181b",
    ctaTextColor: "#fafafa",
    ctaBorderRadiusPx: 8,
    brandDomain: null,
    logoUrl: null,
  },
};

export type ResolveThemeInput = {
  stylingMode: StylingMode;
  layoutPresetId: string;
  configured?: Partial<EmailThemeTokens> | null;
};

function hexOr(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? "";
  if (/^#([0-9a-fA-F]{6})$/.test(trimmed)) return trimmed;
  return fallback;
}

function radiusOr(
  value: number | null | undefined,
  fallback: number,
): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(9999, value));
}

export function resolveLayoutPresetId(id: string): LayoutPresetId {
  return isLayoutPresetId(id) ? id : DEFAULT_LAYOUT_PRESET_ID;
}

/**
 * Toggle only swaps the theme *source*. Layout stays.
 * Preset = DeclineGuard theme for that layout.
 * Configured = merchant brand tokens (Riley crawler / Lemon storefront).
 */
export function resolveTheme(input: ResolveThemeInput): EmailThemeTokens {
  const layoutId = resolveLayoutPresetId(input.layoutPresetId);
  const preset = PRESET_THEMES[layoutId];
  const configured = input.configured ?? {};
  const logoUrl = configured.logoUrl?.trim() || null;
  const brandDomain = configured.brandDomain?.trim() || null;

  if (input.stylingMode === "preset") {
    return {
      ...preset,
      logoUrl,
      brandDomain,
    };
  }

  return {
    brandColor: hexOr(configured.brandColor, preset.brandColor),
    emailBackgroundColor: hexOr(
      configured.emailBackgroundColor,
      preset.emailBackgroundColor,
    ),
    emailTextColor: hexOr(configured.emailTextColor, preset.emailTextColor),
    mutedTextColor: hexOr(configured.mutedTextColor, preset.mutedTextColor),
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
    brandDomain,
    logoUrl,
  };
}

/** Map existing settings / BrandKit fields into configured tokens. */
export function configuredTokensFromSettings(input: {
  brandColor?: string | null;
  secondaryColor?: string | null;
  mutedTextColor?: string | null;
  emailBackgroundColor?: string | null;
  emailTextColor?: string | null;
  linkColor?: string | null;
  ctaBackgroundColor?: string | null;
  ctaTextColor?: string | null;
  ctaBorderRadiusPx?: number | null;
  brandDomain?: string | null;
  logoUrl?: string | null;
}): Partial<EmailThemeTokens> {
  const brand = input.brandColor?.trim() || undefined;
  return {
    brandColor: brand,
    emailBackgroundColor: input.emailBackgroundColor?.trim() || undefined,
    emailTextColor: input.emailTextColor?.trim() || undefined,
    mutedTextColor:
      input.mutedTextColor?.trim() ||
      input.secondaryColor?.trim() ||
      undefined,
    linkColor: input.linkColor?.trim() || brand,
    ctaBackgroundColor: input.ctaBackgroundColor?.trim() || brand,
    ctaTextColor: input.ctaTextColor?.trim() || undefined,
    ctaBorderRadiusPx:
      typeof input.ctaBorderRadiusPx === "number"
        ? input.ctaBorderRadiusPx
        : undefined,
    brandDomain: input.brandDomain?.trim() || null,
    logoUrl: input.logoUrl?.trim() || null,
  };
}

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
