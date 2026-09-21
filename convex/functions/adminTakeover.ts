import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  accountStatusOf,
  recoveryFeePercent,
  requireActiveUser,
  requireSupportParticipant,
  resolvePlan,
  TAKEOVER_FREEZE_REASON,
} from "../lib/accountGuard";
import { planValidator } from "../schema";
import {
  normalizeRole,
  requireAdmin,
  requireActionReason,
  writeAuditLog,
  type AppRole,
} from "../lib/admin";
import { internal } from "../_generated/api";

type DbCtx = QueryCtx | MutationCtx;

/** Chat token merchants click to consent to Admin login-as. */
export const TAKEOVER_CONSENT_TOKEN = "[Allow Admin Takeover]";

const CONSENT_TTL_MS = 2 * 60 * 60 * 1000;
const TAKEOVER_TTL_MS = 60 * 60 * 1000;
const EXTEND_MS = 30 * 60 * 1000;


const takeoverSummaryValidator = v.object({
  _id: v.id("adminTakeovers"),
  merchantUserId: v.id("users"),
  merchantName: v.string(),
  adminUserId: v.union(v.id("users"), v.null()),
  adminName: v.union(v.string(), v.null()),
  threadId: v.id("supportThreads"),
  messageId: v.id("supportMessages"),
  status: v.union(
    v.literal("pending_consent"),
    v.literal("active"),
    v.literal("ended"),
    v.literal("expired"),
    v.literal("revoked"),
  ),
  consentedAt: v.union(v.number(), v.null()),
  consentExpiresAt: v.number(),
  startedAt: v.union(v.number(), v.null()),
  expiresAt: v.union(v.number(), v.null()),
  endedAt: v.union(v.number(), v.null()),
  extended: v.boolean(),
});

async function summarizeTakeover(ctx: DbCtx, row: Doc<"adminTakeovers">) {
  const admin = row.adminUserId ? await ctx.db.get(row.adminUserId) : null;
  const merchant = await ctx.db.get(row.merchantUserId);
  return {
    _id: row._id,
    merchantUserId: row.merchantUserId,
    merchantName: merchant?.userName ?? "Merchant",
    adminUserId: row.adminUserId ?? null,
    adminName: admin?.userName ?? null,
    threadId: row.threadId,
    messageId: row.messageId,
    status: row.status,
    consentedAt: row.consentedAt ?? null,
    consentExpiresAt: row.consentExpiresAt,
    startedAt: row.startedAt ?? null,
    expiresAt: row.expiresAt ?? null,
    endedAt: row.endedAt ?? null,
    extended: row.extended ?? false,
  };
}

async function insertSystemNote(
  ctx: MutationCtx,
  args: {
    threadId: Id<"supportThreads">;
    authorUserId: Id<"users">;
    authorRole: AppRole;
    body: string;
    now: number;
  },
): Promise<void> {
  await ctx.db.insert("supportMessages", {
    threadId: args.threadId,
    authorUserId: args.authorUserId,
    authorRole: args.authorRole,
    body: args.body,
    visibility: "customer",
    kind: "system",
    createdAt: args.now,
  });
}

function messageOffersTakeover(message: Doc<"supportMessages">): boolean {
  return (
    message.visibility === "customer" &&
    (message.kind ?? "chat") === "chat" &&
    message.authorRole === "admin" &&
    message.body.includes(TAKEOVER_CONSENT_TOKEN)
  );
}

/**
 * Undo a freeze we created for takeover — but never clobber a newer Admin
 * status change (disable / re-freeze for abuse) made mid-session.
 * freezeOwnedByTakeover is only set when prior status was active.
 */
async function restoreMerchantAfterTakeover(
  ctx: MutationCtx,
  row: Doc<"adminTakeovers">,
): Promise<void> {
  if (!row.freezeOwnedByTakeover) return;
  const merchant = await ctx.db.get(row.merchantUserId);
  if (!merchant) return;

  const current = accountStatusOf(merchant);
  if (current === "disabled") return;
  if (current === "active") return;
  if (current === "frozen") {
    if (merchant.frozenReason !== TAKEOVER_FREEZE_REASON) return;
    await ctx.db.patch(row.merchantUserId, {
      accountStatus: "active",
      frozenAt: undefined,
      frozenReason: undefined,
    });
  }
}

