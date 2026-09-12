import * as cheerio from "cheerio";
import {
  contrastTextOn,
  isGrayish,
  isNearWhiteOrBlack,
  luminance,
  normalizeHexColor,
  resolveCssVariables,
} from "./colors";

export type ScrapedButtonStyle = {
  backgroundColor: string;
  textColor: string;
  /** CSS px — 9999 means pill */
  borderRadiusPx: number;
  shape: "pill" | "rounded" | "square";
  source: string;
};

export type ScrapedPageTheme = {
  isDark: boolean;
  backgroundColor: string | null;
  textColor: string | null;
};

const CTA_TEXT_HINT =
  /\b(get started|get brave|download brave|download|install|sign up|sign in|log in|start free|try (?:it )?free|start now|start building|start for free|book a demo|subscribe|continue|buy now|purchase|make an offer|upgrade|claim|join|create account|start selling|open app|contact sales|get ramp)\b/i;

/** Promo banners / OAuth — look like CTAs but poison brand color (Resend Forward, etc.). */
const CTA_PROMO_OR_OAUTH =
  /\b(join us at|forward\b|summit|conference|webinar|hackathon|sign up with (google|github|apple|microsoft)|continue with (google|github|apple)|log in with)\b/i;

const TW_RADIUS: Record<string, number> = {
  "rounded-none": 0,
  "rounded-sm": 4,
  rounded: 6,
  "rounded-md": 8,
  "rounded-lg": 10,
  "rounded-xl": 12,
  "rounded-2xl": 16,
  "rounded-3xl": 24,
  "rounded-full": 9999,
};

const TW_COLOR: Record<string, string> = {
  "bg-black": "#000000",
  "bg-white": "#ffffff",
  "text-black": "#000000",
  "text-white": "#ffffff",
  "bg-gray-50": "#f9fafb",
  "bg-gray-900": "#111827",
  "bg-neutral-900": "#171717",
  "bg-zinc-900": "#18181b",
  "bg-slate-900": "#0f172a",
};

function decodeClassAttr(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}

function pickRadiusFromClasses(classes: string): number | null {
  for (const token of classes.split(/\s+/)) {
    if (token in TW_RADIUS) return TW_RADIUS[token]!;
    const arbitrary = token.match(/^rounded-\[(\d+)px\]$/);
    if (arbitrary) return Number(arbitrary[1]);
  }
  return null;
}

function pickTwColor(
  classes: string,
  prefix: "bg" | "text",
  preferDarkVariant: boolean,
): string | null {
  const tokens = classes.split(/\s+/);

  const darkToken = tokens.find((t) => t.startsWith(`dark:${prefix}-`));
  const lightToken = tokens.find(
    (t) => t.startsWith(`${prefix}-`) && !t.startsWith("dark:"),
  );

  const chosen = preferDarkVariant
    ? (darkToken?.replace(/^dark:/, "") ?? lightToken)
    : lightToken;

  if (!chosen) return null;

  if (chosen in TW_COLOR) return TW_COLOR[chosen]!;

  const arbitrary = chosen.match(
    new RegExp(`^${prefix}-\\[#([0-9a-fA-F]{3,8})\\]$`),
  );
  if (arbitrary?.[1]) {
    return normalizeHexColor(`#${arbitrary[1]}`);
  }

  return null;
}

function contrastText(bg: string): string {
  return contrastTextOn(bg);
}

function shapeFromRadius(radiusPx: number): ScrapedButtonStyle["shape"] {
  // Webflow/LS often use 2–2.5rem (~32–40px) for pills
  if (radiusPx >= 24) return "pill";
  if (radiusPx <= 2) return "square";
  return "rounded";
}

