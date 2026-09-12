/**
 * Browser brand capture from Convex: HTTPS worker only.
 *
 * Playwright must NEVER be imported here — Convex cannot bundle Chromium.
 * Dev (laptop): `npm run dev` (or `npm run brand-capture:tunnel`) → trycloudflare.com URL in Convex DEV
 * Prod:         Fly app declineguard-brand-capture (see fly.brand-capture.toml)
 * Fallback:     unset BRAND_CAPTURE_WORKER_URL → CSS scrape
 */

import {
  ensureCtaLabelContrast,
  ensureShellTextHierarchy,
  normalizeHexColor,
} from "./colors";

export type BrowserCapturedKit = {
  pageBackgroundColor: string;
  pageTextColor: string;
  mutedTextColor: string;
  linkColor: string;
  ctaBackgroundColor: string;
  ctaTextColor: string;
  ctaBorderRadiusPx: number;
  fontFamilyRaw: string | null;
  brandColor: string | null;
  confidence: number;
};

const CAPTURE_TIMEOUT_MS = 15_000;

type RawCapture = {
  pageBackgroundColor?: string | null;
  pageTextColor?: string | null;
  mutedTextColor?: string | null;
  linkColor?: string | null;
  ctaBackgroundColor?: string | null;
  ctaTextColor?: string | null;
  ctaBorderRadiusPx?: number | null;
  fontFamilyRaw?: string | null;
  brandColor?: string | null;
  confidence?: number | null;
};

/** Normalize raw worker JSON into a BrandKit-compatible capture. */
export function normalizeBrowserCapture(
  raw: RawCapture | null,
): BrowserCapturedKit | null {
  if (!raw) return null;
  const pageBg =
    normalizeHexColor(raw.pageBackgroundColor ?? "") ?? "#ffffff";
  const pageText =
    normalizeHexColor(raw.pageTextColor ?? "") ?? "#0c0c0c";
  const muted =
    normalizeHexColor(raw.mutedTextColor ?? "") ?? "#6b6b70";
  const link =
    normalizeHexColor(raw.linkColor ?? "") ??
    normalizeHexColor(raw.brandColor ?? "") ??
    "#0c0c0c";
  const ctaBg =
    normalizeHexColor(raw.ctaBackgroundColor ?? "") ?? "#0c0c0c";
  const ctaText =
    normalizeHexColor(raw.ctaTextColor ?? "") ?? "#ffffff";
  const radius =
    typeof raw.ctaBorderRadiusPx === "number" &&
    Number.isFinite(raw.ctaBorderRadiusPx)
      ? Math.max(0, Math.min(9999, Math.round(raw.ctaBorderRadiusPx)))
      : 12;
  const font =
    typeof raw.fontFamilyRaw === "string" && raw.fontFamilyRaw.trim()
      ? raw.fontFamilyRaw.trim().slice(0, 200)
      : null;
  const brand = normalizeHexColor(raw.brandColor ?? "") ?? null;
  const confidence =
    typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
      ? Math.max(0, Math.min(100, Math.round(raw.confidence)))
      : 70;

  const ctaLabel = ensureCtaLabelContrast(ctaBg, ctaText);
  const hierarchy = ensureShellTextHierarchy(pageBg, pageText, muted);

  return {
    pageBackgroundColor: pageBg,
    pageTextColor: hierarchy.bodyText,
    mutedTextColor: hierarchy.mutedText,
    linkColor: link,
    ctaBackgroundColor: ctaBg,
    ctaTextColor: ctaLabel,
    ctaBorderRadiusPx: radius,
    fontFamilyRaw: font,
    brandColor: brand,
    confidence,
  };
}

/**
 * Call the dedicated Playwright worker when configured.
 * Returns null when unset / timeout / error — caller uses CSS scrape.
 */
function isLoopbackWorkerUrl(base: string): boolean {
  try {
    const host = new URL(base).hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}

export async function captureBrandFromBrowser(
  domain: string,
): Promise<BrowserCapturedKit | null> {
  const base = process.env.BRAND_CAPTURE_WORKER_URL?.trim();
  if (!base) return null;

  // Convex cloud cannot reach your laptop — skip instead of hanging ~15s.
  if (isLoopbackWorkerUrl(base)) {
    console.warn(
      "Brand capture worker URL is loopback; skipping browser capture. Use a tunnel URL or unset BRAND_CAPTURE_WORKER_URL.",
    );
    return null;
  }

  const secret = process.env.BRAND_CAPTURE_WORKER_SECRET?.trim();
  const url = new URL("/capture", base.endsWith("/") ? base : `${base}/`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CAPTURE_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({ domain }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(
        `Brand capture worker HTTP ${res.status} for ${url.toString()}`,
      );
      return null;
    }
    const json = (await res.json()) as RawCapture;
    return normalizeBrowserCapture(json);
  } catch (err) {
    // Common when URL is http://127.0.0.1 — Convex cloud cannot reach your laptop.
    console.warn(
      "Brand capture worker unreachable:",
      err instanceof Error ? err.message : err,
      `(url=${url.toString()})`,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}
