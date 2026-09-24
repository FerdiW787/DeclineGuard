import {
  internalMutation,
  internalQuery,
  query,
  type MutationCtx,
} from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import {
  getAuthenticatedUser,
  resolvePlan,
  type Plan,
} from "../lib/accountGuard";
import { writeAuditLog } from "../lib/admin";
import {
  canPromoteWithoutCatalogIds,
  checkoutNonceMatches,
  getPlatformBillingConfig,
  matchesProCatalog,
  planFromLsStatus,
  PRO_CHECKOUT_NONCE_TTL_MS,
  shouldIgnoreLsTestEvent,
} from "../lib/billingPlan";
import { planValidator } from "../schema";

const billingStatusValidator = v.object({
  plan: planValidator,
  lsSubscriptionId: v.union(v.string(), v.null()),
  lsSubscriptionStatus: v.union(v.string(), v.null()),
  hasActivePro: v.boolean(),
});

function hasActivePro(user: Doc<"users">): boolean {
  return (
    resolvePlan(user) === "pro" &&
    (user.lsSubscriptionStatus ?? "").toLowerCase() === "active"
  );
}

/** Viewer (signed-in user), never the takeover merchant. Used for checkout. */
export const getViewerForCheckout = internalQuery({
  args: {},
  returns: v.object({
    _id: v.id("users"),
    clerkUserId: v.string(),
    plan: planValidator,
    lsSubscriptionId: v.union(v.string(), v.null()),
    lsSubscriptionStatus: v.union(v.string(), v.null()),
    accountStatus: v.union(
      v.literal("active"),
      v.literal("frozen"),
      v.literal("disabled"),
    ),
  }),
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    return {
      _id: user._id,
      clerkUserId: user.userId,
      plan: resolvePlan(user),
      lsSubscriptionId: user.lsSubscriptionId ?? null,
      lsSubscriptionStatus: user.lsSubscriptionStatus ?? null,
      accountStatus: user.accountStatus ?? "active",
    };
  },
});

/** Read-only billing snapshot for the signed-in viewer. */
export const getMyBilling = query({
  args: {},
  returns: v.union(billingStatusValidator, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();
    if (!user) return null;
    return {
      plan: resolvePlan(user),
      lsSubscriptionId: user.lsSubscriptionId ?? null,
      lsSubscriptionStatus: user.lsSubscriptionStatus ?? null,
      hasActivePro: hasActivePro(user),
    };
  },
});

async function findPlatformBillingUser(
  ctx: { db: MutationCtx["db"] },
  args: {
    lsSubscriptionId: string;
    convexUserId?: string;
    clerkUserId?: string;
  },
): Promise<Doc<"users"> | null> {
  if (args.convexUserId) {
    const normalized = ctx.db.normalizeId("users", args.convexUserId);
    if (normalized) {
      const byConvexId = await ctx.db.get(normalized);
      if (byConvexId) return byConvexId;
    }
  }

  if (args.clerkUserId) {
    const byClerk = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.clerkUserId!))
      .unique();
    if (byClerk) return byClerk;
  }

  return await ctx.db
    .query("users")
    .withIndex("by_lsSubscriptionId", (q) =>
      q.eq("lsSubscriptionId", args.lsSubscriptionId),
    )
    .unique();
}

/**
 * Store a one-time nonce on the signed-in viewer before createProCheckout.
 * Webhooks that omit catalog ids must present this nonce (or a known sub).
 */
export const reserveProCheckoutNonce = internalMutation({
  args: {
    nonce: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const nonce = args.nonce.trim();
    if (!nonce || nonce.length > 80) {
      throw new Error("Invalid checkout nonce");
    }
    const user = await getAuthenticatedUser(ctx);
    await ctx.db.patch(user._id, {
      lsCheckoutNonce: nonce,
      lsCheckoutNonceExpiresAt: Date.now() + PRO_CHECKOUT_NONCE_TTL_MS,
    });
    return null;
  },
});

/**
 * Apply a signed LS platform-store subscription event to users.plan.
 * Webhooks are the source of truth — this is the only non-staff plan write.
 * Test-mode events do not patch plan unless ALLOW_LS_TEST_BILLING=true.
 */
