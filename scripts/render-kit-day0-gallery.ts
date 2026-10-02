/**
 * Day-0 kit gallery for Fendem / CoS review.
 * Scrapes BrandKit via the storefront path, then renders each kit’s
 * gentle (Day 0) document the way the block-builder canvas does.
 *
 *   npx tsx scripts/render-kit-day0-gallery.ts
 *
 * Writes /opt/cursor/artifacts/email-kits-day0/{kitId}-day0.png + index.html
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import {
  mergeBrandTokens,
  scrapeDomainBrand,
} from "../convex/lib/brandImport/extract";
import {
  ensureCtaLabelContrast,
  ensureShellTextHierarchy,
} from "../convex/lib/brandImport/colors";
import {
  documentForKit,
  kitLogoAlign,
  kitShowsAccentBar,
  kitShowsGreeting,
  kitShowsStoreName,
} from "../src/lib/emailBlockKits";
import {
  markersToHtml,
  resolveShellBackground,
  resolveShellBorder,
  resolveShellBorderColor,
  resolveShellBorderWidth,
  resolveShellRadius,
  textBlockFaceStyle,
  type EmailBlock,
  type EmailDocument,
} from "../src/lib/emailBuilder";
import { styleEmailAnchors } from "../src/lib/emailRichText";
import {
  LAYOUT_PRESET_CATALOG,
  LAYOUT_PRESET_IDS,
  resolveTheme,
  type EmailThemeTokens,
} from "../src/lib/emailTheme";
import { LAYOUT_PRESET_STRUCTURE_META } from "../src/lib/emailLayoutPresets";
import { applyCopyVars } from "../src/lib/recoveryEmailCopy";
import { EMAIL_FONTS, emailFontFamily } from "../src/lib/emailFonts";

const OUT_DIR = "/opt/cursor/artifacts/email-kits-day0";
const SCRAPE_DOMAIN = "dodopayments.com";
const VARS = { product: "Pro Monthly", amount: "€29", firstName: "Maya" };

const NEUTRAL_TOKENS: EmailThemeTokens = {
  brandColor: "#111111",
  secondaryColor: "#6b6b70",
  mutedTextColor: "#6b6b70",
  linkColor: "#111111",
  pageBackgroundColor: "#f7f8f8",
  pageTextColor: "#111111",
  emailBackgroundColor: "#ffffff",
  emailTextColor: "#111111",
  ctaBackgroundColor: "#111111",
  ctaTextColor: "#ffffff",
  ctaBorderRadiusPx: 8,
  emailFont: "system",
  fontFamilyRaw: null,
};

type ScrapeReport = {
  ok: boolean;
  domain: string;
  storeName: string;
  logoUrl: string | null;
  captureMethod: string | null;
  confidence: number | null;
  error: string | null;
  tokens: EmailThemeTokens;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isDarkHex(hex: string): boolean {
  const m = hex.trim().toLowerCase().match(/^#([0-9a-f]{6})$/);
  if (!m?.[1]) return false;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.35;
}

async function downloadLogo(
  url: string,
  destBase: string,
): Promise<string | null> {
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 32) return null;
    const type = res.headers.get("content-type") ?? "";
    const ext = type.includes("png")
      ? "png"
      : type.includes("jpeg") || type.includes("jpg")
        ? "jpg"
        : type.includes("svg")
          ? "svg"
          : type.includes("webp")
            ? "webp"
            : "png";
    const dest = `${destBase}.${ext}`;
    await writeFile(dest, buf);
    return path.basename(dest);
  } catch {
    return null;
  }
}

async function scrapeConfigured(): Promise<ScrapeReport> {
  try {
    const scraped = await scrapeDomainBrand(SCRAPE_DOMAIN);
    const merged = mergeBrandTokens({
      domain: SCRAPE_DOMAIN,
      scraped,
      storeName: scraped.ogSiteName?.trim() || "Dodo Payments",
      storeLogoUrl: scraped.favicon ?? scraped.ogImage,
    });
    const resolved = resolveTheme({
      stylingMode: "configured",
      layoutPresetId: "sonos",
      configured: merged,
    });
    const remoteLogo = scraped.favicon ?? scraped.ogImage;
    const localLogo = remoteLogo
      ? await downloadLogo(remoteLogo, path.join(OUT_DIR, "store-logo"))
      : null;
    return {
      ok: true,
      domain: SCRAPE_DOMAIN,
      storeName: merged.fromName,
      logoUrl: localLogo,
      captureMethod: merged.captureMethod,
      confidence: merged.confidence,
      error: null,
      tokens: resolved.tokens,
    };
  } catch (error) {
    return {
      ok: false,
      domain: SCRAPE_DOMAIN,
      storeName: "Store",
      logoUrl: null,
      captureMethod: null,
      confidence: null,
      error: error instanceof Error ? error.message : String(error),
      tokens: NEUTRAL_TOKENS,
    };
  }
}

function renderHeader(
  storeName: string,
  logoUrl: string | null,
  brand: string,
  text: string,
  align: "left" | "center" | "right",
  showName: boolean,
): string {
  const justify =
    align === "center"
      ? "center"
      : align === "right"
        ? "flex-end"
        : "flex-start";
  const initial = escapeHtml((storeName.trim()[0] || "S").toUpperCase());
  const avatar = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="" width="36" height="36" style="width:36px;height:36px;border-radius:999px;object-fit:cover;background:${escapeHtml(brand)}" />`
    : `<span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:999px;background:${escapeHtml(brand)};color:#fff;font-size:14px;font-weight:700">${initial}</span>`;
  const name = showName
    ? `<span style="font-size:17px;font-weight:600;letter-spacing:-0.02em;color:${escapeHtml(text)};max-width:16rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(storeName)}</span>`
    : "";
  return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;justify-content:${justify}">${avatar}${name}</div>`;
}

function renderBlock(
  block: EmailBlock,
  theme: EmailThemeTokens,
  hierarchy: { bodyText: string; mutedText: string },
): string {
  const link = theme.linkColor;
  const style = `margin-top:${block.marginTop}px;margin-bottom:${block.marginBottom}px`;
  switch (block.type) {
    case "text": {
      const face = textBlockFaceStyle(block, {
        body: hierarchy.bodyText,
        muted: hierarchy.mutedText,
        link,
      });
      const html = styleEmailAnchors(
        markersToHtml(applyCopyVars(block.html, VARS)),
        link,
      );
      return `<p style="${style};font-size:${face.fontSize}px;color:${face.color};font-weight:${face.fontWeight ?? 400};font-style:${face.fontStyle ?? "normal"};text-decoration:${face.textDecoration ?? "none"};text-align:${face.textAlign};line-height:${face.lineHeight}">${html}</p>`;
    }
    case "button": {
      const bg = /^#[0-9a-fA-F]{6}$/.test(block.backgroundColor)
        ? block.backgroundColor
        : theme.ctaBackgroundColor;
      const fg = ensureCtaLabelContrast(bg, theme.ctaTextColor);
      return `<div style="${style};text-align:${block.align}"><span style="display:inline-flex;padding:10px 20px;font-size:12px;font-weight:600;background:${escapeHtml(bg)};color:${escapeHtml(fg)};border-radius:${theme.ctaBorderRadiusPx}px">${escapeHtml(block.label)}</span></div>`;
    }
    case "divider":
      return `<hr style="${style};border:0;border-top:1px solid rgba(0,0,0,0.08)" />`;
    case "spacer":
      return `<div style="${style};height:${Math.max(block.height, 8)}px"></div>`;
    case "image":
      return `<div style="${style}"></div>`;
    case "linkRow":
      return `<p style="${style};font-size:13px;color:${escapeHtml(hierarchy.mutedText)}">${escapeHtml(block.prefix)}<a href="#" style="color:${escapeHtml(link)}">${escapeHtml(block.linkLabel)}</a>${escapeHtml(block.suffix)}</p>`;
    default: {
      const _never: never = block;
      return _never;
    }
  }
}

function renderEmail(
  kitId: (typeof LAYOUT_PRESET_IDS)[number],
  theme: EmailThemeTokens,
  storeName: string,
  logoUrl: string | null,
): { html: string; doc: EmailDocument } {
  const doc = documentForKit("gentle", kitId);
  const shellBg = resolveShellBackground(doc, theme.emailBackgroundColor);
  const hierarchy = ensureShellTextHierarchy(
    shellBg,
    theme.emailTextColor,
    theme.mutedTextColor,
  );
  const borderOn = resolveShellBorder(doc);
  const borderColor = resolveShellBorderColor(doc, theme.brandColor);
  const borderWidth = borderOn ? resolveShellBorderWidth(doc) : 0;
  const radius = resolveShellRadius(doc);
  const dark = isDarkHex(shellBg);
  const footerMuted = dark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)";
  const footerRule = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";
  const subject = applyCopyVars(doc.subject, VARS);
  const blocks = doc.blocks
    .map((block) => renderBlock(block, theme, hierarchy))
    .join("");
  const greeting = kitShowsGreeting(kitId)
    ? `<p style="margin:0 0 16px;font-size:17px;font-weight:600;letter-spacing:-0.02em;color:${escapeHtml(hierarchy.bodyText)}">Hi ${escapeHtml(VARS.firstName)},</p>`
    : "";
  const accent = kitShowsAccentBar(kitId)
    ? `<div style="height:6px;background:${escapeHtml(theme.brandColor)}"></div>`
    : "";

  const html = `
    <article class="email" data-kit="${kitId}" style="width:600px;overflow:hidden;background:${escapeHtml(shellBg)};color:${escapeHtml(hierarchy.bodyText)};border:${borderWidth}px solid ${escapeHtml(borderColor)};border-radius:${radius}px;box-shadow:0 24px 60px -36px rgba(0,0,0,0.4);font-family:${emailFontFamily(theme.emailFont)}">
      <div style="border-bottom:1px solid rgba(0,0,0,0.06);background:#fafafa;padding:12px 20px">
        <p style="margin:0;font-size:10px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:rgba(0,0,0,0.4)">From</p>
        <p style="margin:2px 0 0;font-size:12px;font-weight:500;color:rgba(0,0,0,0.7)">${escapeHtml(storeName)} · billing@${escapeHtml(SCRAPE_DOMAIN)}</p>
        <p style="margin:8px 0 0;font-size:10px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:rgba(0,0,0,0.4)">Subject</p>
        <p style="margin:2px 0 0;font-size:13px;font-weight:600;color:#000">${escapeHtml(subject)}</p>
      </div>
      ${accent}
      <div style="padding:${doc.emailPadding}px;background:${escapeHtml(shellBg)};color:${escapeHtml(hierarchy.bodyText)}">
        ${renderHeader(storeName, logoUrl, theme.brandColor, hierarchy.bodyText, kitLogoAlign(kitId), kitShowsStoreName(kitId))}
        ${greeting}
        ${blocks}
        <hr style="margin:32px 0 16px;border:0;border-top:1px solid ${footerRule}" />
        <p style="margin:0;font-size:12px;color:${footerMuted}">Questions? <a href="#" style="color:${escapeHtml(theme.linkColor)}">support@${escapeHtml(SCRAPE_DOMAIN)}</a></p>
      </div>
    </article>`;
  return { html, doc };
}

function galleryPage(scrape: ScrapeReport, cards: string): string {
  const status = scrape.ok
    ? `Configured tokens from ${scrape.domain} scrape (${scrape.captureMethod}, confidence ${scrape.confidence}). CTA ${scrape.tokens.ctaBackgroundColor}.`
    : `Scrape failed for ${scrape.domain}: ${scrape.error}. Neutral placeholder tokens used — not a Dodo palette.`;
  const fontHref = EMAIL_FONTS[scrape.tokens.emailFont].googleHref;
  const fontLink = fontHref
    ? `<link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${escapeHtml(fontHref)}" rel="stylesheet" />`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>DeclineGuard — Day 0 kit gallery</title>
  ${fontLink}
  <style>
    body { margin: 0; background: #ffffff; color: #08090a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
    .wrap { max-width: 720px; margin: 0 auto; padding: 32px 20px 80px; }
    .shot { background: #ffffff; padding: 28px 24px; box-sizing: border-box; }
    h1 { font-size: 22px; letter-spacing: -0.03em; margin: 0 0 8px; }
    .meta { font-size: 13px; color: #6b6f76; line-height: 1.5; margin: 0 0 28px; }
    .card { margin: 0 0 40px; }
    .label { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #8a8f98; margin: 0 0 6px; }
    .hint { font-size: 13px; color: #6b6f76; margin: 0 0 12px; }
    a { color: inherit; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Recovery email starter kits — Day 0</h1>
    <p class="meta">${escapeHtml(status)} Same layout on Day 2 / Day 5; only copy intensity changes.</p>
    ${cards}
  </div>
</body>
</html>`;
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const scrape = await scrapeConfigured();
  const cards: string[] = [];

  for (const kitId of LAYOUT_PRESET_IDS) {
    const meta = LAYOUT_PRESET_STRUCTURE_META[kitId];
    const catalog = LAYOUT_PRESET_CATALOG[kitId];
    const { html } = renderEmail(
      kitId,
      scrape.tokens,
      scrape.storeName,
      scrape.logoUrl,
    );
    cards.push(`<section class="card">
      <p class="label">${escapeHtml(kitId)}</p>
      <p class="hint">${escapeHtml(meta.label)} — ${escapeHtml(catalog?.description ?? meta.hint)} · Day 0 / gentle</p>
      <div class="shot" data-shot="${kitId}">${html}</div>
    </section>`);
  }

  const galleryHtml = galleryPage(scrape, cards.join("\n"));
  const galleryPath = path.join(OUT_DIR, "index.html");
  await writeFile(galleryPath, galleryHtml, "utf8");
  await writeFile(
    path.join(OUT_DIR, "scrape.json"),
    JSON.stringify(scrape, null, 2),
    "utf8",
  );

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 760, height: 1400 },
    deviceScaleFactor: 2,
  });
  await page.goto(`file://${galleryPath}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  for (const kitId of LAYOUT_PRESET_IDS) {
    const handle = page.locator(`[data-shot="${kitId}"]`);
    await handle.screenshot({
      path: path.join(OUT_DIR, `${kitId}-day0.png`),
      type: "png",
    });
  }

  await browser.close();
  console.log(
    JSON.stringify(
      {
        outDir: OUT_DIR,
        scrapeOk: scrape.ok,
        storeName: scrape.storeName,
        tokens: scrape.tokens,
        error: scrape.error,
        kits: LAYOUT_PRESET_IDS.map((id) => `${id}-day0.png`),
      },
      null,
      2,
    ),
  );
}

void main();
