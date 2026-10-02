"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { allowAppHttpsUrl, allowHttpsUrl } from "../lib/safeUrl";
import {
  createDodoCheckoutSession,
  createDodoCustomerPortal,
  getDodoPaymentsConfig,
} from "../lib/dodoPayments";
import { dodoPlatformPathBlocked } from "../lib/billingProvider";

/**
 * Dodo Payments hosted checkout / portal.
 * Public names Jules will call stay on lemonSqueezyActions:
 *   createProCheckout → { checkoutUrl }
 *   createBillingPortal → { portalUrl }
 *   createPackCheckout → { checkoutUrl } (optional)
 */

export const createProCheckoutInternal = internalAction({
  args: {
    returnUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  returns: v.object({
    checkoutUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    const viewer = await ctx.runQuery(
      internal.functions.billing.getViewerForCheckout,
      {},
    );
    if (dodoPlatformPathBlocked(viewer.billingProvider)) {
      throw new Error("Dodo checkout is not enabled for this account.");
    }
    if (viewer.hasActivePro) {
      throw new Error("You already have an active Pro subscription.");
    }

    const config = getDodoPaymentsConfig();
    if (!config) {
      throw new Error(
        "Pro checkout is not configured. Set DODO_PAYMENTS_API_KEY and DODO_PAYMENTS_PRO_PRODUCT_ID.",
      );
    }

    const checkoutNonce = crypto.randomUUID();
    await ctx.runMutation(internal.functions.dodoBilling.reserveDodoCheckoutNonce, {
      nonce: checkoutNonce,
    });

    const returnUrl = allowAppHttpsUrl(args.returnUrl);
    const session = await createDodoCheckoutSession(config, {
      kind: "pro",
      productId: config.proProductId,
      quantity: 1,
      returnUrl,
      email: args.email,
      name: args.name,
      metadata: {
        convex_user_id: viewer._id,
        clerk_user_id: viewer.clerkUserId,
        checkout_nonce: checkoutNonce,
        billing_kind: "pro",
      },
    });

    const checkoutUrl = allowHttpsUrl(session.checkoutUrl);
    if (!checkoutUrl) {
      throw new Error("Dodo Payments returned an invalid checkout URL");
    }
    return { checkoutUrl };
  },
});

export const createPortalInternal = internalAction({
  args: {
    returnUrl: v.optional(v.string()),
  },
  returns: v.object({
    portalUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    const viewer = await ctx.runQuery(
      internal.functions.billing.getViewerForCheckout,
      {},
    );
    if (dodoPlatformPathBlocked(viewer.billingProvider)) {
      throw new Error("Dodo portal is not enabled for this account.");
    }
    if (!viewer.dodoCustomerId) {
      throw new Error("No Dodo Payments customer is on file for this account.");
    }
    const config = getDodoPaymentsConfig();
    if (!config) {
      throw new Error(
        "Billing portal is not configured. Set DODO_PAYMENTS_API_KEY.",
      );
    }
    const session = await createDodoCustomerPortal(config, {
      customerId: viewer.dodoCustomerId,
      returnUrl: allowAppHttpsUrl(args.returnUrl),
    });
    const portalUrl = allowHttpsUrl(session.portalUrl);
    if (!portalUrl) {
      throw new Error("Dodo Payments returned an invalid portal URL");
    }
    return { portalUrl };
  },
});

export const createPackCheckoutInternal = internalAction({
  args: {
    returnUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    quantity: v.optional(v.number()),
  },
  returns: v.object({
    checkoutUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    const viewer = await ctx.runQuery(
      internal.functions.billing.getViewerForCheckout,
      {},
    );
    if (dodoPlatformPathBlocked(viewer.billingProvider)) {
      throw new Error("Dodo pack checkout is not enabled for this account.");
    }
    const config = getDodoPaymentsConfig();
    if (!config?.packProductId) {
      throw new Error(
        "Pack checkout is not configured. Set DODO_PAYMENTS_PACK_PRODUCT_ID.",
      );
    }
    const quantity =
      args.quantity != null && Number.isFinite(args.quantity)
        ? Math.max(1, Math.min(Math.floor(args.quantity), 20))
        : 1;
    const session = await createDodoCheckoutSession(config, {
      kind: "pack",
      productId: config.packProductId,
      quantity,
      returnUrl: allowAppHttpsUrl(args.returnUrl),
      email: args.email,
      name: args.name,
      metadata: {
        convex_user_id: viewer._id,
        clerk_user_id: viewer.clerkUserId,
        billing_kind: "pack",
        quantity: String(quantity),
      },
    });
    const checkoutUrl = allowHttpsUrl(session.checkoutUrl);
    if (!checkoutUrl) {
      throw new Error("Dodo Payments returned an invalid checkout URL");
    }
    return { checkoutUrl };
  },
});

/** Public alias so Jules can call packs without knowing the adapter. */
export const createPackCheckout = action({
  args: {
    returnUrl: v.optional(v.string()),
    quantity: v.optional(v.number()),
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
        "This account is frozen. Contact DeclineGuard support to restore access before purchasing.",
      );
    }
    if (viewer.billingProvider !== "dodo") {
      throw new Error(
        "Decline packs on Lemon Squeezy are not wired. Switch this merchant to Dodo or use staff billing.",
      );
    }
    await ctx.runMutation(internal.functions.rateLimit.consume, {
      key: `dodo:packCheckout:${identity.subject}`,
      limit: 5,
      windowMs: 60_000,
    });
    const config = getDodoPaymentsConfig();
    if (!config?.packProductId) {
      throw new Error(
        "Pack checkout is not configured. Set DODO_PAYMENTS_PACK_PRODUCT_ID.",
      );
    }
    const quantity =
      args.quantity != null && Number.isFinite(args.quantity)
        ? Math.max(1, Math.min(Math.floor(args.quantity), 20))
        : 1;
    const session = await createDodoCheckoutSession(config, {
      kind: "pack",
      productId: config.packProductId,
      quantity,
      returnUrl: allowAppHttpsUrl(args.returnUrl),
      email: identity.email ?? undefined,
      name: identity.name ?? undefined,
      metadata: {
        convex_user_id: viewer._id,
        clerk_user_id: viewer.clerkUserId,
        billing_kind: "pack",
        quantity: String(quantity),
      },
    });
    const checkoutUrl = allowHttpsUrl(session.checkoutUrl);
    if (!checkoutUrl) {
      throw new Error("Dodo Payments returned an invalid checkout URL");
    }
    return { checkoutUrl };
  },
});
