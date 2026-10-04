import { httpAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  collectDodoWebhookSecrets,
  dodoPaymentAmountCents,
  dodoPaymentProductIds,
  dodoUsageChargeKind,
  dodoUsageSettlePayloadDecision,
  extractDodoMetadata,
  extractDodoUserRefs,
  getDodoPaymentsConfig,
  isDodoPaymentEvent,
  isDodoSubscriptionEvent,
  isDodoUpdatePaymentMethod,
  parseDodoEnvironment,
  parseIsoMsStrict,
  statusFromDodoEvent,
  stringifyDodoId,
} from "./lib/dodoPayments";
import {
  matchesPackProduct,
  packQuantityPreferringCart,
  parsePositiveInt,
} from "./lib/declineCapacity";
import { isFeeInvoiceClaimKey } from "./lib/feeBilling";
import {
  dodoWebhookEventKey,
  verifyStandardWebhook,
} from "./lib/standardWebhooks";

type DodoWebhookBody = {
  business_id?: string;
  type?: string;
  timestamp?: string;
  data?: Record<string, unknown>;
};

/**
 * Dodo Payments webhook.
 * URL: https://<deployment>.convex.site/dodo
 *
 * Subscribe at least to:
 * - subscription.active, subscription.renewed, subscription.on_hold,
 *   subscription.cancelled, subscription.failed, subscription.updated
 * - payment.succeeded (Pro usage settle + recovery-fee checkouts + pack receipts)
 *
 * Env: DODO_PAYMENTS_WEBHOOK_KEY (Standard Webhooks / Svix-style).
 * Optional DODO_PAYMENTS_WEBHOOK_KEY_PREVIOUS for rotation.
 * Test-mode events do not write users.plan unless ALLOW_DODO_TEST_BILLING=true.
 */
