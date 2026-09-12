import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { resolveProductUserOrNull } from "../lib/accountGuard";
import { recoveryActionValidator } from "../schema";

const DAY_MS = 24 * 60 * 60 * 1000;

export type RecoveryAction = "wait" | "nudge_update_pm" | "push_update_pm" | "stop";

/**
 * Compute the recovery policy action based on attempt index.
 * - Attempt 1: wait (LS is still retrying, don't stack on their fail email)
 * - Attempt 2: nudge_update_pm (gentle Email 1)
 * - Attempt 3+: push_update_pm (direct/urgent Emails 2-3)
 */
export function computeRecoveryAction(attemptIndex: number): RecoveryAction {
  if (attemptIndex <= 1) return "wait";
  if (attemptIndex === 2) return "nudge_update_pm";
  return "push_update_pm";
}

function isFastSequence(): boolean {
  return (
    process.env.RECOVERY_SEQUENCE_FAST === "1" ||
    process.env.RECOVERY_SEQUENCE_FAST === "true"
  );
}

async function requireUser(
  ctx: MutationCtx | QueryCtx,
): Promise<Doc<"users"> | null> {
  return await resolveProductUserOrNull(ctx);
}

/**
 * Resolve store branding for a failure.
 * Prefer the current store binding (survives reconnect / new connection rows),
 * then fall back to the failure’s stored connectionId.
 */
async function resolveConnectionForFailure(
  ctx: QueryCtx | MutationCtx,
  failure: Doc<"failedPayments">,
): Promise<Doc<"lemonConnections"> | null> {
  const bindings = await ctx.db
    .query("lemonStoreBindings")
    .withIndex("by_storeId", (q) => q.eq("storeId", failure.storeId))
    .collect();

  if (bindings.length > 0) {
    let binding = bindings[0]!;
    for (const row of bindings) {
      if (row._creationTime > binding._creationTime) binding = row;
    }
    const current = await ctx.db.get(binding.connectionId);
    if (current) return current;
  }

  return await ctx.db.get(failure.connectionId);
}

const emailDeliveryStatusValidator = v.union(
  v.literal("queued"),
  v.literal("delivered"),
  v.literal("bounced"),
  v.literal("complained"),
  v.literal("failed"),
);

const openFailureValidator = v.object({
  _id: v.id("failedPayments"),
  customerEmail: v.string(),
  customerName: v.union(v.string(), v.null()),
  productName: v.union(v.string(), v.null()),
  amountCents: v.number(),
  currency: v.string(),
  failedAt: v.number(),
  updatePaymentUrl: v.union(v.string(), v.null()),
  subscriptionId: v.string(),
  testMode: v.boolean(),
  sequenceLabel: v.string(),
  emailsSentCount: v.number(),
  nextEmailAt: v.union(v.number(), v.null()),
  declineReason: v.union(v.string(), v.null()),
  lastEmailDeliveryStatus: v.union(emailDeliveryStatusValidator, v.null()),
  day0SentAt: v.union(v.number(), v.null()),
  day2SentAt: v.union(v.number(), v.null()),
  day5SentAt: v.union(v.number(), v.null()),
});

const recoveredWinValidator = v.object({
  _id: v.id("failedPayments"),
  customerEmail: v.string(),
  customerName: v.union(v.string(), v.null()),
  productName: v.union(v.string(), v.null()),
  amountCents: v.number(),
  currency: v.string(),
  failedAt: v.number(),
  recoveredAt: v.number(),
  testMode: v.boolean(),
});

const emailSendStepValidator = v.union(
  v.literal("day0"),
  v.literal("day2"),
  v.literal("day5"),
);

const activityTypeValidator = v.union(
  v.literal("payment_failed"),
  v.literal("recovered"),
  v.literal("email_sent"),
  v.literal("email_bounced"),
  v.literal("email_delivered"),
);

const activityValidator = v.object({
  _id: v.id("activityEvents"),
  type: activityTypeValidator,
  title: v.string(),
  detail: v.union(v.string(), v.null()),
  customerEmail: v.union(v.string(), v.null()),
  amountCents: v.union(v.number(), v.null()),
  currency: v.union(v.string(), v.null()),
  occurredAt: v.number(),
});

function emailFromActivity(row: {
  customerEmail?: string;
  title: string;
}): string | null {
  if (row.customerEmail?.trim()) return row.customerEmail.trim().toLowerCase();
  const match = /^([^\s·/]+@[^\s·/]+)\s*[·/]/.exec(row.title);
  return match?.[1]?.toLowerCase() ?? null;
}

function mapActivityRow(row: Doc<"activityEvents">) {
  return {
    _id: row._id,
    type: row.type,
    title: row.title,
    detail: row.detail ?? null,
    customerEmail: emailFromActivity(row),
    amountCents: row.amountCents ?? null,
    currency: row.currency ?? null,
    occurredAt: row.occurredAt,
  };
}

export const hasProcessedEvent = internalQuery({
  args: { eventKey: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("lemonWebhookEvents")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", args.eventKey))
      .unique();
    return existing != null;
  },
});

export const recordWebhookEvent = internalMutation({
  args: {
    eventKey: v.string(),
    eventName: v.string(),
    storeId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("lemonWebhookEvents")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", args.eventKey))
      .unique();
    if (existing) return null;

    await ctx.db.insert("lemonWebhookEvents", {
      eventKey: args.eventKey,
      eventName: args.eventName,
      storeId: args.storeId,
      receivedAt: Date.now(),
    });
    return null;
  },
});

