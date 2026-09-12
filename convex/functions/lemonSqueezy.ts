import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
  auditIfTakeoverWrite,
  requireActiveUserForWrite,
  isSoftDeleted,
  requireActiveUser,
  resolveProductUserOrNull,
} from "../lib/accountGuard";

/**
 * Re-bind action targets to the live product user (Model B).
 * Prevents TOCTOU: snapshotted clerkUserId after takeover end/expire.
 */
async function requireLiveProductForClerkUser(
  ctx: MutationCtx | QueryCtx,
  clerkUserId: string,
): Promise<Doc<"users">> {
  const product = await requireActiveUser(ctx);
  if (product.userId !== clerkUserId) {
    throw new Error(
      "Your access to this account ended or changed. Retry the operation.",
    );
  }
  return product;
}

type StoreOption = {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string;
};

async function recordBindingHistory(
  ctx: MutationCtx,
  args: {
    storeId: string;
    userId: Id<"users">;
    connectionId?: Id<"lemonConnections">;
    action: "bound" | "unbound" | "reclaimed";
    actor: "user" | "admin" | "system";
    meta?: string;
  },
) {
  await ctx.db.insert("storeBindingHistory", {
    storeId: args.storeId,
    userId: args.userId,
    connectionId: args.connectionId,
    action: args.action,
    actor: args.actor,
    at: Date.now(),
    meta: args.meta,
  });
}

async function syncStoreBindings(
  ctx: MutationCtx,
  connectionId: Id<"lemonConnections">,
  userId: Id<"users">,
  stores: StoreOption[],
  actor: "user" | "admin" | "system" = "user",
) {
  const existing = await ctx.db
    .query("lemonStoreBindings")
    .withIndex("by_connection", (q) => q.eq("connectionId", connectionId))
    .collect();

  for (const row of existing) {
    await recordBindingHistory(ctx, {
      storeId: row.storeId,
      userId: row.userId,
      connectionId: row.connectionId,
      action: "unbound",
      actor,
    });
    await ctx.db.delete(row._id);
  }

  // One LS store → one DeclineGuard account. Never silently steal another
  // merchant's binding — they must disconnect first (or orphan cleanup).
  for (const store of stores) {
    const others = await ctx.db
      .query("lemonStoreBindings")
      .withIndex("by_storeId", (q) => q.eq("storeId", store.id))
      .collect();

    for (const row of others) {
      if (row.connectionId === connectionId) continue;

      const otherConnection = await ctx.db.get(row.connectionId);
      if (!otherConnection || isSoftDeleted(otherConnection)) {
        await recordBindingHistory(ctx, {
          storeId: row.storeId,
          userId: row.userId,
          connectionId: row.connectionId,
          action: "unbound",
          actor: "system",
          meta: "orphan_cleanup",
        });
        await ctx.db.delete(row._id);
        continue;
      }

      throw new Error(
        `Store "${store.name}" is already connected to another DeclineGuard account. Disconnect it there before connecting here.`,
      );
    }

    await ctx.db.insert("lemonStoreBindings", {
      storeId: store.id,
      connectionId,
      userId,
    });
    await recordBindingHistory(ctx, {
      storeId: store.id,
      userId,
      connectionId,
      action: "bound",
      actor,
    });
  }
}

const storeOptionValidator = v.object({
  id: v.string(),
  name: v.string(),
  slug: v.string(),
  avatarUrl: v.optional(v.string()),
});

const publicConnectionValidator = v.object({
  _id: v.id("lemonConnections"),
  storeId: v.string(),
  storeName: v.string(),
  storeSlug: v.string(),
  storeAvatarUrl: v.union(v.string(), v.null()),
  stores: v.array(storeOptionValidator),
  apiKeyLast4: v.string(),
  testMode: v.boolean(),
  connectedAt: v.number(),
});

function toPublicConnection(row: Doc<"lemonConnections">) {
  return {
    _id: row._id,
    storeId: row.storeId,
    storeName: row.storeName,
    storeSlug: row.storeSlug,
    storeAvatarUrl: row.storeAvatarUrl ?? null,
    stores: row.stores ?? [
      {
        id: row.storeId,
        name: row.storeName,
        slug: row.storeSlug,
        ...(row.storeAvatarUrl ? { avatarUrl: row.storeAvatarUrl } : {}),
      },
    ],
    apiKeyLast4: row.apiKeyLast4,
    testMode: row.testMode,
    connectedAt: row.connectedAt,
  };
}

