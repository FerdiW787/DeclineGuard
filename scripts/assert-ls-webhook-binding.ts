/**
 * Platform webhook secret must not authorize merchant billing or recoveries.
 * Run: npx tsx scripts/assert-ls-webhook-binding.ts
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isFeeInvoiceClaimKey,
  parseFeeInvoiceClaimKey,
} from "../convex/lib/feeBilling";
import {
  applyPlatformSubscriptionAllowed,
  claimKeyFromFeeOrderProductName,
  feeInvoicePaidFromVerifiedOrder,
  generateMerchantWebhookSecret,
  invoiceOwnsVerifiedLemonOrder,
  lemonFeeInvoiceLookupFromOrder,
  lemonWebhookSecretChoice,
  merchantRecoveredPaymentAuthorized,
  parseLemonOrderForFeeInvoice,
  parseLemonSubscription,
} from "../convex/lib/lemonWebhookAuth";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const platformStoreId = "store-platform";
const merchantStoreId = "store-merchant";
const feeVariantId = "variant-fee";

assert(
  lemonWebhookSecretChoice({
    storeId: platformStoreId,
    platformStoreId,
  }) === "platform",
  "platform store uses the platform secret",
);
assert(
  lemonWebhookSecretChoice({
    storeId: merchantStoreId,
    platformStoreId,
  }) === "merchant",
  "merchant store uses a per-store secret",
);
assert(
  lemonWebhookSecretChoice({ storeId: null, platformStoreId }) === "reject",
  "missing store id cannot bind a secret",
);
assert(
  !merchantRecoveredPaymentAuthorized("platform"),
  "platform secret must not accept a recovered payment for an arbitrary store",
);
assert(
  !merchantRecoveredPaymentAuthorized("reject"),
  "unbound signature must not accept a recovered payment",
);
assert(
  merchantRecoveredPaymentAuthorized("merchant"),
  "merchant-store secret may record a recovered payment for that store",
);

assert(
  !isFeeInvoiceClaimKey("fee-invoice:"),
  "bare fee-invoice prefix is not a claim key",
);
assert(
  !isFeeInvoiceClaimKey("fee-invoice:user"),
  "fee-invoice plus user without a UTC period is not a claim key",
);
assert(
  !isFeeInvoiceClaimKey("fee-invoice:user:2026-10:extra"),
  "claim key must not have a trailing suffix",
);
assert(
  isFeeInvoiceClaimKey("fee-invoice:user:2026-10"),
  "fee-invoice + user id + UTC period is the real key",
);
const parsed = parseFeeInvoiceClaimKey("fee-invoice:user_abc:2026-10");
assert(
  parsed?.userId === "user_abc" && parsed.periodKey === "2026-10",
  "parseFeeInvoiceClaimKey reads user id and UTC period",
);

const coveringOrder = {
  orderId: "ord_real",
  storeId: platformStoreId,
  status: "paid",
  testMode: false,
  subtotalCents: 5000,
  totalCents: 5000,
  variantId: feeVariantId,
  productName: "DeclineGuard recovery fees — 2026-10 fee-invoice:user_a:2026-10",
  checkoutId: null as string | null,
  paidAtMs: Date.UTC(2026, 9, 2),
};

assert(
  feeInvoicePaidFromVerifiedOrder({
    secretChoice: "platform",
    platformStoreId,
    feeVariantId,
    verifiedOrder: null,
    claimedCents: 4000,
  }).accept === false,
  "forged invoice: covering amount + fee-invoice prefix without a Lemon order must not mark paid",
);
assert(
  feeInvoicePaidFromVerifiedOrder({
    secretChoice: "merchant",
    platformStoreId,
    feeVariantId,
    verifiedOrder: coveringOrder,
    claimedCents: 4000,
  }).accept === false,
  "merchant-signed body must not mark a platform fee invoice paid",
);
assert(
  feeInvoicePaidFromVerifiedOrder({
    secretChoice: "platform",
    platformStoreId,
    feeVariantId,
    verifiedOrder: { ...coveringOrder, storeId: merchantStoreId },
    claimedCents: 4000,
  }).accept === false,
  "order for a merchant store must not pay a platform fee invoice",
);
assert(
  feeInvoicePaidFromVerifiedOrder({
    secretChoice: "platform",
    platformStoreId,
    feeVariantId,
    verifiedOrder: { ...coveringOrder, variantId: "variant-pro" },
    claimedCents: 4000,
  }).accept === false,
  "a real Pro order must not pay a fee invoice",
);
assert(
  feeInvoicePaidFromVerifiedOrder({
    secretChoice: "platform",
    platformStoreId,
    feeVariantId,
    verifiedOrder: coveringOrder,
    claimedCents: 4000,
  }).accept === true,
  "real paid live fee-variant order for our store may mark the invoice paid",
);
assert(
  feeInvoicePaidFromVerifiedOrder({
    secretChoice: "platform",
    platformStoreId,
    feeVariantId: null,
    verifiedOrder: coveringOrder,
    claimedCents: 4000,
  }).accept === false,
  "missing fee variant id must fail closed, not skip",
);
assert(
  feeInvoicePaidFromVerifiedOrder({
    secretChoice: "platform",
    platformStoreId,
    feeVariantId,
    verifiedOrder: { ...coveringOrder, variantId: null },
    claimedCents: 4000,
  }).accept === false,
  "order without a variant id must fail closed",
);

const otherInvoiceClaim = "fee-invoice:user_b:2026-10";
assert(
  claimKeyFromFeeOrderProductName(coveringOrder.productName) ===
    "fee-invoice:user_a:2026-10",
  "claim key comes from the verified order product name, not webhook custom data",
);
assert(
  lemonFeeInvoiceLookupFromOrder(coveringOrder).claimKey ===
    "fee-invoice:user_a:2026-10",
  "lookup keys are taken from the order GET",
);
assert(
  invoiceOwnsVerifiedLemonOrder({
    invoice: {
      claimKey: "fee-invoice:user_a:2026-10",
      lsOrderId: null,
      lsCheckoutId: null,
    },
    order: coveringOrder,
  }),
  "invoice whose claim key is in the order product name owns the order",
);
assert(
  !invoiceOwnsVerifiedLemonOrder({
    invoice: {
      claimKey: otherInvoiceClaim,
      lsOrderId: null,
      lsCheckoutId: null,
    },
    order: coveringOrder,
  }),
  "a real paid order must not mark a different invoice paid",
);
assert(
  !invoiceOwnsVerifiedLemonOrder({
    invoice: {
      claimKey: otherInvoiceClaim,
      lsOrderId: null,
      lsCheckoutId: null,
    },
    order: { ...coveringOrder, productName: null, checkoutId: null },
  }),
  "a covering paid order with no invoice bind must not mark another invoice paid",
);
assert(
  invoiceOwnsVerifiedLemonOrder({
    invoice: {
      claimKey: otherInvoiceClaim,
      lsOrderId: "ord_real",
      lsCheckoutId: null,
    },
    order: coveringOrder,
  }),
  "replay: invoice that already stored this order id owns it",
);
assert(
  !invoiceOwnsVerifiedLemonOrder({
    invoice: {
      claimKey: otherInvoiceClaim,
      lsOrderId: "ord_other",
      lsCheckoutId: null,
    },
    order: coveringOrder,
  }),
  "invoice already tied to another order id does not own this order",
);
assert(
  invoiceOwnsVerifiedLemonOrder({
    invoice: {
      claimKey: otherInvoiceClaim,
      lsOrderId: null,
      lsCheckoutId: "chk_real",
    },
    order: { ...coveringOrder, productName: null, checkoutId: "chk_real" },
  }),
  "invoice that stored this checkout id owns the order when product name has no claim key",
);
assert(
  !invoiceOwnsVerifiedLemonOrder({
    invoice: {
      claimKey: otherInvoiceClaim,
      lsOrderId: null,
      lsCheckoutId: "chk_other",
    },
    order: { ...coveringOrder, productName: null, checkoutId: "chk_real" },
  }),
  "a covering order for a different checkout must not mark this invoice paid",
);

assert(
  applyPlatformSubscriptionAllowed({
    verifiedFromLemonApi: false,
    userResolvedBy: "bodyUserId",
    nextPlan: "pro",
  }).allow === false,
  "body user id plus catalog variant must not promote without a Lemon subscription GET",
);
assert(
  applyPlatformSubscriptionAllowed({
    verifiedFromLemonApi: true,
    userResolvedBy: "bodyUserId",
    nextPlan: "pro",
  }).allow === false,
  "even after GET, the user must not be whichever id the body names first",
);
assert(
  applyPlatformSubscriptionAllowed({
    verifiedFromLemonApi: true,
    userResolvedBy: "lsSubscriptionId",
    nextPlan: "pro",
  }).allow === true,
  "verified subscription plus stored sub id may promote",
);
assert(
  applyPlatformSubscriptionAllowed({
    verifiedFromLemonApi: true,
    userResolvedBy: "checkoutNonce",
    nextPlan: "pro",
  }).allow === true,
  "verified subscription plus our checkout nonce may promote",
);

const parsedOrder = parseLemonOrderForFeeInvoice({
  data: {
    id: "99",
    attributes: {
      store_id: 42,
      status: "paid",
      test_mode: false,
      subtotal: 1000,
      total: 1100,
      first_order_item: { variant_id: 7 },
      updated_at: "2026-10-02T00:00:00.000Z",
    },
  },
});
assert(parsedOrder?.orderId === "99", "parse order id");
assert(parsedOrder?.storeId === "42", "parse store id");
assert(parsedOrder?.variantId === "7", "parse variant id");
assert(parsedOrder?.totalCents === 1100, "parse total cents");
assert(parsedOrder?.productName === null, "order parser does not invent a product name");
assert(parsedOrder?.checkoutId === null, "order parser does not read webhook custom data");

const parsedNamedOrder = parseLemonOrderForFeeInvoice({
  data: {
    id: "100",
    attributes: {
      store_id: 42,
      status: "paid",
      test_mode: false,
      subtotal: 1000,
      total: 1000,
      first_order_item: {
        variant_id: 7,
        product_name:
          "DeclineGuard recovery fees — 2026-10 fee-invoice:user_a:2026-10",
      },
      updated_at: "2026-10-02T00:00:00.000Z",
    },
  },
});
assert(
  claimKeyFromFeeOrderProductName(parsedNamedOrder?.productName ?? null) ===
    "fee-invoice:user_a:2026-10",
  "order GET product_name is the trusted claim key source",
);

const parsedSub = parseLemonSubscription({
  data: {
    id: "sub_1",
    attributes: {
      store_id: 42,
      status: "active",
      test_mode: false,
      variant_id: 9,
      product_id: 3,
    },
  },
});
assert(parsedSub?.subscriptionId === "sub_1", "parse subscription id");
assert(parsedSub?.status === "active", "parse subscription status");
assert(parsedSub?.variantId === "9", "parse subscription variant");

const generated = generateMerchantWebhookSecret(
  Uint8Array.from([
    0xab, 0xcd, 0x12, 0x34, 0x56, 0x78, 0x90, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e,
    0x0f, 0x10, 0x11, 0x12,
  ]),
);
assert(
  generated.length === 32 && /^[0-9a-f]+$/.test(generated),
  "merchant secret is 32 hex chars",
);
assert(
  generated !== "platform-secret-placeholder",
  "generated merchant secret is not the platform secret",
);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const billingSrc = readFileSync(
  join(repoRoot, "convex/functions/billing.ts"),
  "utf8",
);
assert(
  billingSrc.includes("verifiedFromLemonApi") &&
    billingSrc.includes("findPlatformBillingUserBySource") &&
    !billingSrc.includes("convexUserId: v.optional") &&
    !billingSrc.includes("clerkUserId: v.optional"),
  "applyPlatformSubscription must not take a body user id",
);
const actionsSrc = readFileSync(
  join(repoRoot, "convex/functions/lemonSqueezyActions.ts"),
  "utf8",
);
const webhookSrc = readFileSync(
  join(repoRoot, "convex/lemonWebhook.ts"),
  "utf8",
);
const feeLibSrc = readFileSync(
  join(repoRoot, "convex/lib/feeBilling.ts"),
  "utf8",
);

assert(
  actionsSrc.includes("generateMerchantWebhookSecret") &&
    !actionsSrc.includes("webhookCallbackConfig") &&
    !/signingSecret:\s*secret/.test(actionsSrc),
  "installStoreWebhook must not copy LEMONSQUEEZY_WEBHOOK_SECRET onto a merchant webhook",
);
assert(
  !actionsSrc.includes("LEMONSQUEEZY_WEBHOOK_SECRET"),
  "merchant webhook install/ping must not read the platform webhook secret",
);
assert(
  webhookSrc.includes("secretsForStore") &&
    webhookSrc.includes("fetchLemonPlatformOrder") &&
    webhookSrc.includes("fetchLemonPlatformSubscription") &&
    webhookSrc.includes("feeInvoicePaidFromVerifiedOrder") &&
    webhookSrc.includes("invoiceOwnsVerifiedLemonOrder") &&
    webhookSrc.includes("lemonFeeInvoiceLookupFromOrder") &&
    webhookSrc.includes("releaseWebhookEvent") &&
    webhookSrc.includes("merchantRecoveredPaymentAuthorized"),
  "handler binds the signature to the store, looks the fee order up in Lemon, and releases rejected claims",
);
assert(
  webhookSrc.includes("verifiedFromLemonApi: true") &&
    !webhookSrc.includes("convexUserId: customRefs"),
  "Pro apply uses the Lemon subscription GET, not the body user id",
);
assert(
  webhookSrc.includes("return await releaseAndIgnore()"),
  "a rejected paid decision after claim must release so the real delivery is not stuck",
);
assert(
  feeLibSrc.includes("parseFeeInvoiceClaimKey") &&
    feeLibSrc.includes("fee-invoice:([^:]+):(\\d{4}-\\d{2})") &&
    !feeLibSrc.includes('claimKey.startsWith("fee-invoice:")'),
  "claim key must be fee-invoice + user id + UTC period, not a prefix",
);

console.log("assert-ls-webhook-binding: ok");