/** Throws if product writes are blocked (actions call this via query). */
export const assertProductWritesAllowed = query({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireActiveUser(ctx);
    return null;
  },
});

/**
 * Effective product account for actions (Lemon connect/refresh/etc.).
 * When Admin owns an active takeover, this is the merchant.
 */
export const getProductContext = query({
  args: {},
  returns: v.object({
    clerkUserId: v.string(),
    convexUserId: v.id("users"),
    actingViaTakeover: v.boolean(),
    plan: planValidator,
    recoveryFeePercent: v.union(v.literal(10), v.literal(4)),
  }),
  handler: async (ctx) => {
    const viewer = await requireSupportParticipant(ctx);
    const product = await requireActiveUser(ctx);
    const plan = resolvePlan(product);
    return {
      clerkUserId: product.userId,
      convexUserId: product._id,
      actingViaTakeover: viewer._id !== product._id,
      plan,
      recoveryFeePercent: recoveryFeePercent(plan),
    };
  },
});

/** Active or pending takeover on a support thread. */
export const getTakeoverForThread = query({
  args: { threadId: v.id("supportThreads") },
  returns: v.union(takeoverSummaryValidator, v.null()),
  handler: async (ctx, args) => {
    const me = await requireSupportParticipant(ctx);
    const thread = await ctx.db.get(args.threadId);
    if (!thread) return null;

    const role = normalizeRole(me.role);
    const isStaff = role === "staff" || role === "admin";
    if (!isStaff && thread.userId !== me._id) return null;

    const rows = await ctx.db
      .query("adminTakeovers")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .take(30);

    const now = Date.now();
    const active = rows.find(
      (r) => r.status === "active" && (r.expiresAt ?? 0) > now,
    );
    if (active) return await summarizeTakeover(ctx, active);

    const pending = rows.find(
      (r) =>
        r.status === "pending_consent" && r.consentExpiresAt > now,
    );
    if (pending) return await summarizeTakeover(ctx, pending);

    return null;
  },
});

/** Impersonated merchant (or Admin viewing) — active takeover banner. */
export const getActiveTakeoverForMe = query({
  args: {},
  returns: v.union(takeoverSummaryValidator, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();
    if (!user) return null;

    // Include past-expiresAt while status is still "active" so End/unfreeze
    // stays available until the expire job / sweep restores the account.
    const asMerchant = await ctx.db
      .query("adminTakeovers")
      .withIndex("by_merchant_status", (q) =>
        q.eq("merchantUserId", user._id).eq("status", "active"),
      )
      .take(5);
    if (asMerchant[0]) return await summarizeTakeover(ctx, asMerchant[0]);

    if (normalizeRole(user.role) === "admin") {
      const asAdmin = await ctx.db
        .query("adminTakeovers")
        .withIndex("by_admin_status", (q) =>
          q.eq("adminUserId", user._id).eq("status", "active"),
        )
        .take(5);
      if (asAdmin[0]) return await summarizeTakeover(ctx, asAdmin[0]);
    }

    return null;
  },
});

/**
 * Merchant consents to Admin login-as from a chat message containing
 * [Allow Admin Takeover].
 */
