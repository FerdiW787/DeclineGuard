const HEX6 = /^#([0-9a-f]{6})$/i;
const HEX8 = /^#([0-9a-f]{8})$/i;
const HEX3 = /^#([0-9a-f]{3})$/i;

const NAMED_CSS_COLORS: Record<string, string> = {
  white: "#ffffff",
  black: "#000000",
  transparent: "#ffffff",
};

export function normalizeHexColor(
  value: string | undefined | null,
): string | null {
  if (!value) return null;
  let trimmed = value.trim().toLowerCase();

  // Strip css functions wrappers we don't resolve yet
  if (trimmed.startsWith("lab(") || trimmed.startsWith("oklch(") || trimmed.startsWith("hsl(")) {
    return null;
  }

  if (trimmed in NAMED_CSS_COLORS) return NAMED_CSS_COLORS[trimmed]!;

  if (HEX6.test(trimmed)) return trimmed;
  // #RRGGBBAA (Webflow often uses #ffffffe6) — keep RGB, drop alpha
  const m8 = trimmed.match(HEX8);
  if (m8?.[1]) return `#${m8[1].slice(0, 6)}`;
  const m3 = trimmed.match(HEX3);
  if (m3) {
    const [, h] = m3;
    if (!h) return null;
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  const rgb = trimmed.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i,
  );
  if (rgb) {
    const r = Number(rgb[1]);
    const g = Number(rgb[2]);
    const b = Number(rgb[3]);
    if (r <= 255 && g <= 255 && b <= 255) {
      return `#${[r, g, b]
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("")}`;
    }
  }
  return null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const n = normalizeHexColor(hex);
  if (!n) return null;
  const r = parseInt(n.slice(1, 3), 16);
  const g = parseInt(n.slice(3, 5), 16);
  const b = parseInt(n.slice(5, 7), 16);
  return { r, g, b };
}

/** Relative luminance — higher = lighter */
export function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(rgb.r) + 0.7152 * f(rgb.g) + 0.0722 * f(rgb.b);
}

export function isNearWhiteOrBlack(hex: string): boolean {
  const lum = luminance(hex);
  return lum < 0.06 || lum > 0.94;
}

export function isGrayish(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  const delta = max - min;
  // Absolute + relative — catches Clerk slate accents like #5e5f6e
  return max === 0 || delta < 28 || delta / max < 0.18;
}

export function contrastDelta(a: string, b: string): number {
  return Math.abs(luminance(a) - luminance(b));
}

/** Black or white label that reads on `bg`. */
export function contrastTextOn(bg: string): string {
  return luminance(bg) > 0.55 ? "#0c0c0c" : "#ffffff";
}

/** Never allow white-on-white / black-on-black CTA labels. */
export function ensureCtaLabelContrast(bg: string, text: string): string {
  const fill = normalizeHexColor(bg) ?? "#0c0c0c";
  const label = normalizeHexColor(text);
  if (label && contrastDelta(fill, label) >= 0.35) return label;
  return contrastTextOn(fill);
}

/**
 * Greeting/body must outrank muted/headline against the shell.
 * Fixes Hi {name} looking weaker than “Quick update…” below it.
 */
export function ensureShellTextHierarchy(
  bg: string,
  bodyText: string,
  mutedText: string,
): { bodyText: string; mutedText: string } {
  const shell = normalizeHexColor(bg) ?? "#ffffff";
  let body = normalizeHexColor(bodyText) ?? contrastTextOn(shell);
  let muted =
    normalizeHexColor(mutedText) ??
    (luminance(shell) > 0.5 ? "#6b6b70" : "#a1a1a6");

  // Greeting (“Hi …”) must stay readable on the shell
  if (contrastDelta(shell, body) < 0.5) {
    body = contrastTextOn(shell);
  }

  // Only auto-fix muted when it’s unreadable on the shell.
  // Do not replace user-chosen Secondary just because it’s close to body —
  // that made the Customizations color picker feel broken.
  if (contrastDelta(shell, muted) < 0.18) {
    muted = luminance(shell) > 0.5 ? "#6b6b70" : "#a1a1a6";
  }

  return { bodyText: body, mutedText: muted };
}