export const upsertFailedPayment = internalMutation({
  args: {
    userId: v.id("users"),
    connectionId: v.id("lemonConnections"),
    storeId: v.string(),
    subscriptionId: v.string(),
    subscriptionInvoiceId: v.string(),
    customerEmail: v.string(),
    customerName: v.optional(v.string()),
    productName: v.optional(v.string()),
    declineReason: v.optional(v.string()),
    amountCents: v.number(),
    currency: v.string(),
    updatePaymentUrl: v.optional(v.string()),
    failedAt: v.number(),
    eventName: v.string(),
    testMode: v.boolean(),
  },
  returns: v.object({
    failureId: v.id("failedPayments"),
    attemptIndex: v.number(),
    recoveryAction: recoveryActionValidator,
  }),
  handler: async (ctx, args) => {
    const open = await ctx.db
      .query("failedPayments")
      .withIndex("by_store_subscription_status", (q) =>
        q
          .eq("storeId", args.storeId)
          .eq("subscriptionId", args.subscriptionId)
          .eq("status", "open"),
      )
      .first();

    let failureId: Id<"failedPayments">;
    let attemptIndex: number;

    if (open) {
      // Increment attempt index for each new failure webhook on the same open failure
      attemptIndex = (open.attemptIndex ?? 1) + 1;
      const recoveryAction = computeRecoveryAction(attemptIndex);

      await ctx.db.patch(open._id, {
        userId: args.userId,
        connectionId: args.connectionId,
        subscriptionInvoiceId: args.subscriptionInvoiceId,
        customerEmail: args.customerEmail,
        customerName: args.customerName,
        productName: args.productName,
        declineReason: args.declineReason,
        amountCents: args.amountCents,
        currency: args.currency,
        updatePaymentUrl: args.updatePaymentUrl,
        failedAt: args.failedAt,
        lastEventName: args.eventName,
        testMode: args.testMode,
        attemptIndex,
        recoveryAction,
      });
      failureId = open._id;
    } else {
      // First failure for this subscription — attempt 1 → wait
      attemptIndex = 1;
      const recoveryAction = computeRecoveryAction(attemptIndex);

      failureId = await ctx.db.insert("failedPayments", {
        userId: args.userId,
        connectionId: args.connectionId,
        storeId: args.storeId,
        subscriptionId: args.subscriptionId,
        subscriptionInvoiceId: args.subscriptionInvoiceId,
        customerEmail: args.customerEmail,
        customerName: args.customerName,
        productName: args.productName,
        declineReason: args.declineReason,
        amountCents: args.amountCents,
        currency: args.currency,
        status: "open",
        updatePaymentUrl: args.updatePaymentUrl,
        failedAt: args.failedAt,
        lastEventName: args.eventName,
        testMode: args.testMode,
        attemptIndex,
        recoveryAction,
      });
    }

    const recoveryAction = computeRecoveryAction(attemptIndex);
    const amountLabel = formatMoney(args.amountCents, args.currency);
    await ctx.db.insert("activityEvents", {
      userId: args.userId,
      storeId: args.storeId,
      type: "payment_failed",
      title: `${args.customerEmail} / Recovery failed`,
      detail: args.productName
        ? `${args.productName} / ${amountLabel}`
        : amountLabel,
      customerEmail: args.customerEmail,
      amountCents: args.amountCents,
      currency: args.currency,
      relatedFailureId: failureId,
      occurredAt: args.failedAt,
    });

    return { failureId, attemptIndex, recoveryAction };
  },
});