export const acceptTakeoverConsent = mutation({
  args: {
    threadId: v.id("supportThreads"),
    messageId: v.id("supportMessages"),
  },
  returns: v.id("adminTakeovers"),
  handler: async (ctx, args) => {
    const me = await requireSupportParticipant(ctx);

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== me._id) {
      throw new Error(
        "Only the merchant who owns this chat can allow Admin takeover.",
      );
    }
    if (thread.status === "closed") {
      throw new Error("This chat is closed.");
    }

    // Ownership of the chat — not role. Staff/Admin testing Help on their
    // own account can consent; start still blocks Admin targets and self.

    const message = await ctx.db.get(args.messageId);
    if (
      !message ||
      message.threadId !== args.threadId ||
      !messageOffersTakeover(message)
    ) {
      throw new Error("That takeover request is no longer valid.");
    }

    const adminAuthor = await ctx.db.get(message.authorUserId);
    if (!adminAuthor || normalizeRole(adminAuthor.role) !== "admin") {
      throw new Error("Only an Admin can request account takeover.");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("adminTakeovers")
      .withIndex("by_merchant_status", (q) =>
        q.eq("merchantUserId", me._id).eq("status", "active"),
      )
      .take(5);
    if (existing.some((r) => (r.expiresAt ?? 0) > now)) {
      throw new Error("An Admin takeover is already active on this account.");
    }

    const pendingRows = await ctx.db
      .query("adminTakeovers")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .take(20);
    for (const row of pendingRows) {
      if (
        row.status === "pending_consent" &&
        row.consentExpiresAt > now
      ) {
        // Reuse only for the same soliciting Admin (bind legacy unbound rows).
        if (row.adminUserId == null || row.adminUserId === adminAuthor._id) {
          if (row.adminUserId == null) {
            await ctx.db.patch(row._id, { adminUserId: adminAuthor._id });
          }
          return row._id;
        }
      }
    }

    const consentExpiresAt = now + CONSENT_TTL_MS;
    const takeoverId = await ctx.db.insert("adminTakeovers", {
      merchantUserId: me._id,
      /** Bound to the Admin who requested consent — only they may start. */
      adminUserId: adminAuthor._id,
      threadId: args.threadId,
      messageId: args.messageId,
      status: "pending_consent",
      consentedAt: now,
      consentExpiresAt,
      createdAt: now,
    });

    await insertSystemNote(ctx, {
      threadId: args.threadId,
      authorUserId: me._id,
      authorRole: "user",
      body: `You allowed Admin takeover for ${adminAuthor.userName}. They can work on your dashboard for up to 60 minutes (you stay locked out). You can revoke consent until they start.`,
      now,
    });
    await ctx.db.patch(args.threadId, { lastMessageAt: now });

    await writeAuditLog(ctx, {
      actorUserId: me._id,
      targetUserId: me._id,
      action: "takeover_consent",
      reason: `Consented to Admin takeover for ${adminAuthor.userName}`,
      metadata: {
        threadId: args.threadId,
        messageId: args.messageId,
        takeoverId,
        consentExpiresAt,
        solicitingAdminUserId: adminAuthor._id,
      },
    });

    return takeoverId;
  },
});

/** Merchant revokes pending consent before Admin starts. */
export const revokeTakeoverConsent = mutation({
  args: { takeoverId: v.id("adminTakeovers") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = await requireSupportParticipant(ctx);
    const row = await ctx.db.get(args.takeoverId);
    if (!row) throw new Error("Takeover not found");
    if (row.merchantUserId !== me._id) {
      throw new Error("Only the merchant can revoke this consent.");
    }
    if (row.status !== "pending_consent") {
      throw new Error("Only pending consent can be revoked this way.");
    }

    const now = Date.now();
    await ctx.db.patch(row._id, {
      status: "revoked",
      endedAt: now,
    });

    await insertSystemNote(ctx, {
      threadId: row.threadId,
      authorUserId: me._id,
      authorRole: "user",
      body: "You revoked Admin takeover consent.",
      now,
    });
    await ctx.db.patch(row.threadId, { lastMessageAt: now });

    await writeAuditLog(ctx, {
      actorUserId: me._id,
      targetUserId: me._id,
      action: "takeover_revoke_consent",
      reason: "Merchant revoked pending Admin takeover consent",
      metadata: { takeoverId: row._id },
    });
    return null;
  },
});

