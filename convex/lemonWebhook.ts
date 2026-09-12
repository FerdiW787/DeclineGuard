import { httpAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { allowHttpsUrl } from "./lib/safeUrl";

type LsWebhookBody = {
  meta?: { event_name?: string };
  data?: {
    type?: string;
    id?: string;
    attributes?: Record<string, unknown>;
  };
};

/**
 * Lemon Squeezy webhook endpoint.
 * URL: https://<deployment>.convex.site/lemonsqueezy
 *
 * Subscribe at least to:
 * - subscription_payment_failed
 * - subscription_payment_recovered
 *
 * Env: LEMONSQUEEZY_WEBHOOK_SECRET (same signing secret you enter in LS)
 */
export const handleLemonSqueezyWebhook = httpAction(
  async (ctx: ActionCtx, request: Request) => {
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    if (!secret) {
      console.error("LEMONSQUEEZY_WEBHOOK_SECRET is not set");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get("X-Signature");
    const valid = await verifyLemonSignature(rawBody, signature, secret);
    if (!valid) {
      return new Response("Invalid signature", { status: 400 });
    }

    let body: LsWebhookBody;
    try {
      body = JSON.parse(rawBody) as LsWebhookBody;
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const eventName =
      request.headers.get("X-Event-Name") ?? body.meta?.event_name ?? "";
    if (!eventName) {
      return new Response("Missing event name", { status: 400 });
    }

    const data = body.data;
    const attrs = data?.attributes;
    const storeIdEarly = stringifyId(attrs?.store_id);

    const isPaymentEvent =
      eventName === "subscription_payment_failed" ||
      eventName === "subscription_payment_recovered";

    const isSubscriptionLifecycleEvent = eventName === "subscription_updated";

    // Record every signed delivery we can attribute to a store — including LS
    // "Send test" / non-payment events — so onboarding can verify the webhook.
    if (!isPaymentEvent && !isSubscriptionLifecycleEvent) {
      if (storeIdEarly) {
        const resourceId =
          typeof data?.id === "string" || typeof data?.id === "number"
            ? String(data.id)
            : `ping:${Date.now()}`;
        const eventKey = `${eventName}:${data?.type ?? "resource"}:${resourceId}`;
        await ctx.runMutation(internal.functions.recoveries.recordWebhookEvent, {
          eventKey,
          eventName,
          storeId: storeIdEarly,
        });
      }
      return new Response("Ignored", { status: 200 });
    }

    if (!data?.id || !attrs) {
      return new Response("Missing payload data", { status: 400 });
    }

    const storeId = storeIdEarly;
    // For subscription_updated, data IS the subscription (use data.id)
    // For payment events, data is an invoice (use attrs.subscription_id)
    const subscriptionId =
      isSubscriptionLifecycleEvent
        ? stringifyId(data.id)
        : stringifyId(attrs.subscription_id);
    if (!storeId || !subscriptionId) {
      return new Response("Missing store or subscription id", { status: 400 });
    }

    // Event key must allow subsequent lifecycle events (cancelled then expired)
    // For subscription_updated: include status + updated_at to differentiate
    // For payment events: resource id is unique per invoice
    const eventKey = isSubscriptionLifecycleEvent
      ? `${eventName}:${data.id}:${attrs.status ?? "unknown"}:${attrs.updated_at ?? Date.now()}`
      : `${eventName}:${data.type ?? "resource"}:${data.id}`;
    const already = await ctx.runQuery(
      internal.functions.recoveries.hasProcessedEvent,
      { eventKey },
    );
    if (already) {
      return new Response("Already processed", { status: 200 });
    }

    const binding = await ctx.runQuery(
      internal.functions.lemonSqueezy.getBindingByStoreId,
      { storeId },
    );
    if (!binding) {
      // Store not linked to any DeclineGuard account — ack so LS stops retrying
      console.warn(`No binding for Lemon Squeezy store ${storeId}`);
      await ctx.runMutation(internal.functions.recoveries.recordWebhookEvent, {
        eventKey,
        eventName,
        storeId,
      });
      return new Response("No matching store", { status: 200 });
    }

    const customerEmail =
      typeof attrs.user_email === "string" ? attrs.user_email : "";
    if (!customerEmail) {
      return new Response("Missing customer email", { status: 400 });
    }

    const customerName =
      typeof attrs.user_name === "string" ? attrs.user_name : undefined;
    const currency =
      typeof attrs.currency === "string" ? attrs.currency : "USD";
    const amountCents = asCents(attrs.total);
    const testMode = attrs.test_mode === true;
    const productName = extractProductName(attrs);
    const declineReason = extractDeclineReason(attrs);
    const occurredAt = parseIsoMs(
      typeof attrs.updated_at === "string"
        ? attrs.updated_at
        : typeof attrs.created_at === "string"
          ? attrs.created_at
          : null,
    );

    const urls =
      attrs.urls && typeof attrs.urls === "object"
        ? (attrs.urls as Record<string, unknown>)
        : null;
    const updatePaymentUrl =
      typeof urls?.update_payment_method === "string"
        ? (allowHttpsUrl(urls.update_payment_method) ?? undefined)
        : undefined;

    if (eventName === "subscription_payment_failed") {
      const result = await ctx.runMutation(
        internal.functions.recoveries.upsertFailedPayment,
        {
          userId: binding.userId,
          connectionId: binding.connectionId,
          storeId,
          subscriptionId,
          subscriptionInvoiceId: String(data.id),
          customerEmail,
          customerName,
          productName,
          declineReason,
          amountCents,
          currency,
          updatePaymentUrl,
          failedAt: occurredAt,
          eventName,
          testMode,
        },
      );

      // Only send recovery emails when policy says to (attempt >= 2)
      // Attempt 1 = wait (don't stack on LS's own failure email)
      if (
        result.recoveryAction === "nudge_update_pm" ||
        result.recoveryAction === "push_update_pm"
      ) {
        await ctx.scheduler.runAfter(
          0,
          internal.functions.recoveryEmails.sendForFailure,
          { failureId: result.failureId },
        );
      }
    } else if (eventName === "subscription_payment_recovered") {
      await ctx.runMutation(internal.functions.recoveries.markPaymentRecovered, {
        userId: binding.userId,
        storeId,
        subscriptionId,
        subscriptionInvoiceId: String(data.id),
        customerEmail,
        amountCents,
        currency,
        recoveredAt: occurredAt,
        eventName,
      });
    } else if (eventName === "subscription_updated") {
      // Handle lifecycle stop: cancelled, expired, or unpaid → stop sequence
      const status =
        typeof attrs.status === "string" ? attrs.status : "";
      const lifecycleStopStatuses = ["cancelled", "expired", "unpaid"];

      if (lifecycleStopStatuses.includes(status)) {
        await ctx.runMutation(
          internal.functions.recoveries.handleSubscriptionLifecycleStop,
          {
            storeId,
            subscriptionId,
            newStatus: status as "cancelled" | "expired" | "unpaid",
            eventName,
            occurredAt,
          },
        );
      }
    }

    await ctx.runMutation(internal.functions.recoveries.recordWebhookEvent, {
      eventKey,
      eventName,
      storeId,
    });

    return new Response("OK", { status: 200 });
  },
);

async function verifyLemonSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const digestHex = [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // LS compares hex digest strings (utf-8 bytes of the hex characters)
  if (digestHex.length !== signatureHeader.length) return false;
  let mismatch = 0;
  for (let i = 0; i < digestHex.length; i += 1) {
    mismatch |= digestHex.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return mismatch === 0;
}

function stringifyId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
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

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Best-effort product label from LS subscription invoice attributes. */
function extractProductName(
  attrs: Record<string, unknown>,
): string | undefined {
  const direct =
    asNonEmptyString(attrs.product_name) ??
    asNonEmptyString(attrs.variant_name) ??
    asNonEmptyString(attrs.product_name_formatted);
  if (direct) return direct;

  const firstItem = attrs.first_subscription_item;
  if (firstItem && typeof firstItem === "object") {
    const item = firstItem as Record<string, unknown>;
    return (
      asNonEmptyString(item.product_name) ??
      asNonEmptyString(item.variant_name) ??
      asNonEmptyString(item.name)
    );
  }
  return undefined;
}

/**
 * Extract lifecycle label from LS attributes.
 * LS does not expose issuer decline_code (insufficient_funds, do_not_honor, etc.)
 * so we use the subscription/invoice status which is publicly available.
 */
function extractDeclineReason(
  attrs: Record<string, unknown>,
): string | undefined {
  return (
    asNonEmptyString(attrs.status_formatted) ??
    asNonEmptyString(attrs.status) ??
    asNonEmptyString(attrs.billing_reason)
  );
}