export const applyPlatformSubscription = internalMutation({
  args: {
    lsSubscriptionId: v.string(),
    status: v.string(),
    variantId: v.optional(v.string()),
    productId: v.optional(v.string()),
    convexUserId: v.optional(v.string()),
    clerkUserId: v.optional(v.string()),
    checkoutNonce: v.optional(v.string()),
    testMode: v.boolean(),
  },
  returns: v.object({
    applied: v.boolean(),
    plan: v.optional(planValidator),
    reason: v.string(),
  }),
  handler: async (ctx, args) => {
    const config = getPlatformBillingConfig();
    if (!config) {
      return { applied: false, reason: "platform_billing_not_configured" };
    }

    if (shouldIgnoreLsTestEvent(args.testMode)) {
      const user = await findPlatformBillingUser(ctx, args);
      if (user) {
        await writeAuditLog(ctx, {
          actorUserId: null,
          targetUserId: user._id,
          action: "plan_webhook:test_mode_ignored",
          reason: "Lemon Squeezy test_mode event ignored (live plan unchanged)",
          metadata: {
            status: args.status,
            lsSubscriptionId: args.lsSubscriptionId,
            variantId: args.variantId ?? null,
            testMode: true,
          },
        });
      }
      return { applied: false, reason: "test_mode_ignored" };
    }

    const nextPlan = planFromLsStatus(args.status);
    if (!nextPlan) {
      return { applied: false, reason: "status_ignored" };
    }

    const catalogOk = matchesProCatalog({
      variantId: args.variantId ?? null,
      productId: args.productId ?? null,
      expectedVariantId: config.variantId,
      expectedProductId: config.productId,
    });

    const user = await findPlatformBillingUser(ctx, args);
    if (!user) {
      return { applied: false, reason: "user_not_found" };
    }

    const knownSub = user.lsSubscriptionId === args.lsSubscriptionId;
    const checkoutNonceOk = checkoutNonceMatches({
      provided: args.checkoutNonce,
      stored: user.lsCheckoutNonce,
      expiresAt: user.lsCheckoutNonceExpiresAt,
      nowMs: Date.now(),
    });

    // Promote only for the configured Pro variant/product. When catalog ids
    // are omitted (payment_success invoices), require a known subscription or
    // the pending-checkout nonce — not bare custom_data user ids.
    if (nextPlan === "pro") {
      if (args.variantId && args.variantId !== config.variantId) {
        return { applied: false, reason: "variant_mismatch" };
      }
      if (
        config.productId &&
        args.productId &&
        args.productId !== config.productId
      ) {
        return { applied: false, reason: "product_mismatch" };
      }
      if (
        !catalogOk &&
        !canPromoteWithoutCatalogIds({ knownSub, checkoutNonceOk })
      ) {
        return { applied: false, reason: "variant_mismatch" };
      }
    }
    if (nextPlan === "free" && !catalogOk && !knownSub) {
      return { applied: false, reason: "unverified_subscription" };
    }

    const priorPlan: Plan = resolvePlan(user);
    await ctx.db.patch(user._id, {
      plan: nextPlan,
      lsSubscriptionId: args.lsSubscriptionId,
      lsSubscriptionStatus: args.status,
      lsCheckoutNonce: "",
      lsCheckoutNonceExpiresAt: 0,
    });

    if (priorPlan !== nextPlan) {
      await writeAuditLog(ctx, {
        actorUserId: null,
        targetUserId: user._id,
        action: `plan_webhook:${nextPlan}`,
        reason: "Lemon Squeezy platform subscription webhook",
        metadata: {
          priorPlan,
          status: args.status,
          lsSubscriptionId: args.lsSubscriptionId,
          variantId: args.variantId ?? null,
          testMode: args.testMode,
          knownSub,
          checkoutNonceOk,
        },
      });
    }

    return {
      applied: priorPlan !== nextPlan || !knownSub,
      plan: nextPlan,
      reason: "ok",
    };
  },
});
