import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "../_generated/server";
import {
  getAuthenticatedUser,
  resolvePlan,
  type Plan,
} from "../lib/accountGuard";
import { writeAuditLog } from "../lib/admin";
import {
  dodoPlatformEventAction,
  isActiveSubscriptionStatus,
  nextDeclinePackExtra,
  packExtraDeclines,
  planAfterForeignDemotion,
  resolveBillingProvider,
  type BillingProviderId,
} from "../lib/billingProvider";
import { checkoutNonceMatches, PRO_CHECKOUT_NONCE_TTL_MS } from "../lib/billingPlan";
import {
  getDodoPaymentsConfig,
  matchesDodoProProduct,
  planFromDodoStatus,
  shouldIgnoreDodoTestEvent,
} from "../lib/dodoPayments";
import { billingProviderValidator, planValidator } from "../schema";

export function billingProviderForUser(
  user: Pick<
    Doc<"users">,
    | "billingProvider"
    | "lsSubscriptionId"
    | "lsSubscriptionStatus"
    | "dodoSubscriptionId"
    | "dodoSubscriptionStatus"
    | "plan"
  >,
  envProvider: string | undefined = process.env.BILLING_PROVIDER,
): BillingProviderId {
  return resolveBillingProvider({
    envProvider,
    userProvider: user.billingProvider ?? null,
    hasActiveLemonSubscription:
      Boolean(user.lsSubscriptionId) &&
      isActiveSubscriptionStatus(user.lsSubscriptionStatus),
    hasActiveDodoSubscription:
      Boolean(user.dodoSubscriptionId) &&
      isActiveSubscriptionStatus(user.dodoSubscriptionStatus),
  });
}

export function userHasActivePro(user: Doc<"users">): boolean {
  if (resolvePlan(user) !== "pro") return false;
  return (
    isActiveSubscriptionStatus(user.lsSubscriptionStatus) ||
    isActiveSubscriptionStatus(user.dodoSubscriptionStatus)
  );
}

export const getUserBillingProvider = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      billingProvider: billingProviderValidator,
      clerkUserId: v.string(),
      userName: v.string(),
      plan: planValidator,
      dodoCustomerId: v.union(v.string(), v.null()),
      dodoSubscriptionId: v.union(v.string(), v.null()),
      hasActivePro: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    return {
      _id: user._id,
      billingProvider: billingProviderForUser(user),
      clerkUserId: user.userId,
      userName: user.userName,
      plan: resolvePlan(user),
      dodoCustomerId: user.dodoCustomerId ?? null,
      dodoSubscriptionId: user.dodoSubscriptionId ?? null,
      hasActivePro: userHasActivePro(user),
    };
  },
});

export const reserveDodoCheckoutNonce = internalMutation({
  args: { nonce: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const nonce = args.nonce.trim();
    if (!nonce || nonce.length > 80) {
      throw new Error("Invalid checkout nonce");
    }
    const user = await getAuthenticatedUser(ctx);
    await ctx.db.patch(user._id, {
      dodoCheckoutNonce: nonce,
      dodoCheckoutNonceExpiresAt: Date.now() + PRO_CHECKOUT_NONCE_TTL_MS,
    });
    return null;
  },
});

export const claimDodoWebhookEvent = internalMutation({
  args: {
    eventKey: v.string(),
    eventName: v.string(),
  },
  returns: v.object({ claimed: v.boolean() }),
  handler: async (ctx, args) => {
    const insertedId = await ctx.db.insert("dodoWebhookEvents", {
      eventKey: args.eventKey,
      eventName: args.eventName,
      receivedAt: Date.now(),
    });

    const allWithKey = await ctx.db
      .query("dodoWebhookEvents")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", args.eventKey))
      .collect();

    if (allWithKey.length === 1) {
      return { claimed: true };
    }

    allWithKey.sort((a, b) => a._creationTime - b._creationTime);
    const winner = allWithKey[0]!;
    for (const row of allWithKey) {
      if (row._id !== winner._id) {
        await ctx.db.delete(row._id);
      }
    }
    return { claimed: winner._id === insertedId };
  },
});