/** Hue buckets for filtering error/warning palette noise */
function hueBucket(hex: string): "red" | "yellow" | "green" | "blue" | "purple" | "other" {
  const rgb = hexToRgb(hex);
  if (!rgb) return "other";
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 0.08) return "other";
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  if (h < 20 || h >= 340) return "red";
  if (h >= 40 && h < 75) return "yellow";
  if (h >= 75 && h < 165) return "green";
  // Clerk purple (#6c47ff ≈ 252°) sits in blue-violet — treat as purple brand
  if (h >= 250 && h < 330) return "purple";
  if (h >= 185 && h < 250) return "blue";
  return "other";
}

export type WeightedColor = { hex: string; weight: number; source: string };

/**
 * Resolve CSS custom properties like:
 * --primary: var(--color-blue);
 * --color-blue: var(--color-blue-600);
 * --color-blue-600: #155dfc;
 */
export function resolveCssVariables(cssText: string): Map<string, string> {
  const raw = new Map<string, string>();
  const re = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cssText)) !== null) {
    const name = m[1]?.toLowerCase();
    const value = m[2]?.trim();
    if (!name || !value) continue;
    // Keep first hex definition; later lab()/theme variants are less useful
    if (!raw.has(name)) raw.set(name, value);
  }

  const resolved = new Map<string, string>();

  const resolve = (name: string, depth = 0): string | null => {
    if (depth > 8) return null;
    if (resolved.has(name)) return resolved.get(name) ?? null;
    const value = raw.get(name);
    if (!value) return null;

    const hex = normalizeHexColor(value);
    if (hex) {
      resolved.set(name, hex);
      return hex;
    }

    const varRef = value.match(/^var\(\s*--([a-zA-Z0-9_-]+)/i);
    if (varRef?.[1]) {
      const inner = resolve(varRef[1].toLowerCase(), depth + 1);
      if (inner) {
        resolved.set(name, inner);
        return inner;
      }
    }
    return null;
  };

  for (const name of raw.keys()) {
    resolve(name);
  }
  return resolved;
}

const PRIMARY_VAR_NAMES = [
  "primary",
  "color-primary",
  "brand",
  "color-brand",
  "accent",
  "color-accent",
  "color-blue",
  "brand-primary",
  "theme-primary",
];

const SECONDARY_VAR_NAMES = [
  "muted-foreground",
  "color-muted-foreground",
  "brand-muted",
  "color-brand-muted",
  "color-brand-line",
  "secondary",
  "color-secondary",
  "foreground",
  "color-foreground",
];

function weightForVarName(name: string): number {
  const n = name.toLowerCase();
  // Explicit brand orange/red tokens (Brave rorange, BAT) beat generic "primary"
  if (/brands-rorange|brands-bat|brand-orange|brand-red|gradient-hero/.test(n)) {
    return 110;
  }
  if (/legacy-interactive[123]\b/.test(n)) return 95;
  if (PRIMARY_VAR_NAMES.includes(n)) return 100;
  if (
    n.endsWith("-600") &&
    /(blue|violet|indigo|purple|brand|primary|orange|red)/.test(n)
  ) {
    return 70;
  }
  if (
    n.endsWith("-500") &&
    /(blue|violet|indigo|purple|brand|primary|orange|red)/.test(n)
  ) {
    return 60;
  }
  // Error/success system colors — not brand (but don't kill real brand reds above)
  if (/destructive|danger|error|warning|success|systemfeedback/.test(n)) {
    return 5;
  }
  if (/\borange-\d|\bred-\d/.test(n) && /primitive/.test(n)) {
    // Mid-scale brand oranges (Brave orange-60 etc.)
    if (/orange-(50|60|40)\b/.test(n) || /red-(50|60)\b/.test(n)) return 55;
    return 8;
  }
  if (SECONDARY_VAR_NAMES.includes(n)) return 40;
  return 0;
}

