"use node";

import { v } from "convex/values";
import { action, internalAction, type ActionCtx } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { getPlatformBillingConfig } from "../lib/billingPlan";
import { apiKeyLast4, decryptApiKey, encryptApiKey } from "../lib/lsCrypto";
import { allowAppHttpsUrl, allowHttpsUrl } from "../lib/safeUrl";

async function assertCallerActive(ctx: ActionCtx): Promise<void> {
  // Model B: Admin with active takeover resolves to merchant product user.
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

const LS_HEADERS = {
  Accept: "application/vnd.api+json",
  "Content-Type": "application/vnd.api+json",
} as const;

type LsStore = {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string;
};

type LsJson = {
  meta?: { test_mode?: boolean };
  data?: unknown;
  errors?: Array<{ detail?: string; title?: string }>;
};

const storeOptionValidator = v.object({
  id: v.string(),
  name: v.string(),
  slug: v.string(),
  avatarUrl: v.optional(v.string()),
});

const REQUIRED_WEBHOOK_EVENTS = [
  "subscription_payment_failed",
  "subscription_payment_recovered",
  "subscription_updated",
] as const;

async function lsFetch(
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
    if (res.status === 401 || res.status === 403) {
      throw new Error("Invalid API key");
    }
    throw new Error(detail);
  }

  return json;
}

function normalizeWebhookUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

function webhookCallbackConfig(): { callbackUrl: string; signingSecret: string } {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim();
  const site = process.env.CONVEX_SITE_URL?.trim().replace(/\/$/, "");
  if (!secret || !site) {
    throw new Error(
      "Webhook is not configured on the server (missing LEMONSQUEEZY_WEBHOOK_SECRET or CONVEX_SITE_URL).",
    );
  }
  return {
    callbackUrl: `${site}/lemonsqueezy`,
    signingSecret: secret,
  };
}

type ListedWebhook = {
  id: string;
  url: string;
  events: string[];
  testMode: boolean;
};

function parseWebhooks(json: LsJson): ListedWebhook[] {
  const data = json.data;
  const items = Array.isArray(data) ? data : data != null ? [data] : [];
  const out: ListedWebhook[] = [];
  for (const item of items) {
    if (
      typeof item !== "object" ||
      item === null ||
      !("id" in item) ||
      !("attributes" in item)
    ) {
      continue;
    }
    const id = String((item as { id: unknown }).id);
    const attrs = (item as { attributes: Record<string, unknown> }).attributes;
    const url = typeof attrs.url === "string" ? attrs.url : "";
    const events = Array.isArray(attrs.events)
      ? attrs.events.filter((e): e is string => typeof e === "string")
      : [];
    out.push({
      id,
      url,
      events,
      testMode: attrs.test_mode === true,
    });
  }
  return out;
}

function hasRequiredEvents(events: string[]): boolean {
  return REQUIRED_WEBHOOK_EVENTS.every((e) => events.includes(e));
}

