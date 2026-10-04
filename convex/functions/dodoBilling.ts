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
  planAfterForeignDemotion,
  resolveBillingProvider,
  type BillingProviderId,
} from "../lib/billingProvider";
import { checkoutNonceMatches, PRO_CHECKOUT_NONCE_TTL_MS } from "../lib/billingPlan";
import {
  dodoPackCreditDecision,
  holdQueueNowMs,
  shouldUnholdOnPlanPromote,
} from "../lib/declineCapacity";
import { releaseHeldAndSchedule } from "../lib/declineHoldQueue";
import {
  getDodoPaymentsConfig,
  matchesDodoProProduct,
  pickUniqueDodoCustomerUser,
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
      .collect();
    const picked = pickUniqueDodoCustomerUser({
      users: byCustomer,
      dodoSubscriptionId: args.dodoSubscriptionId,
    });
    if (picked) return picked;
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
    onDemand: v.optional(v.boolean()),
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
        if (knownSub) {
          await ctx.db.patch(user._id, {
            dodoProductId: args.productId,
            dodoSubscriptionStatus: args.status,
            ...(typeof args.onDemand === "boolean"
              ? { dodoOnDemand: args.onDemand }
              : {}),
            ...(args.dodoCustomerId
              ? { dodoCustomerId: args.dodoCustomerId }
              : {}),
          });
        }
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
      ...(args.productId ? { dodoProductId: args.productId } : {}),
      ...(typeof args.onDemand === "boolean"
        ? { dodoOnDemand: args.onDemand }
        : {}),
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

    if (shouldUnholdOnPlanPromote({ priorPlan, nextPlan: appliedPlan })) {
      await releaseHeldAndSchedule(ctx, {
        userId: user._id,
        plan: appliedPlan,
        packExtra: user.declinePackExtra,
        nowMs: Date.now(),
        force: true,
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
    productId: v.optional(v.string()),
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
    releasedHeld: v.number(),
    reason: v.string(),
  }),
  handler: async (ctx, args) => {
    const paymentId = args.paymentId.trim();
    if (!paymentId) {
      return {
        credited: false,
        alreadyCredited: false,
        extraDeclines: 0,
        releasedHeld: 0,
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
        releasedHeld: 0,
        reason: "already_credited",
      };
    }

    const config = getDodoPaymentsConfig();
    const decision = dodoPackCreditDecision({
      testMode: args.testMode,
      productId: args.productId ?? null,
      expectedProductId: config?.packProductId ?? null,
      quantity: args.quantity,
    });
    if (!decision.credit) {
      if (decision.reason === "test_mode_ignored") {
        const ignoredUser = await findDodoBillingUser(ctx, {
          convexUserId: args.convexUserId,
          clerkUserId: args.clerkUserId,
          dodoCustomerId: args.dodoCustomerId,
        });
        if (ignoredUser) {
          await writeAuditLog(ctx, {
            actorUserId: null,
            targetUserId: ignoredUser._id,
            action: "pack_credit:test_mode_ignored",
            reason: "Dodo test_mode pack ignored (live capacity unchanged)",
            metadata: {
              paymentId,
              productId: args.productId ?? null,
              quantity: args.quantity,
              testMode: true,
            },
          });
        }
      }
      return {
        credited: false,
        alreadyCredited: false,
        extraDeclines: 0,
        releasedHeld: 0,
        reason: decision.reason,
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
        releasedHeld: 0,
        reason: "user_not_found",
      };
    }

    const quantity = decision.quantity;
    const extraDeclines = decision.extraDeclines;
    const nextExtra = nextDeclinePackExtra(user.declinePackExtra, quantity);

    const insertedId = await ctx.db.insert("dodoPackPurchases", {
      userId: user._id,
      paymentId,
      quantity,
      extraDeclines,
      creditedAt: args.paidAt,
    });
    const allWithPayment = await ctx.db
      .query("dodoPackPurchases")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", paymentId))
      .take(8);
    allWithPayment.sort((a, b) => a._creationTime - b._creationTime);
    const winner = allWithPayment[0]!;
    for (const row of allWithPayment) {
      if (row._id !== winner._id) {
        await ctx.db.delete(row._id);
      }
    }
    if (winner._id !== insertedId) {
      return {
        credited: true,
        alreadyCredited: true,
        extraDeclines: winner.extraDeclines,
        releasedHeld: 0,
        reason: "already_credited",
      };
    }

    await ctx.db.patch(user._id, {
      declinePackExtra: nextExtra,
    });

    const { released } = await releaseHeldAndSchedule(ctx, {
      userId: user._id,
      plan: resolvePlan(user),
      packExtra: nextExtra,
      nowMs: holdQueueNowMs(Date.now()),
      force: true,
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
        releasedHeld: released.length,
        productId: args.productId ?? null,
        testMode: args.testMode,
      },
    });

    return {
      credited: true,
      alreadyCredited: false,
      extraDeclines,
      releasedHeld: released.length,
      reason: "ok",
    };
  },
});