/** Parse CSS length → px. Unknown units return null. */
export function cssLengthToPx(value: string): number | null {
  const v = value.trim().toLowerCase();
  if (!v || v === "0") return 0;
  if (v === "50%" || v === "9999px" || v === "999px") return 9999;
  const px = v.match(/^(-?\d+(?:\.\d+)?)px$/);
  if (px) return Math.round(Number(px[1]));
  const rem = v.match(/^(-?\d+(?:\.\d+)?)rem$/);
  if (rem) return Math.round(Number(rem[1]) * 16);
  const em = v.match(/^(-?\d+(?:\.\d+)?)em$/);
  if (em) return Math.round(Number(em[1]) * 16);
  return null;
}

/** First usable hex inside a CSS color/gradient value (optionally via vars). */
export function firstHexFromCssValue(
  value: string,
  vars: Map<string, string>,
  depth = 0,
): string | null {
  if (!value || depth > 6) return null;
  const trimmed = value.trim();

  const direct = normalizeHexColor(trimmed);
  if (direct) return direct;

  const varRef = trimmed.match(/^var\(\s*--([a-zA-Z0-9_-]+)/i);
  if (varRef?.[1]) {
    const key = varRef[1].toLowerCase();
    const fromMap = vars.get(key);
    if (fromMap) {
      const hex = normalizeHexColor(fromMap) ?? firstHexFromCssValue(fromMap, vars, depth + 1);
      if (hex) return hex;
    }
    // Semantic fallbacks when token sheets weren't fetched
    if (/invert-bg|button-invert/i.test(key)) return null;
    if (/brand-bg|primary|accent/i.test(key)) return null;
  }

  // Prefer chromatic stops — skip #fff/#000 fillers in layered gradients
  // e.g. linear-gradient(#fff,#fff) padding-box, linear-gradient(#637cf7,...)
  const hexes = [
    ...trimmed.matchAll(/#([0-9a-fA-F]{3,8})\b/g),
  ]
    .map((m) => normalizeHexColor(`#${m[1]}`))
    .filter((h): h is string => Boolean(h));
  const chromatic = hexes.find((h) => !isNearWhiteOrBlack(h));
  if (chromatic) return chromatic;
  if (hexes[0]) return hexes[0];

  const rgbMatch = trimmed.match(
    /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i,
  );
  if (rgbMatch) {
    return normalizeHexColor(
      `rgb(${rgbMatch[1]},${rgbMatch[2]},${rgbMatch[3]})`,
    );
  }

  return null;
}

function resolveRadiusValue(
  value: string,
  vars: Map<string, string>,
  depth = 0,
): number | null {
  if (!value || depth > 6) return null;
  const trimmed = value.trim();

  const asPx = cssLengthToPx(trimmed);
  if (asPx !== null) return asPx;

  const varRef = trimmed.match(/^var\(\s*--([a-zA-Z0-9_-]+)/i);
  if (varRef?.[1]) {
    const key = varRef[1].toLowerCase();
    const fromMap = vars.get(key);
    if (fromMap) {
      const nested = resolveRadiusValue(fromMap, vars, depth + 1);
      if (nested !== null) return nested;
    }
    // Linear / design-token naming: --radius-rounded / --radius-full → pill
    if (/radius-(rounded|full|pill|circle)/i.test(key)) return 9999;
  }

  return null;
}

/**
 * Index simple class selectors → declaration blocks.
 * Enough for `.btn{...}`, `.upm-premium-proceed-cta{...}`, hashed CSS modules.
 */
export function indexCssClassRules(cssTexts: string[]): Map<string, string> {
  const index = new Map<string, string>();
  const joined = cssTexts.join("\n");
  // Don't require a leading `}` — minified CSS is `.a{...}.b{...}` and the
  // previous matcher skipped every other rule after consuming the brace.
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(joined)) !== null) {
    const rawSelector = (m[1] ?? "").trim();
    const decls = (m[2] ?? "").trim();
    if (!decls || !rawSelector || rawSelector.startsWith("@")) continue;

    for (const part of rawSelector.split(",")) {
      const selector = part.trim();
      // Class-only selectors (chained ok): .btn / .S36ykG_variant-invert
      if (!/^\.([a-zA-Z_][\w-]*)(\.([a-zA-Z_][\w-]*))*$/.test(selector)) {
        continue;
      }
      const classes = [...selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(
        (x) => x[1]!,
      );
      for (const cls of classes) {
        const prev = index.get(cls);
        index.set(cls, prev ? `${prev};${decls}` : decls);
      }
    }
  }
  return index;
}

function declValue(decls: string, prop: string): string | null {
  const re = new RegExp(
    `(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`,
    "i",
  );
  const matches = [...decls.matchAll(new RegExp(re.source, "gi"))];
  if (matches.length === 0) return null;
  // Prefer last non-transparent / non-none value
  for (let i = matches.length - 1; i >= 0; i--) {
    const raw = matches[i]?.[1]?.trim();
    if (!raw) continue;
    if (/^(none|transparent|inherit|initial|0\s+0)$/i.test(raw)) continue;
    return raw;
  }
  return matches[matches.length - 1]?.[1]?.trim() ?? null;
}

function mergeDeclsForClasses(
  classes: string,
  classRules: Map<string, string>,
): string {
  const parts: string[] = [];
  for (const cls of classes.split(/\s+/)) {
    if (!cls) continue;
    const d = classRules.get(cls);
    if (d) parts.push(d);
  }
  return parts.join(";");
}

function parseInlineStyle(styleAttr: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of styleAttr.split(";")) {
    const i = part.indexOf(":");
    if (i < 0) continue;
    const key = part.slice(0, i).trim().toLowerCase();
    const val = part.slice(i + 1).trim();
    if (key && val) out[key] = val;
  }
  return out;
}

/** Collect raw CSS custom property values (not only hex) for radius tokens. */
function collectRawCssVars(cssTexts: string[]): Map<string, string> {
  const raw = new Map<string, string>();
  const re = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
  for (const css of cssTexts) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(css)) !== null) {
      const name = m[1]?.toLowerCase();
      const value = m[2]?.trim();
      if (!name || !value) continue;
      if (!raw.has(name)) raw.set(name, value);
    }
  }
  return raw;
}

