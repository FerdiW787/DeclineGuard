/**
 * Playwright homepage capture — scripts / brand-capture worker only.
 * Never import this from convex/ (breaks Convex bundling).
 */

import { chromium } from "playwright";
import { normalizeBrowserCapture } from "../../convex/lib/brandImport/browserCapture";
import { browserCapturePageScript } from "./browserCapturePageScript";

const CAPTURE_TIMEOUT_MS = 15_000;

export async function captureBrandViaPlaywright(domain: string) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (compatible; DeclineGuardBrandBot/1.0; +https://declineguard.com)",
    });
    const target = domain.startsWith("http")
      ? domain
      : `https://${domain.replace(/^www\./, "")}`;
    await page.goto(target, {
      waitUntil: "domcontentloaded",
      timeout: CAPTURE_TIMEOUT_MS,
    });
    try {
      await page.waitForLoadState("networkidle", { timeout: 4_000 });
    } catch {
      await page.waitForTimeout(1_200);
    }
    const raw = await page.evaluate(browserCapturePageScript());
    return normalizeBrowserCapture(raw as Parameters<typeof normalizeBrowserCapture>[0]);
  } catch {
    return null;
  } finally {
    await browser.close().catch(() => undefined);
  }
}