export const getFailureEmailPayload = internalQuery({
  args: { failureId: v.id("failedPayments") },
  returns: v.union(
    v.object({
      userId: v.id("users"),
      connectionId: v.id("lemonConnections"),
      storeId: v.string(),
      storeName: v.string(),
      storeAvatarUrl: v.union(v.string(), v.null()),
      status: v.union(
        v.literal("open"),
        v.literal("recovered"),
        v.literal("cancelled"),
      ),
      recoveryAction: v.union(recoveryActionValidator, v.null()),
      customerEmail: v.string(),
      customerName: v.union(v.string(), v.null()),
      productName: v.union(v.string(), v.null()),
      amountCents: v.number(),
      currency: v.string(),
      updatePaymentUrl: v.union(v.string(), v.null()),
      subscriptionId: v.string(),
      subscriptionInvoiceId: v.string(),
      lastEmailInvoiceId: v.union(v.string(), v.null()),
      day0SentAt: v.union(v.number(), v.null()),
      day2SentAt: v.union(v.number(), v.null()),
      day5SentAt: v.union(v.number(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const failure = await ctx.db.get(args.failureId);
    if (!failure || failure.deletedAt != null) return null;

    const owner = await ctx.db.get(failure.userId);
    if (!owner) return null;
    const status = owner.accountStatus ?? "active";
    if (status === "frozen" || status === "disabled") {
      return null;
    }

    const connection = await resolveConnectionForFailure(ctx, failure);
    if (connection?.deletedAt != null) return null;
    const storeName = connection?.storeName ?? "Your store";
    const storeAvatarUrl = connection?.storeAvatarUrl ?? null;

    return {
      userId: failure.userId,
      connectionId: failure.connectionId,
      storeId: failure.storeId,
      storeName,
      storeAvatarUrl,
      status: failure.status,
      recoveryAction: failure.recoveryAction ?? null,
      customerEmail: failure.customerEmail,
      customerName: failure.customerName ?? null,
      productName: failure.productName ?? null,
      amountCents: failure.amountCents,
      currency: failure.currency,
      updatePaymentUrl: failure.updatePaymentUrl ?? null,
      subscriptionId: failure.subscriptionId,
      subscriptionInvoiceId: failure.subscriptionInvoiceId,
      lastEmailInvoiceId: failure.lastEmailInvoiceId ?? null,
      day0SentAt: failure.day0SentAt ?? null,
      day2SentAt: failure.day2SentAt ?? null,
      day5SentAt: failure.day5SentAt ?? null,
    };
  },
});

export const recordEmailSent = internalMutation({
  args: {
    failureId: v.id("failedPayments"),
    invoiceId: v.string(),
    subject: v.string(),
    step: v.union(v.literal("day0"), v.literal("day2"), v.literal("day5")),
    stepLabel: v.string(),
    resendMessageId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const failure = await ctx.db.get(args.failureId);
    if (!failure) return null;

    const now = Date.now();
    const patch: {
      lastEmailSentAt: number;
      lastEmailInvoiceId: string;
      emailsSentCount: number;
      day0SentAt?: number;
      day2SentAt?: number;
      day5SentAt?: number;
      lastResendMessageId?: string;
      lastEmailDeliveryStatus?:
        | "queued"
        | "delivered"
        | "bounced"
        | "complained"
        | "failed";
    } = {
      lastEmailSentAt: now,
      lastEmailInvoiceId: args.invoiceId,
      emailsSentCount: (failure.emailsSentCount ?? 0) + 1,
    };

    switch (args.step) {
      case "day0":
        patch.day0SentAt = now;
        break;
      case "day2":
        patch.day2SentAt = now;
        break;
      case "day5":
        patch.day5SentAt = now;
        break;
      default: {
        const _exhaustive: never = args.step;
        throw new Error(`Unhandled sequence step: ${String(_exhaustive)}`);
      }
    }

    if (args.resendMessageId) {
      patch.lastResendMessageId = args.resendMessageId;
      patch.lastEmailDeliveryStatus = "queued";
      await ctx.db.insert("emailSends", {
        userId: failure.userId,
        failureId: args.failureId,
        storeId: failure.storeId,
        step: args.step,
        resendMessageId: args.resendMessageId,
        status: "queued",
        customerEmail: failure.customerEmail,
        sentAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(args.failureId, patch);

    await ctx.db.insert("activityEvents", {
      userId: failure.userId,
      storeId: failure.storeId,
      type: "email_sent",
      title: `${failure.customerEmail} / ${args.stepLabel}`,
      detail: args.subject,
      customerEmail: failure.customerEmail,
      relatedFailureId: failure._id,
      occurredAt: now,
    });

    // Schedule follow-ups in the same mutation as the send record so a crash
    // between "mark sent" and "schedule" cannot leave the sequence stuck.
    const fast = isFastSequence();
    if (args.step === "day0") {
      const day2Ms = fast ? 60_000 : 2 * DAY_MS;
      const day2JobId = await ctx.scheduler.runAfter(
        day2Ms,
        internal.functions.recoveryEmails.sendSequenceStep,
        { failureId: args.failureId, step: "day2" },
      );
      if (fast) {
        await ctx.db.patch(args.failureId, { day2JobId });
        console.log(
          `Scheduled Email 2 for ${args.failureId} in ${day2Ms}ms (fast; Email 3 chains after it)`,
        );
      } else {
        const day5JobId = await ctx.scheduler.runAfter(
          5 * DAY_MS,
          internal.functions.recoveryEmails.sendSequenceStep,
          { failureId: args.failureId, step: "day5" },
        );
        await ctx.db.patch(args.failureId, { day2JobId, day5JobId });
        console.log(
          `Scheduled sequence for ${args.failureId}: day2 in ${day2Ms}ms, day5 in ${5 * DAY_MS}ms`,
        );
      }
    } else if (args.step === "day2" && fast) {
      const day5JobId = await ctx.scheduler.runAfter(
        60_000,
        internal.functions.recoveryEmails.sendSequenceStep,
        { failureId: args.failureId, step: "day5" },
      );
      await ctx.db.patch(args.failureId, { day5JobId });
      console.log(
        `Scheduled Email 3 for ${args.failureId} in 60000ms after Email 2 (fast)`,
      );
    }

    return null;
  },
});

/** Repair path: schedule any missing follow-ups for an open failure. */
export const ensureSequenceScheduled = internalMutation({
  args: { failureId: v.id("failedPayments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const failure = await ctx.db.get(args.failureId);
    if (!failure || failure.status !== "open") return null;

    const fast = isFastSequence();

    if (failure.day0SentAt != null && failure.day2SentAt == null && !failure.day2JobId) {
      const day2Ms = fast ? 60_000 : 2 * DAY_MS;
      const day2JobId = await ctx.scheduler.runAfter(
        day2Ms,
        internal.functions.recoveryEmails.sendSequenceStep,
        { failureId: args.failureId, step: "day2" },
      );
      await ctx.db.patch(args.failureId, { day2JobId });
      console.log(
        `Repaired: scheduled Email 2 for ${args.failureId} in ${day2Ms}ms`,
      );
      return null;
    }

    if (
      fast &&
      failure.day2SentAt != null &&
      failure.day5SentAt == null &&
      !failure.day5JobId
    ) {
      const day5JobId = await ctx.scheduler.runAfter(
        60_000,
        internal.functions.recoveryEmails.sendSequenceStep,
        { failureId: args.failureId, step: "day5" },
      );
      await ctx.db.patch(args.failureId, { day5JobId });
      console.log(
        `Repaired: scheduled Email 3 for ${args.failureId} in 60000ms`,
      );
    }

    return null;
  },
});

/**
 * Stop sequence when fresh LS fetch reveals cancelled/expired status.
 * Called from send path when we discover the subscription ended.
 */
export const stopSequenceOnLifecycleEnd = internalMutation({
  args: {
    failureId: v.id("failedPayments"),
    status: v.union(v.literal("cancelled"), v.literal("expired")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const failure = await ctx.db.get(args.failureId);
    if (!failure) return null;

    // Cancel any scheduled jobs
    if (failure.day2JobId) {
      try {
        await ctx.scheduler.cancel(failure.day2JobId);
      } catch {
        /* already finished or cancelled */
      }
    }
    if (failure.day5JobId) {
      try {
        await ctx.scheduler.cancel(failure.day5JobId);
      } catch {
        /* already finished or cancelled */
      }
    }

    // Mark as stopped
    await ctx.db.patch(args.failureId, {
      status: "cancelled",
      recoveryAction: "stop",
      day2JobId: undefined,
      day5JobId: undefined,
    });

    return null;
  },
});

/**
 * Schedule day5 after a push day2 send (called from sendPushForUnpaid).
 * Unpaid handling cancels day5JobId before sending, so we must re-schedule.
 */
export const scheduleDay5AfterPush = internalMutation({
  args: { failureId: v.id("failedPayments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const failure = await ctx.db.get(args.failureId);
    if (!failure || failure.status !== "open") return null;

    // Only schedule if day5 not already sent and no job pending
    if (failure.day5SentAt != null || failure.day5JobId != null) return null;

    // Schedule day5 for 3 days after day2 (or 60s in fast mode)
    const fast = isFastSequence();
    const delay = fast ? 60_000 : 3 * DAY_MS;
    const day5JobId = await ctx.scheduler.runAfter(
      delay,
      internal.functions.recoveryEmails.sendSequenceStep,
      { failureId: args.failureId, step: "day5" },
    );
    await ctx.db.patch(args.failureId, { day5JobId });
    console.log(
      `Scheduled Email 3 for ${args.failureId} in ${delay}ms after push day2`,
    );

    return null;
  },
});

export const cancelSequenceJobs = internalMutation({
  args: { failureId: v.id("failedPayments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const failure = await ctx.db.get(args.failureId);
    if (!failure) return null;

    if (failure.day2JobId) {
      try {
        await ctx.scheduler.cancel(failure.day2JobId);
      } catch {
        /* already finished or cancelled */
      }
    }
    if (failure.day5JobId) {
      try {
        await ctx.scheduler.cancel(failure.day5JobId);
      } catch {
        /* already finished or cancelled */
      }
    }

    await ctx.db.patch(args.failureId, {
      day2JobId: undefined,
      day5JobId: undefined,
      day2SentAt: undefined,
      day5SentAt: undefined,
    });
    return null;
  },
});

export const markPaymentRecovered = internalMutation({
  args: {
    userId: v.id("users"),
    storeId: v.string(),
    subscriptionId: v.string(),
    subscriptionInvoiceId: v.string(),
    customerEmail: v.string(),
    amountCents: v.number(),
    currency: v.string(),
    recoveredAt: v.number(),
    eventName: v.string(),
  },
  returns: v.union(v.id("failedPayments"), v.null()),
  handler: async (ctx, args) => {
    const open = await ctx.db
      .query("failedPayments")
      .withIndex("by_store_subscription_status", (q) =>
        q
          .eq("storeId", args.storeId)
          .eq("subscriptionId", args.subscriptionId)
          .eq("status", "open"),
      )
      .first();

    if (!open) {
      // No open DeclineGuard failure for this subscription — ignore for KPIs.
      // (Re-firing recovered, or LS recover without a prior fail we tracked,
      // used to insert activity with amount and double-count the 30-day chart.)
      return null;
    }

    if (open.day2JobId) {
      try {
        await ctx.scheduler.cancel(open.day2JobId);
      } catch {
        /* already finished or cancelled */
      }
    }
    if (open.day5JobId) {
      try {
        await ctx.scheduler.cancel(open.day5JobId);
      } catch {
        /* already finished or cancelled */
      }
    }

    await ctx.db.patch(open._id, {
      status: "recovered",
      recoveredAt: args.recoveredAt,
      subscriptionInvoiceId: args.subscriptionInvoiceId,
      lastEventName: args.eventName,
      recoveryAction: "stop",
      day2JobId: undefined,
      day5JobId: undefined,
    });

    await ctx.db.insert("activityEvents", {
      userId: args.userId,
      storeId: args.storeId,
      type: "recovered",
      title: `${args.customerEmail} / recovered`,
      detail: formatMoney(args.amountCents, args.currency),
      customerEmail: args.customerEmail,
      amountCents: args.amountCents,
      currency: args.currency,
      relatedFailureId: open._id,
      occurredAt: args.recoveredAt,
    });

    // Free-tier 10% fee ledger — skip test-mode recoveries; invoice manually.
    // Policy: no fee if recovered before Day 0 email was sent (LS recovered on its own).
    if (!open.testMode && open.day0SentAt != null) {
      const existingFee = await ctx.db
        .query("recoveryFees")
        .withIndex("by_failure", (q) => q.eq("failureId", open._id))
        .first();
      if (!existingFee) {
        const amountCents = args.amountCents;
        const feeCents = Math.round(amountCents * 0.1);
        if (feeCents > 0) {
          await ctx.db.insert("recoveryFees", {
            userId: args.userId,
            failureId: open._id,
            storeId: args.storeId,
            recoveredAt: args.recoveredAt,
            amountCents,
            feeCents,
            currency: args.currency,
            status: "owed",
            testMode: false,
          });
        }
      }
    }

    return open._id;
  },
});

/**
 * Handle subscription lifecycle change.
 * Called when subscription_updated shows status change to cancelled/expired/unpaid.
 * - cancelled/expired → stop sequence (no more emails)
 * - unpaid → send aggressive push email (direct/urgent, not gentle)
 */
export const handleSubscriptionLifecycleStop = internalMutation({
  args: {
    storeId: v.string(),
    subscriptionId: v.string(),
    newStatus: v.union(
      v.literal("cancelled"),
      v.literal("expired"),
      v.literal("unpaid"),
    ),
    eventName: v.string(),
    occurredAt: v.number(),
  },
  returns: v.union(v.id("failedPayments"), v.null()),
  handler: async (ctx, args) => {
    const open = await ctx.db
      .query("failedPayments")
      .withIndex("by_store_subscription_status", (q) =>
        q
          .eq("storeId", args.storeId)
          .eq("subscriptionId", args.subscriptionId)
          .eq("status", "open"),
      )
      .first();

    if (!open) return null;

    // For unpaid, send aggressive push email (if past attempt-1 wait)
    // For cancelled/expired, set status to "cancelled" and action to "stop"
    if (args.newStatus === "unpaid") {
      // Respect attempt-1 wait policy — don't jump the wait window
      const attemptIndex = open.attemptIndex ?? 1;
      if (attemptIndex <= 1) {
        // Still in wait window — do NOT change recoveryAction (stay in wait)
        // Keep scheduled follow-ups intact (don't cancel jobs)
        // Just record the event, let normal sequence continue at attempt 2+
        await ctx.db.patch(open._id, {
          lastEventName: args.eventName,
        });
      } else {
        // Past wait window — cancel pending jobs and send push immediately
        if (open.day2JobId) {
          try {
            await ctx.scheduler.cancel(open.day2JobId);
          } catch {
            /* already finished or cancelled */
          }
        }
        if (open.day5JobId) {
          try {
            await ctx.scheduler.cancel(open.day5JobId);
          } catch {
            /* already finished or cancelled */
          }
        }

        await ctx.db.patch(open._id, {
          recoveryAction: "push_update_pm",
          lastEventName: args.eventName,
          day2JobId: undefined,
          day5JobId: undefined,
        });

        // Send immediate push email (direct/urgent, NOT gentle)
        await ctx.scheduler.runAfter(
          0,
          internal.functions.recoveryEmails.sendPushForUnpaid,
          { failureId: open._id },
        );
      }
    } else {
      // Cancelled or expired → cancel scheduled jobs and stop sequence
      if (open.day2JobId) {
        try {
          await ctx.scheduler.cancel(open.day2JobId);
        } catch {
          /* already finished or cancelled */
        }
      }
      if (open.day5JobId) {
        try {
          await ctx.scheduler.cancel(open.day5JobId);
        } catch {
          /* already finished or cancelled */
        }
      }
      // Cancelled or expired → stop sequence entirely
      await ctx.db.patch(open._id, {
        status: "cancelled",
        recoveryAction: "stop",
        lastEventName: args.eventName,
        day2JobId: undefined,
        day5JobId: undefined,
      });

      await ctx.db.insert("activityEvents", {
        userId: open.userId,
        storeId: args.storeId,
        type: "payment_failed",
        title: `${open.customerEmail} / subscription ${args.newStatus}`,
        detail: "Recovery sequence stopped — subscription ended",
        customerEmail: open.customerEmail,
        relatedFailureId: open._id,
        occurredAt: args.occurredAt,
      });
    }

    return open._id;
  },
});

/** Update Resend delivery status from webhook (by message id). */
export const updateEmailDeliveryStatus = internalMutation({
  args: {
    resendMessageId: v.string(),
    status: emailDeliveryStatusValidator,
    occurredAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const send = await ctx.db
      .query("emailSends")
      .withIndex("by_resendMessageId", (q) =>
        q.eq("resendMessageId", args.resendMessageId),
      )
      .first();
    if (!send) return null;

    await ctx.db.patch(send._id, {
      status: args.status,
      updatedAt: args.occurredAt,
    });

    const failure = await ctx.db.get(send.failureId);
    if (failure && failure.lastResendMessageId === args.resendMessageId) {
      await ctx.db.patch(failure._id, {
        lastEmailDeliveryStatus: args.status,
      });
    }

    if (args.status === "bounced" || args.status === "complained") {
      await ctx.db.insert("activityEvents", {
        userId: send.userId,
        storeId: send.storeId,
        type: "email_bounced",
        title: `${send.customerEmail} / email bounced`,
        detail:
          args.status === "complained"
            ? "Marked as spam"
            : "Delivery failed — customer may not have seen the update link",
        customerEmail: send.customerEmail,
        relatedFailureId: send.failureId,
        occurredAt: args.occurredAt,
      });
    } else if (args.status === "delivered") {
      await ctx.db.insert("activityEvents", {
        userId: send.userId,
        storeId: send.storeId,
        type: "email_delivered",
        title: `${send.customerEmail} / email delivered`,
        detail: "Recovery email reached the inbox",
        customerEmail: send.customerEmail,
        relatedFailureId: send.failureId,
        occurredAt: args.occurredAt,
      });
    }

    return null;
  },
});

const SUMMARY_SCAN_LIMIT = 400;

/** Pick the currency with the largest cent total; flag if more than one. */
function primaryCurrencyTotals(
  rows: ReadonlyArray<{ amountCents: number; currency: string }>,
): {
  cents: number;
  currency: string | null;
  mixed: boolean;
} {
  const byCurrency = new Map<string, number>();
  for (const row of rows) {
    const code = row.currency.trim().toUpperCase() || "USD";
    byCurrency.set(code, (byCurrency.get(code) ?? 0) + row.amountCents);
  }

  let currency: string | null = null;
  let cents = 0;
  for (const [code, total] of byCurrency) {
    if (total > cents) {
      currency = code;
      cents = total;
    }
  }

  return {
    cents,
    currency,
    mixed: byCurrency.size > 1,
  };
}

/** High-level KPIs for the dashboard header / sidebar */
export const getRecoverySummary = query({
  args: {
    /** Start of the current local month (ms), from the client */
    monthStartMs: v.number(),
    /** Start of the previous local month (ms), from the client */
    priorMonthStartMs: v.number(),
  },
  returns: v.object({
    openCount: v.number(),
    openAtRiskCents: v.number(),
    openCurrency: v.union(v.string(), v.null()),
    openCurrencyMixed: v.boolean(),
    recoveredThisMonthCents: v.number(),
    recoveredThisMonthCount: v.number(),
    recoveredPriorMonthCents: v.number(),
    recoveredPriorMonthCount: v.number(),
    recoveredCurrency: v.union(v.string(), v.null()),
    recoveredCurrencyMixed: v.boolean(),
    /** Failures that started this month and are still open */
    cohortOpenCount: v.number(),
    /** Failures that started this month and recovered */
    cohortRecoveredCount: v.number(),
    /**
     * Cohort rate: recovered / (recovered + still open) among declines
     * that failed this calendar month. Null when the cohort is empty.
     */
    recoveryRatePercent: v.union(v.number(), v.null()),
    emailsSentThisMonth: v.number(),
    /** Best currency for chart money series (recovered primary, else open). */
    displayCurrency: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const empty = {
      openCount: 0,
      openAtRiskCents: 0,
      openCurrency: null,
      openCurrencyMixed: false,
      recoveredThisMonthCents: 0,
      recoveredThisMonthCount: 0,
      recoveredPriorMonthCents: 0,
      recoveredPriorMonthCount: 0,
      recoveredCurrency: null,
      recoveredCurrencyMixed: false,
      cohortOpenCount: 0,
      cohortRecoveredCount: 0,
      recoveryRatePercent: null as number | null,
      emailsSentThisMonth: 0,
      displayCurrency: null as string | null,
    };

    const user = await requireUser(ctx);
    if (!user) return empty;

    const openRows = (
      await ctx.db
        .query("failedPayments")
        .withIndex("by_user_status_failedAt", (q) =>
          q.eq("userId", user._id).eq("status", "open"),
        )
        .order("desc")
        .take(SUMMARY_SCAN_LIMIT)
    ).filter((row) => row.deletedAt == null);

    const openMoney = primaryCurrencyTotals(openRows);
    let cohortOpenCount = 0;
    for (const row of openRows) {
      if (row.failedAt >= args.monthStartMs) cohortOpenCount += 1;
    }

    const recoveredThisMonthRows = (
      await ctx.db
        .query("failedPayments")
        .withIndex("by_user_status_recoveredAt", (q) =>
          q
            .eq("userId", user._id)
            .eq("status", "recovered")
            .gte("recoveredAt", args.monthStartMs),
        )
        .take(SUMMARY_SCAN_LIMIT)
    ).filter((row) => row.deletedAt == null);

    const recoveredPriorMonthRows = (
      await ctx.db
        .query("failedPayments")
        .withIndex("by_user_status_recoveredAt", (q) =>
          q
            .eq("userId", user._id)
            .eq("status", "recovered")
            .gte("recoveredAt", args.priorMonthStartMs),
        )
        .take(SUMMARY_SCAN_LIMIT)
    ).filter(
      (row) =>
        row.deletedAt == null &&
        row.recoveredAt != null &&
        row.recoveredAt < args.monthStartMs,
    );

    const recoveredMoney = primaryCurrencyTotals(recoveredThisMonthRows);
    const recoveredPriorMoney = primaryCurrencyTotals(recoveredPriorMonthRows);

    // Cohort: declines that *failed* this month (open or recovered).
    // Ordered by failedAt desc so we can stop once we leave the month.
    const recoveredByFailedAt = (
      await ctx.db
        .query("failedPayments")
        .withIndex("by_user_status_failedAt", (q) =>
          q.eq("userId", user._id).eq("status", "recovered"),
        )
        .order("desc")
        .take(SUMMARY_SCAN_LIMIT)
    ).filter((row) => row.deletedAt == null);

    let cohortRecoveredCount = 0;
    for (const row of recoveredByFailedAt) {
      if (row.failedAt < args.monthStartMs) break;
      cohortRecoveredCount += 1;
    }

    const cohortTotal = cohortRecoveredCount + cohortOpenCount;
    const recoveryRatePercent =
      cohortTotal === 0
        ? null
        : Math.round((cohortRecoveredCount / cohortTotal) * 100);

    const emailRows = (
      await ctx.db
        .query("activityEvents")
        .withIndex("by_user_type_occurred", (q) =>
          q.eq("userId", user._id).eq("type", "email_sent"),
        )
        .order("desc")
        .take(SUMMARY_SCAN_LIMIT)
    ).filter((row) => row.deletedAt == null);

    let emailsSentThisMonth = 0;
    for (const row of emailRows) {
      if (row.occurredAt < args.monthStartMs) break;
      emailsSentThisMonth += 1;
    }

    const displayCurrency =
      recoveredMoney.currency ?? openMoney.currency ?? null;

    return {
      openCount: openRows.length,
      openAtRiskCents: openMoney.cents,
      openCurrency: openMoney.currency,
      openCurrencyMixed: openMoney.mixed,
      recoveredThisMonthCents: recoveredMoney.cents,
      recoveredThisMonthCount: recoveredThisMonthRows.length,
      recoveredPriorMonthCents: recoveredPriorMoney.cents,
      recoveredPriorMonthCount: recoveredPriorMonthRows.length,
      recoveredCurrency: recoveredMoney.currency,
      recoveredCurrencyMixed: recoveredMoney.mixed,
      cohortOpenCount,
      cohortRecoveredCount,
      recoveryRatePercent,
      emailsSentThisMonth,
      displayCurrency,
    };
  },
});

/** Open failures for the signed-in merchant (newest first) */
function mapOpenFailure(row: Doc<"failedPayments">) {
  return {
    _id: row._id,
    customerEmail: row.customerEmail,
    customerName: row.customerName ?? null,
    productName: row.productName ?? null,
    amountCents: row.amountCents,
    currency: row.currency,
    failedAt: row.failedAt,
    updatePaymentUrl: row.updatePaymentUrl ?? null,
    subscriptionId: row.subscriptionId,
    testMode: row.testMode,
    sequenceLabel: sequenceLabelForFailure(row),
    emailsSentCount: row.emailsSentCount ?? 0,
    nextEmailAt: nextEmailAtForFailure(row),
    declineReason: row.declineReason ?? null,
    lastEmailDeliveryStatus: row.lastEmailDeliveryStatus ?? null,
    day0SentAt: row.day0SentAt ?? null,
    day2SentAt: row.day2SentAt ?? null,
    day5SentAt: row.day5SentAt ?? null,
  };
}

export const listOpenFailures = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(openFailureValidator),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) return [];

    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const rows = await ctx.db
      .query("failedPayments")
      .withIndex("by_user_status_failedAt", (q) =>
        q.eq("userId", user._id).eq("status", "open"),
      )
      .order("desc")
      .take(limit);

    return rows.filter((row) => row.deletedAt == null).map(mapOpenFailure);
  },
});

/** Recent recovered wins for the Recoveries workspace. */
export const listRecentRecovered = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(recoveredWinValidator),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) return [];

    const limit = Math.min(Math.max(args.limit ?? 12, 1), 50);
    const rows = await ctx.db
      .query("failedPayments")
      .withIndex("by_user_status_recoveredAt", (q) =>
        q.eq("userId", user._id).eq("status", "recovered"),
      )
      .order("desc")
      .take(limit);

    return rows
      .filter((row) => row.deletedAt == null && row.recoveredAt != null)
      .map((row) => ({
        _id: row._id,
        customerEmail: row.customerEmail,
        customerName: row.customerName ?? null,
        productName: row.productName ?? null,
        amountCents: row.amountCents,
        currency: row.currency,
        failedAt: row.failedAt,
        recoveredAt: row.recoveredAt!,
        testMode: row.testMode,
      }));
  },
});

/**
 * Case drawer for one open (or recovered) failure: sequence sends + related activity.
 */
export const getFailureCase = query({
  args: { failureId: v.id("failedPayments") },
  returns: v.union(
    v.object({
      failure: openFailureValidator,
      status: v.union(
        v.literal("open"),
        v.literal("recovered"),
        v.literal("cancelled"),
      ),
      recoveredAt: v.union(v.number(), v.null()),
      emails: v.array(
        v.object({
          _id: v.id("emailSends"),
          step: emailSendStepValidator,
          status: emailDeliveryStatusValidator,
          sentAt: v.number(),
        }),
      ),
      activity: v.array(activityValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) return null;

    const failure = await ctx.db.get(args.failureId);
    if (
      !failure ||
      failure.userId !== user._id ||
      failure.deletedAt != null
    ) {
      return null;
    }

    const emailRows = await ctx.db
      .query("emailSends")
      .withIndex("by_failure", (q) => q.eq("failureId", failure._id))
      .collect();
    emailRows.sort((a, b) => a.sentAt - b.sentAt);

    const customerEmail = failure.customerEmail.trim().toLowerCase();
    const activityScan = await ctx.db
      .query("activityEvents")
      .withIndex("by_user_occurred", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(200);

    const activity = activityScan
      .filter((row) => {
        if (row.deletedAt != null) return false;
        if (row.relatedFailureId === failure._id) return true;
        const email = emailFromActivity(row);
        return email != null && email === customerEmail;
      })
      .slice(0, 40)
      .map(mapActivityRow);

    return {
      failure: mapOpenFailure(failure),
      status: failure.status,
      recoveredAt: failure.recoveredAt ?? null,
      emails: emailRows.map((row) => ({
        _id: row._id,
        step: row.step,
        status: row.status,
        sentAt: row.sentAt,
      })),
      activity,
    };
  },
});

function sequenceLabelForFailure(row: {
  day0SentAt?: number;
  day2SentAt?: number;
  day5SentAt?: number;
  day2JobId?: unknown;
  day5JobId?: unknown;
  recoveryAction?: string | null;
  attemptIndex?: number | null;
}): string {
  if (row.day5SentAt != null) return "Email 3 · Day 5 sent";
  if (row.day2SentAt != null) {
    return row.day5JobId ? "Email 2 · Day 5 pending" : "Email 2 · Day 2 sent";
  }
  if (row.day0SentAt != null) {
    return row.day2JobId ? "Email 1 · Day 2 pending" : "Email 1 · Day 0 sent";
  }
  // Honest label for wait/null action (attempt 1)
  if (row.recoveryAction === "wait" || row.recoveryAction == null) {
    const attempt = row.attemptIndex ?? 1;
    return `Waiting · Attempt ${attempt}`;
  }
  if (row.recoveryAction === "stop") {
    return "Stopped";
  }
  // nudge_update_pm or push_update_pm with no emails sent yet
  return "Queued · Email pending";
}

/** ETA for the next scheduled recovery email (prod timing: +2d / +5d from Day 0). */
function nextEmailAtForFailure(row: {
  day0SentAt?: number;
  day2SentAt?: number;
  day5SentAt?: number;
  day2JobId?: unknown;
  day5JobId?: unknown;
}): number | null {
  if (row.day5SentAt != null) return null;
  if (
    row.day2SentAt != null &&
    row.day5SentAt == null &&
    row.day5JobId != null
  ) {
    if (row.day0SentAt != null) return row.day0SentAt + 5 * DAY_MS;
    return row.day2SentAt + 3 * DAY_MS;
  }
  if (
    row.day0SentAt != null &&
    row.day2SentAt == null &&
    row.day2JobId != null
  ) {
    return row.day0SentAt + 2 * DAY_MS;
  }
  return null;
}

/** Recent activity for the signed-in merchant (newest first) */
export const listRecentActivity = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(activityValidator),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) return [];

    const limit = Math.min(Math.max(args.limit ?? 30, 1), 100);
    const rows = await ctx.db
      .query("activityEvents")
      .withIndex("by_user_occurred", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);

    return rows.filter((row) => row.deletedAt == null).map(mapActivityRow);
  },
});

/**
 * Activity since a timestamp for charts (30-day windows).
 * Scans newest-first and keeps events on/after sinceMs.
 */
export const listActivitySince = query({
  args: {
    sinceMs: v.number(),
    limit: v.optional(v.number()),
  },
  returns: v.array(activityValidator),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) return [];

    const limit = Math.min(Math.max(args.limit ?? 300, 1), 500);
    const rows = await ctx.db
      .query("activityEvents")
      .withIndex("by_user_occurred", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);

    const inRange: typeof rows = [];
    for (const row of rows) {
      if (row.deletedAt != null) continue;
      if (row.occurredAt < args.sinceMs) break;
      inRange.push(row);
    }

    return inRange.map(mapActivityRow);
  },
});

/**
 * Recovered failures for chart money (source of truth — not activityEvents).
 * Avoids double-counting when recovered webhooks were re-fired.
 */
export const listRecoveredSince = query({
  args: {
    sinceMs: v.number(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      recoveredAt: v.number(),
      amountCents: v.number(),
      currency: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) return [];

    const limit = Math.min(Math.max(args.limit ?? 300, 1), 500);
    const rows = await ctx.db
      .query("failedPayments")
      .withIndex("by_user_status_recoveredAt", (q) =>
        q
          .eq("userId", user._id)
          .eq("status", "recovered")
          .gte("recoveredAt", args.sinceMs),
      )
      .order("desc")
      .take(limit);

    return rows
      .filter((row) => row.deletedAt == null && row.recoveredAt != null)
      .map((row) => ({
        recoveredAt: row.recoveredAt!,
        amountCents: row.amountCents,
        currency: row.currency,
      }));
  },
});

const HISTORY_SCAN_LIMIT = 500;
const HISTORY_PAGE_SIZE = 10;

/**
 * Full event history with type / email filters and page-number pagination
 * (10 per page). Scans the newest 500 events for the merchant.
 */
export const listActivityHistory = query({
  args: {
    page: v.number(),
    type: v.optional(activityTypeValidator),
    customerEmail: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(activityValidator),
    pageIndex: v.number(),
    pageCount: v.number(),
    totalCount: v.number(),
    pageSize: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) {
      return {
        page: [],
        pageIndex: 0,
        pageCount: 1,
        totalCount: 0,
        pageSize: HISTORY_PAGE_SIZE,
      };
    }

    const emailFilter = args.customerEmail?.trim().toLowerCase() || null;

    const rows = args.type
      ? await ctx.db
          .query("activityEvents")
          .withIndex("by_user_type_occurred", (q) =>
            q.eq("userId", user._id).eq("type", args.type!),
          )
          .order("desc")
          .take(HISTORY_SCAN_LIMIT)
      : await ctx.db
          .query("activityEvents")
          .withIndex("by_user_occurred", (q) => q.eq("userId", user._id))
          .order("desc")
          .take(HISTORY_SCAN_LIMIT);

    const filtered = rows.filter((row) => {
      if (row.deletedAt != null) return false;
      if (!emailFilter) return true;
      return emailFromActivity(row) === emailFilter;
    });

    const totalCount = filtered.length;
    const pageCount = Math.max(1, Math.ceil(totalCount / HISTORY_PAGE_SIZE));
    const pageIndex = Math.min(
      Math.max(0, Math.floor(args.page)),
      pageCount - 1,
    );
    const start = pageIndex * HISTORY_PAGE_SIZE;
    const page = filtered
      .slice(start, start + HISTORY_PAGE_SIZE)
      .map(mapActivityRow);

    return {
      page,
      pageIndex,
      pageCount,
      totalCount,
      pageSize: HISTORY_PAGE_SIZE,
    };
  },
});