/** Detect whether the marketing page is dark-themed. */
export function detectPageTheme(
  html: string,
  cssTexts: string[],
): ScrapedPageTheme {
  const vars = new Map<string, string>();
  for (const css of cssTexts) {
    for (const [k, v] of resolveCssVariables(css)) {
      if (!vars.has(k)) vars.set(k, v);
    }
  }

  const bgCandidates = [
    vars.get("background"),
    vars.get("color-background"),
    vars.get("color-brand-surface"),
    vars.get("color-polar-950"),
    vars.get("color-polar-900"),
    vars.get("color-bg-primary"),
  ].filter(Boolean) as string[];

  const textCandidates = [
    vars.get("foreground"),
    vars.get("color-foreground"),
    vars.get("color-brand-foreground"),
    vars.get("color-text-primary"),
  ].filter(Boolean) as string[];

  // Match real theme class tokens — NOT CSS vars like `--dark` in
  // class="[--root-bg:var(--dark,...)]" (Clerk.com false-positive).
  const head = html.slice(0, 8_000);
  const rootClass =
    head.match(/<(?:html|body)\b[^>]*\sclass="([^"]*)"/i)?.[1] ?? "";
  const rootTokens = new Set(
    rootClass
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean),
  );
  const bodyDark =
    /data-theme\s*=\s*["']dark["']/i.test(head) ||
    rootTokens.has("dark") ||
    rootTokens.has("theme-dark") ||
    rootTokens.has("dark-mode");

  // Prefer light surfaces when the page declares a light root (Clerk gray-50)
  const lightRootHint =
    /--root-bg:[^;)]*gray-50|--root-bg:[^;)]*#f[0-9a-f]{5}|bg-\(--light/i.test(
      head,
    ) || /color-gray-50|background:\s*#f[57]/i.test(cssTexts.join("\n").slice(0, 20_000));

  let backgroundColor = bgCandidates[0] ?? null;
  const textColor = textCandidates[0] ?? null;

  // Prefer an explicitly light background token over a dark "primary" surface
  // used only in mid-page sections.
  for (const key of [
    "color-gray-50",
    "color-background",
    "background",
    "color-bg-primary",
  ]) {
    const hex = vars.get(key);
    if (hex && luminance(hex) > 0.85) {
      backgroundColor = hex;
      break;
    }
  }

  let isDark = bodyDark && !lightRootHint;
  if (backgroundColor) {
    const hex = normalizeHexColor(backgroundColor);
    if (hex) {
      if (luminance(hex) > 0.75) isDark = false;
      else if (luminance(hex) < 0.28 && !lightRootHint) isDark = true;
    }
  }
  if (lightRootHint) isDark = false;

  return { isDark, backgroundColor, textColor };
}

