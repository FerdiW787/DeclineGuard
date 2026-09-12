import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import {
  requireStaff,
  requireAdmin,
  writeAuditLog,
  normalizeRole,
  assertCanActOnTarget,
  canBanAccounts,
  requireActionReason,
  isReversibleAuditAction,
} from "../lib/admin";
import { accountStatusOf, isSoftDeleted } from "../lib/accountGuard";

const accountStatusValidator = v.union(
  v.literal("active"),
  v.literal("frozen"),
  v.literal("disabled"),
);

const appRoleValidator = v.union(
  v.literal("user"),
  v.literal("staff"),
  v.literal("admin"),
);

const merchantSummaryValidator = v.object({
  _id: v.id("users"),
  userId: v.string(),
  userName: v.string(),
  role: appRoleValidator,
  accountStatus: accountStatusValidator,
  frozenReason: v.union(v.string(), v.null()),
  frozenAt: v.union(v.number(), v.null()),
  connection: v.union(
    v.object({
      _id: v.id("lemonConnections"),
      storeId: v.string(),
      storeName: v.string(),
      storeSlug: v.string(),
      apiKeyLast4: v.string(),
      deletedAt: v.union(v.number(), v.null()),
      connectedAt: v.number(),
    }),
    v.null(),
  ),
  openFailureCount: v.number(),
  activityCount: v.number(),
  hasSoftDeletedData: v.boolean(),
});

async function summarizeMerchant(ctx: QueryCtx | MutationCtx, user: Doc<"users">) {
  const connection = await ctx.db
    .query("lemonConnections")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .unique();

  const failures = await ctx.db
    .query("failedPayments")
    .withIndex("by_user_failedAt", (q) => q.eq("userId", user._id))
    .order("desc")
    .take(200);

  const activity = await ctx.db
    .query("activityEvents")
    .withIndex("by_user_occurred", (q) => q.eq("userId", user._id))
    .order("desc")
    .take(200);

  const openFailureCount = failures.filter(
    (f) => f.status === "open" && f.deletedAt == null,
  ).length;
  const activityCount = activity.filter((a) => a.deletedAt == null).length;
  const hasSoftDeletedData =
    (connection != null && isSoftDeleted(connection)) ||
    failures.some((f) => f.deletedAt != null) ||
    activity.some((a) => a.deletedAt != null);

  return {
    _id: user._id,
    userId: user.userId,
    userName: user.userName,
    role: normalizeRole(user.role),
    accountStatus: accountStatusOf(user),
    frozenReason: user.frozenReason ?? null,
    frozenAt: user.frozenAt ?? null,
    connection: connection
      ? {
          _id: connection._id,
          storeId: connection.storeId,
          storeName: connection.storeName,
          storeSlug: connection.storeSlug,
          apiKeyLast4: connection.apiKeyLast4,
          deletedAt: connection.deletedAt ?? null,
          connectedAt: connection.connectedAt,
        }
      : null,
    openFailureCount,
    activityCount,
    hasSoftDeletedData,
  };
}

/** Staff: search merchants by name, Clerk id, store id, or store name. */
export const searchMerchants = query({
  args: { q: v.string() },
  returns: v.array(merchantSummaryValidator),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const needle = args.q.trim().toLowerCase();
    if (needle.length < 2) return [];

    // eslint-disable-next-line @convex-dev/no-query-collect -- admin search; bounded take below
    const users = await ctx.db.query("users").take(500);
    const matchedUsers: Doc<"users">[] = [];

    for (const user of users) {
      if (
        user.userId.toLowerCase().includes(needle) ||
        user.userName.toLowerCase().includes(needle)
      ) {
        matchedUsers.push(user);
        continue;
      }
      const connection = await ctx.db
        .query("lemonConnections")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .unique();
      if (!connection) continue;
      if (
        connection.storeId.toLowerCase().includes(needle) ||
        connection.storeName.toLowerCase().includes(needle) ||
        connection.storeSlug.toLowerCase().includes(needle)
      ) {
        matchedUsers.push(user);
      }
    }

    const out = [];
    for (const user of matchedUsers.slice(0, 40)) {
      out.push(await summarizeMerchant(ctx, user));
    }
    return out;
  },
});