async function signAndPostWebhookPing(args: {
  storeId: string;
  callbackUrl: string;
  signingSecret: string;
}): Promise<void> {
  const eventName = "order_created";
  const resourceId = `dg-ping-${Date.now()}`;
  const body = {
    meta: { event_name: eventName },
    data: {
      type: "orders",
      id: resourceId,
      attributes: {
        store_id: Number(args.storeId) || args.storeId,
        test_mode: true,
      },
    },
  };
  const rawBody = JSON.stringify(body);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(args.signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );
  const signature = [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const res = await fetch(args.callbackUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Signature": signature,
      "X-Event-Name": eventName,
    },
    body: rawBody,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Test ping failed (${res.status}): ${text || "no response body"}`,
    );
  }
}

function parseStores(json: LsJson): LsStore[] {
  const data = json.data;
  if (!Array.isArray(data)) return [];

  const stores: LsStore[] = [];
  for (const item of data) {
    if (
      typeof item !== "object" ||
      item === null ||
      !("id" in item) ||
      !("attributes" in item)
    ) {
      continue;
    }
    const id = String((item as { id: unknown }).id);
    const attrs = (item as { attributes: Record<string, unknown> }).attributes;
    const name =
      typeof attrs.name === "string" && attrs.name.trim()
        ? attrs.name.trim()
        : `Store ${id}`;
    const slug =
      typeof attrs.slug === "string"
        ? attrs.slug
        : typeof attrs.domain === "string"
          ? attrs.domain
          : "";
    const avatarUrl =
      typeof attrs.avatar_url === "string" && attrs.avatar_url.trim()
        ? attrs.avatar_url.trim()
        : undefined;
    stores.push({ id, name, slug, ...(avatarUrl ? { avatarUrl } : {}) });
  }
  return stores;
}

/**
 * Validate a Lemon Squeezy API key and save a store connection.
 * If the account has multiple stores and storeId is omitted, returns pick_store.
 */
export const connectStore = action({
  args: {
    apiKey: v.string(),
    storeId: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      status: v.literal("connected"),
      storeId: v.string(),
      storeName: v.string(),
      storeSlug: v.string(),
      testMode: v.boolean(),
    }),
    v.object({
      status: v.literal("pick_store"),
      stores: v.array(storeOptionValidator),
      testMode: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    await assertCallerActive(ctx);
    const clerkUserId = await productClerkUserId(ctx);

    await ctx.runMutation(internal.functions.rateLimit.consume, {
      key: `ls:connect:${clerkUserId}`,
      limit: 5,
      windowMs: 60_000,
    });

    const apiKey = args.apiKey.trim();
    if (!apiKey) throw new Error("API key is required");

    // Prove the key works
    const me = await lsFetch(apiKey, "/users/me");
    const testMode = me.meta?.test_mode === true;

    const storesJson = await lsFetch(apiKey, "/stores");
    const stores = parseStores(storesJson);

    if (stores.length === 0) {
      throw new Error("No stores found on this Lemon Squeezy account");
    }

    if (!args.storeId && stores.length > 1) {
      return {
        status: "pick_store" as const,
        stores,
        testMode,
      };
    }

    const selected =
      args.storeId != null
        ? stores.find((s) => s.id === args.storeId)
        : stores[0];

    if (!selected) {
      throw new Error("Selected store not found for this API key");
    }

    const cipher = await encryptApiKey(apiKey);

    await ctx.runMutation(internal.functions.lemonSqueezy.saveConnection, {
      clerkUserId,
      storeId: selected.id,
      storeName: selected.name,
      storeSlug: selected.slug,
      storeAvatarUrl: selected.avatarUrl,
      stores,
      apiKeyCipher: cipher,
      apiKeyLast4: apiKeyLast4(apiKey),
      testMode,
    });

    return {
      status: "connected" as const,
      storeId: selected.id,
      storeName: selected.name,
      storeSlug: selected.slug,
      testMode,
    };
  },
});

/** Refresh stores + logo from Lemon Squeezy (sidebar picker + email branding) */
export const refreshStores = action({
  args: {},
  returns: v.array(storeOptionValidator),
  handler: async (ctx) => {
    await assertCallerActive(ctx);
    const clerkUserId = await productClerkUserId(ctx);

    await ctx.runMutation(internal.functions.rateLimit.consume, {
      key: `ls:refresh:${clerkUserId}`,
      limit: 20,
      windowMs: 60_000,
    });

    const secret = await ctx.runQuery(
      internal.functions.lemonSqueezy.getConnectionSecret,
      { clerkUserId },
    );
    if (!secret) throw new Error("No Lemon Squeezy connection");

    let apiKey: string;
    try {
      apiKey = await decryptApiKey(secret.apiKeyCipher);
    } catch {
      throw new Error(
        "Could not decrypt your Lemon Squeezy API key. The encryption key may have changed — disconnect and reconnect your store.",
      );
    }

    const me = await lsFetch(apiKey, "/users/me");
    const testMode = me.meta?.test_mode === true;
    const stores = parseStores(await lsFetch(apiKey, "/stores"));
    if (stores.length === 0) {
      throw new Error("No stores found on this Lemon Squeezy account");
    }

    const stillSelected = stores.find((s) => s.id === secret.storeId);
    const selected = stillSelected ?? stores[0]!;

    await ctx.runMutation(internal.functions.lemonSqueezy.patchStores, {
      connectionId: secret._id,
      stores,
      storeId: selected.id,
      storeName: selected.name,
      storeSlug: selected.slug,
      storeAvatarUrl: selected.avatarUrl ?? null,
      testMode,
    });

    return stores;
  },
});

/**
 * Create (or update) the DeclineGuard webhook on the merchant’s LS store
 * using their stored API key — no manual paste required.
 */
export const installStoreWebhook = action({
  args: {},
  returns: v.object({
    status: v.union(
      v.literal("created"),
      v.literal("updated"),
      v.literal("already_configured"),
    ),
    webhookId: v.string(),
  }),
  handler: async (ctx) => {
    await assertCallerActive(ctx);
    const clerkUserId = await productClerkUserId(ctx);

    await ctx.runMutation(internal.functions.rateLimit.consume, {
      key: `ls:installWebhook:${clerkUserId}`,
      limit: 10,
      windowMs: 60_000,
    });

    const secret = await ctx.runQuery(
      internal.functions.lemonSqueezy.getConnectionSecret,
      { clerkUserId },
    );
    if (!secret) throw new Error("No Lemon Squeezy connection");

    let apiKey: string;
    try {
      apiKey = await decryptApiKey(secret.apiKeyCipher);
    } catch {
      throw new Error(
        "Could not decrypt your Lemon Squeezy API key. Disconnect and reconnect your store.",
      );
    }

    const { callbackUrl, signingSecret } = webhookCallbackConfig();
    const targetUrl = normalizeWebhookUrl(callbackUrl);
    const events = [...REQUIRED_WEBHOOK_EVENTS];

    const listed = parseWebhooks(
      await lsFetch(
        apiKey,
        `/webhooks?filter[store_id]=${encodeURIComponent(secret.storeId)}`,
      ),
    );

    const existing = listed.find(
      (w) => normalizeWebhookUrl(w.url) === targetUrl,
    );

    let status: "created" | "updated" | "already_configured";
    let webhookId: string;

    if (existing) {
      const needsUpdate =
        !hasRequiredEvents(existing.events) ||
        existing.testMode !== secret.testMode;
      if (needsUpdate) {
        await lsFetch(apiKey, `/webhooks/${existing.id}`, {
          method: "PATCH",
          body: {
            data: {
              type: "webhooks",
              id: existing.id,
              attributes: {
                url: callbackUrl,
                events,
                secret: signingSecret,
              },
            },
          },
        });
        status = "updated";
      } else {
        // Refresh secret so LS matches Convex even if events were already OK.
        await lsFetch(apiKey, `/webhooks/${existing.id}`, {
          method: "PATCH",
          body: {
            data: {
              type: "webhooks",
              id: existing.id,
              attributes: {
                secret: signingSecret,
                events,
              },
            },
          },
        });
        status = "already_configured";
      }
      webhookId = existing.id;
    } else {
      const created = await lsFetch(apiKey, "/webhooks", {
        method: "POST",
        body: {
          data: {
            type: "webhooks",
            attributes: {
              url: callbackUrl,
              events,
              secret: signingSecret,
              test_mode: secret.testMode,
            },
            relationships: {
              store: {
                data: {
                  type: "stores",
                  id: secret.storeId,
                },
              },
            },
          },
        },
      });
      const createdId =
        created.data &&
        typeof created.data === "object" &&
        created.data !== null &&
        "id" in created.data
          ? String((created.data as { id: unknown }).id)
          : "";
      if (!createdId) {
        throw new Error("Lemon Squeezy created the webhook but returned no id");
      }
      webhookId = createdId;
      status = "created";
    }

    // Prove our endpoint accepts signed deliveries for this store.
    await signAndPostWebhookPing({
      storeId: secret.storeId,
      callbackUrl,
      signingSecret,
    });

    return { status, webhookId };
  },
});

/**
 * Sign a harmless ping and POST it to our webhook endpoint.
 * Used when the merchant configured the webhook manually.
 */
export const sendWebhookTestPing = action({
  args: {},
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx) => {
    await assertCallerActive(ctx);
    const clerkUserId = await productClerkUserId(ctx);

    await ctx.runMutation(internal.functions.rateLimit.consume, {
      key: `ls:webhookPing:${clerkUserId}`,
      limit: 10,
      windowMs: 60_000,
    });

    const secret = await ctx.runQuery(
      internal.functions.lemonSqueezy.getConnectionSecret,
      { clerkUserId },
    );
    if (!secret) throw new Error("No Lemon Squeezy connection");

    const { callbackUrl, signingSecret } = webhookCallbackConfig();
    await signAndPostWebhookPing({
      storeId: secret.storeId,
      callbackUrl,
      signingSecret,
    });

    return { ok: true as const };
  },
});

type RetryCoreFailure = {
  failureId: Id<"failedPayments">;
  connectionId: Id<"lemonConnections">;
  subscriptionId: string;
};

type RetryCoreResult = {
  status: "ok" | "no_connection" | "ls_error";
  message: string;
  updatePaymentUrl?: string;
};

type RetryActionResult = {
  status: "ok" | "not_found" | "not_open" | "no_connection" | "ls_error";
  message: string;
  updatePaymentUrl?: string;
};

/** Shared LS URL refresh + sanitize + persist. Not exported. */
async function runRetryFailedPayment(
  ctx: ActionCtx,
  args: {
    failure: RetryCoreFailure;
    requestedBy: "merchant" | "staff";
  },
): Promise<RetryCoreResult> {
  const copy =
    args.requestedBy === "merchant"
      ? {
          noConnection:
            "No Lemon Squeezy connection found. Please reconnect your store.",
          decryptFail:
            "Could not decrypt your Lemon Squeezy API key. Disconnect and reconnect your store.",
        }
      : {
          noConnection: "No Lemon Squeezy connection found for this failure.",
          decryptFail: "Could not decrypt Lemon Squeezy API key.",
        };

  const secret = await ctx.runQuery(
    internal.functions.lemonSqueezy.getConnectionSecretById,
    { connectionId: args.failure.connectionId },
  );
  if (!secret) {
    return {
      status: "no_connection",
      message: copy.noConnection,
    };
  }

  let apiKey: string;
  try {
    apiKey = await decryptApiKey(secret.apiKeyCipher);
  } catch {
    return {
      status: "no_connection",
      message: copy.decryptFail,
    };
  }

  let rawUpdatePaymentUrl: string | undefined;
  try {
    const json = await lsFetch(
      apiKey,
      `/subscriptions/${args.failure.subscriptionId}`,
    );
    const data = json.data as Record<string, unknown> | null | undefined;
    const attrs =
      data && typeof data === "object" && "attributes" in data
        ? (data.attributes as Record<string, unknown>)
        : null;

    if (attrs) {
      const urls =
        attrs.urls && typeof attrs.urls === "object"
          ? (attrs.urls as Record<string, unknown>)
          : null;

      rawUpdatePaymentUrl =
        typeof urls?.update_payment_method === "string"
          ? urls.update_payment_method
          : typeof urls?.customer_portal === "string"
            ? urls.customer_portal
            : undefined;
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Lemon Squeezy API error";
    return {
      status: "ls_error",
      message: `Failed to fetch subscription data: ${message}`,
    };
  }

  const sanitizedUrl = allowHttpsUrl(rawUpdatePaymentUrl) ?? undefined;

  await ctx.runMutation(internal.functions.recoveries.updateFailureForRetry, {
    failureId: args.failure.failureId,
    updatePaymentUrl: sanitizedUrl,
    requestedBy: args.requestedBy,
  });

  return {
    status: "ok",
    message: "Retry requested. Fresh payment link fetched.",
    updatePaymentUrl: sanitizedUrl,
  };
}

/**
 * Merchant-triggered retry for a failed payment.
 * Lemon Squeezy does not expose a manual retry API, so this action:
 * 1. Fetches fresh subscription data (with new update_payment_method URL)
 * 2. Updates the failedPayment record with the fresh URL (sanitized)
 * 3. Records a retry_requested activity breadcrumb (no fake recovered event)
 *
 * v1: URL refresh + activity only. Does NOT advance the recovery email sequence.
 * sendEmail is accepted but currently no-ops (reserved for future use).
 *
 * Requirements:
 * - Caller must be authenticated (Model B takeover supported)
 * - Failure must be "open" and owned by the caller's product account
 * - Rate-limited per failure and per user
 */
export const retryFailedPayment = action({
  args: {
    failureId: v.id("failedPayments"),
    sendEmail: v.optional(v.boolean()),
  },
  returns: v.object({
    status: v.union(
      v.literal("ok"),
      v.literal("not_found"),
      v.literal("not_open"),
      v.literal("no_connection"),
      v.literal("ls_error"),
    ),
    message: v.string(),
    updatePaymentUrl: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<RetryActionResult> => {
    await assertCallerActive(ctx);
    const clerkUserId = await productClerkUserId(ctx);

    await ctx.runMutation(internal.functions.rateLimit.consume, {
      key: `ls:retry:user:${clerkUserId}`,
      limit: 10,
      windowMs: 60_000,
    });

    await ctx.runMutation(internal.functions.rateLimit.consume, {
      key: `ls:retry:failure:${args.failureId}`,
      limit: 3,
      windowMs: 60_000,
    });

    const product = await ctx.runQuery(
      api.functions.adminTakeover.getProductContext,
      {},
    );

    const failure = await ctx.runQuery(
      internal.functions.recoveries.getFailureForRetry,
      { failureId: args.failureId, userId: product.convexUserId },
    );

    if (!failure) {
      return {
        status: "not_found" as const,
        message: "Failed payment not found or you do not have access to it.",
      };
    }

    if (failure.status !== "open") {
      return {
        status: "not_open" as const,
        message: "This payment is no longer open for retry.",
      };
    }

    return await runRetryFailedPayment(ctx, {
      failure: {
        failureId: args.failureId,
        connectionId: failure.connectionId,
        subscriptionId: failure.subscriptionId,
      },
      requestedBy: "merchant",
    });
  },
});

/**
 * Internal action for staff/ops to trigger retry without auth checks.
 * Ownership guard still applies — staff must specify a valid failure.
 *
 * v1: URL refresh + activity only. Does NOT advance the recovery email sequence.
 * sendEmail is accepted but currently no-ops (reserved for future use).
 *
 * Internal only — do not wrap as a public action.
 */
export const retryFailedPaymentInternal = internalAction({
  args: {
    failureId: v.id("failedPayments"),
    sendEmail: v.optional(v.boolean()),
  },
  returns: v.object({
    status: v.union(
      v.literal("ok"),
      v.literal("not_found"),
      v.literal("not_open"),
      v.literal("no_connection"),
      v.literal("ls_error"),
    ),
    message: v.string(),
    updatePaymentUrl: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<RetryActionResult> => {
    const failure = await ctx.runQuery(
      internal.functions.recoveries.getFailureEmailPayload,
      { failureId: args.failureId },
    );

    if (!failure) {
      return {
        status: "not_found" as const,
        message: "Failed payment not found.",
      };
    }

    if (failure.status !== "open") {
      return {
        status: "not_open" as const,
        message: "This payment is no longer open for retry.",
      };
    }

    return await runRetryFailedPayment(ctx, {
      failure: {
        failureId: args.failureId,
        connectionId: failure.connectionId,
        subscriptionId: failure.subscriptionId,
      },
      requestedBy: "staff",
    });
  },
});

/**
 * Fetch fresh subscription data from Lemon Squeezy API.
 * Used before sending recovery emails to get live update_payment_method URL.
 * Internal-only to prevent public access to merchant LS API keys.
 */
export const fetchFreshSubscriptionUrl = internalAction({
  args: {
    connectionId: v.id("lemonConnections"),
    subscriptionId: v.string(),
  },
  returns: v.union(
    v.object({
      updatePaymentMethodUrl: v.union(v.string(), v.null()),
      customerPortalUrl: v.union(v.string(), v.null()),
      subscriptionStatus: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const connectionSecret = await ctx.runQuery(
      internal.functions.lemonSqueezy.getConnectionSecretById,
      { connectionId: args.connectionId },
    );
    if (!connectionSecret) return null;

    let apiKey: string;
    try {
      apiKey = await decryptApiKey(connectionSecret.apiKeyCipher);
    } catch {
      console.warn("Could not decrypt API key for fresh subscription fetch");
      return null;
    }

    try {
      const json = await lsFetch(apiKey, `/subscriptions/${args.subscriptionId}`);
      const data = json.data as Record<string, unknown> | null | undefined;
      const attrs =
        data && typeof data === "object" && "attributes" in data
          ? (data.attributes as Record<string, unknown>)
          : null;
      if (!attrs) return null;

      const urls =
        attrs.urls && typeof attrs.urls === "object"
          ? (attrs.urls as Record<string, unknown>)
          : null;

      const updatePaymentMethodUrl =
        typeof urls?.update_payment_method === "string"
          ? urls.update_payment_method
          : null;
      const customerPortalUrl =
        typeof urls?.customer_portal === "string"
          ? urls.customer_portal
          : null;
      const subscriptionStatus =
        typeof attrs.status === "string" ? attrs.status : null;

      return {
        updatePaymentMethodUrl,
        customerPortalUrl,
        subscriptionStatus,
      };
    } catch (err) {
      console.warn("Failed to fetch fresh subscription data:", err);
      return null;
    }
  },
});

function checkoutUrlFromLs(json: LsJson): string | null {
  const data = json.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const attrs =
    "attributes" in data &&
    data.attributes &&
    typeof data.attributes === "object"
      ? (data.attributes as Record<string, unknown>)
      : null;
  if (!attrs) return null;
  if (typeof attrs.url === "string") return attrs.url;
  const urls =
    attrs.urls && typeof attrs.urls === "object"
      ? (attrs.urls as Record<string, unknown>)
      : null;
  return typeof urls?.url === "string" ? urls.url : null;
}

/**
 * Create a Lemon Squeezy checkout for DeclineGuard Pro ($29.99/mo).
 * Does NOT set users.plan — webhooks are the source of truth after payment.
 */
export const createProCheckout = action({
  args: {
    returnUrl: v.optional(v.string()),
  },
  returns: v.object({
    checkoutUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    await ctx.runMutation(api.functions.user.ensureCurrentUser, {});

    const viewer = await ctx.runQuery(
      internal.functions.billing.getViewerForCheckout,
      {},
    );
    if (viewer.accountStatus === "disabled") {
      throw new Error("This account is disabled. Contact DeclineGuard support.");
    }
    if (viewer.accountStatus === "frozen") {
      throw new Error(
        "This account is frozen. Contact DeclineGuard support to restore access before upgrading.",
      );
    }
    if (
      viewer.plan === "pro" &&
      (viewer.lsSubscriptionStatus ?? "").toLowerCase() === "active"
    ) {
      throw new Error("You already have an active Pro subscription.");
    }

    await ctx.runMutation(internal.functions.rateLimit.consume, {
      key: `ls:proCheckout:${identity.subject}`,
      limit: 5,
      windowMs: 60_000,
    });

    const config = getPlatformBillingConfig();
    const apiKey = config?.apiKey ?? process.env.LEMONSQUEEZY_API_KEY?.trim();
    if (!config || !apiKey) {
      throw new Error(
        "Pro checkout is not configured. Set LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_STORE_ID, and LEMONSQUEEZY_PRO_VARIANT_ID.",
      );
    }

    const returnUrl = allowAppHttpsUrl(args.returnUrl);
    const variantNumeric = Number(config.variantId);
    if (!Number.isFinite(variantNumeric)) {
      throw new Error("LEMONSQUEEZY_PRO_VARIANT_ID must be a numeric variant id.");
    }

    const checkoutNonce = crypto.randomUUID();
    await ctx.runMutation(internal.functions.billing.reserveProCheckoutNonce, {
      nonce: checkoutNonce,
    });

    const json = await lsFetch(apiKey, "/checkouts", {
      method: "POST",
      body: {
        data: {
          type: "checkouts",
          attributes: {
            checkout_data: {
              ...(identity.email ? { email: identity.email } : {}),
              ...(identity.name ? { name: identity.name } : {}),
              custom: {
                convex_user_id: viewer._id,
                clerk_user_id: identity.subject,
                checkout_nonce: checkoutNonce,
              },
            },
            product_options: {
              enabled_variants: [variantNumeric],
              ...(returnUrl
                ? {
                    redirect_url: returnUrl,
                    receipt_button_text: "Back to DeclineGuard",
                    receipt_link_url: returnUrl,
                  }
                : {}),
            },
          },
          relationships: {
            store: {
              data: { type: "stores", id: config.storeId },
            },
            variant: {
              data: { type: "variants", id: config.variantId },
            },
          },
        },
      },
    });

    const rawUrl = checkoutUrlFromLs(json);
    const checkoutUrl = allowHttpsUrl(rawUrl);
    if (!checkoutUrl) {
      throw new Error("Lemon Squeezy returned an invalid checkout URL");
    }
    return { checkoutUrl };
  },
});