type Candidate = {
  score: number;
  classes: string;
  label: string;
  styleAttr: string;
};

function collectButtonCandidates(html: string): Candidate[] {
  const $ = cheerio.load(html);
  const out: Candidate[] = [];

  $("a, button, [role='button']").each((_, el) => {
    const node = $(el);
    const classes = decodeClassAttr(node.attr("class") ?? "");
    const styleAttr = node.attr("style") ?? "";
    const label = node.text().replace(/\s+/g, " ").trim().slice(0, 80);
    if (!label || label.length > 48) return;

    let score = 0;
    if (CTA_PROMO_OR_OAUTH.test(label)) score -= 80;
    if (CTA_TEXT_HINT.test(label)) score += 55;
    if (/rounded-full|radius-rounded|shape-circle|pill/i.test(classes)) {
      score += 12;
    }
    if (/\bbg-(black|white)\b/.test(classes)) score += 28;
    if (/\bdark:bg-(black|white)\b/.test(classes)) score += 30;
    if (/\bbg-(primary|brand)\b/.test(classes)) score += 18;
    if (/\b(btn|button|cta|proceed|purchase|signup|sign-up)\b/i.test(classes)) {
      score += 18;
    }
    // Webflow / marketing kits
    if (/\bbutton-primary\b/i.test(classes)) score += 30;
    if (/\bnav_button\b/i.test(classes)) score += 8;
    if (/\bw-button\b/i.test(classes)) score += 14;
    if (/variant-(invert|primary)/i.test(classes)) score += 22;
    // Brave Leo / hero download CTAs
    if (/\bisHero\b|\bbtn--hero\b|\bisJumbo\b/i.test(classes)) score += 40;
    if (/\bleoButton\b|\bisFilled\b/i.test(classes)) score += 12;
    if (/\bdownload\b/i.test(classes) || /download/i.test(node.attr("id") ?? "")) {
      score += 16;
    }
    if (/h-10|h-11|h-12|px-5|px-6|size-large/i.test(classes)) score += 6;
    if (node.attr("type") === "button" || node.attr("data-testid")) score += 4;
    // Nav junk / faint text links
    if (
      /menu|dropdown|icon-only|sr-only|slide-dot|toggle|radio|play-btn|swiper|isPlainFaint|isTiny\b/i.test(
        classes,
      )
    ) {
      score -= 40;
    }
    // Prefer full-width purchase / hero CTAs over tiny controls
    if (/proceed|premium-proceed|luxury-cta|\bhero\b/i.test(classes)) score += 20;
    if (label.length < 2) score -= 30;

    // Keep candidates we can still style via CSS class lookup
    if (score >= 18 || (CTA_TEXT_HINT.test(label) && classes)) {
      out.push({ score, classes, label, styleAttr });
    }
  });

  const re =
    /<(?:a|button)[^>]*class="([^"]+)"[^>]*(?:style="([^"]*)")?[^>]*>[\s\S]{0,220}?(Get Started|Get Brave|Download Brave|Download|Sign up|Start free|Try free|Book a demo|Subscribe|Buy Now|Purchase|Start now|Start building)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const classes = decodeClassAttr(m[1] ?? "");
    const styleAttr = m[2] ?? "";
    const label = m[3] ?? "";
    if (!classes) continue;
    out.push({ score: 70, classes, label, styleAttr });
  }

  out.sort((a, b) => b.score - a.score);
  return out;
}