export const getMerchant = query({
  args: { userId: v.id("users") },
  returns: v.union(merchantSummaryValidator, v.null()),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    return await summarizeMerchant(ctx, user);
  },
});

export const listAuditForTarget = query({
  args: {
    targetUserId: v.id("users"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("auditLogs"),
      action: v.string(),
      reason: v.union(v.string(), v.null()),
      metadata: v.union(v.string(), v.null()),
      createdAt: v.number(),
      actorUserId: v.union(v.id("users"), v.null()),
      revokedAt: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const rows = await ctx.db
      .query("auditLogs")
      .withIndex("by_target_createdAt", (q) =>
        q.eq("targetUserId", args.targetUserId),
      )
      .order("desc")
      .take(limit);
    return rows.map((row) => ({
      _id: row._id,
      action: row.action,
      reason: row.reason ?? null,
      metadata: row.metadata ?? null,
      createdAt: row.createdAt,
      actorUserId: row.actorUserId,
      revokedAt: row.revokedAt ?? null,
    }));
  },
});

const liveLogEntryValidator = v.object({
  _id: v.id("auditLogs"),
  action: v.string(),
  reason: v.union(v.string(), v.null()),
  metadata: v.union(v.string(), v.null()),
  createdAt: v.number(),
  revokedAt: v.union(v.number(), v.null()),
  revokeNote: v.union(v.string(), v.null()),
  reversible: v.boolean(),
  actor: v.union(
    v.object({
      _id: v.id("users"),
      userName: v.string(),
      role: appRoleValidator,
      userId: v.string(),
    }),
    v.null(),
  ),
  target: v.union(
    v.object({
      _id: v.id("users"),
      userName: v.string(),
      role: appRoleValidator,
      userId: v.string(),
      accountStatus: accountStatusValidator,
    }),
    v.null(),
  ),
  revokedBy: v.union(
    v.object({
      _id: v.id("users"),
      userName: v.string(),
    }),
    v.null(),
  ),
});

/** Admin live feed of Staff + Admin privileged actions. */
export const listLiveStaffActivity = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(liveLogEntryValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.min(Math.max(args.limit ?? 60, 1), 120);
    const rows = await ctx.db
      .query("auditLogs")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", 0))
      .order("desc")
      .take(limit * 2);

    const out = [];
    for (const row of rows) {
      if (row.action === "purge_expired_soft_deletes") continue;
      if (row.actorUserId == null) continue;

      const actorDoc = await ctx.db.get(row.actorUserId);
      if (!actorDoc) continue;
      const actorRole = normalizeRole(actorDoc.role);
      if (actorRole !== "staff" && actorRole !== "admin") continue;

      let target = null;
      if (row.targetUserId) {
        const t = await ctx.db.get(row.targetUserId);
        if (t) {
          target = {
            _id: t._id,
            userName: t.userName,
            role: normalizeRole(t.role),
            userId: t.userId,
            accountStatus: accountStatusOf(t),
          };
        }
      }

      let revokedBy = null;
      if (row.revokedByUserId) {
        const r = await ctx.db.get(row.revokedByUserId);
        if (r) revokedBy = { _id: r._id, userName: r.userName };
      }

      out.push({
        _id: row._id,
        action: row.action,
        reason: row.reason ?? null,
        metadata: row.metadata ?? null,
        createdAt: row.createdAt,
        revokedAt: row.revokedAt ?? null,
        revokeNote: row.revokeNote ?? null,
        reversible:
          row.revokedAt == null && isReversibleAuditAction(row.action),
        actor: {
          _id: actorDoc._id,
          userName: actorDoc.userName,
          role: actorRole,
          userId: actorDoc.userId,
        },
        target,
        revokedBy,
      });
      if (out.length >= limit) break;
    }
    return out;
  },
});

