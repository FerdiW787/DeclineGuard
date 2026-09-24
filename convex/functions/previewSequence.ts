import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { writeAuditLog } from "../lib/admin";
import {
  accountStatusOf,
  isSoftDeleted,
  requireActiveUser,
  requireActiveUserForWrite,
} from "../lib/accountGuard";
import { consumeRateLimit } from "../lib/rateLimit";

/** Gap between preview emails (mirrors fast recovery drip, but 30s). */
export const PREVIEW_GAP_MS = 30_000;

/** Per merchant: 2 preview sequence starts every 3 × 24h (Fendem 2026-09-24). */
export const PREVIEW_USER_START_LIMIT = 2;
export const PREVIEW_USER_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
export const PREVIEW_USER_RATE_LIMIT_ERROR =
  "Preview limit reached. You can start 2 preview sequences every 3 days.";

/** Platform safety: 40 preview sequence starts per hour globally. */
export const PREVIEW_GLOBAL_RATE_KEY = "preview_seq:global";
export const PREVIEW_GLOBAL_START_LIMIT = 40;
export const PREVIEW_GLOBAL_WINDOW_MS = 60 * 60 * 1000;

const previewStepValidator = v.union(
  v.literal("step1"),
  v.literal("step2"),
  v.literal("step3"),
);

const rowStatusValidator = v.union(
  v.literal("running"),
  v.literal("completed"),
  v.literal("cancelled"),
  v.literal("failed"),
);

const activePreviewValidator = v.object({
  _id: v.id("previewSequences"),
  status: rowStatusValidator,
  toEmail: v.string(),
  step1SentAt: v.union(v.number(), v.null()),
  step2SentAt: v.union(v.number(), v.null()),
  step3SentAt: v.union(v.number(), v.null()),
  startedAt: v.number(),
  completedAt: v.union(v.number(), v.null()),
  lastError: v.union(v.string(), v.null()),
  /** 0–3 emails delivered so far */
  sentCount: v.number(),
});

const claimResultValidator = v.union(
  v.literal("send"),
  v.literal("skip"),
  v.literal("abort"),
);

function normalizeAccountEmail(raw: string | undefined | null): string {
  const email = raw?.trim().toLowerCase() ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(
      "Your account has no usable email. Update it in account settings, then try again.",
    );
  }
  return email;
}

async function cancelJobsForPreview(
  ctx: MutationCtx,
  preview: Doc<"previewSequences">,
): Promise<void> {
  const jobIds = [
    preview.step1JobId,
    preview.step2JobId,
    preview.step3JobId,
  ];
  for (const jobId of jobIds) {
    if (!jobId) continue;
    try {
      await ctx.scheduler.cancel(jobId);
    } catch {
      // Already ran or missing — fine.
    }
  }
  await ctx.db.patch(preview._id, {
    step1JobId: undefined,
    step2JobId: undefined,
    step3JobId: undefined,
  });
}

/** Latest preview for the signed-in merchant (for progress UI). */
export const getLatest = query({
  args: {},
  returns: v.union(activePreviewValidator, v.null()),
  handler: async (ctx) => {
    const user = await requireActiveUser(ctx);
    const row = await ctx.db
      .query("previewSequences")
      .withIndex("by_user_started", (q) => q.eq("userId", user._id))
      .order("desc")
      .first();
    if (!row) return null;

    const sentCount =
      (row.step1SentAt != null ? 1 : 0) +
      (row.step2SentAt != null ? 1 : 0) +
      (row.step3SentAt != null ? 1 : 0);

    return {
      _id: row._id,
      status: row.status,
      toEmail: row.toEmail,
      step1SentAt: row.step1SentAt ?? null,
      step2SentAt: row.step2SentAt ?? null,
      step3SentAt: row.step3SentAt ?? null,
      startedAt: row.startedAt,
      completedAt: row.completedAt ?? null,
      lastError: row.lastError ?? null,
      sentCount,
    };
  },
});

/**
 * Start Email 1 now, then Email 2 and 3 at +30s each, to the account email.
 * Cancels any still-running preview for this merchant first.
 */
