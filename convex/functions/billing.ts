import {
  internalMutation,
  internalQuery,
  query,
  type QueryCtx,
} from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { PlatformBillingUserSource } from "../lib/lemonWebhookAuth";
import { applyPlatformSubscriptionAllowed } from "../lib/lemonWebhookAuth";
import {
  getAuthenticatedUser,
  resolvePlan,
  type Plan,
} from "../lib/accountGuard";
import { writeAuditLog } from "../lib/admin";
import {
  canPromoteWithoutCatalogIds,
  checkoutNonceMatches,
  checkoutNonceSourceMayPromote,
  getPlatformBillingConfig,
  matchesProCatalog,
  planFromLsStatus,
  PRO_CHECKOUT_NONCE_TTL_MS,
  shouldIgnoreLsTestEvent,
} from "../lib/billingPlan";
import {
  isActiveSubscriptionStatus,
  lsPlatformEventAction,
  planAfterForeignDemotion,
} from "../lib/billingProvider";
import { shouldUnholdOnPlanPromote } from "../lib/declineCapacity";
import { releaseHeldAndSchedule } from "../lib/declineHoldQueue";
import {
  billingProviderForUser,
  userHasActivePro,
} from "./dodoBilling";
import { billingProviderValidator, planValidator } from "../schema";

const billingStatusValidator = v.object({
  plan: planValidator,
  billingProvider: billingProviderValidator,
  lsSubscriptionId: v.union(v.string(), v.null()),
  lsSubscriptionStatus: v.union(v.string(), v.null()),
  dodoCustomerId: v.union(v.string(), v.null()),
  dodoSubscriptionId: v.union(v.string(), v.null()),
  dodoSubscriptionStatus: v.union(v.string(), v.null()),
  hasActivePro: v.boolean(),
  portalAvailable: v.boolean(),
});

/** Viewer (signed-in user), never the takeover merchant. Used for checkout. */
export const getViewerForCheckout = internalQuery({
  args: {},
  returns: v.object({
    _id: v.id("users"),
    clerkUserId: v.string(),
    plan: planValidator,
    billingProvider: billingProviderValidator,
    lsSubscriptionId: v.union(v.string(), v.null()),
    lsSubscriptionStatus: v.union(v.string(), v.null()),
    dodoCustomerId: v.union(v.string(), v.null()),
    dodoSubscriptionId: v.union(v.string(), v.null()),
    dodoSubscriptionStatus: v.union(v.string(), v.null()),
    accountStatus: v.union(
      v.literal("active"),
      v.literal("frozen"),
      v.literal("disabled"),
    ),
    hasActivePro: v.boolean(),
  }),
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    return {
      _id: user._id,
      clerkUserId: user.userId,
      plan: resolvePlan(user),
      billingProvider: billingProviderForUser(user),
      lsSubscriptionId: user.lsSubscriptionId ?? null,
      lsSubscriptionStatus: user.lsSubscriptionStatus ?? null,
      dodoCustomerId: user.dodoCustomerId ?? null,
      dodoSubscriptionId: user.dodoSubscriptionId ?? null,
      dodoSubscriptionStatus: user.dodoSubscriptionStatus ?? null,
      accountStatus: user.accountStatus ?? "active",
      hasActivePro: userHasActivePro(user),
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
    const billingProvider = billingProviderForUser(user);
    const hasActivePro = userHasActivePro(user);
    return {
      plan: resolvePlan(user),
      billingProvider,
      lsSubscriptionId: user.lsSubscriptionId ?? null,
      lsSubscriptionStatus: user.lsSubscriptionStatus ?? null,
      dodoCustomerId: user.dodoCustomerId ?? null,
      dodoSubscriptionId: user.dodoSubscriptionId ?? null,
      dodoSubscriptionStatus: user.dodoSubscriptionStatus ?? null,
      hasActivePro,
      portalAvailable:
        Boolean(user.dodoCustomerId) || Boolean(user.lsSubscriptionId),
    };
  },
});

async function findPlatformBillingUserBySource(
  ctx: { db: QueryCtx["db"] },
  args: {
    lsSubscriptionId: string;
    checkoutNonce?: string;
  },
): Promise<{ user: Doc<"users"> | null; source: PlatformBillingUserSource }> {
  const bySub = await ctx.db
    .query("users")
    .withIndex("by_lsSubscriptionId", (q) =>
      q.eq("lsSubscriptionId", args.lsSubscriptionId),
    )
    .unique();
  if (bySub) return { user: bySub, source: "lsSubscriptionId" };

  const nonce = args.checkoutNonce?.trim();
  if (nonce) {
    const byNonce = await ctx.db
      .query("users")
      .withIndex("by_lsCheckoutNonce", (q) => q.eq("lsCheckoutNonce", nonce))
      .unique();
    if (byNonce) return { user: byNonce, source: "checkoutNonce" };
  }

  return { user: null, source: "none" };
}

export const resolvePlatformBillingUserSource = internalQuery({
  args: {
    lsSubscriptionId: v.string(),
    checkoutNonce: v.optional(v.string()),
  },
  returns: v.union(
    v.literal("lsSubscriptionId"),
    v.literal("checkoutNonce"),
    v.literal("bodyUserId"),
    v.literal("none"),
  ),
  handler: async (ctx, args) => {
    const found = await findPlatformBillingUserBySource(ctx, args);
    return found.source;
  },
});

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
    checkoutNonce: v.optional(v.string()),
    testMode: v.boolean(),
    verifiedFromLemonApi: v.boolean(),
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

    if (!args.verifiedFromLemonApi) {
      return { applied: false, reason: "subscription_not_verified" };
    }

    const previewFound = await findPlatformBillingUserBySource(ctx, args);
    const previewUser = previewFound.user;
    const nextPlanPreview = planFromLsStatus(args.status);
    const allowed = applyPlatformSubscriptionAllowed({
      verifiedFromLemonApi: true,
      userResolvedBy: previewFound.source,
      nextPlan: nextPlanPreview,
    });
    if (!allowed.allow) {
      return { applied: false, reason: allowed.reason };
    }
    if (previewUser) {
      const eventAction = lsPlatformEventAction({
        provider: billingProviderForUser(previewUser),
        nextPlan: nextPlanPreview,
      });
      if (eventAction === "skip_promote") {
        return { applied: false, reason: "provider_dodo" };
      }
    }

    if (shouldIgnoreLsTestEvent(args.testMode)) {
      const user = previewUser;
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

    const user = previewUser;
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
      const nonceGate = checkoutNonceSourceMayPromote({
        userResolvedBy: previewFound.source,
        nextPlan,
        checkoutNonceOk,
        catalogOk,
      });
      if (!nonceGate.allow) {
        return { applied: false, reason: nonceGate.reason };
      }
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
    const appliedPlan = planAfterForeignDemotion({
      nextPlan,
      otherMorActive: isActiveSubscriptionStatus(user.dodoSubscriptionStatus),
    });
    await ctx.db.patch(user._id, {
      plan: appliedPlan,
      lsSubscriptionId: args.lsSubscriptionId,
      lsSubscriptionStatus: args.status,
      lsCheckoutNonce: "",
      lsCheckoutNonceExpiresAt: 0,
      ...(nextPlan === "pro"
        ? {
            dodoSubscriptionId: "",
            dodoSubscriptionStatus: "",
          }
        : {}),
    });

    if (priorPlan !== appliedPlan) {
      await writeAuditLog(ctx, {
        actorUserId: null,
        targetUserId: user._id,
        action: `plan_webhook:${appliedPlan}`,
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