function invertHeuristic(
  classes: string,
  pageTheme: ScrapedPageTheme,
): { bg: string; text: string } | null {
  if (!/variant-invert|btn-invert|button-invert|invert\b/i.test(classes)) {
    return null;
  }
  if (pageTheme.isDark) {
    return { bg: "#e5e5e6", text: "#08090a" };
  }
  return { bg: "#0c0c0c", text: "#ffffff" };
}

/** Pull `<style>` contents only — never index the full HTML (scripts blow up). */
export function extractInlineStyleBlocks(html: string): string[] {
  const blocks: string[] = [];
  const re = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const body = m[1]?.trim();
    if (body) blocks.push(body);
  }
  return blocks;
}

/**
 * Infer primary CTA styling from homepage buttons.
 * Prefer the theme variant that matches the page (dark homepage → dark: styles).
 */
export function extractButtonStyle(
  html: string,
  cssTexts: string[],
  pageTheme: ScrapedPageTheme,
  fallbackBrandColor: string,
): ScrapedButtonStyle {
  // Critical: only index real CSS. Running the class indexer over full HTML
  // (Linear ~1.2MB of JS/JSON braces) can stall the import for 40s+.
  const cssForIndex = [...extractInlineStyleBlocks(html), ...cssTexts];

  const hexVars = new Map<string, string>();
  for (const css of cssForIndex) {
    for (const [k, v] of resolveCssVariables(css)) {
      if (!hexVars.has(k)) hexVars.set(k, v);
    }
  }
  const rawVars = collectRawCssVars(cssForIndex);
  // Merge: prefer resolved hex, keep raw for radius tokens
  const vars = new Map<string, string>([...rawVars, ...hexVars]);
  const classRules = indexCssClassRules(cssForIndex);
  const candidates = collectButtonCandidates(html);
  const preferDark = pageTheme.isDark;

  for (const candidate of candidates.slice(0, 16)) {
    if (CTA_PROMO_OR_OAUTH.test(candidate.label)) continue;

    const decls = mergeDeclsForClasses(candidate.classes, classRules);
    const inline = parseInlineStyle(candidate.styleAttr);

    let bg =
      pickTwColor(candidate.classes, "bg", preferDark) ??
      firstHexFromCssValue(inline["background"] ?? "", vars) ??
      firstHexFromCssValue(inline["background-color"] ?? "", vars) ??
      firstHexFromCssValue(declValue(decls, "background") ?? "", vars) ??
      firstHexFromCssValue(declValue(decls, "background-color") ?? "", vars);

    let textFromClass =
      pickTwColor(candidate.classes, "text", preferDark) ??
      firstHexFromCssValue(inline["color"] ?? "", vars) ??
      firstHexFromCssValue(declValue(decls, "color") ?? "", vars);

    // Transparent / token backgrounds (Brave isHero, Linear invert / primary)
    const bgIsTransparent =
      !bg ||
      /^(transparent|none|0\s+0)$/i.test(
        (inline["background"] ??
          inline["background-color"] ??
          declValue(decls, "background") ??
          declValue(decls, "background-color") ??
          declValue(decls, "--bg") ??
          "").trim(),
      );

    if (!bg || bgIsTransparent) {
      if (/isHero|btn--hero/i.test(candidate.classes)) {
        // Brave hero: gradient on ::before/::after + brand orange tokens
        bg =
          firstHexFromCssValue(vars.get("leo-gradient-hero") ?? "", vars) ??
          hexVars.get("leo-color-primitive-brands-rorange-1") ??
          hexVars.get("leo-color-primitive-brands-rorange-2") ??
          hexVars.get("leo-color-legacy-interactive2") ??
          hexVars.get("leo-color-legacy-interactive1") ??
          null;
        textFromClass = textFromClass ?? "#ffffff";
      }
      if (!bg && /variant-primary|isFilled/i.test(candidate.classes)) {
        bg =
          hexVars.get("color-brand-bg") ??
          hexVars.get("mixed-primary-color") ??
          hexVars.get("leo-color-button-background") ??
          hexVars.get("brand") ??
          hexVars.get("primary") ??
          null;
      }
      if (!bg && /variant-invert|button-invert/i.test(candidate.classes)) {
        bg = hexVars.get("color-button-invert-bg") ?? null;
        if (!textFromClass) {
          textFromClass =
            hexVars.get("color-bg-primary") ??
            (pageTheme.isDark ? "#08090a" : "#ffffff");
        }
      }
    }

    if (!bg) {
      const heuristic = invertHeuristic(candidate.classes, pageTheme);
      if (heuristic) {
        bg = heuristic.bg;
        textFromClass = textFromClass ?? heuristic.text;
      }
    }

    if (!bg) continue;

    // Skip washed mid-grays (nav chips) — keep looking for a real CTA
    const weakGray = isGrayish(bg) && !isNearWhiteOrBlack(bg);
    if (weakGray && candidate.score < 60) continue;
    // Skip plain white/black on light marketing pages unless it's a top CTA
    if (
      !pageTheme.isDark &&
      isNearWhiteOrBlack(bg) &&
      candidate.score < 70 &&
      !/isHero|btn--hero|button-primary/i.test(candidate.classes)
    ) {
      continue;
    }

    let radius =
      pickRadiusFromClasses(candidate.classes) ??
      resolveRadiusValue(inline["border-radius"] ?? "", vars) ??
      resolveRadiusValue(declValue(decls, "border-radius") ?? "", vars) ??
      resolveRadiusValue(declValue(decls, "--button-corner-radius") ?? "", vars);

    // Height-aware pill: radius >= half height
    if (radius === null || radius < 999) {
      const heightPx =
        cssLengthToPx(inline["height"] ?? "") ??
        cssLengthToPx(declValue(decls, "height") ?? "") ??
        cssLengthToPx(declValue(decls, "--button-height") ?? "");
      if (heightPx && radius !== null && radius >= heightPx / 2 - 1) {
        radius = 9999;
      }
    }

    // Token / class name hints for pill when radius still unknown
    if (radius === null) {
      if (
        /rounded-full|radius-rounded|shape-circle|pill/i.test(candidate.classes) ||
        /radius-rounded|radius-full/i.test(decls)
      ) {
        radius = 9999;
      } else {
        radius = 12;
      }
    }

    let textColor = textFromClass ?? contrastText(bg);
    // Fix unreadable pairings (e.g. white text on light gray)
    if (Math.abs(luminance(bg) - luminance(textColor)) < 0.25) {
      textColor = contrastText(bg);
    }

    // On dark pages, strongly prefer light/white CTAs (Polar, Linear invert)
    if (pageTheme.isDark && luminance(bg) < 0.35 && candidate.score < 70) {
      continue;
    }

    return {
      backgroundColor: bg,
      textColor,
      borderRadiusPx: radius,
      shape: shapeFromRadius(radius),
      source: `cta:${candidate.label}`,
    };
  }

  // Fallback: brand-colored rounded button
  const bg = normalizeHexColor(fallbackBrandColor) ?? "#0c0c0c";
  return {
    backgroundColor: bg,
    textColor: contrastText(bg),
    borderRadiusPx: 12,
    shape: "rounded",
    source: "fallback-brand",
  };
}