export const getAuditEntry = query({
  args: { auditId: v.id("auditLogs") },
  returns: v.union(liveLogEntryValidator, v.null()),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(args.auditId);
    if (!row) return null;

    const actorDoc = row.actorUserId
      ? await ctx.db.get(row.actorUserId)
      : null;
    let target = null;
    if (row.targetUserId) {
      const t = await ctx.db.get(row.targetUserId);
      if (t) {
        target = {
          _id: t._id,
          userName: t.userName,
          role: normalizeRole(t.role),
          userId: t.userId,
          accountStatus: accountStatusOf(t),
        };
      }
    }
    let revokedBy = null;
    if (row.revokedByUserId) {
      const r = await ctx.db.get(row.revokedByUserId);
      if (r) revokedBy = { _id: r._id, userName: r.userName };
    }

    return {
      _id: row._id,
      action: row.action,
      reason: row.reason ?? null,
      metadata: row.metadata ?? null,
      createdAt: row.createdAt,
      revokedAt: row.revokedAt ?? null,
      revokeNote: row.revokeNote ?? null,
      reversible: row.revokedAt == null && isReversibleAuditAction(row.action),
      actor: actorDoc
        ? {
            _id: actorDoc._id,
            userName: actorDoc.userName,
            role: normalizeRole(actorDoc.role),
            userId: actorDoc.userId,
          }
        : null,
      target,
      revokedBy,
    };
  },
});

/**
 * Mark an audit entry revoked and apply the DB-side undo (status → active).
 * Clerk unban for ban actions is done by adminActions.revokeStaffAction.
 */
export const applyAuditRevoke = internalMutation({
  args: {
    auditId: v.id("auditLogs"),
    adminUserId: v.id("users"),
    revokeNote: v.string(),
    /** When true, also set target accountStatus to active */
    unlockTarget: v.boolean(),
  },
  returns: v.object({
    action: v.string(),
    targetUserId: v.union(v.id("users"), v.null()),
  }),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.auditId);
    if (!row) throw new Error("Audit entry not found");
    if (row.revokedAt != null) throw new Error("This action was already revoked");
    if (!isReversibleAuditAction(row.action)) {
      throw new Error("This action cannot be automatically revoked");
    }

    const note = requireActionReason(args.revokeNote);

    if (args.unlockTarget && row.targetUserId) {
      await ctx.db.patch(row.targetUserId, {
        accountStatus: "active",
        frozenAt: undefined,
        frozenReason: undefined,
      });
    }

    await ctx.db.patch(args.auditId, {
      revokedAt: Date.now(),
      revokedByUserId: args.adminUserId,
      revokeNote: note,
    });

    await writeAuditLog(ctx, {
      actorUserId: args.adminUserId,
      targetUserId: row.targetUserId,
      action: "audit_revoked",
      reason: note,
      metadata: {
        originalAuditId: args.auditId,
        originalAction: row.action,
      },
    });

    return {
      action: row.action,
      targetUserId: row.targetUserId ?? null,
    };
  },
});

