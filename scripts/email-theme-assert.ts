/**
 * P1: legacy rows without stylingMode must stay on configured BrandKit.
 * Run: npx tsx scripts/email-theme-assert.ts
 */
import { resolveThemeFromSettings } from "../convex/lib/emailTheme";

const theme = resolveThemeFromSettings({
  brandColor: "#112233",
  stylingMode: undefined,
  brandImportCompletedAt: null,
});

if (theme.stylingMode !== "configured") {
  throw new Error(
    `P1 FAIL: expected stylingMode configured, got ${theme.stylingMode}`,
  );
}
if (theme.tokens.brandColor !== "#112233") {
  throw new Error(
    `P1 FAIL: expected brandColor #112233, got ${theme.tokens.brandColor}`,
  );
}

console.log(
  "P1 assert green: unset stylingMode + no brand import → configured",
  theme.tokens.brandColor,
);
