"use node";

import { createClerkClient } from "@clerk/backend";
import { v } from "convex/values";
import { action, internalAction, type ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { feeInvoiceClaimKey, utcPeriodKey } from "../lib/feeBilling";

/**
 * LS mechanism: Checkout + `custom_price` → paid webhook `order_created`.
 *
 * Lemon Squeezy has no API to open a standalone invoice or charge a card
 * on file without an existing subscription. A one-time variant on
 * DeclineGuard’s own store plus POST /v1/checkouts?custom_price is the
 * least-friction fit with the current HMAC webhook. Generate-order-invoice
 * is PDF-only after an order exists; subscription invoices need a Pro
 * subscription (out of scope this run).
 *
 * Env: LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_STORE_ID,
 * LEMONSQUEEZY_FEE_VARIANT_ID, optional LEMONSQUEEZY_STORE_CURRENCY (USD).
 * The platform store webhook must use LEMONSQUEEZY_WEBHOOK_SECRET and
 * subscribe to `order_created`.
 */

const LS_HEADERS = {
  Accept: "application/vnd.api+json",
  "Content-Type": "application/vnd.api+json",
} as const;

type PlatformLsConfig = {
  apiKey: string;
  storeId: string;
  variantId: string;
  currency: string;
};

type LsJson = {
  meta?: { test_mode?: boolean };
  data?: unknown;
  errors?: Array<{ detail?: string; title?: string }>;
};

function platformLsConfig(): PlatformLsConfig | null {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY?.trim();
  const storeId = process.env.LEMONSQUEEZY_STORE_ID?.trim();
  const variantId = process.env.LEMONSQUEEZY_FEE_VARIANT_ID?.trim();
  const currency = (
    process.env.LEMONSQUEEZY_STORE_CURRENCY?.trim() || "USD"
  ).toUpperCase();
  if (!apiKey || !storeId || !variantId) return null;
  return { apiKey, storeId, variantId, currency };
}

async function lsPlatformFetch(
  apiKey: string,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<LsJson> {
  const res = await fetch(`https://api.lemonsqueezy.com/v1${path}`, {
    method: init?.method ?? "GET",
    headers: {
      ...LS_HEADERS,
      Authorization: `Bearer ${apiKey}`,
    },
    body: init?.body != null ? JSON.stringify(init.body) : undefined,
  });

  const json = (await res.json()) as LsJson;
  if (!res.ok) {
    const detail =
      json.errors?.[0]?.detail ??
      json.errors?.[0]?.title ??
      `Lemon Squeezy error (${res.status})`;
    throw new Error(detail);
  }
  return json;
}

function readCheckout(json: LsJson): { id: string; url?: string } {
  const data = json.data;
  if (typeof data !== "object" || data === null || !("id" in data)) {
    throw new Error("Lemon Squeezy checkout response missing id");
  }
  const id = data.id;
  if (typeof id !== "string" || !id.trim()) {
    throw new Error("Lemon Squeezy checkout response missing id");
  }
  const attrs =
    "attributes" in data && typeof data.attributes === "object"
      ? (data.attributes as Record<string, unknown>)
      : null;
  const url = typeof attrs?.url === "string" ? attrs.url : undefined;
  return { id: id.trim(), url };
}

async function lookupClerkEmail(
  clerkUserId: string,
): Promise<string | undefined> {
  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (!secretKey) return undefined;
  try {
    const client = createClerkClient({ secretKey });
    const user = await client.users.getUser(clerkUserId);
    return (
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses[0]?.emailAddress
    );
  } catch (err) {
    console.warn("Fee invoice: Clerk email lookup failed", err);
    return undefined;
  }
}

const invoiceMerchantResultValidator = v.object({
  outcome: v.union(
    v.literal("created"),
    v.literal("skipped_zero"),
    v.literal("skipped_claimed"),
    v.literal("skipped_currency"),
    v.literal("skipped_unconfigured"),
    v.literal("failed"),
  ),
  invoiceId: v.union(v.id("billingInvoices"), v.null()),
  totalCents: v.number(),
  feeCount: v.number(),
  error: v.union(v.string(), v.null()),
});

type InvoiceMerchantResult = {
  outcome:
    | "created"
    | "skipped_zero"
    | "skipped_claimed"
    | "skipped_currency"
    | "skipped_unconfigured"
    | "failed";
  invoiceId: Id<"billingInvoices"> | null;
  totalCents: number;
  feeCount: number;
  error: string | null;
};

type OwedFeePage = {
  page: Array<{
    _id: Id<"recoveryFees">;
    userId: Id<"users">;
    feeCents: number;
    currency: string;
    testMode: boolean;
    billingInvoiceId?: Id<"billingInvoices">;
  }>;
  isDone: boolean;
  continueCursor: string;
};

type MonthlyFeeInvoiceSummary = {
  merchants: number;
  created: number;
  skippedZero: number;
  skippedClaimed: number;
  skippedCurrency: number;
  failed: number;
  unconfigured: boolean;
};

async function invoiceMerchant(
  ctx: ActionCtx,
  userId: Id<"users">,
  periodKey: string,
  nowMs: number,
  actorUserId: Id<"users"> | null,
): Promise<InvoiceMerchantResult> {
  const config = platformLsConfig();
  if (!config) {
    console.error(
      "Fee invoice skipped: LEMONSQUEEZY_API_KEY / LEMONSQUEEZY_STORE_ID / LEMONSQUEEZY_FEE_VARIANT_ID not set",
    );
    return {
      outcome: "skipped_unconfigured",
      invoiceId: null,
      totalCents: 0,
      feeCount: 0,
      error: "not_configured",
    };
  }

  const claim = await ctx.runMutation(
    internal.functions.feeBilling.claimBillingPeriod,
    {
      userId,
      periodKey,
      storeCurrency: config.currency,
      nowMs,
    },
  );

  if (claim.skippedZero) {
    return {
      outcome: "skipped_zero",
      invoiceId: claim.invoiceId,
      totalCents: 0,
      feeCount: 0,
      error: null,
    };
  }
  if (claim.currencyMixed || claim.currencyMismatch) {
    console.warn(
      `Fee invoice skipped for ${userId}: ${claim.reason ?? "currency"}`,
    );
    return {
      outcome: "skipped_currency",
      invoiceId: claim.invoiceId,
      totalCents: 0,
      feeCount: 0,
      error: claim.reason,
    };
  }
  if (!claim.claimed || !claim.invoiceId) {
    return {
      outcome: "skipped_claimed",
      invoiceId: claim.invoiceId,
      totalCents: claim.totalCents,
      feeCount: claim.feeCount,
      error: claim.reason,
    };
  }

  const invoiceId = claim.invoiceId;
  const target = await ctx.runQuery(
    internal.functions.feeBilling.getUserBillingTarget,
    { userId },
  );
  const email = target
    ? await lookupClerkEmail(target.clerkUserId)
    : undefined;

  try {
    const json = await lsPlatformFetch(config.apiKey, "/checkouts", {
      method: "POST",
      body: {
        data: {
          type: "checkouts",
          attributes: {
            custom_price: claim.totalCents,
            product_options: {
              name: `DeclineGuard recovery fees — ${periodKey}`,
              description: `${claim.feeCount} recovered payment${claim.feeCount === 1 ? "" : "s"}`,
            },
            checkout_data: {
              ...(email ? { email } : {}),
              ...(target?.userName ? { name: target.userName } : {}),
              custom: {
                claim_key: feeInvoiceClaimKey(userId, periodKey),
                billing_invoice_id: invoiceId,
              },
            },
            expires_at: new Date(nowMs + 45 * 24 * 60 * 60 * 1000).toISOString(),
          },
          relationships: {
            store: { data: { type: "stores", id: config.storeId } },
            variant: { data: { type: "variants", id: config.variantId } },
          },
        },
      },
    });

    const checkout = readCheckout(json);
    const attached = await ctx.runMutation(
      internal.functions.feeBilling.attachLsCheckout,
      {
        invoiceId,
        lsCheckoutId: checkout.id,
        lsCheckoutUrl: checkout.url,
        nowMs,
      },
    );
    if (!attached) {
      throw new Error("Failed to persist Lemon Squeezy checkout id");
    }

    await ctx.runMutation(internal.functions.feeBilling.recordFeeInvoiceCreated, {
      invoiceId,
      actorUserId,
    });

    return {
      outcome: "created",
      invoiceId,
      totalCents: claim.totalCents,
      feeCount: claim.feeCount,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lemon Squeezy error";
    console.error(`Fee invoice LS create failed for ${userId}:`, message);
    await ctx.runMutation(internal.functions.feeBilling.markBillingClaimFailed, {
      invoiceId,
      error: message,
      unlinkFees: true,
    });
    return {
      outcome: "failed",
      invoiceId,
      totalCents: claim.totalCents,
      feeCount: claim.feeCount,
      error: message,
    };
  }
}

export const runMonthlyFeeInvoices = internalAction({
  args: {},
  returns: v.object({
    merchants: v.number(),
    created: v.number(),
    skippedZero: v.number(),
    skippedClaimed: v.number(),
    skippedCurrency: v.number(),
    failed: v.number(),
    unconfigured: v.boolean(),
  }),
  handler: async (ctx): Promise<MonthlyFeeInvoiceSummary> => {
    if (!platformLsConfig()) {
      console.error(
        "Monthly fee invoice job skipped — platform Lemon Squeezy env is not configured",
      );
      return {
        merchants: 0,
        created: 0,
        skippedZero: 0,
        skippedClaimed: 0,
        skippedCurrency: 0,
        failed: 0,
        unconfigured: true,
      };
    }

    const nowMs = Date.now();
    const periodKey = utcPeriodKey(nowMs);
    const userIds = new Set<Id<"users">>();
    let cursor: string | null = null;

    for (;;) {
      const page: OwedFeePage = await ctx.runQuery(
        internal.functions.feeBilling.listOwedFeePage,
        {
          paginationOpts: { numItems: 100, cursor },
        },
      );
      for (const fee of page.page) {
        if (fee.testMode) continue;
        if (fee.billingInvoiceId != null) continue;
        if (fee.feeCents <= 0) continue;
        userIds.add(fee.userId);
      }
      if (page.isDone) break;
      cursor = page.continueCursor;
    }

    let created = 0;
    let skippedZero = 0;
    let skippedClaimed = 0;
    let skippedCurrency = 0;
    let failed = 0;

    for (const userId of userIds) {
      const result = await invoiceMerchant(
        ctx,
        userId,
        periodKey,
        nowMs,
        null,
      );
      switch (result.outcome) {
        case "created":
          created += 1;
          break;
        case "skipped_zero":
          skippedZero += 1;
          break;
        case "skipped_claimed":
          skippedClaimed += 1;
          break;
        case "skipped_currency":
          skippedCurrency += 1;
          break;
        case "skipped_unconfigured":
          return {
            merchants: userIds.size,
            created,
            skippedZero,
            skippedClaimed,
            skippedCurrency,
            failed,
            unconfigured: true,
          };
        case "failed":
          failed += 1;
          break;
        default: {
          const _never: never = result.outcome;
          void _never;
        }
      }
    }

    console.log(
      `Monthly fee invoices ${periodKey}: merchants=${userIds.size} created=${created} claimed=${skippedClaimed} zero=${skippedZero} currency=${skippedCurrency} failed=${failed}`,
    );

    return {
      merchants: userIds.size,
      created,
      skippedZero,
      skippedClaimed,
      skippedCurrency,
      failed,
      unconfigured: false,
    };
  },
});

/** Staff/Admin force-run for one merchant (current UTC month). */
export const adminForceRunFeeInvoice = action({
  args: {
    userId: v.id("users"),
    reason: v.string(),
  },
  returns: invoiceMerchantResultValidator,
  handler: async (ctx, args): Promise<InvoiceMerchantResult> => {
    const actorUserId: Id<"users"> = await ctx.runMutation(
      internal.functions.feeBilling.assertStaffCanInvoiceUser,
      { userId: args.userId, reason: args.reason },
    );
    const nowMs = Date.now();
    return await invoiceMerchant(
      ctx,
      args.userId,
      utcPeriodKey(nowMs),
      nowMs,
      actorUserId,
    );
  },
});