export const start = mutation({
  args: {},
  returns: v.id("previewSequences"),
  handler: async (ctx) => {
    const user = await requireActiveUserForWrite(ctx, "preview_sequence_start");
    // Preview is blocked while the product account is frozen (incl. takeover).
    if (accountStatusOf(user) === "frozen") {
      throw new Error(
        "This account is frozen. Contact DeclineGuard support before sending a preview.",
      );
    }
    if (accountStatusOf(user) === "disabled") {
      throw new Error("This account is disabled. Contact DeclineGuard support.");
    }
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Preconditions before scheduling.
    if (identity.emailVerified !== true) {
      throw new Error("Verify your account email before sending a preview.");
    }
    const toEmail = normalizeAccountEmail(identity.email);

    const connection = await ctx.db
      .query("lemonConnections")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!connection || isSoftDeleted(connection)) {
      throw new Error("Connect a Lemon Squeezy store before sending a preview.");
    }

    await consumeRateLimit(
      ctx,
      `preview_seq:${user._id}`,
      PREVIEW_USER_START_LIMIT,
      PREVIEW_USER_WINDOW_MS,
      PREVIEW_USER_RATE_LIMIT_ERROR,
    );
    await consumeRateLimit(
      ctx,
      PREVIEW_GLOBAL_RATE_KEY,
      PREVIEW_GLOBAL_START_LIMIT,
      PREVIEW_GLOBAL_WINDOW_MS,
    );

    const running = await ctx.db
      .query("previewSequences")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "running"),
      )
      .take(5);

    for (const prev of running) {
      await cancelJobsForPreview(ctx, prev);
      await ctx.db.patch(prev._id, {
        status: "cancelled",
        completedAt: Date.now(),
        lastError: "Superseded by a new preview",
      });
    }

    const previewId = await ctx.db.insert("previewSequences", {
      userId: user._id,
      connectionId: connection._id,
      toEmail,
      status: "running",
      startedAt: Date.now(),
    });

    const step1JobId = await ctx.scheduler.runAfter(
      0,
      internal.functions.previewSequenceEmails.sendStep,
      { previewId, step: "step1" },
    );
    await ctx.db.patch(previewId, { step1JobId });

    return previewId;
  },
});

/** Stop a running preview (cancels pending Email 1–3 jobs). */
export const cancel = mutation({
  args: { previewId: v.id("previewSequences") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireActiveUserForWrite(ctx, "preview_sequence_cancel");
    const row = await ctx.db.get(args.previewId);
    if (!row || row.userId !== user._id) {
      throw new Error("Preview not found");
    }
    if (row.status !== "running") return null;

    await cancelJobsForPreview(ctx, row);
    await ctx.db.patch(row._id, {
      status: "cancelled",
      completedAt: Date.now(),
    });
    return null;
  },
});

