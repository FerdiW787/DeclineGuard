import {
  mergeBrandTokens,
  scrapeDomainBrand,
} from "../convex/lib/brandImport/extract";

async function main() {
  const domains =
    process.argv.slice(2).length > 0
      ? process.argv.slice(2)
      : ["polar.sh", "linea.app", "linear.app", "youtube.com"];

  for (const domain of domains) {
    try {
      const scraped = await scrapeDomainBrand(domain);
      const tokens = mergeBrandTokens({
        domain,
        scraped,
        storeName: "Test Store",
        storeLogoUrl: null,
      });
      console.log("\n===", domain, "===");
      console.log({
        brandColor: tokens.brandColor,
        ctaBackgroundColor: tokens.ctaBackgroundColor,
        ctaTextColor: tokens.ctaTextColor,
        ctaShape: tokens.ctaShape,
        ctaBorderRadiusPx: tokens.ctaBorderRadiusPx,
        emailBackgroundColor: tokens.emailBackgroundColor,
        emailTextColor: tokens.emailTextColor,
        emailFont: tokens.emailFont,
        buttonSource: tokens.sources.button,
        confidence: tokens.confidence,
      });
    } catch (err) {
      console.error(domain, err);
    }
  }
}

main();
