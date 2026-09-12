import { v } from "convex/values";

/** Email-safe font presets — keep in sync with src/lib/emailFonts.ts */

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

export function emailFontStack(fontId: EmailFontId): string {
  return EMAIL_FONTS[fontId].stack;
}

/**
 * Prefer the scraped homepage family name at the front of the email-safe stack.
 * Example: Inter → `'Inter', Helvetica, Arial, sans-serif` (via Inter preset).
 */
export function emailFontStackWithRaw(
  fontId: EmailFontId,
  fontFamilyRaw: string | null | undefined,
): string {
  const base = emailFontStack(fontId);
  if (!fontFamilyRaw?.trim()) return base;
  const first = fontFamilyRaw.split(",")[0]?.trim();
  if (!first) return base;
  const bare = first.replace(/['"]/g, "").toLowerCase();
  // Generics already covered by system stack — don't invent a custom face name
  if (
    bare === "sans" ||
    bare === "sans-serif" ||
    bare === "system-ui" ||
    bare === "-apple-system" ||
    bare === "blinkmacsystemfont" ||
    bare === "ui-sans-serif"
  ) {
    return base;
  }
  if (base.toLowerCase().includes(bare)) return base;
  const quoted =
    first.startsWith("'") || first.startsWith('"')
      ? first
      : `'${first.replace(/['"]/g, "")}'`;
  return `${quoted}, ${base}`;
}

export function emailFontHeadLinks(fontId: EmailFontId): string {
  const href = EMAIL_FONTS[fontId].googleHref;
  if (!href) return "";
  return `<link href="${href}" rel="stylesheet" />`;
}

export const emailFontValidator = v.union(
  v.literal("system"),
  v.literal("inter"),
  v.literal("georgia"),
  v.literal("dm-sans"),
  v.literal("merriweather"),
);
