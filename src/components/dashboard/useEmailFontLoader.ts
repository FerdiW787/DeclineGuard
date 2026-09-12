import { useEffect } from "react";
import { EMAIL_FONTS, type EmailFontId } from "@/lib/emailFonts";

/** Loads Google Fonts for email preview when a web font is selected. */
export function useEmailFontLoader(fontId: EmailFontId): void {
  useEffect(() => {
    const href = EMAIL_FONTS[fontId].googleHref;
    if (!href) return;

    const id = `dg-email-font-${fontId}`;
    if (document.getElementById(id)) return;

    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }, [fontId]);
}
