/** In-page extractor — serialized into Playwright page.evaluate. */
export function browserCapturePageScript(): string {
  return `(() => {
  function rgbToHex(input) {
    if (!input || input === "transparent" || input === "rgba(0, 0, 0, 0)") return null;
    const m = String(input).match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/i);
    if (!m) {
      if (/^#[0-9a-f]{3,8}$/i.test(String(input).trim())) {
        let h = String(input).trim().toLowerCase();
        if (h.length === 4) h = "#" + h[1]+h[1]+h[2]+h[2]+h[3]+h[3];
        return h.slice(0, 7);
      }
      return null;
    }
    const hex = (n) => Number(n).toString(16).padStart(2, "0");
    return "#" + hex(m[1]) + hex(m[2]) + hex(m[3]);
  }

  function lum(hex) {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const f = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }

  function paintedBg(el) {
    let node = el;
    for (let i = 0; i < 8 && node; i++) {
      const cs = getComputedStyle(node);
      const hex = rgbToHex(cs.backgroundColor);
      if (hex && lum(hex) > 0.02) return hex;
      node = node.parentElement;
    }
    return null;
  }

  function sampleGradientSolid(el) {
    const cs = getComputedStyle(el);
    const bg = cs.backgroundImage || "";
    const m = bg.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/i);
    if (m) {
      const hex = (n) => Number(n).toString(16).padStart(2, "0");
      return "#" + hex(m[1]) + hex(m[2]) + hex(m[3]);
    }
    for (const pseudo of ["::before", "::after"]) {
      try {
        const pcs = getComputedStyle(el, pseudo);
        const pbg = pcs.backgroundImage || pcs.backgroundColor || "";
        const pm = String(pbg).match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/i);
        if (pm) {
          const hex = (n) => Number(n).toString(16).padStart(2, "0");
          return "#" + hex(pm[1]) + hex(pm[2]) + hex(pm[3]);
        }
      } catch (_) {}
    }
    return null;
  }

  const CTA_RE = /get started|download|buy|sign up|start free|try free|subscribe|pricing|get brave|get ramp|start now|claim|create account|book a demo|start building/i;
  const CTA_PROMO = /join us at|forward\\b|summit|conference|webinar|hackathon|sign up with (google|github|apple)|continue with (google|github|apple)|log in with/i;
  const vw = window.innerWidth || 1200;
  const vh = window.innerHeight || 800;

  const candidates = [];
  const nodes = document.querySelectorAll("a, button, [role='button'], input[type='submit']");
  for (const el of nodes) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 28) continue;
    if (rect.top > vh * 1.2 || rect.bottom < 0) continue;
    const text = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim().replace(/\\s+/g, " ");
    if (!text || text.length > 48) continue;
    if (CTA_PROMO.test(text)) continue;
    const cls = (el.className && String(el.className)) || "";
    let score = 0;
    if (CTA_RE.test(text)) score += 40;
    if (/\\bjoin\\b/i.test(text) && !CTA_RE.test(text)) score -= 20;
    if (/hero|cta|primary|btn--hero|button--primary|is-hero/i.test(cls)) score += 35;
    // Hero band only — mid-page product demos (Clerk auth section) poison brand
    if (rect.top < vh * 0.55) score += 28;
    else if (rect.top < vh * 0.85) score += 8;
    else score -= 25;
    if (rect.width > 100 && rect.width < vw * 0.6) score += 10;
    if (rect.height >= 40 && rect.height <= 72) score += 8;
    score += Math.max(0, 18 - Math.floor(rect.top / 70));
    candidates.push({ el, text, score, rect });
  }
  candidates.sort((a, b) => b.score - a.score);

  let ctaBg = null;
  let ctaText = null;
  let ctaRadius = 12;
  let brandFromCta = null;

  // Pick later after pageBg is known so we can reject shell-matching fills (Ramp white-on-white).
  const rankedCtas = candidates.slice(0, 20);

  /** Prefer body/html stacks — never CTA (often inherits a marketing face). */
  function declaredFontFamily(el) {
    if (!el) return null;
    const cs = getComputedStyle(el);
    for (const key of ["--font-sans", "--font-body", "--font-family", "--font"]) {
      const v = cs.getPropertyValue(key).trim();
      if (v && !v.startsWith("var(")) return v;
    }
    const stack = (cs.fontFamily || "").trim();
    return stack || null;
  }

  function sampleViewportBg() {
    const points = [
      [vw * 0.5, vh * 0.28],
      [vw * 0.5, vh * 0.12],
      [vw * 0.22, vh * 0.32],
      [vw * 0.78, vh * 0.32],
      [vw * 0.5, vh * 0.5],
    ];
    const votes = new Map();
    for (const [x, y] of points) {
      const el = document.elementFromPoint(x, y);
      if (!el) continue;
      const hex = paintedBg(el) || sampleGradientSolid(el);
      if (!hex) continue;
      votes.set(hex, (votes.get(hex) || 0) + 1);
    }
    let best = null;
    let bestN = 0;
    for (const [hex, n] of votes) {
      if (n > bestN) {
        best = hex;
        bestN = n;
      }
    }
    return best;
  }

  function dominantPageBg() {
    let best = { hex: null, score: 0 };
    const roots = [
      document.documentElement,
      document.body,
      ...Array.from(document.querySelectorAll("main, section, header, [class*='hero'], [class*='Hero']")),
    ];
    const seen = new Set();
    for (const el of roots) {
      if (!el || seen.has(el)) continue;
      seen.add(el);
      const rect = el.getBoundingClientRect();
      if (rect.width < vw * 0.45 || rect.height < vh * 0.25) continue;
      if (rect.bottom < 40 || rect.top > vh * 0.85) continue;
      const hex = rgbToHex(getComputedStyle(el).backgroundColor) || sampleGradientSolid(el);
      if (!hex) continue;
      const cover =
        Math.min(rect.width, vw) *
        Math.min(Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0)), vh);
      let score = cover;
      if (rect.top < 120) score *= 1.25;
      if (score > best.score) best = { hex, score };
    }
    return best.hex;
  }

  const bodyCs = getComputedStyle(document.body);
  let pageBg =
    sampleViewportBg() ||
    dominantPageBg() ||
    paintedBg(document.documentElement) ||
    paintedBg(document.body) ||
    rgbToHex(bodyCs.backgroundColor) ||
    "#ffffff";

  // Prefer chromatic hero fills (Clerk purple) over near-black secondary buttons.
  function isChromatic(hex) {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return Math.max(r, g, b) - Math.min(r, g, b) > 40;
  }

  // Choose CTA after shell is known — reject fills that disappear into the page.
  for (const c of rankedCtas) {
    const cs = getComputedStyle(c.el);
    let bg = rgbToHex(cs.backgroundColor) || sampleGradientSolid(c.el) || paintedBg(c.el);
    if (!bg) continue;
    const color = rgbToHex(cs.color) || "#ffffff";
    // Skip ghost / shell-matching buttons (Ramp white-on-white)
    if (Math.abs(lum(bg) - lum(pageBg)) < 0.12) continue;
    if (Math.abs(lum(bg) - lum(color)) < 0.18) continue;
    // On light pages, skip near-black chips when a later chromatic hero CTA exists
    if (lum(pageBg) > 0.7 && lum(bg) < 0.2 && !isChromatic(bg)) {
      const hasChromaticHero = rankedCtas.some((other) => {
        if (other.rect.top > vh * 0.6) return false;
        const ocs = getComputedStyle(other.el);
        const obg = rgbToHex(ocs.backgroundColor) || sampleGradientSolid(other.el);
        return obg && isChromatic(obg) && Math.abs(lum(obg) - lum(pageBg)) >= 0.12;
      });
      if (hasChromaticHero) continue;
    }
    const br = parseFloat(cs.borderTopLeftRadius) || 0;
    ctaBg = bg;
    ctaText = color;
    ctaRadius = br >= 999 || br >= Math.min(c.rect.height, c.rect.width) / 2 - 1 ? 9999 : Math.round(br);
    if (isChromatic(bg) && lum(bg) > 0.08 && lum(bg) < 0.92) brandFromCta = bg;
    else if (!brandFromCta && lum(bg) < 0.92 && lum(bg) > 0.08) brandFromCta = bg;
    if (c.score >= 35 && (isChromatic(bg) || lum(pageBg) < 0.35)) break;
    if (c.score >= 50) break;
  }
  // Fallback: best scored candidate even if low contrast (merge will fix label)
  if (!ctaBg) {
    for (const c of rankedCtas) {
      const cs = getComputedStyle(c.el);
      let bg = rgbToHex(cs.backgroundColor) || sampleGradientSolid(c.el) || paintedBg(c.el);
      if (!bg) continue;
      const color = rgbToHex(cs.color) || "#ffffff";
      const br = parseFloat(cs.borderTopLeftRadius) || 0;
      ctaBg = bg;
      ctaText = color;
      ctaRadius = br >= 999 || br >= Math.min(c.rect.height, c.rect.width) / 2 - 1 ? 9999 : Math.round(br);
      if (lum(bg) < 0.92 && lum(bg) > 0.08) brandFromCta = bg;
      break;
    }
  }

  if (ctaBg && lum(ctaBg) > 0.85 && lum(pageBg) > 0.85 && rankedCtas[0]) {
    let node = rankedCtas[0].el.parentElement;
    for (let i = 0; i < 8 && node; i++) {
      const hex = rgbToHex(getComputedStyle(node).backgroundColor);
      const rect = node.getBoundingClientRect();
      if (
        hex &&
        lum(hex) < 0.35 &&
        rect.width >= vw * 0.55 &&
        rect.height >= vh * 0.35
      ) {
        pageBg = hex;
        break;
      }
      node = node.parentElement;
    }
  }

  const main = document.querySelector("main") || document.body;
  const mainCs = getComputedStyle(main);
  let pageText = rgbToHex(mainCs.color) || rgbToHex(bodyCs.color) || "#0c0c0c";
  if (lum(pageBg) < 0.35) {
    const h = document.querySelector("h1, h2");
    if (h) {
      const ht = rgbToHex(getComputedStyle(h).color);
      if (ht && lum(ht) > 0.5) pageText = ht;
    } else if (lum(pageText) < 0.4) {
      pageText = "#f5f5f5";
    }
  }
  let fontFamily =
    declaredFontFamily(document.body) ||
    declaredFontFamily(document.documentElement) ||
    declaredFontFamily(main) ||
    null;
  // Generics / OS stacks win over a lonely Inter from a Next.js variable class
  const firstFace = (fontFamily || "")
    .split(",")[0]
    ?.replace(/["']/g, "")
    .trim()
    .toLowerCase();
  const genericFirst =
    !firstFace ||
    firstFace === "sans" ||
    firstFace === "sans-serif" ||
    firstFace === "system-ui" ||
    firstFace === "-apple-system" ||
    firstFace === "blinkmacsystemfont" ||
    firstFace === "ui-sans-serif" ||
    firstFace === "helvetica" ||
    firstFace === "arial";
  if (genericFirst) {
    fontFamily = fontFamily || "system-ui, sans-serif";
  }

  let linkColor = null;
  const contentRoot = document.querySelector("main") || document.body;
  const nav = document.querySelector("nav, header");
  for (const a of contentRoot.querySelectorAll("a[href]")) {
    if (nav && nav.contains(a)) continue;
    const t = (a.innerText || "").trim();
    if (t.length < 2 || t.length > 80) continue;
    const rect = a.getBoundingClientRect();
    if (rect.top > vh || rect.height < 8) continue;
    const cs = getComputedStyle(a);
    const hex = rgbToHex(cs.color);
    if (!hex) continue;
    if (Math.abs(lum(hex) - lum(pageBg)) < 0.15) continue;
    if (hex === pageText) continue;
    linkColor = hex;
    break;
  }

  let muted = null;
  for (const p of contentRoot.querySelectorAll("p, span, small")) {
    const cs = getComputedStyle(p);
    const hex = rgbToHex(cs.color);
    if (!hex) continue;
    const text = (p.innerText || "").trim();
    if (text.length < 24) continue;
    if (Math.abs(lum(hex) - lum(pageBg)) < 0.12) continue;
    if (hex === pageText) continue;
    const op = parseFloat(cs.opacity || "1");
    if (op < 0.95 || Math.abs(lum(hex) - lum(pageText)) > 0.08) {
      muted = hex;
      break;
    }
  }
  if (!muted) {
    muted = lum(pageBg) < 0.35 ? "#a1a1a6" : "#6b6b70";
  }
  if (!linkColor) {
    linkColor = brandFromCta || (lum(pageBg) < 0.35 ? "#ffffff" : pageText);
  }

  const confidence = ctaBg ? (candidates[0] && candidates[0].score >= 40 ? 88 : 72) : 45;

  return {
    pageBackgroundColor: pageBg,
    pageTextColor: pageText,
    mutedTextColor: muted,
    linkColor: linkColor || brandFromCta || pageText,
    ctaBackgroundColor: ctaBg || (lum(pageBg) > 0.5 ? "#0c0c0c" : "#ffffff"),
    ctaTextColor: ctaText || (lum(pageBg) > 0.5 ? "#ffffff" : "#0c0c0c"),
    ctaBorderRadiusPx: ctaRadius,
    fontFamilyRaw: fontFamily,
    brandColor: brandFromCta,
    confidence,
  };
})()`;
}