/** Collect high-signal brand colors from CSS variables + theme-color. */
export function collectWeightedBrandColors(args: {
  themeColor?: string | null;
  cssTexts: string[];
  htmlSnippet?: string;
}): WeightedColor[] {
  const out: WeightedColor[] = [];

  const theme = normalizeHexColor(args.themeColor);
  if (theme && !isNearWhiteOrBlack(theme)) {
    out.push({ hex: theme, weight: 90, source: "theme-color" });
  }

  for (const css of args.cssTexts) {
    const vars = resolveCssVariables(css);
    for (const [name, hex] of vars) {
      if (isNearWhiteOrBlack(hex)) continue;
      const weight = weightForVarName(name);
      if (weight <= 0) continue;
      out.push({ hex, weight, source: `var(--${name})` });
    }

    // CTA / button backgrounds in authored CSS (not utility dumps alone)
    const buttonBg = css.matchAll(
      /(?:^|[}\s])(?:button|\.btn|\.cta|[.#][a-z0-9_-]*(?:cta|primary|brand)[a-z0-9_-]*)[^{]*\{[^}]*background(?:-color)?:\s*([^;}\n]+)/gi,
    );
    for (const match of buttonBg) {
      const hex = normalizeHexColor(match[1]?.trim() ?? "");
      if (hex && !isNearWhiteOrBlack(hex) && !isGrayish(hex)) {
        out.push({ hex, weight: 55, source: "button-bg" });
      }
    }
  }

  // Lightweight HTML hints (og / inline theme) — low weight
  if (args.htmlSnippet) {
    const vars = resolveCssVariables(args.htmlSnippet);
    for (const [name, hex] of vars) {
      const weight = weightForVarName(name);
      if (weight >= 60 && !isNearWhiteOrBlack(hex)) {
        out.push({ hex, weight: weight - 10, source: `html-var(--${name})` });
      }
    }
  }

  return out;
}

/** Classic Material / demo-UI swatches (Clerk component showcase, etc.). */
const DEMO_UI_PALETTE = new Set([
  "#1976d2",
  "#2196f3",
  "#03a9f4",
  "#00bcd4",
  "#4caf50",
  "#8bc34a",
  "#cddc39",
  "#ffeb3b",
  "#ffc107",
  "#ff9800",
  "#ff5722",
  "#ff3d00",
  "#f44336",
  "#e91e63",
  "#9c27b0",
  "#673ab7",
  "#3f51b5",
  "#607d8b",
  "#795548",
]);

export function pickPrimaryColor(weighted: WeightedColor[]): string | null {
  if (weighted.length === 0) return null;

  // Aggregate by hex
  const scores = new Map<string, { score: number; sources: string[] }>();
  for (const item of weighted) {
    const hex = normalizeHexColor(item.hex);
    if (!hex || isNearWhiteOrBlack(hex)) continue;
    let score = item.weight;
    const bucket = hueBucket(hex);
    const fromBrandToken =
      /brands-rorange|brands-bat|gradient-hero|legacy-interactive|button-bg|cta:/i.test(
        item.source,
      );

    // Pastel washes (Brave mistakenly picked #ffe1d4) — almost never the brand
    if (luminance(hex) > 0.75 && !fromBrandToken) score *= 0.15;

    // Soft-downrank accidental error reds, but keep strong brand oranges/reds
    if (bucket === "red" && item.weight < 55 && !fromBrandToken) score *= 0.4;
    if (bucket === "yellow" && item.weight < 80 && !fromBrandToken) score *= 0.25;
    if (bucket === "green" && item.weight < 70) score *= 0.45;
    // Neon sky/cyan section accents (Clerk auth demos) beat real purple brands by raw count
    if (bucket === "blue" && luminance(hex) > 0.45 && !fromBrandToken) {
      score *= 0.28;
    }
    // Material demo chips inside product screenshots (Clerk component gallery)
    if (DEMO_UI_PALETTE.has(hex) && !fromBrandToken) score *= 0.12;
    // Product purples / violet brands (Clerk #6c47ff)
    if (bucket === "purple") score *= 1.35;
    if (isGrayish(hex)) score *= 0.12;
    if (fromBrandToken) score *= 1.35;

    const prev = scores.get(hex) ?? { score: 0, sources: [] };
    prev.score += score;
    prev.sources.push(item.source);
    scores.set(hex, prev);
  }

  // Merge near-duplicate purples (#6c47ff ≈ #6248f6) so they beat lone blues
  const purpleBoosted = new Set<string>();
  for (const [hex, info] of [...scores.entries()]) {
    if (hueBucket(hex) !== "purple" || purpleBoosted.has(hex)) continue;
    let bonus = 0;
    for (const [other, otherInfo] of scores) {
      if (other === hex || hueBucket(other) !== "purple") continue;
      const rgbA = hexToRgb(hex);
      const rgbB = hexToRgb(other);
      if (!rgbA || !rgbB) continue;
      const dist =
        Math.abs(rgbA.r - rgbB.r) +
        Math.abs(rgbA.g - rgbB.g) +
        Math.abs(rgbA.b - rgbB.b);
      if (dist < 80) {
        bonus += otherInfo.score * 0.5;
        purpleBoosted.add(other);
      }
    }
    info.score += bonus;
    purpleBoosted.add(hex);
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1].score - a[1].score);
  if (ranked.length === 0) return null;

  // Prefer saturated mid-luminance brand colors over pale/dark extremes
  const vivid = ranked.find(([hex, info]) => {
    const lum = luminance(hex);
    return (
      info.score >= 35 &&
      lum > 0.08 &&
      lum < 0.72 &&
      !isGrayish(hex)
    );
  });
  if (vivid) return vivid[0];

  return ranked[0]?.[0] ?? null;
}

