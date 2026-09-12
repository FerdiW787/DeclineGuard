/**
 * Regression fixtures for homepage brand import (CSS path + optional browser).
 *
 *   npx tsx scripts/brand-import-fixtures.ts
 *   npx tsx scripts/brand-import-fixtures.ts --browser
 */

import {
  mergeBrandTokens,
  scrapeDomainBrand,
} from "../convex/lib/brandImport/extract";
import { captureBrandViaPlaywright } from "./lib/playwrightBrandCapture";

type Expectation = {
  domain: string;
  /** Soft checks — scrape quality varies; fail only on hard mismatches */
  ctaBgNot?: string[];
  ctaBgApprox?: string;
  /** Only asserted when running with --browser */
  ctaBgApproxBrowser?: string;
  pageBgDark?: boolean;
  pageBgLight?: boolean;
  minConfidence?: number;
};

const FIXTURES: Expectation[] = [
  {
    domain: "polar.sh",
    pageBgDark: true,
    // White / near-white pill CTA
    minConfidence: 40,
  },
  {
    domain: "linear.app",
    pageBgDark: true,
    minConfidence: 40,
  },
  {
    domain: "lemonsqueezy.com",
    // Browser path: white pill on purple hero. CSS path may flatten CTA for contrast.
    ctaBgApproxBrowser: "#ffffff",
    minConfidence: 30,
  },
  {
    domain: "brave.com",
    // Hero CTA should be orange-red, not white/black
    ctaBgNot: ["#ffffff", "#000000", "#0c0c0c"],
    ctaBgApprox: "#ff5601",
    pageBgLight: true,
    minConfidence: 40,
  },
];

function hexDistance(a: string, b: string): number {
  const parse = (h: string) => {
    const x = h.replace("#", "");
    return [
      parseInt(x.slice(0, 2), 16),
      parseInt(x.slice(2, 4), 16),
      parseInt(x.slice(4, 6), 16),
    ] as const;
  };
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
}

function isDark(hex: string): boolean {
  const x = hex.replace("#", "");
  const r = parseInt(x.slice(0, 2), 16) / 255;
  const g = parseInt(x.slice(2, 4), 16) / 255;
  const b = parseInt(x.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.45;
}

async function runOne(domain: string, useBrowser: boolean) {
  const browserKit = useBrowser
    ? await captureBrandViaPlaywright(domain)
    : null;
  const scraped = await scrapeDomainBrand(domain);
  const tokens = mergeBrandTokens({
    domain,
    scraped,
    storeName: "Fixture Store",
    storeLogoUrl: null,
    browserKit,
  });
  return tokens;
}

function assertCtaApprox(
  actual: string,
  expected: string,
  errors: string[],
): void {
  const dist = hexDistance(actual, expected);
  const nearWhite =
    expected.toLowerCase() === "#ffffff" &&
    hexDistance(actual, "#ffffff") <= 80;
  if (dist > 120 && !nearWhite) {
    errors.push(`CTA bg ${actual} far from ${expected} (Δ=${dist})`);
  }
}

async function main() {
  const useBrowser = process.argv.includes("--browser");
  let failed = 0;

  console.log(
    useBrowser
      ? "Running fixtures with browser → CSS ladder\n"
      : "Running fixtures with CSS scrape (pass --browser for Playwright)\n",
  );

  for (const fix of FIXTURES) {
    const label = fix.domain;
    try {
      const tokens = await runOne(fix.domain, useBrowser);
      const errors: string[] = [];

      if (
        fix.minConfidence != null &&
        tokens.confidence < fix.minConfidence
      ) {
        errors.push(
          `confidence ${tokens.confidence} < ${fix.minConfidence}`,
        );
      }
      if (fix.pageBgDark && !isDark(tokens.pageBackgroundColor)) {
        errors.push(
          `expected dark page bg, got ${tokens.pageBackgroundColor}`,
        );
      }
      if (fix.pageBgLight && isDark(tokens.pageBackgroundColor)) {
        errors.push(
          `expected light page bg, got ${tokens.pageBackgroundColor}`,
        );
      }
      if (fix.ctaBgNot?.includes(tokens.ctaBackgroundColor.toLowerCase())) {
        errors.push(`CTA bg forbidden: ${tokens.ctaBackgroundColor}`);
      }
      if (fix.ctaBgApprox) {
        assertCtaApprox(tokens.ctaBackgroundColor, fix.ctaBgApprox, errors);
      }
      if (useBrowser && fix.ctaBgApproxBrowser) {
        assertCtaApprox(
          tokens.ctaBackgroundColor,
          fix.ctaBgApproxBrowser,
          errors,
        );
      }

      const summary = {
        captureMethod: tokens.captureMethod,
        pageBackgroundColor: tokens.pageBackgroundColor,
        pageTextColor: tokens.pageTextColor,
        mutedTextColor: tokens.mutedTextColor,
        linkColor: tokens.linkColor,
        ctaBackgroundColor: tokens.ctaBackgroundColor,
        ctaTextColor: tokens.ctaTextColor,
        ctaShape: tokens.ctaShape,
        emailFont: tokens.emailFont,
        fontFamilyRaw: tokens.fontFamilyRaw,
        confidence: tokens.confidence,
      };

      if (errors.length > 0) {
        failed += 1;
        console.log(`FAIL ${label}`);
        console.log(summary);
        for (const e of errors) console.log(`  · ${e}`);
      } else {
        console.log(`OK   ${label}`);
        console.log(summary);
      }
      console.log("");
    } catch (err) {
      failed += 1;
      console.log(`FAIL ${label}`);
      console.error(err);
      console.log("");
    }
  }

  if (failed > 0) {
    console.error(`${failed} fixture(s) failed`);
    process.exit(1);
  }
  console.log("All fixtures passed");
}

main();
