"use node";

import { createClerkClient } from "@clerk/backend";
import { v } from "convex/values";
import { action, internalAction, type ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  FEE_INVOICE_CHECKOUT_TTL_MS,
  feeInvoiceClaimKey,
  utcPeriodKey,
} from "../lib/feeBilling";
import { allowHttpsUrl } from "../lib/safeUrl";
import { resolveFromAddress } from "../lib/recoveryEmailFrom";

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

function readCheckout(json: LsJson): { id: string; url: string | null } {
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
  const url = typeof attrs?.url === "string" ? allowHttpsUrl(attrs.url) : null;
  return { id: id.trim(), url };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

async function sendFeeInvoiceEmail(args: {
  to: string;
  merchantName: string;
  periodKey: string;
  totalCents: number;
  currency: string;
  checkoutUrl: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn(
      "RESEND_API_KEY not set — fee invoice checkout URL was not emailed",
    );
    return false;
  }
  const safeUrl = allowHttpsUrl(args.checkoutUrl);
  if (!safeUrl) return false;

  const amount = formatMoney(args.totalCents, args.currency);
  const name = args.merchantName.trim() || "there";
  const from = resolveFromAddress("DeclineGuard");
  const subject = `DeclineGuard recovery fees — ${args.periodKey}`;
  const text = [
    `Hi ${name},`,
    "",
    `Your DeclineGuard recovery fees for ${args.periodKey} are ${amount}.`,
    "Pay this invoice:",
    safeUrl,
    "",
    "This link expires; if it no longer works, contact DeclineGuard support.",
  ].join("\n");
  const html = `<p>Hi ${escapeHtml(name)},</p>
<p>Your DeclineGuard recovery fees for ${escapeHtml(args.periodKey)} are <strong>${escapeHtml(amount)}</strong>.</p>
<p><a href="${escapeHtml(safeUrl)}">Pay invoice</a></p>
<p>This link expires. If it no longer works, contact DeclineGuard support.</p>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject,
        text,
        html,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("Fee invoice email failed", res.status, errText);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Fee invoice email threw", err);
    return false;
  }
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
  lsCheckoutId: v.union(v.string(), v.null()),
  lsCheckoutUrl: v.union(v.string(), v.null()),
  checkoutEmailSent: v.boolean(),
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
  lsCheckoutId: string | null;
  lsCheckoutUrl: string | null;
  checkoutEmailSent: boolean;
};

function emptyCheckoutFields(): Pick<
  InvoiceMerchantResult,
  "lsCheckoutId" | "lsCheckoutUrl" | "checkoutEmailSent"
> {
  return {
    lsCheckoutId: null,
    lsCheckoutUrl: null,
    checkoutEmailSent: false,
  };
}

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
      ...emptyCheckoutFields(),
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

  const target = await ctx.runQuery(
    internal.functions.feeBilling.getUserBillingTarget,
    { userId },
  );
  const email = target
    ? await lookupClerkEmail(target.clerkUserId)
    : undefined;

  if (claim.skippedZero) {
    return {
      outcome: "skipped_zero",
      invoiceId: claim.invoiceId,
      totalCents: 0,
      feeCount: 0,
      error: null,
      ...emptyCheckoutFields(),
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
      ...emptyCheckoutFields(),
    };
  }
  if (!claim.claimed || !claim.invoiceId) {
    const existing = claim.invoiceId
      ? await ctx.runQuery(
          internal.functions.feeBilling.getInvoiceCheckoutFields,
          { invoiceId: claim.invoiceId },
        )
      : null;
    const existingUrl = existing?.lsCheckoutUrl ?? null;
    let checkoutEmailSent = false;
    if (actorUserId && existingUrl && email) {
      checkoutEmailSent = await sendFeeInvoiceEmail({
        to: email,
        merchantName: target?.userName ?? "there",
        periodKey,
        totalCents: existing?.totalCents ?? claim.totalCents,
        currency: claim.currency ?? config.currency,
        checkoutUrl: existingUrl,
      });
      if (checkoutEmailSent && existing) {
        await ctx.runMutation(
          internal.functions.feeBilling.recordCheckoutEmailSent,
          { invoiceId: existing._id, nowMs },
        );
      }
    }
    return {
      outcome: "skipped_claimed",
      invoiceId: claim.invoiceId,
      totalCents: claim.totalCents,
      feeCount: claim.feeCount,
      error: claim.reason,
      lsCheckoutId: existing?.lsCheckoutId ?? null,
      lsCheckoutUrl: existingUrl,
      checkoutEmailSent,
    };
  }

  const invoiceId = claim.invoiceId;
  const expiresAt = nowMs + FEE_INVOICE_CHECKOUT_TTL_MS;

  let checkoutId: string | null = null;
  let checkoutUrl: string | null = null;
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
            expires_at: new Date(expiresAt).toISOString(),
          },
          relationships: {
            store: { data: { type: "stores", id: config.storeId } },
            variant: { data: { type: "variants", id: config.variantId } },
          },
        },
      },
    });
    const checkout = readCheckout(json);
    checkoutId = checkout.id;
    checkoutUrl = checkout.url;
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
      ...emptyCheckoutFields(),
    };
  }

  // LS returned a checkout id: persist it, keep fees linked, never unlink.
  if (!checkoutId) {
    await ctx.runMutation(internal.functions.feeBilling.markBillingClaimFailed, {
      invoiceId,
      error: "checkout_missing_id",
      unlinkFees: true,
    });
    return {
      outcome: "failed",
      invoiceId,
      totalCents: claim.totalCents,
      feeCount: claim.feeCount,
      error: "checkout_missing_id",
      ...emptyCheckoutFields(),
    };
  }

  if (!checkoutUrl) {
    try {
      const refetch = await lsPlatformFetch(
        config.apiKey,
        `/checkouts/${checkoutId}`,
      );
      checkoutUrl = readCheckout(refetch).url;
    } catch (err) {
      console.warn(`Fee invoice: checkout ${checkoutId} refetch failed`, err);
    }
  }

  try {
    const attached = await ctx.runMutation(
      internal.functions.feeBilling.attachLsCheckout,
      {
        invoiceId,
        lsCheckoutId: checkoutId,
        lsCheckoutUrl: checkoutUrl ?? undefined,
        expiresAt,
        nowMs,
      },
    );
    if (!attached) {
      console.error(
        `Fee invoice: persist failed after LS checkout ${checkoutId} for ${invoiceId}`,
      );
    }
  } catch (err) {
    console.error(
      `Fee invoice: persist threw after LS checkout ${checkoutId}:`,
      err,
    );
  }

  try {
    await ctx.runMutation(internal.functions.feeBilling.recordFeeInvoiceCreated, {
      invoiceId,
      actorUserId,
    });
  } catch (err) {
    console.error(`Fee invoice: created audit failed for ${invoiceId}:`, err);
  }

  let checkoutEmailSent = false;
  if (checkoutUrl && email) {
    checkoutEmailSent = await sendFeeInvoiceEmail({
      to: email,
      merchantName: target?.userName ?? "there",
      periodKey,
      totalCents: claim.totalCents,
      currency: claim.currency ?? config.currency,
      checkoutUrl,
    });
    if (checkoutEmailSent) {
      await ctx.runMutation(
        internal.functions.feeBilling.recordCheckoutEmailSent,
        { invoiceId, nowMs },
      );
    }
  } else if (!checkoutUrl) {
    console.error(
      `Fee invoice ${invoiceId}: LS checkout ${checkoutId} has no HTTPS URL — staff must copy from LS or release after expiresAt`,
    );
  } else if (!email) {
    console.warn(
      `Fee invoice ${invoiceId}: no merchant email — checkout URL is on the staff list / force-run return`,
    );
  }

  return {
    outcome: "created",
    invoiceId,
    totalCents: claim.totalCents,
    feeCount: claim.feeCount,
    error: checkoutUrl ? null : "missing_checkout_url",
    lsCheckoutId: checkoutId,
    lsCheckoutUrl: checkoutUrl,
    checkoutEmailSent,
  };
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
