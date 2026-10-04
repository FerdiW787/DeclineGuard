import { httpAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  extractCustomUserRefs,
  isPlatformBillingEventName,
  isPlatformBillingStore,
  planFromLsStatus,
} from "./lib/billingPlan";
import {
  applyPlatformSubscriptionAllowed,
  feeInvoicePaidFromVerifiedOrder,
  invoiceOwnsVerifiedLemonOrder,
  lemonFeeInvoiceLookupFromOrder,
  lemonWebhookSecretChoice,
  merchantRecoveredPaymentAuthorized,
  parseLemonOrderForFeeInvoice,
  parseLemonSubscription,
  type LemonWebhookSecretChoice,
} from "./lib/lemonWebhookAuth";
import { decryptApiKey } from "./lib/lsCrypto";
import { allowHttpsUrl } from "./lib/safeUrl";

type LsWebhookBody = {
  meta?: { event_name?: string; custom_data?: unknown; test_mode?: boolean };
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
 * Subscribe merchant stores at least to:
 * - subscription_payment_failed
 * - subscription_payment_recovered
 * - subscription_updated
 *
 * DeclineGuard’s own store (LEMONSQUEEZY_STORE_ID) also POSTs here:
 * - order_created — recovery-fee invoices (claim/release + mark paid)
 * - subscription_* — Pro $29.99/mo (applyPlatformSubscription)
 *
 * Env: LEMONSQUEEZY_WEBHOOK_SECRET verifies only LEMONSQUEEZY_STORE_ID.
 * Merchant stores use a per-connection secret generated at install — never
 * the platform secret. Lemon does not return webhook secrets from the API.
 * Test-mode Pro events do not write users.plan unless ALLOW_LS_TEST_BILLING=true.
 */
export const handleLemonSqueezyWebhook = httpAction(
  async (ctx: ActionCtx, request: Request) => {
    const rawBody = await request.text();

    let body: LsWebhookBody;
    try {
      body = JSON.parse(rawBody) as LsWebhookBody;
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const storeIdForVerify = stringifyId(body.data?.attributes?.store_id);
    const resolved = await secretsForStore(ctx, storeIdForVerify);
    if (resolved.choice === "platform" && resolved.secrets.length === 0) {
      return new Response("Webhook secret not configured", { status: 500 });
    }
    if (resolved.choice === "reject" || resolved.secrets.length === 0) {
      return new Response("Invalid signature", { status: 400 });
    }

    const signature = request.headers.get("X-Signature");
    const valid = await verifyLemonSignature(rawBody, signature, resolved.secrets);
    if (!valid) {
      return new Response("Invalid signature", { status: 400 });
    }

    const secretChoice = resolved.choice;

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
    const isPlatformStore = isPlatformBillingStore(storeIdEarly);
    const isBillingEvent =
      isPlatformStore && isPlatformBillingEventName(eventName);

    const billingStoreId = process.env.LEMONSQUEEZY_STORE_ID?.trim();
    const isBillingOrderEvent =
      eventName === "order_created" &&
      !!storeIdEarly &&
      !!billingStoreId &&
      storeIdEarly === billingStoreId;

    if (isBillingOrderEvent && storeIdEarly) {
      return await handleBillingOrderWebhook(ctx, {
        eventName,
        storeId: storeIdEarly,
        secretChoice,
        data,
        attrs,
      });
    }

    // Record every signed delivery we can attribute to a store — including LS
    // "Send test" / non-payment events — so onboarding can verify the webhook.
    if (!isPaymentEvent && !isSubscriptionLifecycleEvent && !isBillingEvent) {
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
    // For subscription_* lifecycle events, data IS the subscription (use data.id)
    // For payment events, data is an invoice (use attrs.subscription_id)
    const subscriptionId =
      isSubscriptionLifecycleEvent ||
      (isBillingEvent && eventName.startsWith("subscription_") &&
        !eventName.startsWith("subscription_payment_"))
        ? stringifyId(data.id)
        : stringifyId(attrs.subscription_id);
    if (!storeId || !subscriptionId) {
      return new Response("Missing store or subscription id", { status: 400 });
    }

    // Validate customer email BEFORE claim for payment events only.
    // Payment events require email for recovery notifications.
    // Lifecycle events (subscription_updated) often omit user_email and don't need it.
    const customerEmail =
      typeof attrs.user_email === "string" ? attrs.user_email : "";
    if (isPaymentEvent && !customerEmail && !isBillingEvent) {
      return new Response("Missing customer email", { status: 400 });
    }

    // Event key must allow subsequent lifecycle events (cancelled then expired)
    // For subscription_updated: include status + updated_at to differentiate
    // For payment events: resource id is unique per invoice
    // NOTE: updated_at fallback is "unknown" (not Date.now()) for stable keys across retries
    const eventKey =
      isSubscriptionLifecycleEvent ||
      (isBillingEvent && !isPaymentEvent)
        ? `${eventName}:${data.id}:${attrs.status ?? "unknown"}:${attrs.updated_at ?? "unknown"}`
        : `${eventName}:${data.type ?? "resource"}:${data.id}`;

    // Atomic claim: only the winner proceeds to business logic.
    // Prevents race conditions under LS retry bursts.
    const { claimed } = await ctx.runMutation(
      internal.functions.recoveries.claimWebhookEvent,
      { eventKey, eventName, storeId },
    );
    if (!claimed) {
      return new Response("Already processed", { status: 200 });
    }

    // --- CLAIM WON: all paths below must either succeed or release the claim ---

    const binding = await ctx.runQuery(
      internal.functions.lemonSqueezy.getBindingByStoreId,
      { storeId },
    );
    if (!binding && !isBillingEvent) {
      // Store not linked to any DeclineGuard account — ack so LS stops retrying
      // Keep claim (intentional: we don't want retries for unlinked stores)
      console.warn(`No binding for Lemon Squeezy store ${storeId}`);
      return new Response("No matching store", { status: 200 });
    }

    // Extract remaining fields (non-throwing)
    const customerName =
      typeof attrs.user_name === "string" ? attrs.user_name : undefined;
    const currency =
      typeof attrs.currency === "string" ? attrs.currency : "USD";
    const amountCents = asCents(attrs.total);
    const testMode =
      attrs.test_mode === true || body.meta?.test_mode === true;
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

    // Business logic: wrap in try/catch — on failure, release claim and return 500
    // so LS retries get a fresh chance (not stuck "Already processed" forever)
    try {
      if (isBillingEvent) {
        const subLookup = await fetchLemonPlatformSubscription(subscriptionId);
        if (subLookup.kind === "error") {
          throw new Error("Lemon subscription lookup failed");
        }
        const verifiedSub = subLookup.subscription;
        if (verifiedSub) {
          const customRefs = extractCustomUserRefs(body.meta ?? {});
          const userSource = await ctx.runQuery(
            internal.functions.billing.resolvePlatformBillingUserSource,
            {
              lsSubscriptionId: verifiedSub.subscriptionId,
              checkoutNonce: customRefs.checkoutNonce ?? undefined,
            },
          );
          const nextPlan = planFromLsStatus(verifiedSub.status);
          const allowed = applyPlatformSubscriptionAllowed({
            verifiedFromLemonApi: true,
            userResolvedBy: userSource,
            nextPlan,
          });
          if (allowed.allow) {
            await ctx.runMutation(
              internal.functions.billing.applyPlatformSubscription,
              {
                lsSubscriptionId: verifiedSub.subscriptionId,
                status: verifiedSub.status,
                variantId: verifiedSub.variantId ?? undefined,
                productId: verifiedSub.productId ?? undefined,
                checkoutNonce: customRefs.checkoutNonce ?? undefined,
                testMode: verifiedSub.testMode,
                verifiedFromLemonApi: true,
              },
            );
          }
        }
      }

      if (binding && eventName === "subscription_payment_failed" && customerEmail) {
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
          !result.quotaHeld &&
          !result.releaseScheduledEmail &&
          (result.recoveryAction === "nudge_update_pm" ||
            result.recoveryAction === "push_update_pm")
        ) {
          await ctx.scheduler.runAfter(
            0,
            internal.functions.recoveryEmails.sendForFailure,
            { failureId: result.failureId },
          );
        }
      } else if (
        binding &&
        merchantRecoveredPaymentAuthorized(secretChoice) &&
        eventName === "subscription_payment_recovered" &&
        customerEmail
      ) {
        await ctx.runMutation(
          internal.functions.recoveries.markPaymentRecovered,
          {
            userId: binding.userId,
            storeId,
            subscriptionId,
            subscriptionInvoiceId: String(data.id),
            customerEmail,
            amountCents,
            currency,
            recoveredAt: occurredAt,
            eventName,
          },
        );
      } else if (binding && eventName === "subscription_updated") {
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
    } catch (err) {
      // Business logic failed — release claim so LS retries can re-process
      console.error(
        `Webhook business logic failed for ${eventKey}, releasing claim:`,
        err,
      );
      try {
        await ctx.runMutation(internal.functions.recoveries.releaseWebhookEvent, {
          eventKey,
        });
      } catch (releaseErr) {
        console.error(`Failed to release claim for ${eventKey}:`, releaseErr);
      }
      return new Response("Internal error", { status: 500 });
    }

    // Success — claim stays, event is processed
    return new Response("OK", { status: 200 });
  },
);

/**
 * Paid signal for DeclineGuard’s own-store fee invoices (checkout + custom_price).
 * Uses the same claim/release path as merchant payment webhooks.
 */
async function handleBillingOrderWebhook(
  ctx: ActionCtx,
  args: {
    eventName: string;
    storeId: string;
    secretChoice: LemonWebhookSecretChoice;
    data: LsWebhookBody["data"];
    attrs: Record<string, unknown> | undefined;
  },
): Promise<Response> {
  if (!args.data?.id || !args.attrs) {
    return new Response("Missing payload data", { status: 400 });
  }

  const orderLookup = await fetchLemonPlatformOrder(String(args.data.id));
  if (orderLookup.kind === "error") {
    return new Response("Internal error", { status: 500 });
  }
  const verifiedOrder = orderLookup.order;
  const paidDecision = feeInvoicePaidFromVerifiedOrder({
    secretChoice: args.secretChoice,
    platformStoreId: process.env.LEMONSQUEEZY_STORE_ID?.trim() || null,
    feeVariantId: process.env.LEMONSQUEEZY_FEE_VARIANT_ID?.trim() || null,
    verifiedOrder,
    claimedCents: 0,
  });
  if (!paidDecision.accept || !verifiedOrder) {
    await ctx.runMutation(internal.functions.recoveries.recordWebhookEvent, {
      eventKey: `${args.eventName}:${args.data.type ?? "orders"}:${args.data.id}:rejected:${paidDecision.accept ? "no_order" : paidDecision.reason}`,
      eventName: args.eventName,
      storeId: args.storeId,
    });
    return new Response("Ignored", { status: 200 });
  }

  const lookup = lemonFeeInvoiceLookupFromOrder(verifiedOrder);
  const invoiceId = await ctx.runQuery(
    internal.functions.feeBilling.findBillingInvoiceForPaidOrder,
    {
      claimKey: lookup.claimKey ?? undefined,
      lsCheckoutId: lookup.lsCheckoutId ?? undefined,
      lsOrderId: lookup.lsOrderId,
    },
  );

  const eventKey = `${args.eventName}:${args.data.type ?? "orders"}:${verifiedOrder.orderId}`;
  const { claimed } = await ctx.runMutation(
    internal.functions.recoveries.claimWebhookEvent,
    { eventKey, eventName: args.eventName, storeId: args.storeId },
  );
  if (!claimed) {
    return new Response("Already processed", { status: 200 });
  }

  const releaseAndIgnore = async (): Promise<Response> => {
    try {
      await ctx.runMutation(internal.functions.recoveries.releaseWebhookEvent, {
        eventKey,
      });
    } catch (releaseErr) {
      console.error(`Failed to release claim for ${eventKey}:`, releaseErr);
    }
    return new Response("Ignored", { status: 200 });
  };

  try {
    if (!invoiceId) {
      return await releaseAndIgnore();
    }

    const invoiceMeta = await ctx.runQuery(
      internal.functions.feeBilling.getInvoiceProvider,
      { invoiceId },
    );
    if (
      !invoiceMeta ||
      !invoiceOwnsVerifiedLemonOrder({
        invoice: {
          claimKey: invoiceMeta.claimKey,
          lsOrderId: invoiceMeta.lsOrderId,
          lsCheckoutId: invoiceMeta.lsCheckoutId,
        },
        order: verifiedOrder,
      })
    ) {
      return await releaseAndIgnore();
    }
    if (invoiceMeta.billingProvider === "dodo") {
      return await releaseAndIgnore();
    }

    const userProvider = await ctx.runQuery(
      internal.functions.dodoBilling.getUserBillingProvider,
      { userId: invoiceMeta.userId },
    );
    if (userProvider?.billingProvider === "dodo") {
      return await releaseAndIgnore();
    }

    const paidDecisionForInvoice = feeInvoicePaidFromVerifiedOrder({
      secretChoice: args.secretChoice,
      platformStoreId: process.env.LEMONSQUEEZY_STORE_ID?.trim() || null,
      feeVariantId: process.env.LEMONSQUEEZY_FEE_VARIANT_ID?.trim() || null,
      verifiedOrder,
      claimedCents: invoiceMeta.totalCents,
    });
    if (!paidDecisionForInvoice.accept) {
      return await releaseAndIgnore();
    }

    const marked = await ctx.runMutation(
      internal.functions.feeBilling.markBillingInvoicePaid,
      {
        invoiceId,
        lsOrderId: verifiedOrder.orderId,
        orderStatus: verifiedOrder.status,
        subtotalCents: verifiedOrder.subtotalCents,
        totalCents: verifiedOrder.totalCents,
        testMode: verifiedOrder.testMode,
        paidAt: verifiedOrder.paidAtMs || parseIsoMs(
          typeof args.attrs.updated_at === "string"
            ? args.attrs.updated_at
            : typeof args.attrs.created_at === "string"
              ? args.attrs.created_at
              : null,
        ),
      },
    );
    if (marked.reason === "not_found" || marked.reason === "order_already_used") {
      return await releaseAndIgnore();
    }
  } catch (err) {
    console.error(
      `Fee invoice webhook failed for ${eventKey}, releasing claim:`,
      err,
    );
    try {
      await ctx.runMutation(internal.functions.recoveries.releaseWebhookEvent, {
        eventKey,
      });
    } catch (releaseErr) {
      console.error(`Failed to release claim for ${eventKey}:`, releaseErr);
    }
    return new Response("Internal error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}

async function secretsForStore(
  ctx: ActionCtx,
  storeId: string | null,
): Promise<{ choice: LemonWebhookSecretChoice; secrets: string[] }> {
  const platformStoreId = process.env.LEMONSQUEEZY_STORE_ID?.trim() || null;
  const choice = lemonWebhookSecretChoice({ storeId, platformStoreId });
  if (choice === "reject") {
    return { choice, secrets: [] };
  }
  if (choice === "platform") {
    const currentSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim();
    const previousSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET_PREVIOUS?.trim();
    const secrets = [currentSecret, previousSecret].filter(
      (s): s is string => typeof s === "string" && s.length > 0,
    );
    if (secrets.length === 0) {
      console.error("LEMONSQUEEZY_WEBHOOK_SECRET is not set");
    }
    return { choice, secrets };
  }

  if (!storeId) return { choice: "reject", secrets: [] };
  const cipher = await ctx.runQuery(
    internal.functions.lemonSqueezy.getWebhookSecretCipherByStoreId,
    { storeId },
  );
  if (!cipher) return { choice, secrets: [] };
  try {
    const secret = await decryptApiKey(cipher);
    if (!secret) return { choice, secrets: [] };
    return { choice, secrets: [secret] };
  } catch {
    return { choice, secrets: [] };
  }
}

type LemonOrderLookup =
  | { kind: "ok"; order: ReturnType<typeof parseLemonOrderForFeeInvoice> }
  | { kind: "error" };

async function fetchLemonPlatformOrder(orderId: string): Promise<LemonOrderLookup> {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY?.trim();
  if (!apiKey) {
    console.error("LEMONSQUEEZY_API_KEY is not set — cannot verify fee order");
    return { kind: "error" };
  }
  try {
    const res = await fetch(
      `https://api.lemonsqueezy.com/v1/orders/${encodeURIComponent(orderId)}`,
      {
        headers: {
          Accept: "application/vnd.api+json",
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );
    if (res.status === 404) {
      return { kind: "ok", order: null };
    }
    if (!res.ok) {
      console.error(`Lemon order lookup failed (${res.status})`);
      return { kind: "error" };
    }
    const json: unknown = await res.json();
    return { kind: "ok", order: parseLemonOrderForFeeInvoice(json) };
  } catch (err) {
    console.error("Lemon order lookup threw", err);
    return { kind: "error" };
  }
}

type LemonSubscriptionLookup =
  | { kind: "ok"; subscription: ReturnType<typeof parseLemonSubscription> }
  | { kind: "error" };

async function fetchLemonPlatformSubscription(
  subscriptionId: string,
): Promise<LemonSubscriptionLookup> {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY?.trim();
  if (!apiKey) {
    console.error("LEMONSQUEEZY_API_KEY is not set — cannot verify subscription");
    return { kind: "error" };
  }
  try {
    const res = await fetch(
      `https://api.lemonsqueezy.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
      {
        headers: {
          Accept: "application/vnd.api+json",
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );
    if (res.status === 404) {
      return { kind: "ok", subscription: null };
    }
    if (!res.ok) {
      console.error(`Lemon subscription lookup failed (${res.status})`);
      return { kind: "error" };
    }
    const json: unknown = await res.json();
    return { kind: "ok", subscription: parseLemonSubscription(json) };
  } catch (err) {
    console.error("Lemon subscription lookup threw", err);
    return { kind: "error" };
  }
}

/**
 * Timing-safe HMAC-SHA256 signature verification for a single secret.
 */
async function verifySignatureWithSecret(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
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
  // Timing-safe compare: constant-time XOR accumulation
  if (digestHex.length !== signatureHeader.length) return false;
  let mismatch = 0;
  for (let i = 0; i < digestHex.length; i += 1) {
    mismatch |= digestHex.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Verify Lemon Squeezy webhook signature against one or more secrets.
 * Supports dual-secret rotation: if current secret fails, tries previous.
 * Both secrets are always checked (timing-safe) to prevent side-channel leaks.
 */
async function verifyLemonSignature(
  rawBody: string,
  signatureHeader: string | null,
  secrets: string[],
): Promise<boolean> {
  if (!signatureHeader) return false;
  if (secrets.length === 0) return false;

  // Verify against all secrets (timing-safe: always check all, then combine)
  const results = await Promise.all(
    secrets.map((secret) =>
      verifySignatureWithSecret(rawBody, signatureHeader, secret),
    ),
  );

  // Accept if any secret verifies (supports rotation window)
  return results.some((valid) => valid);
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