/** Distinct customer emails that appear in event history (for search dropdown) */
export const listActivityCustomerEmails = query({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) return [];

    const seen = new Set<string>();

    const activities = await ctx.db
      .query("activityEvents")
      .withIndex("by_user_occurred", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(HISTORY_SCAN_LIMIT);

    for (const row of activities) {
      if (row.deletedAt != null) continue;
      const email = emailFromActivity(row);
      if (email) seen.add(email);
    }

    const failures = await ctx.db
      .query("failedPayments")
      .withIndex("by_user_failedAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(200);

    for (const row of failures) {
      if (row.deletedAt != null) continue;
      const email = row.customerEmail.trim().toLowerCase();
      if (email) seen.add(email);
    }

    return [...seen].sort((a, b) => a.localeCompare(b));
  },
});

/** Free-tier fee ledger summary for Overview / Settings. */
export const getFeesSummary = query({
  args: { monthStartMs: v.number() },
  returns: v.object({
    owedThisMonthCents: v.number(),
    owedAllTimeCents: v.number(),
    owedCount: v.number(),
    currency: v.union(v.string(), v.null()),
    currencyMixed: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const empty = {
      owedThisMonthCents: 0,
      owedAllTimeCents: 0,
      owedCount: 0,
      currency: null as string | null,
      currencyMixed: false,
    };
    const user = await requireUser(ctx);
    if (!user) return empty;

    const rows = await ctx.db
      .query("recoveryFees")
      .withIndex("by_user_recoveredAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(SUMMARY_SCAN_LIMIT);

    const owed = rows.filter((r) => r.status === "owed" && !r.testMode);
    let owedThisMonthCents = 0;
    let owedAllTimeCents = 0;
    const byCurrency = new Map<string, number>();

    for (const row of owed) {
      owedAllTimeCents += row.feeCents;
      if (row.recoveredAt >= args.monthStartMs) {
        owedThisMonthCents += row.feeCents;
      }
      const code = row.currency.trim().toUpperCase() || "USD";
      byCurrency.set(code, (byCurrency.get(code) ?? 0) + row.feeCents);
    }

    let currency: string | null = null;
    let max = 0;
    for (const [code, total] of byCurrency) {
      if (total > max) {
        max = total;
        currency = code;
      }
    }

    return {
      owedThisMonthCents,
      owedAllTimeCents,
      owedCount: owed.length,
      currency,
      currencyMixed: byCurrency.size > 1,
    };
  },
});

const CSV_EXPORT_LIMIT = 2000;

/** Rows for Recoveries CSV export (open + recovered). */
export const exportRecoveriesCsvRows = query({
  args: {},
  returns: v.array(
    v.object({
      customerEmail: v.string(),
      customerName: v.union(v.string(), v.null()),
      productName: v.union(v.string(), v.null()),
      amountCents: v.number(),
      currency: v.string(),
      status: v.union(
        v.literal("open"),
        v.literal("recovered"),
        v.literal("cancelled"),
      ),
      failedAt: v.number(),
      recoveredAt: v.union(v.number(), v.null()),
      sequenceLabel: v.string(),
      lastEmailDeliveryStatus: v.union(emailDeliveryStatusValidator, v.null()),
      declineReason: v.union(v.string(), v.null()),
      feeCents: v.union(v.number(), v.null()),
      testMode: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) return [];

    const failures = await ctx.db
      .query("failedPayments")
      .withIndex("by_user_failedAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(CSV_EXPORT_LIMIT);

    const feeByFailure = new Map<Id<"failedPayments">, number>();
    const fees = await ctx.db
      .query("recoveryFees")
      .withIndex("by_user_recoveredAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(CSV_EXPORT_LIMIT);
    for (const fee of fees) {
      feeByFailure.set(fee.failureId, fee.feeCents);
    }

    return failures
      .filter((row) => row.deletedAt == null && row.status !== "cancelled")
      .map((row) => ({
        customerEmail: row.customerEmail,
        customerName: row.customerName ?? null,
        productName: row.productName ?? null,
        amountCents: row.amountCents,
        currency: row.currency,
        status: row.status,
        failedAt: row.failedAt,
        recoveredAt: row.recoveredAt ?? null,
        sequenceLabel: sequenceLabelForFailure(row),
        lastEmailDeliveryStatus: row.lastEmailDeliveryStatus ?? null,
        declineReason: row.declineReason ?? null,
        feeCents: feeByFailure.get(row._id) ?? null,
        testMode: row.testMode,
      }));
  },
});

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}