export const releaseDodoWebhookEvent = internalMutation({
  args: { eventKey: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("dodoWebhookEvents")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", args.eventKey))
      .collect();
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    return null;
  },
});

async function findDodoBillingUser(
  ctx: { db: MutationCtx["db"] },
  args: {
    dodoSubscriptionId?: string;
    dodoCustomerId?: string;
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

  if (args.dodoSubscriptionId) {
    const bySub = await ctx.db
      .query("users")
      .withIndex("by_dodoSubscriptionId", (q) =>
        q.eq("dodoSubscriptionId", args.dodoSubscriptionId),
      )
      .unique();
    if (bySub) return bySub;
  }

  if (args.dodoCustomerId) {
    const byCustomer = await ctx.db
      .query("users")
      .withIndex("by_dodoCustomerId", (q) =>
        q.eq("dodoCustomerId", args.dodoCustomerId),
      )
      .first();
    if (byCustomer) return byCustomer;
  }

  return null;
}

/**
 * Apply a signed Dodo subscription event to users.plan.
 * Webhooks are the source of truth — same as applyPlatformSubscription.
 */
export const applyDodoSubscription = internalMutation({
  args: {
    dodoSubscriptionId: v.string(),
    dodoCustomerId: v.optional(v.string()),
    status: v.string(),
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
    const config = getDodoPaymentsConfig();
    if (!config) {
      return { applied: false, reason: "dodo_billing_not_configured" };
    }

    const user = await findDodoBillingUser(ctx, args);
    const nextPlanPreview = planFromDodoStatus(args.status);
    if (user) {
      const eventAction = dodoPlatformEventAction({
        provider: billingProviderForUser(user),
        nextPlan: nextPlanPreview,
      });
      if (eventAction === "skip_promote") {
        return { applied: false, reason: "provider_lemon" };
      }
    }

    if (shouldIgnoreDodoTestEvent(args.testMode)) {
      if (user) {
        await writeAuditLog(ctx, {
          actorUserId: null,
          targetUserId: user._id,
          action: "plan_webhook:test_mode_ignored",
          reason: "Dodo test_mode event ignored (live plan unchanged)",
          metadata: {
            status: args.status,
            dodoSubscriptionId: args.dodoSubscriptionId,
            productId: args.productId ?? null,
            testMode: true,
          },
        });
      }
      return { applied: false, reason: "test_mode_ignored" };
    }

    const nextPlan = planFromDodoStatus(args.status);
    if (!nextPlan) {
      return { applied: false, reason: "status_ignored" };
    }

    if (!user) {
      return { applied: false, reason: "user_not_found" };
    }

    const catalogOk = matchesDodoProProduct({
      productId: args.productId ?? null,
      expectedProductId: config.proProductId,
    });
    const knownSub = user.dodoSubscriptionId === args.dodoSubscriptionId;
    const checkoutNonceOk = checkoutNonceMatches({
      provided: args.checkoutNonce,
      stored: user.dodoCheckoutNonce,
      expiresAt: user.dodoCheckoutNonceExpiresAt,
      nowMs: Date.now(),
    });

    if (nextPlan === "pro") {
      if (args.productId && args.productId !== config.proProductId) {
        return { applied: false, reason: "product_mismatch" };
      }
      if (!catalogOk && !knownSub && !checkoutNonceOk) {
        return { applied: false, reason: "product_mismatch" };
      }
    }
    if (nextPlan === "free" && !catalogOk && !knownSub) {
      return { applied: false, reason: "unverified_subscription" };
    }

    const priorPlan: Plan = resolvePlan(user);
    const appliedPlan = planAfterForeignDemotion({
      nextPlan,
      otherMorActive: isActiveSubscriptionStatus(user.lsSubscriptionStatus),
    });
    await ctx.db.patch(user._id, {
      plan: appliedPlan,
      billingProvider: nextPlan === "pro" ? "dodo" : user.billingProvider,
      dodoSubscriptionId: args.dodoSubscriptionId,
      dodoSubscriptionStatus: args.status,
      ...(args.dodoCustomerId ? { dodoCustomerId: args.dodoCustomerId } : {}),
      dodoCheckoutNonce: "",
      dodoCheckoutNonceExpiresAt: 0,
      ...(nextPlan === "pro"
        ? {
            lsSubscriptionId: "",
            lsSubscriptionStatus: "",
          }
        : {}),
    });

    if (priorPlan !== appliedPlan) {
      await writeAuditLog(ctx, {
        actorUserId: null,
        targetUserId: user._id,
        action: `plan_webhook:${appliedPlan}`,
        reason: "Dodo Payments platform subscription webhook",
        metadata: {
          priorPlan,
          status: args.status,
          dodoSubscriptionId: args.dodoSubscriptionId,
          productId: args.productId ?? null,
          testMode: args.testMode,
          knownSub,
          checkoutNonceOk,
        },
      });
    }

    return {
      applied: priorPlan !== appliedPlan || !knownSub,
      plan: appliedPlan,
      reason: "ok",
    };
  },
});

/**
 * Credit a paid Dodo +10 decline pack. Idempotent on paymentId.
 */
export const creditDodoPackPurchase = internalMutation({
  args: {
    paymentId: v.string(),
    quantity: v.number(),
    convexUserId: v.optional(v.string()),
    clerkUserId: v.optional(v.string()),
    dodoCustomerId: v.optional(v.string()),
    paidAt: v.number(),
    testMode: v.boolean(),
  },
  returns: v.object({
    credited: v.boolean(),
    alreadyCredited: v.boolean(),
    extraDeclines: v.number(),
    reason: v.string(),
  }),
  handler: async (ctx, args) => {
    const paymentId = args.paymentId.trim();
    if (!paymentId) {
      return {
        credited: false,
        alreadyCredited: false,
        extraDeclines: 0,
        reason: "missing_payment_id",
      };
    }

    const existing = await ctx.db
      .query("dodoPackPurchases")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", paymentId))
      .unique();
    if (existing) {
      return {
        credited: true,
        alreadyCredited: true,
        extraDeclines: existing.extraDeclines,
        reason: "already_credited",
      };
    }

    const user = await findDodoBillingUser(ctx, {
      convexUserId: args.convexUserId,
      clerkUserId: args.clerkUserId,
      dodoCustomerId: args.dodoCustomerId,
    });
    if (!user) {
      return {
        credited: false,
        alreadyCredited: false,
        extraDeclines: 0,
        reason: "user_not_found",
      };
    }

    const quantity = Math.max(1, Math.floor(args.quantity));
    const extraDeclines = packExtraDeclines(quantity);
    if (extraDeclines <= 0) {
      return {
        credited: false,
        alreadyCredited: false,
        extraDeclines: 0,
        reason: "invalid_quantity",
      };
    }

    await ctx.db.insert("dodoPackPurchases", {
      userId: user._id,
      paymentId,
      quantity,
      extraDeclines,
      creditedAt: args.paidAt,
    });
    await ctx.db.patch(user._id, {
      declinePackExtra: nextDeclinePackExtra(user.declinePackExtra, quantity),
    });
    await writeAuditLog(ctx, {
      actorUserId: null,
      targetUserId: user._id,
      action: "pack_credit:dodo",
      reason: args.testMode
        ? "Dodo pack payment (test_mode)"
        : "Dodo pack payment",
      metadata: {
        paymentId,
        quantity,
        extraDeclines,
        testMode: args.testMode,
      },
    });

    return {
      credited: true,
      alreadyCredited: false,
      extraDeclines,
      reason: "ok",
    };
  },
});
