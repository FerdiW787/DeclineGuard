"use node";

import { v } from "convex/values";
import { action, type ActionCtx } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { createClerkClient } from "@clerk/backend";

function clerkClient() {
  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY is not configured on Convex");
  }
  return createClerkClient({ secretKey });
}

function requireReason(reason: string | undefined): string {
  const trimmed = reason?.trim() ?? "";
  if (trimmed.length < 8) {
    throw new Error(
      "A comment of at least 8 characters is required (why you’re doing this).",
    );
  }
  if (trimmed.length > 2000) {
    throw new Error("Comment is too long (max 2000 characters).");
  }
  return trimmed;
}

type Actor = {
  _id: Id<"users">;
  role: "user" | "staff" | "admin";
};

async function requireStaffActor(ctx: ActionCtx): Promise<Actor> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const me = await ctx.runQuery(api.functions.user.getCurrentUser, {});
  if (!me || (me.role !== "admin" && me.role !== "staff")) {
    throw new Error("Staff access required");
  }
  return { _id: me._id, role: me.role };
}

async function requireAdminActor(ctx: ActionCtx): Promise<Actor> {
  const me = await requireStaffActor(ctx);
  if (me.role !== "admin") {
    throw new Error("Admin access required — only Admins can ban or unban.");
  }
  return me;
}

async function assertActionAllowedOnTarget(
  ctx: ActionCtx,
  actor: Actor,
  targetUserId: Id<"users">,
): Promise<void> {
  if (actor.role === "admin") return;
  const target = await ctx.runQuery(api.functions.admin.getMerchant, {
    userId: targetUserId,
  });
  if (!target) throw new Error("Target user not found");
  if (target.role !== "user") {
    throw new Error(
      "Staff can only help merchants (User role). Ask an Admin to act on Staff or Admin accounts.",
    );
  }
}

/** Kick all active Clerk sessions for a merchant (YouTube-style lockout). */
export const revokeSessions = action({
  args: {
    userId: v.id("users"),
    reason: v.string(),
  },
  returns: v.object({ revoked: v.number() }),
  handler: async (ctx, args) => {
    const actor = await requireStaffActor(ctx);
    await assertActionAllowedOnTarget(ctx, actor, args.userId);
    const reason = requireReason(args.reason);

    const clerkUserId = await ctx.runQuery(api.functions.admin.getUserClerkId, {
      userId: args.userId,
    });
    if (!clerkUserId) throw new Error("Target user not found");

    const client = clerkClient();
    const sessions = await client.sessions.getSessionList({
      userId: clerkUserId,
      status: "active",
    });

    let revoked = 0;
    for (const session of sessions.data) {
      await client.sessions.revokeSession(session.id);
      revoked += 1;
    }

    await ctx.runMutation(internal.functions.admin.recordClerkAction, {
      adminUserId: actor._id,
      targetUserId: args.userId,
      action: "revoke_sessions",
      reason,
      metadata: JSON.stringify({ revoked }),
    });

    return { revoked };
  },
});

/** Ban sign-in until staff clears (maps to disabled + Clerk ban). Admin only. */
export const banUser = action({
  args: {
    userId: v.id("users"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdminActor(ctx);
    const reason = requireReason(args.reason);
    const clerkUserId = await ctx.runQuery(api.functions.admin.getUserClerkId, {
      userId: args.userId,
    });
    if (!clerkUserId) throw new Error("Target user not found");

    await ctx.runMutation(internal.functions.admin.setAccountStatusInternal, {
      userId: args.userId,
      status: "disabled",
      reason,
    });

    const client = clerkClient();
    await client.users.banUser(clerkUserId);

    const sessions = await client.sessions.getSessionList({
      userId: clerkUserId,
      status: "active",
    });
    for (const session of sessions.data) {
      await client.sessions.revokeSession(session.id);
    }

    await ctx.runMutation(internal.functions.admin.recordClerkAction, {
      adminUserId: admin._id,
      targetUserId: args.userId,
      action: "ban_user",
      reason,
    });
    return null;
  },
});

/** Lift Clerk ban and set account active. Admin only. */
export const unbanUser = action({
  args: {
    userId: v.id("users"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdminActor(ctx);
    const reason = requireReason(args.reason);
    const clerkUserId = await ctx.runQuery(api.functions.admin.getUserClerkId, {
      userId: args.userId,
    });
    if (!clerkUserId) throw new Error("Target user not found");

    const client = clerkClient();
    await client.users.unbanUser(clerkUserId);

    await ctx.runMutation(internal.functions.admin.setAccountStatusInternal, {
      userId: args.userId,
      status: "active",
      reason,
    });

    await ctx.runMutation(internal.functions.admin.recordClerkAction, {
      adminUserId: admin._id,
      targetUserId: args.userId,
      action: "unban_user",
      reason,
    });
    return null;
  },
});

/**
 * Admin undoes a reversible staff/admin action from the live log.
 * Unlocks Convex status and unbans in Clerk when the original action was a ban/freeze.
 */
export const revokeStaffAction = action({
  args: {
    auditId: v.id("auditLogs"),
    revokeNote: v.string(),
  },
  returns: v.object({
    undone: v.string(),
    clerkUnbanned: v.boolean(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ undone: string; clerkUnbanned: boolean }> => {
    const admin = await requireAdminActor(ctx);
    const note = requireReason(args.revokeNote);

    const entry = (await ctx.runQuery(api.functions.admin.getAuditEntry, {
      auditId: args.auditId,
    })) as {
      action: string;
      reversible: boolean;
      revokedAt: number | null;
      target: { userId: string } | null;
    } | null;

    if (!entry) throw new Error("Audit entry not found");
    if (!entry.reversible) {
      throw new Error(
        entry.revokedAt
          ? "This action was already revoked"
          : "This action cannot be automatically revoked (e.g. restore, reclaim, kick sessions).",
      );
    }

    const needsClerkUnban =
      entry.action === "ban_user" || entry.action === "account_status:disabled";

    let clerkUnbanned = false;
    if (needsClerkUnban && entry.target) {
      const client = clerkClient();
      await client.users.unbanUser(entry.target.userId);
      clerkUnbanned = true;
    }

    await ctx.runMutation(internal.functions.admin.applyAuditRevoke, {
      auditId: args.auditId,
      adminUserId: admin._id,
      revokeNote: note,
      unlockTarget: true,
    });

    return { undone: entry.action, clerkUnbanned };
  },
});