export const handleDodoWebhook = httpAction(
  async (ctx: ActionCtx, request: Request) => {
    const secrets = collectDodoWebhookSecrets();
    if (secrets.length === 0) {
      console.error("DODO_PAYMENTS_WEBHOOK_KEY is not set");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    const rawBody = await request.text();
    const headers = {
      id: request.headers.get("webhook-id") ?? "",
      timestamp: request.headers.get("webhook-timestamp") ?? "",
      signature: request.headers.get("webhook-signature") ?? "",
    };

    const valid = await verifyStandardWebhook({
      rawBody,
      headers,
      secrets,
      nowSec: Math.floor(Date.now() / 1000),
    });
    if (!valid) {
      return new Response("Invalid signature", { status: 400 });
    }

    let body: DodoWebhookBody;
    try {
      body = JSON.parse(rawBody) as DodoWebhookBody;
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const eventType = typeof body.type === "string" ? body.type.trim() : "";
    if (!eventType) {
      return new Response("Missing event type", { status: 400 });
    }

    const data = body.data && typeof body.data === "object" ? body.data : {};
    const resourceId =
      stringifyDodoId(data.subscription_id) ??
      stringifyDodoId(data.payment_id) ??
      stringifyDodoId(data.checkout_session_id) ??
      stringifyDodoId(data.session_id) ??
      null;
    const eventKey = dodoWebhookEventKey({
      webhookId: headers.id,
      eventType,
      resourceId,
    });

    const { claimed } = await ctx.runMutation(
      internal.functions.dodoBilling.claimDodoWebhookEvent,
      { eventKey, eventName: eventType },
    );
    if (!claimed) {
      return new Response("Already processed", { status: 200 });
    }

    try {
      if (isDodoSubscriptionEvent(eventType)) {
        await handleSubscriptionEvent(ctx, eventType, data);
      } else if (isDodoPaymentEvent(eventType)) {
        await handlePaymentEvent(ctx, eventType, data);
      }
    } catch (err) {
      console.error(
        `Dodo webhook business logic failed for ${eventKey}, releasing claim:`,
        err,
      );
      try {
        await ctx.runMutation(
          internal.functions.dodoBilling.releaseDodoWebhookEvent,
          { eventKey },
        );
      } catch (releaseErr) {
        console.error(`Failed to release Dodo claim for ${eventKey}:`, releaseErr);
      }
      return new Response("Internal error", { status: 500 });
    }

    return new Response("OK", { status: 200 });
  },
);

async function handleSubscriptionEvent(
  ctx: ActionCtx,
  eventType: string,
  data: Record<string, unknown>,
): Promise<void> {
  const subscriptionId = stringifyDodoId(data.subscription_id);
  if (!subscriptionId) {
    throw new Error("Dodo subscription event missing subscription_id");
  }

  const metadata = extractDodoMetadata(data.metadata);
  const refs = extractDodoUserRefs(metadata);
  const productId =
    stringifyDodoId(data.product_id) ??
    extractProductIdFromNested(data);
  const customerId = extractCustomerId(data);
  const payloadStatus =
    typeof data.status === "string" ? data.status : "";

  const status = statusFromDodoEvent(eventType, payloadStatus);
  const testMode = isDodoTestPayload(data);
  await ctx.runMutation(internal.functions.dodoBilling.applyDodoSubscription, {
    dodoSubscriptionId: subscriptionId,
    dodoCustomerId: customerId ?? undefined,
    status,
    productId: productId ?? undefined,
    onDemand: typeof data.on_demand === "boolean" ? data.on_demand : undefined,
    convexUserId: refs.convexUserId ?? undefined,
    clerkUserId: refs.clerkUserId ?? undefined,
    checkoutNonce: refs.checkoutNonce ?? undefined,
    testMode,
  });
}

async function handlePaymentEvent(
  ctx: ActionCtx,
  eventType: string,
  data: Record<string, unknown>,
): Promise<void> {
  if (eventType !== "payment.succeeded") return;

  const metadata = extractDodoMetadata(data.metadata);
  const refs = extractDodoUserRefs(metadata);
  const productId =
    stringifyDodoId(data.product_id) ?? extractProductIdFromNested(data);
  const packProductId = getDodoPaymentsConfig()?.packProductId ?? null;
  const packProductMatch = matchesPackProduct({
    productId,
    expectedProductId: packProductId,
  });
  if (refs.billingKind === "pack" || packProductMatch) {
    const paymentId = stringifyDodoId(data.payment_id);
    if (!paymentId) {
      throw new Error("Dodo pack payment.succeeded missing payment_id");
    }
    const credited = await ctx.runMutation(
      internal.functions.dodoBilling.creditDodoPackPurchase,
      {
        paymentId,
        quantity: packQuantityFromPayload(data, metadata),
        productId: productId ?? undefined,
        convexUserId: refs.convexUserId ?? undefined,
        clerkUserId: refs.clerkUserId ?? undefined,
        dodoCustomerId: extractCustomerId(data) ?? undefined,
        paidAt: parseIsoMs(
          typeof data.created_at === "string"
            ? data.created_at
            : typeof data.updated_at === "string"
              ? data.updated_at
              : null,
        ),
        testMode: isDodoTestPayload(data),
      },
    );
    if (!credited.credited && credited.reason === "user_not_found") {
      throw new Error(`No user for Dodo pack payment ${paymentId}`);
    }
    return;
  }

  const claimKey = refs.claimKey;
  if (!claimKey || !isFeeInvoiceClaimKey(claimKey)) {
    const subscriptionId = stringifyDodoId(data.subscription_id);
    const proProductId = getDodoPaymentsConfig()?.proProductId ?? null;
    const decision = dodoUsageSettlePayloadDecision({
      eventType,
      hasFeeClaimKey: false,
      subscriptionId,
      productIds: dodoPaymentProductIds(data),
      expectedProProductId: proProductId,
      chargeKind: dodoUsageChargeKind({
        payment: data,
        expectedProProductId: proProductId,
      }),
      isUpdatePaymentMethod: isDodoUpdatePaymentMethod(data),
      amountCents: dodoPaymentAmountCents(data),
      paymentCreatedAtMs: parseIsoMsStrict(data.created_at),
    });
    if (decision.settle) {
      const paymentId = stringifyDodoId(data.payment_id);
      await ctx.runMutation(
        internal.functions.feeBilling.settleDodoUsageFeeInvoices,
        {
          dodoCustomerId: extractCustomerId(data) ?? undefined,
          dodoSubscriptionId: subscriptionId ?? undefined,
          dodoPaymentId: paymentId ?? undefined,
          paidAt: decision.paidAt,
          coveredPeriodKey: decision.coveredPeriodKey,
          testMode: isDodoTestPayload(data),
        },
      );
    }
    return;
  }

  const paymentId = stringifyDodoId(data.payment_id);
  if (!paymentId) {
    throw new Error("Dodo payment.succeeded missing payment_id");
  }

  const invoiceId = await ctx.runQuery(
    internal.functions.feeBilling.findBillingInvoiceForPaidOrder,
    {
      claimKey,
      billingInvoiceId: refs.billingInvoiceId ?? undefined,
      dodoCheckoutId: stringifyDodoId(data.checkout_session_id) ?? undefined,
      dodoPaymentId: paymentId,
    },
  );
  if (!invoiceId) {
    throw new Error(
      `No billingInvoices row for ${claimKey} / payment ${paymentId}`,
    );
  }

  const amountCents = asCents(data.total_amount ?? data.amount ?? data.settlement_amount);
  await ctx.runMutation(internal.functions.feeBilling.markBillingInvoicePaid, {
    invoiceId,
    lsOrderId: paymentId,
    lsCheckoutId: stringifyDodoId(data.checkout_session_id) ?? undefined,
    dodoPaymentId: paymentId,
    dodoCheckoutId: stringifyDodoId(data.checkout_session_id) ?? undefined,
    orderStatus: "paid",
    subtotalCents: amountCents,
    totalCents: amountCents,
    testMode: isDodoTestPayload(data),
    paidAt: parseIsoMs(
      typeof data.created_at === "string"
        ? data.created_at
        : typeof data.updated_at === "string"
          ? data.updated_at
          : null,
    ),
  });
}

function packQuantityFromPayload(
  data: Record<string, unknown>,
  metadata: Record<string, string>,
): number {
  const items = data.product_cart;
  let cartQuantity: number | null = null;
  if (Array.isArray(items) && items[0] && typeof items[0] === "object") {
    const rec = items[0] as Record<string, unknown>;
    cartQuantity = parsePositiveInt(rec.quantity);
  }
  const metadataQuantity = parsePositiveInt(
    metadata.quantity ?? metadata.pack_quantity,
  );
  return packQuantityPreferringCart({ cartQuantity, metadataQuantity });
}

function extractCustomerId(data: Record<string, unknown>): string | null {
  const direct = stringifyDodoId(data.customer_id);
  if (direct) return direct;
  const customer = data.customer;
  if (customer && typeof customer === "object") {
    const rec = customer as Record<string, unknown>;
    return stringifyDodoId(rec.customer_id) ?? stringifyDodoId(rec.id);
  }
  return null;
}

function extractProductIdFromNested(
  data: Record<string, unknown>,
): string | null {
  const product = data.product;
  if (product && typeof product === "object") {
    const rec = product as Record<string, unknown>;
    return stringifyDodoId(rec.product_id) ?? stringifyDodoId(rec.id);
  }
  const items = data.product_cart;
  if (Array.isArray(items) && items[0] && typeof items[0] === "object") {
    const rec = items[0] as Record<string, unknown>;
    return stringifyDodoId(rec.product_id);
  }
  return null;
}

function isDodoTestPayload(data: Record<string, unknown>): boolean {
  if (data.test_mode === true) return true;
  if (data.livemode === false) return true;
  return parseDodoEnvironment(process.env.DODO_PAYMENTS_ENVIRONMENT) === "test_mode";
}

function asCents(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.round(n);
  }
  return 0;
}

function parseIsoMs(value: string | null): number {
  if (!value) return Date.now();
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : Date.now();
}