export function pickSecondaryColor(
  weighted: WeightedColor[],
  primary: string,
  cssTexts: string[] = [],
): string | null {
  const primaryNorm = normalizeHexColor(primary);

  // Prefer explicit muted / foreground tokens
  for (const css of cssTexts) {
    const vars = resolveCssVariables(css);
    for (const name of SECONDARY_VAR_NAMES) {
      const hex = vars.get(name);
      if (!hex || hex === primaryNorm || isNearWhiteOrBlack(hex)) continue;
      if (isGrayish(hex) || luminance(hex) > 0.2) return hex;
    }
    // Brand gray scales like --color-polar-500
    for (const [name, hex] of vars) {
      if (!/-(400|500|600)$/.test(name)) continue;
      if (!/(muted|polar|gray|slate|zinc|neutral|stone)/.test(name)) continue;
      if (!hex || hex === primaryNorm || isNearWhiteOrBlack(hex)) continue;
      return hex;
    }
  }

  // Grayish candidates from weighted list
  const grays = weighted
    .map((w) => normalizeHexColor(w.hex))
    .filter((c): c is string => c != null && c !== primaryNorm && isGrayish(c) && !isNearWhiteOrBlack(c));
  if (grays.length > 0) {
    grays.sort(
      (a, b) => Math.abs(luminance(a) - 0.42) - Math.abs(luminance(b) - 0.42),
    );
    return grays[0] ?? null;
  }

  return primaryNorm ? softenPrimary(primaryNorm) : "#6b6b70";
}

function softenPrimary(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#6b6b70";
  const mix = (c: number) => Math.round(c * 0.35 + 120 * 0.65);
  return `#${[mix(rgb.r), mix(rgb.g), mix(rgb.b)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * When a page has no CSS variables (YouTube-style), pick rare saturated
 * colors from the HTML head/body — never from full stylesheet dumps.
 */
export function fallbackHtmlAccentColors(html: string): WeightedColor[] {
  // Brand tokens can sit deep in large SPAs (YouTube ~700kb+). Cap at 1.5MB.
  const head = html.slice(0, 1_500_000);
  const accentCounts = new Map<string, number>();
  const grayCounts = new Map<string, number>();
  const hexRe = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;
  let m: RegExpExecArray | null;
  while ((m = hexRe.exec(head)) !== null) {
    const hex = normalizeHexColor(m[0]);
    if (!hex || isNearWhiteOrBlack(hex)) continue;
    if (isGrayish(hex)) {
      grayCounts.set(hex, (grayCounts.get(hex) ?? 0) + 1);
      continue;
    }
    accentCounts.set(hex, (accentCounts.get(hex) ?? 0) + 1);
  }

  const out: WeightedColor[] = [];
  for (const [hex, count] of accentCounts) {
    const bucket = hueBucket(hex);
    // Prefer brand-like accents that appear a few times (not once from noise)
    let weight = 20 + Math.min(count, 4) * 8;
    if (bucket === "red") weight += 10; // YouTube etc.
    if (bucket === "blue" || bucket === "purple") weight += 12;
    if (bucket === "yellow") weight -= 15;
    if (bucket === "green") weight -= 5;
    out.push({ hex, weight, source: "html-accent" });
  }

  // Grays feed secondary (muted text), not primary
  for (const [hex, count] of grayCounts) {
    const lum = luminance(hex);
    if (lum < 0.15 || lum > 0.75) continue;
    out.push({
      hex,
      weight: 25 + Math.min(count, 5) * 3,
      source: "html-muted",
    });
  }
  return out;
}
