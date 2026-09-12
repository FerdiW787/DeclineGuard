import type { EmailFontId } from "../emailFonts";

export type BrandCaptureMethod = "browser" | "css" | "defaults";

export type BrandKitCtaShape = "pill" | "rounded" | "square";

/** Canonical tokens applied to recovery emails after homepage import. */
export type BrandKit = {
  brandColor: string;
  secondaryColor: string;
  mutedTextColor: string;
  linkColor: string;
  pageBackgroundColor: string;
  pageTextColor: string;
  emailBackgroundColor: string;
  emailTextColor: string;
  ctaBackgroundColor: string;
  ctaTextColor: string;
  ctaBorderRadiusPx: number;
  ctaShape: BrandKitCtaShape;
  emailFont: EmailFontId;
  fontFamilyRaw: string | null;
  captureMethod: BrandCaptureMethod;
  confidence: number;
};

export const BRAND_IMPORT_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Dev-only: set `BRAND_IMPORT_UNLIMITED=1` on the Convex deployment
 * (`npx convex env set BRAND_IMPORT_UNLIMITED 1`) for infinite re-imports.
 * Never enable on production.
 */
export function isBrandImportUnlimited(): boolean {
  const raw = process.env.BRAND_IMPORT_UNLIMITED?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export type BrandImportQuota = {
  canImport: boolean;
  reason:
    | "ok_first"
    | "ok_cooldown"
    | "ok_bonus"
    | "ok_unlimited"
    | "blocked_cooldown";
  lastBrandImportAt: number | null;
  brandImportBonusCredits: number;
  nextImportAt: number | null;
  brandImportCompletedAt: number | null;
};

export function evaluateBrandImportQuota(args: {
  brandImportCompletedAt: number | null;
  lastBrandImportAt: number | null;
  brandImportBonusCredits: number;
  now: number;
  unlimited?: boolean;
}): BrandImportQuota {
  const bonus = Math.max(0, Math.floor(args.brandImportBonusCredits));
  const completedAt = args.brandImportCompletedAt;
  const lastAt = args.lastBrandImportAt;

  if (args.unlimited ?? isBrandImportUnlimited()) {
    return {
      canImport: true,
      reason: "ok_unlimited",
      lastBrandImportAt: lastAt,
      brandImportBonusCredits: bonus,
      nextImportAt: null,
      brandImportCompletedAt: completedAt,
    };
  }

  if (completedAt == null) {
    return {
      canImport: true,
      reason: "ok_first",
      lastBrandImportAt: lastAt,
      brandImportBonusCredits: bonus,
      nextImportAt: null,
      brandImportCompletedAt: completedAt,
    };
  }

  if (bonus > 0) {
    return {
      canImport: true,
      reason: "ok_bonus",
      lastBrandImportAt: lastAt,
      brandImportBonusCredits: bonus,
      nextImportAt: null,
      brandImportCompletedAt: completedAt,
    };
  }

  if (lastAt == null || args.now - lastAt >= BRAND_IMPORT_COOLDOWN_MS) {
    return {
      canImport: true,
      reason: "ok_cooldown",
      lastBrandImportAt: lastAt,
      brandImportBonusCredits: bonus,
      nextImportAt: null,
      brandImportCompletedAt: completedAt,
    };
  }

  return {
    canImport: false,
    reason: "blocked_cooldown",
    lastBrandImportAt: lastAt,
    brandImportBonusCredits: bonus,
    nextImportAt: lastAt + BRAND_IMPORT_COOLDOWN_MS,
    brandImportCompletedAt: completedAt,
  };
}