/** Prepare freeze + mark active (called from startTakeover action). */
export const beginTakeoverSession = internalMutation({
  args: {
    takeoverId: v.id("adminTakeovers"),
    adminUserId: v.id("users"),
    reason: v.string(),
  },
  returns: v.object({
    merchantClerkUserId: v.string(),
    adminClerkUserId: v.string(),
    expiresAt: v.number(),
    merchantUserId: v.id("users"),
  }),
  handler: async (ctx, args) => {
    const reason = requireActionReason(args.reason);
    const row = await ctx.db.get(args.takeoverId);
    if (!row) throw new Error("Takeover not found");
    const now = Date.now();

    if (row.status !== "pending_consent") {
      throw new Error("Takeover consent is not pending.");
    }
    if (row.consentExpiresAt <= now) {
      await ctx.db.patch(row._id, { status: "expired", endedAt: now });
      throw new Error("Takeover consent expired. Ask the merchant again.");
    }

    const admin = await ctx.db.get(args.adminUserId);
    if (!admin || normalizeRole(admin.role) !== "admin") {
      throw new Error("Admin access required");
    }

    // Consent is bound to the soliciting Admin (set at acceptTakeoverConsent).
    if (row.adminUserId != null && row.adminUserId !== admin._id) {
      throw new Error(
        "This consent was granted for a different Admin. Ask the merchant again from your chat.",
      );
    }
    // Legacy pending rows without adminUserId: only the message author may start.
    if (row.adminUserId == null) {
      const offer = await ctx.db.get(row.messageId);
      if (!offer || offer.authorUserId !== admin._id) {
        throw new Error(
          "This consent was granted for a different Admin. Ask the merchant again from your chat.",
        );
      }
    }

    const merchant = await ctx.db.get(row.merchantUserId);
    if (!merchant) throw new Error("Merchant not found");
    const merchantRole = normalizeRole(merchant.role);
    // Never take over Admin accounts. User + Staff OK (Staff for test accounts).
    if (merchantRole === "admin") {
      throw new Error(
        "Cannot take over an Admin account. Use a merchant (User) account.",
      );
    }
    if (merchant._id === admin._id) {
      throw new Error(
        "You cannot take over your own account. Use a separate merchant test user.",
      );
    }

    const otherActive = await ctx.db
      .query("adminTakeovers")
      .withIndex("by_merchant_status", (q) =>
        q.eq("merchantUserId", merchant._id).eq("status", "active"),
      )
      .take(5);
    if (otherActive.some((r) => r._id !== row._id && (r.expiresAt ?? 0) > now)) {
      throw new Error("Another Admin takeover is already active.");
    }

    // One active takeover per Admin — avoids ambiguous product context.
    const adminAlreadyActive = await ctx.db
      .query("adminTakeovers")
      .withIndex("by_admin_status", (q) =>
        q.eq("adminUserId", admin._id).eq("status", "active"),
      )
      .take(5);
    if (
      adminAlreadyActive.some(
        (r) => r._id !== row._id && (r.expiresAt ?? 0) > now,
      )
    ) {
      throw new Error(
        "You already have an active takeover. End it before starting another.",
      );
    }

    const priorStatus = accountStatusOf(merchant);
    if (priorStatus === "disabled") {
      throw new Error("Cannot take over a disabled account. Unban first.");
    }

    let freezeOwnedByTakeover = false;
    if (priorStatus === "active") {
      await ctx.db.patch(merchant._id, {
        accountStatus: "frozen",
        frozenAt: now,
        frozenReason: TAKEOVER_FREEZE_REASON,
      });
      freezeOwnedByTakeover = true;
    }

    const expiresAt = now + TAKEOVER_TTL_MS;
    await ctx.db.patch(row._id, {
      status: "active",
      adminUserId: admin._id,
      startedAt: now,
      expiresAt,
      priorAccountStatus: priorStatus,
      priorFrozenReason: merchant.frozenReason,
      freezeOwnedByTakeover,
      extended: false,
      writeCapabilityNonce: undefined,
      actorClerkSessionId: undefined,
    });

    await insertSystemNote(ctx, {
      threadId: row.threadId,
      authorUserId: admin._id,
      authorRole: "admin",
      body: `An Admin started a temporary login session on your account (up to 60 minutes). You are locked out of the dashboard until it ends.`,
      now,
    });
    await ctx.db.patch(row.threadId, { lastMessageAt: now });

    await writeAuditLog(ctx, {
      actorUserId: admin._id,
      targetUserId: merchant._id,
      action: "takeover_start",
      reason,
      metadata: {
        takeoverId: row._id,
        expiresAt,
        freezeOwnedByTakeover,
        priorStatus,
      },
    });

    await ctx.scheduler.runAt(
      expiresAt,
      internal.functions.adminTakeover.expireTakeoverInternal,
      { takeoverId: row._id },
    );

    return {
      merchantClerkUserId: merchant.userId,
      adminClerkUserId: admin.userId,
      expiresAt,
      merchantUserId: merchant._id,
    };
  },
});