export const getPayload = internalQuery({
  args: { previewId: v.id("previewSequences") },
  returns: v.union(
    v.object({
      previewId: v.id("previewSequences"),
      userId: v.id("users"),
      status: rowStatusValidator,
      toEmail: v.string(),
      storeName: v.string(),
      storeAvatarUrl: v.union(v.string(), v.null()),
      accountActive: v.boolean(),
      step1SentAt: v.union(v.number(), v.null()),
      step2SentAt: v.union(v.number(), v.null()),
      step3SentAt: v.union(v.number(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.previewId);
    if (!row) return null;
    const connection = await ctx.db.get(row.connectionId);
    if (!connection || isSoftDeleted(connection)) return null;
    const owner = await ctx.db.get(row.userId);
    if (!owner) return null;

    return {
      previewId: row._id,
      userId: row.userId,
      status: row.status,
      toEmail: row.toEmail,
      storeName: connection.storeName,
      storeAvatarUrl: connection.storeAvatarUrl ?? null,
      accountActive: accountStatusOf(owner) === "active",
      step1SentAt: row.step1SentAt ?? null,
      step2SentAt: row.step2SentAt ?? null,
      step3SentAt: row.step3SentAt ?? null,
    };
  },
});

/**
 * Reserve a step before calling Resend so action retries do not double-send.
 * Returns send | skip (already sent) | abort (cancelled / inactive).
 */
export const claimStep = internalMutation({
  args: {
    previewId: v.id("previewSequences"),
    step: previewStepValidator,
  },
  returns: claimResultValidator,
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.previewId);
    if (!row || row.status !== "running") return "abort";

    const owner = await ctx.db.get(row.userId);
    if (!owner || accountStatusOf(owner) !== "active") {
      await cancelJobsForPreview(ctx, row);
      await ctx.db.patch(args.previewId, {
        status: "cancelled",
        completedAt: Date.now(),
        lastError: "Account no longer active",
      });
      return "abort";
    }

    const now = Date.now();
    switch (args.step) {
      case "step1": {
        if (row.step1SentAt != null) return "skip";
        if (row.step1ClaimedAt != null) return "send";
        await ctx.db.patch(args.previewId, { step1ClaimedAt: now });
        return "send";
      }
      case "step2": {
        if (row.step2SentAt != null) return "skip";
        if (row.step2ClaimedAt != null) return "send";
        await ctx.db.patch(args.previewId, { step2ClaimedAt: now });
        return "send";
      }
      case "step3": {
        if (row.step3SentAt != null) return "skip";
        if (row.step3ClaimedAt != null) return "send";
        await ctx.db.patch(args.previewId, { step3ClaimedAt: now });
        return "send";
      }
      default: {
        const _exhaustive: never = args.step;
        throw new Error(`Unhandled preview step: ${String(_exhaustive)}`);
      }
    }
  },
});

export const recordStepSent = internalMutation({
  args: {
    previewId: v.id("previewSequences"),
    step: previewStepValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.previewId);
    if (!row || row.status !== "running") return null;

    const now = Date.now();
    switch (args.step) {
      case "step1": {
        if (row.step1SentAt != null) return null;
        const step2JobId = await ctx.scheduler.runAfter(
          PREVIEW_GAP_MS,
          internal.functions.previewSequenceEmails.sendStep,
          { previewId: args.previewId, step: "step2" },
        );
        await ctx.db.patch(args.previewId, {
          step1SentAt: now,
          step1JobId: undefined,
          step2JobId,
        });
        break;
      }
      case "step2": {
        if (row.step2SentAt != null) return null;
        const step3JobId = await ctx.scheduler.runAfter(
          PREVIEW_GAP_MS,
          internal.functions.previewSequenceEmails.sendStep,
          { previewId: args.previewId, step: "step3" },
        );
        await ctx.db.patch(args.previewId, {
          step2SentAt: now,
          step2JobId: undefined,
          step3JobId,
        });
        break;
      }
      case "step3": {
        if (row.step3SentAt != null) return null;
        await ctx.db.patch(args.previewId, {
          step3SentAt: now,
          step3JobId: undefined,
          status: "completed",
          completedAt: now,
        });
        break;
      }
      default: {
        const _exhaustive: never = args.step;
        throw new Error(`Unhandled preview step: ${String(_exhaustive)}`);
      }
    }
    return null;
  },
});

export const markFailed = internalMutation({
  args: {
    previewId: v.id("previewSequences"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.previewId);
    if (!row || row.status !== "running") return null;
    await cancelJobsForPreview(ctx, row);
    await ctx.db.patch(args.previewId, {
      status: "failed",
      completedAt: Date.now(),
      lastError: args.error.slice(0, 500),
    });
    return null;
  },
});

/**
 * Record a Resend quota/rate-limit error for preview sequences.
 * Writes an ops-visible audit log (lighter weight than recovery emails).
 * Does NOT auto-retry — sequence is marked failed, ops can query for blocked sends.
 */
export const recordPreviewQuotaError = internalMutation({
  args: {
    previewId: v.id("previewSequences"),
    step: previewStepValidator,
    status: v.number(),
    code: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.previewId);
    if (!row) return null;

    await writeAuditLog(ctx, {
      actorUserId: null,
      targetUserId: row.userId,
      action: "resend_quota_blocked",
      reason: "Preview sequence email blocked by Resend quota/rate limit",
      metadata: {
        previewId: args.previewId,
        step: args.step,
        status: args.status,
        code: args.code,
        message: args.message,
        toEmail: row.toEmail,
        isPreview: true,
      },
    });

    return null;
  },
});
