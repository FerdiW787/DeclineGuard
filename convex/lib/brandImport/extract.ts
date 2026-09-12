import * as cheerio from "cheerio";
import type { EmailFontId } from "../emailFonts";
import {
  detectPageTheme,
  emailShellFromTheme,
  ensureCtaContrast,
  ensureShellContrastForCta,
  extractButtonStyle,
  type ScrapedButtonStyle,
} from "./buttons";
import {
  collectWeightedBrandColors,
  contrastTextOn,
  ensureCtaLabelContrast,
  ensureShellTextHierarchy,
  fallbackHtmlAccentColors,
  isGrayish,
  isNearWhiteOrBlack,
  luminance,
  normalizeHexColor,
  pickPrimaryColor,
  pickSecondaryColor,
  type WeightedColor,
} from "./colors";
import {
  fetchHomepageHtml,
  fetchStylesheets,
  normalizeDomainInput,
} from "./domain";
import type { BrowserCapturedKit } from "./browserCapture";

export type ScrapedBrandSignals = {
  themeColor: string | null;
  ogSiteName: string | null;
  ogImage: string | null;
  favicon: string | null;
  fontFamily: string | null;
  /** Weighted brand color signals (not a raw hex dump) */
  weightedColors: WeightedColor[];
  cssTexts: string[];
  html: string;
  buttonStyle: ScrapedButtonStyle;
  emailBackgroundColor: string;
  emailTextColor: string;
  pageIsDark: boolean;
  tierUsed: "tier1" | "tier2";
  confidence: number;
};

export type BrandImportTokens = {
  brandColor: string;
  secondaryColor: string;
  mutedTextColor: string;
  linkColor: string;
  pageBackgroundColor: string;
  pageTextColor: string;
  emailFont: EmailFontId;
  fontFamilyRaw: string | null;
  fromName: string;
  ctaBackgroundColor: string;
  ctaTextColor: string;
  ctaBorderRadiusPx: number;
  ctaShape: "pill" | "rounded" | "square";
  emailBackgroundColor: string;
  emailTextColor: string;
  confidence: number;
  tierUsed: "tier1" | "tier2" | "browser";
  captureMethod: "browser" | "css" | "defaults";
  sources: {
    logo: "lemon_squeezy" | "og_image" | "favicon" | "none";
    name: "lemon_squeezy" | "og_site" | "domain";
    colors: "domain_scrape" | "defaults";
    font: "domain_scrape" | "default";
    button: "homepage_cta" | "fallback";
  };
};

/**
 * Map site fonts → our email-safe presets.
 * Only the *first* family counts — never match Inter buried in a system stack.
 */