export const endTakeoverInternal = internalMutation({
  args: {
    takeoverId: v.id("adminTakeovers"),
    endedByUserId: v.union(v.id("users"), v.null()),
    reason: v.string(),
    status: v.union(
      v.literal("ended"),
      v.literal("expired"),
      v.literal("revoked"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.takeoverId);
    if (!row) return null;
    if (row.status !== "active" && row.status !== "pending_consent") {
      return null;
    }

    const now = Date.now();
    if (row.status === "active") {
      await restoreMerchantAfterTakeover(ctx, row);
    }

    await ctx.db.patch(row._id, {
      status: args.status,
      endedAt: now,
    });

    const authorId = args.endedByUserId ?? row.adminUserId ?? row.merchantUserId;
    const author = await ctx.db.get(authorId);
    const authorRole: AppRole = author
      ? normalizeRole(author.role)
      : "admin";

    await insertSystemNote(ctx, {
      threadId: row.threadId,
      authorUserId: authorId,
      authorRole,
      body:
        args.status === "expired"
          ? "Admin takeover ended (time expired). Your dashboard access is restored."
          : "Admin takeover ended. Your dashboard access is restored.",
      now,
    });
    await ctx.db.patch(row.threadId, { lastMessageAt: now });

    await writeAuditLog(ctx, {
      actorUserId: args.endedByUserId,
      targetUserId: row.merchantUserId,
      action:
        args.status === "expired" ? "takeover_expire" : "takeover_end",
      reason: args.reason,
      metadata: { takeoverId: row._id, status: args.status },
    });
    return null;
  },
});

export const expireTakeoverInternal = internalMutation({
  args: { takeoverId: v.id("adminTakeovers") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.takeoverId);
    if (!row || row.status !== "active") return null;
    const now = Date.now();
    if (row.expiresAt != null && row.expiresAt > now + 1000) {
      // Extended after this job was scheduled — skip
      return null;
    }
    await restoreMerchantAfterTakeover(ctx, row);
    await ctx.db.patch(row._id, {
      status: "expired",
      endedAt: now,
    });
    await insertSystemNote(ctx, {
      threadId: row.threadId,
      authorUserId: row.adminUserId ?? row.merchantUserId,
      authorRole: "admin",
      body: "Admin takeover ended (time expired). Your dashboard access is restored.",
      now,
    });
    await ctx.db.patch(row.threadId, { lastMessageAt: now });
    await writeAuditLog(ctx, {
      actorUserId: null,
      targetUserId: row.merchantUserId,
      action: "takeover_expire",
      reason: "Takeover session expired",
      metadata: { takeoverId: row._id },
    });
    return null;
  },
});

