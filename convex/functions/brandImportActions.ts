"use node";

import { v, type Infer } from "convex/values";
import { action, type ActionCtx } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { isBrandImportUnlimited } from "../lib/brandImport/brandKit";
import { validateDomainInput } from "../lib/brandImport/domain";
import { mergeBrandTokens, scrapeDomainBrand } from "../lib/brandImport/extract";
import { captureBrandFromBrowser } from "../lib/brandImport/browserCapture";
import { emailFontValidator } from "../lib/emailFonts";

async function assertCallerActive(ctx: ActionCtx): Promise<void> {
  await ctx.runQuery(
    api.functions.adminTakeover.assertProductWritesAllowed,
    {},
  );
}

async function productClerkUserId(ctx: ActionCtx): Promise<string> {
  const product = await ctx.runQuery(
    api.functions.adminTakeover.getProductContext,
    {},
  );
  return product.clerkUserId;
}

const brandImportResultValidator = v.object({
  domain: v.string(),
  brandColor: v.string(),
  secondaryColor: v.string(),
  mutedTextColor: v.string(),
  linkColor: v.string(),
  pageBackgroundColor: v.string(),
  pageTextColor: v.string(),
  emailFont: emailFontValidator,
  fontFamilyRaw: v.union(v.string(), v.null()),
  fromName: v.string(),
  ctaBackgroundColor: v.string(),
  ctaTextColor: v.string(),
  ctaBorderRadiusPx: v.number(),
  ctaShape: v.union(
    v.literal("pill"),
    v.literal("rounded"),
    v.literal("square"),
  ),
  emailBackgroundColor: v.string(),
  emailTextColor: v.string(),
  confidence: v.number(),
  tierUsed: v.union(
    v.literal("tier1"),
    v.literal("tier2"),
    v.literal("browser"),
  ),
  captureMethod: v.union(
    v.literal("browser"),
    v.literal("css"),
    v.literal("defaults"),
  ),
  storeName: v.string(),
  storeLogoUrl: v.union(v.string(), v.null()),
  sources: v.object({
    logo: v.union(
      v.literal("lemon_squeezy"),
      v.literal("og_image"),
      v.literal("favicon"),
      v.literal("none"),
    ),
    name: v.union(
      v.literal("lemon_squeezy"),
      v.literal("og_site"),
      v.literal("domain"),
    ),
    colors: v.union(v.literal("domain_scrape"), v.literal("defaults")),
    font: v.union(v.literal("domain_scrape"), v.literal("default")),
    button: v.union(v.literal("homepage_cta"), v.literal("fallback")),
  }),
});

type BrandImportResult = Infer<typeof brandImportResultValidator>;

type BrandImportContext = {
  userId: Id<"users">;
  storeName: string;
  storeLogoUrl: string | null;
  storeSlug: string;
};

/** Scan a marketing domain + merge with Lemon Squeezy store identity. */
export const importBrandFromDomain = action({
  args: { domain: v.string() },
  returns: brandImportResultValidator,
  handler: async (ctx, args): Promise<BrandImportResult> => {
    await assertCallerActive(ctx);
    const clerkUserId = await productClerkUserId(ctx);

    const quota = await ctx.runQuery(
      internal.functions.recoverySettings.getBrandImportQuotaForClerkUser,
      { clerkUserId },
    );
    if (!quota.canImport) {
      const when = quota.nextImportAt
        ? new Date(quota.nextImportAt).toLocaleDateString()
        : "later this month";
      throw new Error(
        `You can re-import from your homepage once per month. Next free import: ${when}. Need an extra after a rebrand? Contact support.`,
      );
    }

    const { domain } = validateDomainInput(args.domain);

    const context: BrandImportContext | null = await ctx.runQuery(
      internal.functions.recoverySettings.getBrandImportContext,
      { clerkUserId },
    );
    if (!context) {
      throw new Error("Connect your Lemon Squeezy store first");
    }

    // Ladder: browser (15s) → CSS scrape → defaults (via merge).
    // Run in parallel; browser null → CSS path; failed scans do not burn limits.
    // Hard-cap browser so a stuck worker never blocks the CSS scrape path.
    const [browserSettled, scrapeSettled] = await Promise.allSettled([
      Promise.race([
        captureBrandFromBrowser(domain),
        new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), 16_000);
        }),
      ]),
      Promise.race([
        scrapeDomainBrand(domain),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                "That site took too long to scan. Try again in a moment.",
              ),
            );
          }, 20_000);
        }),
      ]),
    ]);

    const browserKit =
      browserSettled.status === "fulfilled" ? browserSettled.value : null;

    if (scrapeSettled.status === "rejected" && !browserKit) {
      throw scrapeSettled.reason instanceof Error
        ? scrapeSettled.reason
        : new Error("Could not scan that domain");
    }

    // Soft abuse guard after success only — monthly product quota is the real limit.
    // Dev with BRAND_IMPORT_UNLIMITED skips this so you can iterate freely.
    if (!isBrandImportUnlimited()) {
      await ctx.runMutation(internal.functions.rateLimit.consume, {
        key: `brand:scan:${clerkUserId}`,
        limit: 60,
        windowMs: 60 * 60 * 1000,
      });
    }

    const scraped =
      scrapeSettled.status === "fulfilled"
        ? scrapeSettled.value
        : {
            themeColor: browserKit!.brandColor,
            ogSiteName: null,
            ogImage: null,
            favicon: null,
            fontFamily: browserKit!.fontFamilyRaw,
            weightedColors: browserKit!.brandColor
              ? [
                  {
                    hex: browserKit!.brandColor,
                    weight: 10,
                    source: "browser",
                  },
                ]
              : [],
            cssTexts: [],
            html: "",
            buttonStyle: {
              backgroundColor: browserKit!.ctaBackgroundColor,
              textColor: browserKit!.ctaTextColor,
              borderRadiusPx: browserKit!.ctaBorderRadiusPx,
              shape:
                browserKit!.ctaBorderRadiusPx >= 40
                  ? ("pill" as const)
                  : ("rounded" as const),
              source: "cta:browser",
            },
            emailBackgroundColor: browserKit!.pageBackgroundColor,
            emailTextColor: browserKit!.pageTextColor,
            pageIsDark: false,
            tierUsed: "tier1" as const,
            confidence: browserKit!.confidence,
          };

    const tokens = mergeBrandTokens({
      domain,
      scraped,
      storeName: context.storeName,
      storeLogoUrl: context.storeLogoUrl,
      browserKit,
    });

    return {
      domain,
      brandColor: tokens.brandColor,
      secondaryColor: tokens.secondaryColor,
      mutedTextColor: tokens.mutedTextColor,
      linkColor: tokens.linkColor,
      pageBackgroundColor: tokens.pageBackgroundColor,
      pageTextColor: tokens.pageTextColor,
      emailFont: tokens.emailFont,
      fontFamilyRaw: tokens.fontFamilyRaw,
      fromName: tokens.fromName,
      ctaBackgroundColor: tokens.ctaBackgroundColor,
      ctaTextColor: tokens.ctaTextColor,
      ctaBorderRadiusPx: tokens.ctaBorderRadiusPx,
      ctaShape: tokens.ctaShape,
      emailBackgroundColor: tokens.emailBackgroundColor,
      emailTextColor: tokens.emailTextColor,
      confidence: tokens.confidence,
      tierUsed: tokens.tierUsed,
      captureMethod: tokens.captureMethod,
      storeName: context.storeName,
      storeLogoUrl: context.storeLogoUrl,
      sources: tokens.sources,
    };
  },
});