/** Email shell = page background (homepage fidelity). Contrast fixed only when measured fail. */
export function emailShellFromTheme(
  pageTheme: ScrapedPageTheme,
  button: ScrapedButtonStyle,
): {
  emailBackgroundColor: string;
  emailTextColor: string;
} {
  void button;
  const bgHex = pageTheme.backgroundColor
    ? normalizeHexColor(pageTheme.backgroundColor)
    : null;
  const textHex = pageTheme.textColor
    ? normalizeHexColor(pageTheme.textColor)
    : null;

  if (pageTheme.isDark) {
    const bg = bgHex && !isNearWhiteOrBlack(bgHex) ? bgHex : "#0c0c0c";
    const text =
      textHex && luminance(textHex) > 0.5 ? textHex : "#f5f5f5";
    return { emailBackgroundColor: bg, emailTextColor: text };
  }

  const bg = bgHex ?? "#ffffff";
  const text =
    textHex && luminance(textHex) < 0.55 ? textHex : "#0c0c0c";
  return { emailBackgroundColor: bg, emailTextColor: text };
}

/**
 * Never rewrite scraped homepage CTAs (that kills fidelity — Lemon white pills
 * became black). Only adjust fallback/synthetic buttons.
 * Shell contrast is handled by {@link ensureShellContrastForCta}.
 */