export const setAccountStatus = mutation({
  args: {
    userId: v.id("users"),
    status: accountStatusValidator,
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireStaff(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    assertCanActOnTarget(actor, user);

    if (args.status === "disabled" && !canBanAccounts(actor.role)) {
      throw new Error(
        "Only Admins can ban accounts. Staff may freeze merchants instead.",
      );
    }

    const reason = requireActionReason(args.reason);

    if (args.status === "active") {
      await ctx.db.patch(args.userId, {
        accountStatus: "active",
        frozenAt: undefined,
        frozenReason: undefined,
      });
    } else {
      await ctx.db.patch(args.userId, {
        accountStatus: args.status,
        frozenAt: Date.now(),
        frozenReason: reason,
      });
    }

    await writeAuditLog(ctx, {
      actorUserId: actor._id,
      targetUserId: args.userId,
      action: `account_status:${args.status}`,
      reason,
    });
    return null;
  },
});

/** Trusted path for ban/unban actions (audit written separately as ban_user / unban_user). */
export const setAccountStatusInternal = internalMutation({
  args: {
    userId: v.id("users"),
    status: accountStatusValidator,
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const reason = requireActionReason(args.reason);
    if (args.status === "active") {
      await ctx.db.patch(args.userId, {
        accountStatus: "active",
        frozenAt: undefined,
        frozenReason: undefined,
      });
    } else {
      await ctx.db.patch(args.userId, {
        accountStatus: args.status,
        frozenAt: Date.now(),
        frozenReason: reason,
      });
    }
    return null;
  },
});

/** Undo soft-delete: revive connection, history, settings, and rebind stores. */
export const restoreAccount = mutation({
  args: {
    userId: v.id("users"),
    reason: v.string(),
  },
  returns: v.object({
    restoredFailures: v.number(),
    restoredActivity: v.number(),
    restoredConnection: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const actor = await requireStaff(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    assertCanActOnTarget(actor, user);
    const reason = requireActionReason(args.reason);
    const connection = await ctx.db
      .query("lemonConnections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    let restoredConnection = false;
    if (connection && isSoftDeleted(connection)) {
      // Ensure stores are free before rebinding
      const stores = connection.stores ?? [
        {
          id: connection.storeId,
          name: connection.storeName,
          slug: connection.storeSlug,
        },
      ];
      for (const store of stores) {
        const others = await ctx.db
          .query("lemonStoreBindings")
          .withIndex("by_storeId", (q) => q.eq("storeId", store.id))
          .collect();
        for (const row of others) {
          if (row.userId === args.userId) {
            await ctx.db.delete(row._id);
            continue;
          }
          throw new Error(
            `Cannot restore: store ${store.id} is currently bound to another account. Reclaim it first.`,
          );
        }
      }

      await ctx.db.patch(connection._id, {
        deletedAt: undefined,
        deletedBy: undefined,
      });

      for (const store of stores) {
        await ctx.db.insert("lemonStoreBindings", {
          storeId: store.id,
          connectionId: connection._id,
          userId: args.userId,
        });
        await ctx.db.insert("storeBindingHistory", {
          storeId: store.id,
          userId: args.userId,
          connectionId: connection._id,
          action: "bound",
          actor: "admin",
          at: Date.now(),
          meta: "restore_account",
        });
      }
      restoredConnection = true;
    }

    // eslint-disable-next-line @convex-dev/no-query-collect -- admin restore
    const failures = await ctx.db
      .query("failedPayments")
      .withIndex("by_user_failedAt", (q) => q.eq("userId", args.userId))
      .collect();
    let restoredFailures = 0;
    for (const row of failures) {
      if (row.deletedAt == null) continue;
      await ctx.db.patch(row._id, {
        deletedAt: undefined,
        deletedBy: undefined,
      });
      restoredFailures += 1;
    }

    // eslint-disable-next-line @convex-dev/no-query-collect -- admin restore
    const activity = await ctx.db
      .query("activityEvents")
      .withIndex("by_user_occurred", (q) => q.eq("userId", args.userId))
      .collect();
    let restoredActivity = 0;
    for (const row of activity) {
      if (row.deletedAt == null) continue;
      await ctx.db.patch(row._id, {
        deletedAt: undefined,
        deletedBy: undefined,
      });
      restoredActivity += 1;
    }

    const settings = await ctx.db
      .query("recoverySettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (settings?.deletedAt != null) {
      await ctx.db.patch(settings._id, {
        deletedAt: undefined,
        deletedBy: undefined,
      });
    }

    await writeAuditLog(ctx, {
      actorUserId: actor._id,
      targetUserId: args.userId,
      action: "restore_account",
      reason,
      metadata: {
        restoredFailures,
        restoredActivity,
        restoredConnection,
      },
    });

    return { restoredFailures, restoredActivity, restoredConnection };
  },
});

/**
 * Move live webhook routing for a store to the rightful DeclineGuard user.
 * Soft-deletes any other account currently holding that store.
 */
export const reclaimStore = mutation({
  args: {
    storeId: v.string(),
    toUserId: v.id("users"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireStaff(ctx);
    const toUser = await ctx.db.get(args.toUserId);
    if (!toUser) throw new Error("Target user not found");
    assertCanActOnTarget(actor, toUser);
    const reason = requireActionReason(args.reason);

    const storeId = args.storeId.trim();
    if (!storeId) throw new Error("storeId is required");

    // Soft-delete any foreign live connection that owns this store
    const liveBindings = await ctx.db
      .query("lemonStoreBindings")
      .withIndex("by_storeId", (q) => q.eq("storeId", storeId))
      .collect();

    for (const binding of liveBindings) {
      if (binding.userId === args.toUserId) continue;
      const otherConn = await ctx.db.get(binding.connectionId);
      if (otherConn && !isSoftDeleted(otherConn)) {
        await softDeleteConnectionAsAdmin(ctx, otherConn);
      } else {
        await ctx.db.delete(binding._id);
      }
    }

    let connection = await ctx.db
      .query("lemonConnections")
      .withIndex("by_user", (q) => q.eq("userId", args.toUserId))
      .unique();

    if (!connection) {
      throw new Error(
        "Target user has no Lemon Squeezy connection to reclaim onto. Restore or reconnect first.",
      );
    }

    // Revive soft-deleted connection if needed
    if (isSoftDeleted(connection)) {
      await ctx.db.patch(connection._id, {
        deletedAt: undefined,
        deletedBy: undefined,
        storeId,
      });
      connection = (await ctx.db.get(connection._id))!;
    }

    // Ensure this store is on the connection's store list
    const stores = connection.stores ?? [
      {
        id: connection.storeId,
        name: connection.storeName,
        slug: connection.storeSlug,
      },
    ];
    if (!stores.some((s) => s.id === storeId)) {
      stores.push({
        id: storeId,
        name: connection.storeName,
        slug: connection.storeSlug,
      });
    }

    await ctx.db.patch(connection._id, {
      storeId,
      stores,
      deletedAt: undefined,
      deletedBy: undefined,
    });

    // Clear existing bindings for this connection then bind all stores
    const existingForConn = await ctx.db
      .query("lemonStoreBindings")
      .withIndex("by_connection", (q) => q.eq("connectionId", connection!._id))
      .collect();
    for (const row of existingForConn) {
      await ctx.db.delete(row._id);
    }

    for (const store of stores) {
      const others = await ctx.db
        .query("lemonStoreBindings")
        .withIndex("by_storeId", (q) => q.eq("storeId", store.id))
        .collect();
      for (const row of others) {
        await ctx.db.delete(row._id);
      }
      await ctx.db.insert("lemonStoreBindings", {
        storeId: store.id,
        connectionId: connection._id,
        userId: args.toUserId,
      });
    }

    await ctx.db.insert("storeBindingHistory", {
      storeId,
      userId: args.toUserId,
      connectionId: connection._id,
      action: "reclaimed",
      actor: "admin",
      at: Date.now(),
    });

    await writeAuditLog(ctx, {
      actorUserId: actor._id,
      targetUserId: args.toUserId,
      action: "reclaim_store",
      reason,
      metadata: { storeId },
    });
    return null;
  },
});

async function softDeleteConnectionAsAdmin(
  ctx: MutationCtx,
  connection: Doc<"lemonConnections">,
) {
  const now = Date.now();

  // eslint-disable-next-line @convex-dev/no-query-collect
  const failures = await ctx.db
    .query("failedPayments")
    .withIndex("by_user_failedAt", (q) => q.eq("userId", connection.userId))
    .collect();
  for (const failure of failures) {
    if (failure.deletedAt != null) continue;
    if (failure.day2JobId) {
      try {
        await ctx.scheduler.cancel(failure.day2JobId);
      } catch {
        /* ignore */
      }
    }
    if (failure.day5JobId) {
      try {
        await ctx.scheduler.cancel(failure.day5JobId);
      } catch {
        /* ignore */
      }
    }
    await ctx.db.patch(failure._id, {
      deletedAt: now,
      deletedBy: "admin",
      day2JobId: undefined,
      day5JobId: undefined,
    });
  }

  // eslint-disable-next-line @convex-dev/no-query-collect
  const activity = await ctx.db
    .query("activityEvents")
    .withIndex("by_user_occurred", (q) => q.eq("userId", connection.userId))
    .collect();
  for (const event of activity) {
    if (event.deletedAt != null) continue;
    await ctx.db.patch(event._id, { deletedAt: now, deletedBy: "admin" });
  }

  const settings = await ctx.db
    .query("recoverySettings")
    .withIndex("by_user", (q) => q.eq("userId", connection.userId))
    .unique();
  if (settings && settings.deletedAt == null) {
    await ctx.db.patch(settings._id, { deletedAt: now, deletedBy: "admin" });
  }

  const bindings = await ctx.db
    .query("lemonStoreBindings")
    .withIndex("by_connection", (q) => q.eq("connectionId", connection._id))
    .collect();
  for (const row of bindings) {
    await ctx.db.insert("storeBindingHistory", {
      storeId: row.storeId,
      userId: row.userId,
      connectionId: row.connectionId,
      action: "unbound",
      actor: "admin",
      at: now,
      meta: "reclaim_soft_delete",
    });
    await ctx.db.delete(row._id);
  }

  await ctx.db.patch(connection._id, {
    deletedAt: now,
    deletedBy: "admin",
  });
}

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

/** Hard-purge soft-deleted rows older than 90 days. */
export const purgeExpiredSoftDeletes = internalMutation({
  args: {},
  returns: v.object({
    connections: v.number(),
    failures: v.number(),
    activity: v.number(),
    settings: v.number(),
  }),
  handler: async (ctx) => {
    const cutoff = Date.now() - RETENTION_MS;
    let connections = 0;
    let failures = 0;
    let activity = 0;
    let settings = 0;

    // eslint-disable-next-line @convex-dev/no-query-collect -- cron purge batch
    const connRows = await ctx.db
      .query("lemonConnections")
      .withIndex("by_deletedAt", (q) => q.gte("deletedAt", 0))
      .take(200);
    for (const row of connRows) {
      if (row.deletedAt == null || row.deletedAt > cutoff) continue;
      await ctx.db.delete(row._id);
      connections += 1;
    }

    // eslint-disable-next-line @convex-dev/no-query-collect -- cron purge batch
    const failureRows = await ctx.db
      .query("failedPayments")
      .withIndex("by_deletedAt", (q) => q.gte("deletedAt", 0))
      .take(500);
    for (const row of failureRows) {
      if (row.deletedAt == null || row.deletedAt > cutoff) continue;
      await ctx.db.delete(row._id);
      failures += 1;
    }

    // eslint-disable-next-line @convex-dev/no-query-collect -- cron purge batch
    const activityRows = await ctx.db
      .query("activityEvents")
      .withIndex("by_deletedAt", (q) => q.gte("deletedAt", 0))
      .take(500);
    for (const row of activityRows) {
      if (row.deletedAt == null || row.deletedAt > cutoff) continue;
      await ctx.db.delete(row._id);
      activity += 1;
    }

    // Settings: no by_deletedAt index — scan recent via users is heavy; take by_user is per-user.
    // Soft-deleted settings ride with connection purge window via admin restore; skip bulk here
    // unless we find deleted settings on purged users. Keep a small opportunistic scan:
    // eslint-disable-next-line @convex-dev/no-query-collect
    const allSettings = await ctx.db.query("recoverySettings").take(200);
    for (const row of allSettings) {
      if (row.deletedAt == null || row.deletedAt > cutoff) continue;
      await ctx.db.delete(row._id);
      settings += 1;
    }

    await writeAuditLog(ctx, {
      actorUserId: null,
      action: "purge_expired_soft_deletes",
      metadata: { connections, failures, activity, settings },
    });

    return { connections, failures, activity, settings };
  },
});

/** Used by adminActions after Clerk revoke/ban. */
export const recordClerkAction = internalMutation({
  args: {
    adminUserId: v.id("users"),
    targetUserId: v.id("users"),
    action: v.string(),
    reason: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await writeAuditLog(ctx, {
      actorUserId: args.adminUserId,
      targetUserId: args.targetUserId,
      action: args.action,
      reason: args.reason,
      metadata: args.metadata ? JSON.parse(args.metadata) : undefined,
    });
    return null;
  },
});

export const getUserClerkId = query({
  args: { userId: v.id("users") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const user = await ctx.db.get(args.userId);
    return user?.userId ?? null;
  },
});
