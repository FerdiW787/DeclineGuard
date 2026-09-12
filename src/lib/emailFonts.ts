/** Email font presets — keep in sync with convex/lib/emailFonts.ts */

export const EMAIL_FONT_IDS = [
  "system",
  "inter",
  "georgia",
  "dm-sans",
  "merriweather",
] as const;

export type EmailFontId = (typeof EMAIL_FONT_IDS)[number];

export const DEFAULT_EMAIL_FONT: EmailFontId = "system";

type FontSpec = {
  label: string;
  stack: string;
  googleHref?: string;
};

export const EMAIL_FONTS: Record<EmailFontId, FontSpec> = {
  system: {
    label: "System",
    stack:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  },
  inter: {
    label: "Inter",
    stack:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    googleHref:
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap",
  },
  georgia: {
    label: "Georgia",
    stack: "Georgia, 'Times New Roman', Times, serif",
  },
  "dm-sans": {
    label: "DM Sans",
    stack:
      "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    googleHref:
      "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap",
  },
  merriweather: {
    label: "Merriweather",
    stack: "'Merriweather', Georgia, 'Times New Roman', serif",
    googleHref:
      "https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap",
  },
};

export function normalizeEmailFont(
  value: string | undefined | null,
): EmailFontId {
  if (value && value in EMAIL_FONTS) {
    return value as EmailFontId;
  }
  return DEFAULT_EMAIL_FONT;
}

export function emailFontFamily(fontId: EmailFontId): string {
  return EMAIL_FONTS[fontId].stack;
}

export const EMAIL_FONT_OPTIONS = EMAIL_FONT_IDS.map((id) => ({
  id,
  label: EMAIL_FONTS[id].label,
}));