export function ensureCtaContrast(
  button: ScrapedButtonStyle,
  emailBackground: string,
  classesHint?: string,
): ScrapedButtonStyle {
  if (button.source.startsWith("cta:")) return button;

  const bgLum = luminance(button.backgroundColor);
  const shellLum = luminance(emailBackground);
  const contrast = Math.abs(bgLum - shellLum);
  if (contrast >= 0.35) return button;

  if (classesHint && /dark:bg-white/.test(classesHint) && shellLum > 0.5) {
    return {
      ...button,
      backgroundColor: "#000000",
      textColor: "#ffffff",
      source: `${button.source}+contrast-fix`,
    };
  }
  if (shellLum > 0.5 && bgLum > 0.7) {
    return {
      ...button,
      backgroundColor: "#0c0c0c",
      textColor: "#ffffff",
      source: `${button.source}+contrast-fix`,
    };
  }
  if (shellLum < 0.3 && bgLum < 0.25) {
    return {
      ...button,
      backgroundColor: "#ffffff",
      textColor: "#0c0c0c",
      source: `${button.source}+contrast-fix`,
    };
  }
  return button;
}

/**
 * When a light homepage CTA sits on a light shell, darken the shell (prefer
 * chromatic brand) so the CTA stays true — never invent a black button.
 */
export function ensureShellContrastForCta(
  shell: { emailBackgroundColor: string; emailTextColor: string },
  button: ScrapedButtonStyle,
  brandPrimary: string,
): { emailBackgroundColor: string; emailTextColor: string } {
  const bgLum = luminance(button.backgroundColor);
  const shellLum = luminance(shell.emailBackgroundColor);
  if (Math.abs(bgLum - shellLum) >= 0.35) return shell;

  // Light CTA on light shell → brand / dark shell, keep CTA
  if (bgLum > 0.7 && shellLum > 0.7) {
    const brand = normalizeHexColor(brandPrimary);
    if (
      brand &&
      !isNearWhiteOrBlack(brand) &&
      !isGrayish(brand) &&
      luminance(brand) < 0.55
    ) {
      return {
        emailBackgroundColor: brand,
        emailTextColor: "#ffffff",
      };
    }
    return {
      emailBackgroundColor: "#0c0c0c",
      emailTextColor: "#f5f5f5",
    };
  }

  // Dark CTA on dark shell → light shell
  if (bgLum < 0.25 && shellLum < 0.3) {
    return {
      emailBackgroundColor: "#ffffff",
      emailTextColor: "#0c0c0c",
    };
  }

  return shell;
}
