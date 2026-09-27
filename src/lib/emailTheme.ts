import type { EmailFontId } from "./emailFonts";
import type { EmailThemeTokens } from "./emailLayoutContract";

export {
  PRESET_THEMES,
  resolveLayoutPresetId,
  resolveTheme,
  type EmailThemeTokens,
  type ResolveThemeInput,
} from "./emailLayoutContract";

/** Map existing settings / BrandKit fields into configured tokens. */
export function configuredTokensFromSettings(input: {
  brandColor?: string | null;
  secondaryColor?: string | null;
  mutedTextColor?: string | null;
  emailBackgroundColor?: string | null;
  emailTextColor?: string | null;
  pageBackgroundColor?: string | null;
  pageTextColor?: string | null;
  linkColor?: string | null;
  ctaBackgroundColor?: string | null;
  ctaTextColor?: string | null;
  ctaBorderRadiusPx?: number | null;
  emailFont?: EmailFontId | null;
  logoUrl?: string | null;
}): Partial<EmailThemeTokens> {
  const brand = input.brandColor?.trim() || undefined;
  const pageBg =
    input.pageBackgroundColor?.trim() ||
    input.emailBackgroundColor?.trim() ||
    undefined;
  const pageText =
    input.pageTextColor?.trim() || input.emailTextColor?.trim() || undefined;
  return {
    brandColor: brand,
    secondaryColor: input.secondaryColor?.trim() || undefined,
    emailBackgroundColor: input.emailBackgroundColor?.trim() || pageBg,
    emailTextColor: input.emailTextColor?.trim() || pageText,
    pageBackgroundColor: pageBg,
    pageTextColor: pageText,
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
    emailFont: input.emailFont ?? undefined,
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
