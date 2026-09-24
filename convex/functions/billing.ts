import { internalMutation, internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import {
  getAuthenticatedUser,
  resolvePlan,
  type Plan,
} from "../lib/accountGuard";
import { writeAuditLog } from "../lib/admin";
import {
  getPlatformBillingConfig,
  matchesProCatalog,
  planFromLsStatus,
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

/**
 * Apply a signed LS platform-store subscription event to users.plan.
 * Webhooks are the source of truth — this is the only non-staff plan write.
 */
export const applyPlatformSubscription = internalMutation({
  args: {
    lsSubscriptionId: v.string(),
    status: v.string(),
    variantId: v.optional(v.string()),
    productId: v.optional(v.string()),
    convexUserId: v.optional(v.string()),
    clerkUserId: v.optional(v.string()),
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

    let user: Doc<"users"> | null = null;

    if (args.convexUserId) {
      const normalized = ctx.db.normalizeId("users", args.convexUserId);
      if (normalized) {
        user = await ctx.db.get(normalized);
      }
    }

    if (!user && args.clerkUserId) {
      user = await ctx.db
        .query("users")
        .withIndex("by_userId", (q) => q.eq("userId", args.clerkUserId!))
        .unique();
    }

    if (!user) {
      user = await ctx.db
        .query("users")
        .withIndex("by_lsSubscriptionId", (q) =>
          q.eq("lsSubscriptionId", args.lsSubscriptionId),
        )
        .unique();
    }

    if (!user) {
      return { applied: false, reason: "user_not_found" };
    }

    const knownSub = user.lsSubscriptionId === args.lsSubscriptionId;
    const resolvedViaCustomData = Boolean(
      args.convexUserId &&
        ctx.db.normalizeId("users", args.convexUserId) === user._id,
    );

    // Promote only for the configured Pro variant/product, or when our
    // checkout custom_data resolved the user and catalog ids were omitted
    // (payment_success invoices sometimes drop variant/product).
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
      if (!catalogOk && !resolvedViaCustomData) {
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