async function getActiveConnectionForUser(
  ctx: MutationCtx | QueryCtx,
  userId: Id<"users">,
): Promise<Doc<"lemonConnections"> | null> {
  const row = await ctx.db
    .query("lemonConnections")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (!row || isSoftDeleted(row)) return null;
  return row;
}

export const getConnection = query({
  args: {},
  returns: v.union(publicConnectionValidator, v.null()),
  handler: async (ctx) => {
    const user = await resolveProductUserOrNull(ctx);
    if (!user) return null;

    const row = await getActiveConnectionForUser(ctx, user._id);
    if (!row) return null;
    return toPublicConnection(row);
  },
});

/**
 * Public webhook callback URL for Settings / onboarding.
 * Never returns the signing secret — it stays server-side only.
 */
export const getWebhookSetup = query({
  args: {},
  returns: v.union(
    v.object({
      callbackUrl: v.string(),
      /** True when LEMONSQUEEZY_WEBHOOK_SECRET is configured on Convex. */
      serverConfigured: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const user = await resolveProductUserOrNull(ctx);
    if (!user) return null;

    const connection = await getActiveConnectionForUser(ctx, user._id);
    if (!connection) return null;

    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim();
    const site = process.env.CONVEX_SITE_URL?.trim().replace(/\/$/, "");
    if (!site) return null;

    return {
      callbackUrl: `${site}/lemonsqueezy`,
      serverConfigured: Boolean(secret),
    };
  },
});

export const getWebhookStatus = query({
  args: {
    sinceMs: v.optional(v.number()),
  },
  returns: v.object({
    connected: v.boolean(),
    storeId: v.union(v.string(), v.null()),
    verified: v.boolean(),
    lastReceivedAt: v.union(v.number(), v.null()),
    lastEventName: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const empty = {
      connected: false,
      storeId: null as string | null,
      verified: false,
      lastReceivedAt: null as number | null,
      lastEventName: null as string | null,
    };

    const user = await resolveProductUserOrNull(ctx);
    if (!user) return empty;

    const connection = await getActiveConnectionForUser(ctx, user._id);
    if (!connection) return empty;

    const storeIds = new Set<string>([connection.storeId]);
    for (const store of connection.stores ?? []) {
      storeIds.add(store.id);
    }

    let latest: {
      receivedAt: number;
      eventName: string;
    } | null = null;

    for (const storeId of storeIds) {
      const row = await ctx.db
        .query("lemonWebhookEvents")
        .withIndex("by_store_received", (q) => q.eq("storeId", storeId))
        .order("desc")
        .first();
      if (!row) continue;
      if (args.sinceMs != null && row.receivedAt < args.sinceMs) continue;
      if (!latest || row.receivedAt > latest.receivedAt) {
        latest = {
          receivedAt: row.receivedAt,
          eventName: row.eventName,
        };
      }
    }

    return {
      connected: true,
      storeId: connection.storeId,
      verified: latest != null,
      lastReceivedAt: latest?.receivedAt ?? null,
      lastEventName: latest?.eventName ?? null,
    };
  },
});

export const selectStore = mutation({
  args: { storeId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireActiveUserForWrite(ctx, "lemon_select_store", {
      storeId: args.storeId,
    });
    const row = await getActiveConnectionForUser(ctx, user._id);
    if (!row) throw new Error("No Lemon Squeezy connection");

    const stores = row.stores ?? [
      {
        id: row.storeId,
        name: row.storeName,
        slug: row.storeSlug,
        ...(row.storeAvatarUrl ? { avatarUrl: row.storeAvatarUrl } : {}),
      },
    ];

    const next = stores.find((s) => s.id === args.storeId);
    if (!next) throw new Error("Store not found on this connection");

    await ctx.db.patch(row._id, {
      storeId: next.id,
      storeName: next.name,
      storeSlug: next.slug,
      storeAvatarUrl: next.avatarUrl,
    });
    await syncStoreBindings(ctx, row._id, user._id, stores);
    return null;
  },
});

/** Used by actions — never exposed to the client */
export const getConnectionSecret = internalQuery({
  args: { clerkUserId: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("lemonConnections"),
      apiKeyCipher: v.string(),
      storeId: v.string(),
      testMode: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    let user: Doc<"users">;
    try {
      user = await requireLiveProductForClerkUser(ctx, args.clerkUserId);
    } catch {
      return null;
    }

    const row = await getActiveConnectionForUser(ctx, user._id);
    if (!row) return null;

    return {
      _id: row._id,
      apiKeyCipher: row.apiKeyCipher,
      storeId: row.storeId,
      testMode: row.testMode,
    };
  },
});

export const patchStores = internalMutation({
  args: {
    connectionId: v.id("lemonConnections"),
    stores: v.array(storeOptionValidator),
    storeId: v.optional(v.string()),
    storeName: v.optional(v.string()),
    storeSlug: v.optional(v.string()),
    storeAvatarUrl: v.optional(v.union(v.string(), v.null())),
    testMode: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection || isSoftDeleted(connection)) {
      throw new Error("Connection not found");
    }

    const product = await requireActiveUser(ctx);
    if (connection.userId !== product._id) {
      throw new Error(
        "Your access to this account ended or changed. Retry the operation.",
      );
    }
    await auditIfTakeoverWrite(ctx, product, "lemon_refresh_stores");

    const patch: {
      stores: StoreOption[];
      storeId?: string;
      storeName?: string;
      storeSlug?: string;
      storeAvatarUrl?: string | undefined;
      testMode?: boolean;
    } = { stores: args.stores };
    if (args.storeId !== undefined) patch.storeId = args.storeId;
    if (args.storeName !== undefined) patch.storeName = args.storeName;
    if (args.storeSlug !== undefined) patch.storeSlug = args.storeSlug;
    if (args.storeAvatarUrl !== undefined) {
      patch.storeAvatarUrl = args.storeAvatarUrl ?? undefined;
    }
    if (args.testMode !== undefined) patch.testMode = args.testMode;
    await ctx.db.patch(args.connectionId, patch);

    await syncStoreBindings(
      ctx,
      args.connectionId,
      connection.userId,
      args.stores,
    );
    return null;
  },
});

async function cancelFailureJobs(
  ctx: MutationCtx,
  failure: Doc<"failedPayments">,
) {
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
}

/** Soft-delete recovery history for a user (keeps rows for admin restore). */
async function softDeleteStoreHistory(
  ctx: MutationCtx,
  userId: Id<"users">,
  deletedBy: "user" | "admin" | "system",
) {
  const now = Date.now();

  // eslint-disable-next-line @convex-dev/no-query-collect -- disconnect archive; bounded per merchant
  const failures = await ctx.db
    .query("failedPayments")
    .withIndex("by_user_failedAt", (q) => q.eq("userId", userId))
    .collect();

  for (const failure of failures) {
    if (isSoftDeleted(failure)) continue;
    await cancelFailureJobs(ctx, failure);
    await ctx.db.patch(failure._id, {
      deletedAt: now,
      deletedBy,
      day2JobId: undefined,
      day5JobId: undefined,
    });
  }

  // eslint-disable-next-line @convex-dev/no-query-collect -- disconnect archive; bounded per merchant
  const activity = await ctx.db
    .query("activityEvents")
    .withIndex("by_user_occurred", (q) => q.eq("userId", userId))
    .collect();

  for (const event of activity) {
    if (isSoftDeleted(event)) continue;
    await ctx.db.patch(event._id, { deletedAt: now, deletedBy });
  }

  const settings = await ctx.db
    .query("recoverySettings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (settings && !isSoftDeleted(settings)) {
    await ctx.db.patch(settings._id, { deletedAt: now, deletedBy });
  }
}

/** Soft-delete connection + recovery history. Safe if nothing is connected. */
export async function archiveMerchantData(
  ctx: MutationCtx,
  userId: Id<"users">,
  deletedBy: "user" | "admin" | "system",
): Promise<void> {
  const row = await ctx.db
    .query("lemonConnections")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();

  await softDeleteStoreHistory(ctx, userId, deletedBy);

  if (row && !isSoftDeleted(row)) {
    await syncStoreBindings(ctx, row._id, userId, [], deletedBy);
    await ctx.db.patch(row._id, {
      deletedAt: Date.now(),
      deletedBy,
    });
  }
}

export const disconnectStore = mutation({
  args: {
    /** Must exactly match the connected store name (trimmed). */
    confirmStoreName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireActiveUserForWrite(ctx, "lemon_disconnect");
    const row = await getActiveConnectionForUser(ctx, user._id);

    if (!row) {
      throw new Error("No store connected");
    }

    if (args.confirmStoreName.trim() !== row.storeName) {
      throw new Error(
        "Store name does not match. Type the exact store name to disconnect.",
      );
    }

    await archiveMerchantData(ctx, user._id, "user");
    return null;
  },
});

export const saveConnection = internalMutation({
  args: {
    clerkUserId: v.string(),
    storeId: v.string(),
    storeName: v.string(),
    storeSlug: v.string(),
    storeAvatarUrl: v.optional(v.string()),
    stores: v.array(storeOptionValidator),
    apiKeyCipher: v.string(),
    apiKeyLast4: v.string(),
    testMode: v.boolean(),
  },
  returns: v.id("lemonConnections"),
  handler: async (ctx, args) => {
    // Live re-bind: do not trust action-snapshotted clerkUserId alone.
    const user = await requireLiveProductForClerkUser(ctx, args.clerkUserId);
    await auditIfTakeoverWrite(ctx, user, "lemon_connect", {
      storeId: args.storeId,
    });

    const existing = await ctx.db
      .query("lemonConnections")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    const now = Date.now();
    const fields = {
      userId: user._id,
      storeId: args.storeId,
      storeName: args.storeName,
      storeSlug: args.storeSlug,
      storeAvatarUrl: args.storeAvatarUrl,
      stores: args.stores,
      apiKeyCipher: args.apiKeyCipher,
      apiKeyLast4: args.apiKeyLast4,
      testMode: args.testMode,
      connectedAt: now,
      deletedAt: undefined,
      deletedBy: undefined,
    };

    if (existing) {
      await ctx.db.patch(existing._id, fields);
      // Clear soft-delete on related settings when reconnecting
      const settings = await ctx.db
        .query("recoverySettings")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .unique();
      if (settings?.deletedAt != null) {
        await ctx.db.patch(settings._id, {
          deletedAt: undefined,
          deletedBy: undefined,
        });
      }
      await syncStoreBindings(ctx, existing._id, user._id, args.stores);
      return existing._id;
    }

    const connectionId = await ctx.db.insert("lemonConnections", fields);
    await syncStoreBindings(ctx, connectionId, user._id, args.stores);
    return connectionId;
  },
});

/** Resolve which DeclineGuard user owns an LS store (webhook routing) */
export const getBindingByStoreId = internalQuery({
  args: { storeId: v.string() },
  returns: v.union(
    v.object({
      connectionId: v.id("lemonConnections"),
      userId: v.id("users"),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const bindings = await ctx.db
      .query("lemonStoreBindings")
      .withIndex("by_storeId", (q) => q.eq("storeId", args.storeId))
      .collect();
    if (bindings.length === 0) return null;
    let binding = bindings[0]!;
    for (const row of bindings) {
      if (row._creationTime > binding._creationTime) binding = row;
    }

    const connection = await ctx.db.get(binding.connectionId);
    if (!connection || isSoftDeleted(connection)) return null;

    return {
      connectionId: binding.connectionId,
      userId: binding.userId,
    };
  },
});

/** Soft-delete a connection (admin / reclaim path). */
export const softDeleteConnectionInternal = internalMutation({
  args: {
    connectionId: v.id("lemonConnections"),
    deletedBy: v.union(
      v.literal("user"),
      v.literal("admin"),
      v.literal("system"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.connectionId);
    if (!row || isSoftDeleted(row)) return null;

    await softDeleteStoreHistory(ctx, row.userId, args.deletedBy);
    await syncStoreBindings(ctx, row._id, row.userId, [], args.deletedBy === "admin" ? "admin" : "system");
    await ctx.db.patch(row._id, {
      deletedAt: Date.now(),
      deletedBy: args.deletedBy,
    });
    return null;
  },
});