/** Admin or actor session ends the takeover. */
export const endTakeover = mutation({
  args: {
    takeoverId: v.id("adminTakeovers"),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = await requireSupportParticipant(ctx);
    const row = await ctx.db.get(args.takeoverId);
    if (!row) throw new Error("Takeover not found");
    if (row.status !== "active") {
      throw new Error("No active takeover to end.");
    }

    const role = normalizeRole(me.role);
    const isAdminOwner =
      role === "admin" && row.adminUserId === me._id;
    const isAnyAdmin = role === "admin";
    const isMerchant = row.merchantUserId === me._id;
    // Model B: Admin ends while still signed in as Admin; merchant can also end.
    if (!isAdminOwner && !isAnyAdmin && !isMerchant) {
      throw new Error("Not allowed to end this takeover.");
    }

    const reason =
      args.reason?.trim() && args.reason.trim().length >= 8
        ? requireActionReason(args.reason)
        : isMerchant
          ? "Merchant ended takeover session"
          : "Admin ended takeover session";

    await restoreMerchantAfterTakeover(ctx, row);
    const now = Date.now();
    await ctx.db.patch(row._id, {
      status: "ended",
      endedAt: now,
    });

    await insertSystemNote(ctx, {
      threadId: row.threadId,
      authorUserId: me._id,
      authorRole: role === "admin" ? "admin" : "user",
      body: "Admin takeover ended. Your dashboard access is restored.",
      now,
    });
    await ctx.db.patch(row.threadId, { lastMessageAt: now });

    await writeAuditLog(ctx, {
      actorUserId: me._id,
      targetUserId: row.merchantUserId,
      action: "takeover_end",
      reason,
      metadata: {
        takeoverId: row._id,
        endedByRole: role,
        owningAdminUserId: row.adminUserId,
      },
    });
    return null;
  },
});

export const extendTakeover = mutation({
  args: {
    takeoverId: v.id("adminTakeovers"),
    reason: v.string(),
  },
  returns: v.object({ expiresAt: v.number() }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const reason = requireActionReason(args.reason);
    const row = await ctx.db.get(args.takeoverId);
    if (!row || row.status !== "active") {
      throw new Error("No active takeover to extend.");
    }
    if (row.adminUserId !== admin._id) {
      throw new Error("Only the Admin who started this takeover can extend it.");
    }
    if (row.extended) {
      throw new Error("This takeover was already extended once.");
    }
    const now = Date.now();
    const base = Math.max(row.expiresAt ?? now, now);
    const expiresAt = base + EXTEND_MS;
    await ctx.db.patch(row._id, {
      expiresAt,
      extended: true,
    });

    await ctx.scheduler.runAt(
      expiresAt,
      internal.functions.adminTakeover.expireTakeoverInternal,
      { takeoverId: row._id },
    );

    await writeAuditLog(ctx, {
      actorUserId: admin._id,
      targetUserId: row.merchantUserId,
      action: "takeover_extend",
      reason,
      metadata: { takeoverId: row._id, expiresAt },
    });

    return { expiresAt };
  },
});

export const getTakeoverClerkIds = internalQuery({
  args: { takeoverId: v.id("adminTakeovers") },
  returns: v.union(
    v.object({
      merchantClerkUserId: v.string(),
      adminClerkUserId: v.string(),
      merchantUserId: v.id("users"),
      status: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.takeoverId);
    if (!row || !row.adminUserId) return null;
    const merchant = await ctx.db.get(row.merchantUserId);
    const admin = await ctx.db.get(row.adminUserId);
    if (!merchant || !admin) return null;
    return {
      merchantClerkUserId: merchant.userId,
      adminClerkUserId: admin.userId,
      merchantUserId: merchant._id,
      status: row.status,
    };
  },
});

/** Cron: expire stale pending consents and overdue active sessions. */
export const sweepExpiredTakeovers = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();

    const pending = await ctx.db
      .query("adminTakeovers")
      .withIndex("by_status_consentExpiresAt", (q) =>
        q.eq("status", "pending_consent"),
      )
      .take(100);
    for (const row of pending) {
      if (row.consentExpiresAt <= now) {
        await ctx.db.patch(row._id, {
          status: "expired",
          endedAt: now,
        });
      }
    }

    const active = await ctx.db
      .query("adminTakeovers")
      .withIndex("by_status_expiresAt", (q) => q.eq("status", "active"))
      .take(100);
    for (const row of active) {
      if (row.expiresAt != null && row.expiresAt <= now) {
        await restoreMerchantAfterTakeover(ctx, row);
        await ctx.db.patch(row._id, {
          status: "expired",
          endedAt: now,
        });
        await writeAuditLog(ctx, {
          actorUserId: null,
          targetUserId: row.merchantUserId,
          action: "takeover_expire",
          reason: "Takeover session expired (sweep)",
          metadata: { takeoverId: row._id },
        });
      }
    }
    return null;
  },
});