export function mapFontFamily(family: string | null): EmailFontId {
  if (!family) return "system";
  const f = family.toLowerCase().replace(/["']/g, "");
  const parts = f.split(",").map((p) => p.trim()).filter(Boolean);
  const first = parts[0] ?? "";

  // Generics / OS stacks → system (never Inter)
  if (
    first === "sans" ||
    first === "sans-serif" ||
    first === "system-ui" ||
    first === "-apple-system" ||
    first === "blinkmacsystemfont" ||
    first === "ui-sans-serif" ||
    first === "helvetica" ||
    first === "arial" ||
    first === "segoe ui" ||
    first === "roboto" ||
    first === "oxygen" ||
    first === "ubuntu" ||
    first === "cantarell" ||
    first === "fira sans" ||
    first === "droid sans" ||
    first === "helvetica neue" ||
    first.startsWith("var(")
  ) {
    return "system";
  }

  // Inter only when it is the primary face — not buried after system-ui/sans
  const interPrimary =
    first === "inter" ||
    first === "interdisplay" ||
    first.startsWith("inter ") ||
    first.startsWith("__inter") ||
    /^inter[_-]/.test(first);
  if (interPrimary) {
    return "inter";
  }
  if (first === "dm sans" || first === "dm-sans") return "dm-sans";
  if (first === "merriweather") return "merriweather";
  if (
    first === "georgia" ||
    first === "serif" ||
    first === "times" ||
    first === "times new roman" ||
    first === "ui-serif"
  ) {
    return "georgia";
  }

  return "system";
}

function metaContent($: cheerio.CheerioAPI, keys: string[]): string | null {
  for (const key of keys) {
    const el =
      $(`meta[name="${key}"]`).attr("content") ??
      $(`meta[property="${key}"]`).attr("content");
    if (el?.trim()) return el.trim();
  }
  return null;
}

function extractFontHints(
  $: cheerio.CheerioAPI,
  html: string,
  cssTexts: string[],
): string | null {
  // Prefer what body/html actually use — not a Google Font loaded for a widget.
  const bodyStyle = $("body").attr("style") ?? "";
  const htmlStyle = $("html").attr("style") ?? "";
  const inlineBody =
    bodyStyle.match(/font-family:\s*([^;]+)/i)?.[1]?.trim() ??
    htmlStyle.match(/font-family:\s*([^;]+)/i)?.[1]?.trim();
  if (inlineBody && !inlineBody.startsWith("var(")) return inlineBody;

  const cssBlob = cssTexts.join("\n");
  const bodyRule = cssBlob.match(
    /(?:^|})\s*(?:html|body|:root)\s*\{[^}]*font-family:\s*([^;}{]+)/i,
  )?.[1]?.trim();
  if (bodyRule && !bodyRule.startsWith("var(")) return bodyRule;

  // Google Fonts — skip Inter unless document CSS also uses it (common false positive)
  const googleHref =
    $('link[href*="fonts.googleapis.com"]').attr("href") ??
    html.match(/fonts\.googleapis\.com\/css2?\?[^"'>\s]+/i)?.[0];
  if (googleHref) {
    try {
      const href = googleHref.startsWith("//")
        ? `https:${googleHref}`
        : googleHref.startsWith("http")
          ? googleHref
          : `https://${googleHref}`;
      const url = new URL(href);
      const familyParam =
        url.searchParams.getAll("family")[0] ??
        url.searchParams.get("family");
      const name = decodeURIComponent((familyParam ?? "").split(":")[0] ?? "")
        .replace(/\+/g, " ")
        .trim();
      if (name) {
        const isInter = /^inter\b/i.test(name);
        const bodyUsesInter = /font-family\s*:[^;{}]*\binter\b/i.test(cssBlob);
        if (!isInter || bodyUsesInter) return name;
      }
    } catch {
      // fall through
    }
  }

  return null;
}

function extractTier1(
  html: string,
  pageUrl: string,
): {
  themeColor: string | null;
  ogSiteName: string | null;
  ogImage: string | null;
  favicon: string | null;
  fontFamily: string | null;
  inlineCss: string;
  stylesheetHrefs: string[];
} {
  const $ = cheerio.load(html);
  const themeColor = normalizeHexColor(metaContent($, ["theme-color"]));
  const ogSiteName = metaContent($, ["og:site_name", "og:title"]);
  const ogImage = metaContent($, ["og:image", "twitter:image"]);

  let favicon: string | null = null;
  const iconHref =
    $('link[rel="icon"]').attr("href") ??
    $('link[rel="shortcut icon"]').attr("href") ??
    $('link[rel="apple-touch-icon"]').attr("href");
  if (iconHref) {
    try {
      favicon = new URL(iconHref, pageUrl).toString();
    } catch {
      favicon = null;
    }
  }

  const inlineCss = $("style")
    .toArray()
    .map((el) => $(el).html() ?? "")
    .join("\n");

  const stylesheetHrefs = $('link[rel="stylesheet"]')
    .toArray()
    .map((el) => $(el).attr("href"))
    .filter((h): h is string => typeof h === "string" && h.length > 0)
    // Skip pure Google Fonts CSS for color extraction (fonts handled separately)
    .filter((h) => !h.includes("fonts.googleapis.com"));

  const fontFamily = extractFontHints($, html, [inlineCss]);

  return {
    themeColor,
    ogSiteName,
    ogImage,
    favicon,
    fontFamily: fontFamily || null,
    inlineCss,
    stylesheetHrefs,
  };
}

function scoreSignals(args: {
  themeColor: string | null;
  fontFamily: string | null;
  ogImage: string | null;
  ogSiteName: string | null;
  weightedColors: WeightedColor[];
  hasCss: boolean;
}): number {
  let score = 0;
  if (args.themeColor) score += 20;
  if (args.fontFamily) score += 15;
  if (args.ogImage) score += 8;
  if (args.ogSiteName) score += 8;
  if (args.hasCss) score += 20;
  const bestWeight = Math.max(0, ...args.weightedColors.map((w) => w.weight));
  if (bestWeight >= 90) score += 35;
  else if (bestWeight >= 60) score += 25;
  else if (bestWeight >= 40) score += 15;
  else if (args.weightedColors.length > 0) score += 5;
  return Math.min(score, 100);
}

export async function scrapeDomainBrand(
  domainInput: string,
): Promise<ScrapedBrandSignals> {
  const domain = normalizeDomainInput(domainInput);
  const page = await fetchHomepageHtml(domain);
  if (!page) {
    throw new Error("Could not fetch homepage");
  }

  const base = extractTier1(page.html, page.finalUrl);

  // First pass from inline CSS / theme-color / HTML accents
  let cssTexts = [base.inlineCss].filter((t) => t.trim().length > 0);
  let weightedColors = [
    ...collectWeightedBrandColors({
      themeColor: base.themeColor,
      cssTexts,
      htmlSnippet: page.html.slice(0, 80_000),
    }),
    ...fallbackHtmlAccentColors(page.html),
  ];

  const bestWeight = Math.max(0, ...weightedColors.map((w) => w.weight));
  const isNextApp = base.stylesheetHrefs.some((h) =>
    h.includes("/_next/static"),
  );
  // Webflow (Lemon Squeezy etc.) keeps button tokens in one CDN stylesheet
  const isWebflow = base.stylesheetHrefs.some(
    (h) =>
      h.includes("website-files.com") ||
      h.includes("webflow.com") ||
      h.includes("webflow.io"),
  );
  const sameOriginCss = base.stylesheetHrefs.filter((h) => {
    const lower = h.toLowerCase();
    if (lower.includes("fonts.googleapis") || lower.includes("fonts.gstatic")) {
      return false;
    }
    // Skip huge third-party kits that often hang (YouTube, etc.)
    if (lower.includes("youtube.com") || lower.includes("ytimg.com")) {
      return false;
    }
    return true;
  });
  // Next/Webflow/same-origin CSS needed for accurate CTAs (Brave, etc.)
  const needsStylesheets =
    isNextApp ||
    isWebflow ||
    bestWeight < 35 ||
    base.stylesheetHrefs.length === 1 ||
    (sameOriginCss.length > 0 && sameOriginCss.length <= 6);

  let tierUsed: "tier1" | "tier2" = "tier1";
  if (needsStylesheets && base.stylesheetHrefs.length > 0) {
    // Prefer index/Button/color token sheets (Linear, etc.) over random chunks
    const nextSheets = base.stylesheetHrefs.filter((h) =>
      h.includes("/_next/"),
    );
    const preferred = isNextApp
      ? nextSheets.length > 0
        ? nextSheets
        : sameOriginCss
      : sameOriginCss.length > 0
        ? sameOriginCss
        : base.stylesheetHrefs;

    try {
      // Use the landed host so redirects (parking pages) can still load CSS
      let sheetDomain = domain;
      try {
        sheetDomain = new URL(page.finalUrl).hostname.replace(/^www\./, "");
      } catch {
        sheetDomain = domain;
      }
      const cssFromSheets = await fetchStylesheets(
        preferred,
        page.finalUrl,
        sheetDomain,
        // index + Button + color tokens / single Webflow bundle
        isNextApp ? 4 : isWebflow ? 2 : 3,
      );
      if (cssFromSheets.length > 0) {
        cssTexts = [...cssTexts, ...cssFromSheets];
        tierUsed = "tier2";
        weightedColors = [
          ...collectWeightedBrandColors({
            themeColor: base.themeColor,
            cssTexts,
            htmlSnippet: page.html.slice(0, 80_000),
          }),
          // Keep HTML accents as low-weight backup
          ...fallbackHtmlAccentColors(page.html),
        ];
      }
    } catch {
      // Stylesheet fetch is best-effort — keep HTML signals
    }
  }

  const $ = cheerio.load(page.html);
  const fontFamily =
    extractFontHints($, page.html, cssTexts) ?? base.fontFamily;

  const pageTheme = detectPageTheme(page.html, cssTexts);
  const provisionalPrimary =
    pickPrimaryColor(weightedColors) ?? base.themeColor ?? "#0c0c0c";
  let buttonStyle = extractButtonStyle(
    page.html,
    cssTexts,
    pageTheme,
    provisionalPrimary,
  );
  let shell = emailShellFromTheme(pageTheme, buttonStyle);
  buttonStyle = ensureCtaContrast(
    buttonStyle,
    shell.emailBackgroundColor,
    page.html.match(/class="([^"]*rounded-full[^"]*bg-(?:black|white)[^"]*)"/i)?.[1],
  );
  // Prefer keeping homepage CTA paint; adjust shell when contrast fails
  shell = ensureShellContrastForCta(shell, buttonStyle, provisionalPrimary);

  const confidence = Math.min(
    100,
    scoreSignals({
      themeColor: base.themeColor,
      fontFamily,
      ogImage: base.ogImage,
      ogSiteName: base.ogSiteName,
      weightedColors,
      hasCss: cssTexts.length > 0,
    }) + (buttonStyle.source.startsWith("cta:") ? 10 : 0),
  );

  const pageIsDark =
    (() => {
      const h = shell.emailBackgroundColor.replace("#", "");
      const r = parseInt(h.slice(0, 2), 16) / 255;
      const g = parseInt(h.slice(2, 4), 16) / 255;
      const b = parseInt(h.slice(4, 6), 16) / 255;
      return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.45;
    })() || pageTheme.isDark;

  return {
    themeColor: base.themeColor,
    ogSiteName: base.ogSiteName,
    ogImage: base.ogImage,
    favicon: base.favicon,
    fontFamily,
    weightedColors,
    cssTexts,
    html: page.html,
    buttonStyle,
    emailBackgroundColor: shell.emailBackgroundColor,
    emailTextColor: shell.emailTextColor,
    pageIsDark,
    tierUsed,
    confidence,
  };
}

function shapeFromRadius(px: number): "pill" | "rounded" | "square" {
  if (px >= 999 || px >= 40) return "pill";
  if (px <= 4) return "square";
  return "rounded";
}

export function mergeBrandTokens(args: {
  domain: string;
  scraped: ScrapedBrandSignals;
  storeName: string;
  storeLogoUrl: string | null;
  /** When present, browser-computed kit wins for email-capable tokens */
  browserKit?: BrowserCapturedKit | null;
}): BrandImportTokens {
  let primary =
    pickPrimaryColor(args.scraped.weightedColors) ?? "#0c0c0c";
  let secondary =
    pickSecondaryColor(
      args.scraped.weightedColors,
      primary,
      args.scraped.cssTexts,
    ) ?? "#6b6b70";

  // On dark email shells, prefer a light muted secondary for readability
  if (args.scraped.pageIsDark) {
    const muted = normalizeHexColor(args.scraped.emailTextColor);
    if (muted) {
      secondary = "#a1a1a6";
    }
  }

  const fromName =
    args.storeName.trim() ||
    args.scraped.ogSiteName?.trim() ||
    args.domain;

  let logoSource: BrandImportTokens["sources"]["logo"] = "none";
  if (args.storeLogoUrl) logoSource = "lemon_squeezy";
  else if (args.scraped.ogImage) logoSource = "og_image";
  else if (args.scraped.favicon) logoSource = "favicon";

  const nameSource: BrandImportTokens["sources"]["name"] = args.storeName.trim()
    ? "lemon_squeezy"
    : args.scraped.ogSiteName
      ? "og_site"
      : "domain";

  const emailFont = mapFontFamily(args.scraped.fontFamily);
  const colorsFromScrape =
    args.scraped.weightedColors.length > 0 && primary !== "#0c0c0c";
  const btn = args.scraped.buttonStyle;

  // Homepage CTA color is the strongest brand signal when it's chromatic
  if (
    btn.source.startsWith("cta:") &&
    !isNearWhiteOrBlack(btn.backgroundColor) &&
    !isGrayish(btn.backgroundColor)
  ) {
    primary = btn.backgroundColor;
  }

  let pageBackgroundColor = args.scraped.emailBackgroundColor;
  let pageTextColor = args.scraped.emailTextColor;
  let mutedTextColor = secondary;
  // Reject washed-out "muted" on light shells (Brave often scrapes pale grays)
  if (!args.scraped.pageIsDark && luminance(mutedTextColor) > 0.75) {
    mutedTextColor = "#6b6b70";
    secondary = mutedTextColor;
  }
  let linkColor = primary;
  let ctaBackgroundColor = btn.backgroundColor;
  let ctaTextColor = btn.textColor;
  let ctaBorderRadiusPx = btn.borderRadiusPx;
  let ctaShape = btn.shape;
  let fontFamilyRaw = args.scraped.fontFamily;
  let mappedFont = emailFont;
  let confidence = args.scraped.confidence;
  let captureMethod: BrandImportTokens["captureMethod"] = colorsFromScrape
    ? "css"
    : "defaults";
  let tierUsed: BrandImportTokens["tierUsed"] = args.scraped.tierUsed;
  let buttonSource: BrandImportTokens["sources"]["button"] =
    btn.source.startsWith("cta:") ? "homepage_cta" : "fallback";

  const kit = args.browserKit;
  if (kit) {
    const cssShellDark =
      !isNearWhiteOrBlack(args.scraped.emailBackgroundColor) &&
      (() => {
        const h = args.scraped.emailBackgroundColor.replace("#", "");
        const r = parseInt(h.slice(0, 2), 16) / 255;
        const g = parseInt(h.slice(2, 4), 16) / 255;
        const b = parseInt(h.slice(4, 6), 16) / 255;
        return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.45;
      })();
    const kitShellLight = (() => {
      const h = kit.pageBackgroundColor.replace("#", "");
      const r = parseInt(h.slice(0, 2), 16) / 255;
      const g = parseInt(h.slice(2, 4), 16) / 255;
      const b = parseInt(h.slice(4, 6), 16) / 255;
      return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.85;
    })();
    const kitCtaLight =
      isNearWhiteOrBlack(kit.ctaBackgroundColor) ||
      isGrayish(kit.ctaBackgroundColor);

    // Trust browser CTA always; for shell, if browser says white+light CTA but
    // CSS scrape found a dark homepage, keep the dark shell (Polar-style SPAs).
    const useCssShell =
      kitShellLight &&
      kitCtaLight &&
      cssShellDark &&
      args.scraped.pageIsDark;

    pageBackgroundColor = useCssShell
      ? args.scraped.emailBackgroundColor
      : kit.pageBackgroundColor;
    pageTextColor = useCssShell
      ? args.scraped.emailTextColor
      : kit.pageTextColor;
    mutedTextColor =
      isNearWhiteOrBlack(kit.mutedTextColor) ||
      kit.mutedTextColor === kit.pageBackgroundColor
        ? secondary
        : kit.mutedTextColor;
    secondary = mutedTextColor;
    linkColor =
      isNearWhiteOrBlack(kit.linkColor) && !args.scraped.pageIsDark
        ? primary
        : kit.linkColor;
    ctaBackgroundColor = kit.ctaBackgroundColor;
    ctaTextColor = kit.ctaTextColor;
    ctaBorderRadiusPx = kit.ctaBorderRadiusPx;
    ctaShape = shapeFromRadius(kit.ctaBorderRadiusPx);
    fontFamilyRaw = kit.fontFamilyRaw ?? fontFamilyRaw;
    mappedFont = mapFontFamily(fontFamilyRaw);
    if (
      kit.brandColor &&
      !isNearWhiteOrBlack(kit.brandColor) &&
      !isGrayish(kit.brandColor)
    ) {
      primary = kit.brandColor;
    } else if (
      !isNearWhiteOrBlack(kit.ctaBackgroundColor) &&
      !isGrayish(kit.ctaBackgroundColor)
    ) {
      primary = kit.ctaBackgroundColor;
    }

    const shellDark = luminance(pageBackgroundColor) < 0.45;
    const ctaLum = luminance(kit.ctaBackgroundColor);
    // Resend-style ONLY: light invert CTA on a dark shell → monochrome.
    // Do NOT treat dark/gray CTAs on light shells (Clerk) as monochrome — that
    // wipes the real purple brand in favor of black.
    const lightInvertOnDark =
      shellDark && isNearWhiteOrBlack(kit.ctaBackgroundColor) && ctaLum > 0.7;
    if (lightInvertOnDark) {
      primary = "#ffffff";
      linkColor = primary;
    } else if (
      !shellDark &&
      (isNearWhiteOrBlack(kit.ctaBackgroundColor) || isGrayish(kit.ctaBackgroundColor))
    ) {
      // Light marketing page + muted/dark CTA → prefer CSS brand accent (purple)
      const accent =
        pickPrimaryColor(args.scraped.weightedColors) ?? primary;
      if (
        accent &&
        !isNearWhiteOrBlack(accent) &&
        !isGrayish(accent)
      ) {
        primary = accent;
        linkColor = accent;
        ctaBackgroundColor = accent;
        ctaTextColor = contrastTextOn(accent);
      }
    }

    // Raycast-style: browser CTA is soft gray invert but CSS found a strong
    // brand accent — paint the email CTA with that accent.
    if (
      isGrayish(ctaBackgroundColor) &&
      !isNearWhiteOrBlack(ctaBackgroundColor) &&
      !isNearWhiteOrBlack(primary) &&
      !isGrayish(primary)
    ) {
      ctaBackgroundColor = primary;
      ctaTextColor = contrastTextOn(primary);
    }

    // Ramp-style: CTA fill ≈ shell → use brand ink / accent so the button exists
    if (
      Math.abs(
        luminance(ctaBackgroundColor) - luminance(pageBackgroundColor),
      ) < 0.12
    ) {
      const shellDark = luminance(pageBackgroundColor) < 0.45;
      ctaBackgroundColor =
        !isNearWhiteOrBlack(primary) && !isGrayish(primary)
          ? primary
          : shellDark
            ? "#ffffff"
            : "#0c0c0c";
      ctaTextColor = contrastTextOn(ctaBackgroundColor);
    }

    confidence = Math.max(confidence, kit.confidence);
    captureMethod = "browser";
    tierUsed = "browser";
    buttonSource = "homepage_cta";
  }

  // Hard readability guards (import-time)
  ctaTextColor = ensureCtaLabelContrast(ctaBackgroundColor, ctaTextColor);
  const hierarchy = ensureShellTextHierarchy(
    pageBackgroundColor,
    pageTextColor,
    mutedTextColor,
  );
  pageTextColor = hierarchy.bodyText;
  mutedTextColor = hierarchy.mutedText;

  mappedFont = mapFontFamily(fontFamilyRaw);

  return {
    brandColor: primary,
    secondaryColor: mutedTextColor,
    mutedTextColor,
    linkColor,
    pageBackgroundColor,
    pageTextColor,
    emailFont: mappedFont,
    fontFamilyRaw,
    fromName,
    ctaBackgroundColor,
    ctaTextColor,
    ctaBorderRadiusPx,
    ctaShape,
    emailBackgroundColor: pageBackgroundColor,
    emailTextColor: pageTextColor,
    confidence,
    tierUsed,
    captureMethod,
    sources: {
      logo: logoSource,
      name: nameSource,
      colors:
        captureMethod === "defaults" && !colorsFromScrape
          ? "defaults"
          : "domain_scrape",
      font: fontFamilyRaw ? "domain_scrape" : "default",
      button: buttonSource,
    },
  };
}
