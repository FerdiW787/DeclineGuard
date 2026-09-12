import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  accountStatusOf,
  requireSupportParticipant,
  isSoftDeleted,
} from "../lib/accountGuard";
import {
  normalizeRole,
  requireAdmin,
  requireStaff,
  writeAuditLog,
  type AppRole,
} from "../lib/admin";
import { consumeRateLimit } from "../lib/rateLimit";

const topicValidator = v.union(
  v.literal("account"),
  v.literal("billing"),
  v.literal("lemon_squeezy"),
  v.literal("bug"),
  v.literal("other"),
);

const statusValidator = v.union(
  v.literal("open"),
  v.literal("claimed"),
  v.literal("waiting_customer"),
  v.literal("waiting_staff"),
  v.literal("resolved"),
  v.literal("closed"),
);

const appRoleValidator = v.union(
  v.literal("user"),
  v.literal("staff"),
  v.literal("admin"),
);

const MAX_BODY = 4000;
const MAX_SUBJECT = 120;

function trimBody(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length < 1) throw new Error("Message can’t be empty.");
  if (trimmed.length > MAX_BODY) {
    throw new Error(`Message is too long (max ${MAX_BODY} characters).`);
  }
  return trimmed;
}

function trimSubject(subject: string): string {
  const trimmed = subject.trim();
  if (trimmed.length < 3) {
    throw new Error("Please write a short summary (at least 3 characters).");
  }
  if (trimmed.length > MAX_SUBJECT) {
    throw new Error(`Summary is too long (max ${MAX_SUBJECT} characters).`);
  }
  return trimmed;
}

async function recordSupportEvent(
  ctx: MutationCtx,
  args: {
    threadId: Id<"supportThreads">;
    actorUserId: Id<"users">;
    type:
      | "claim"
      | "release"
      | "force_claim"
      | "resolve"
      | "close"
      | "reopen"
      | "escalate";
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  await ctx.db.insert("supportEvents", {
    threadId: args.threadId,
    actorUserId: args.actorUserId,
    type: args.type,
    at: Date.now(),
    meta: args.meta ? JSON.stringify(args.meta) : undefined,
  });
}

async function loadThreadOrThrow(
  ctx: MutationCtx,
  threadId: Id<"supportThreads">,
): Promise<Doc<"supportThreads">> {
  const thread = await ctx.db.get(threadId);
  if (!thread) throw new Error("Conversation not found.");
  return thread;
}

const threadSummaryValidator = v.object({
  _id: v.id("supportThreads"),
  userId: v.id("users"),
  topic: topicValidator,
  subject: v.string(),
  status: statusValidator,
  assigneeId: v.union(v.id("users"), v.null()),
  claimedAt: v.union(v.number(), v.null()),
  escalatedAt: v.union(v.number(), v.null()),
  escalatedByName: v.union(v.string(), v.null()),
  lastMessageAt: v.number(),
  lastCustomerMessageAt: v.union(v.number(), v.null()),
  lastStaffMessageAt: v.union(v.number(), v.null()),
  merchantAccountStatusAtOpen: v.union(
    v.literal("active"),
    v.literal("frozen"),
    v.literal("disabled"),
  ),
  storeId: v.union(v.string(), v.null()),
  storeName: v.union(v.string(), v.null()),
  createdAt: v.number(),
  merchantName: v.string(),
  merchantRole: appRoleValidator,
  assigneeName: v.union(v.string(), v.null()),
  /** Preview of latest customer-visible message */
  lastMessagePreview: v.union(v.string(), v.null()),
  /** True when staff/system replied after merchant last read */
  hasUnread: v.boolean(),
});

async function lastCustomerVisiblePreview(
  ctx: QueryCtx | MutationCtx,
  threadId: Id<"supportThreads">,
): Promise<string | null> {
  const rows = await ctx.db
    .query("supportMessages")
    .withIndex("by_thread_createdAt", (q) => q.eq("threadId", threadId))
    .order("desc")
    .take(30);
  for (const row of rows) {
    if (row.visibility === "internal") continue;
    const preview = row.body.replace(/\s+/g, " ").trim();
    if (!preview) continue;
    return preview.length > 100 ? `${preview.slice(0, 97)}…` : preview;
  }
  return null;
}

async function summarizeThread(
  ctx: QueryCtx | MutationCtx,
  thread: Doc<"supportThreads">,
) {
  const merchant = await ctx.db.get(thread.userId);
  let assigneeName: string | null = null;
  if (thread.assigneeId) {
    const assignee = await ctx.db.get(thread.assigneeId);
    assigneeName = assignee?.userName ?? null;
  }
  let escalatedByName: string | null = null;
  if (thread.escalatedBy) {
    const escalator = await ctx.db.get(thread.escalatedBy);
    escalatedByName = escalator?.userName ?? null;
  }
  const lastMessagePreview = await lastCustomerVisiblePreview(ctx, thread._id);
  const readAt = thread.customerLastReadAt ?? 0;
  const staffAt = thread.lastStaffMessageAt ?? 0;
  const hasUnread =
    staffAt > 0 &&
    staffAt > readAt &&
    thread.status !== "closed";

  return {
    _id: thread._id,
    userId: thread.userId,
    topic: thread.topic,
    subject: thread.subject,
    status: thread.status,
    assigneeId: thread.assigneeId ?? null,
    claimedAt: thread.claimedAt ?? null,
    escalatedAt: thread.escalatedAt ?? null,
    escalatedByName,
    lastMessageAt: thread.lastMessageAt,
    lastCustomerMessageAt: thread.lastCustomerMessageAt ?? null,
    lastStaffMessageAt: thread.lastStaffMessageAt ?? null,
    merchantAccountStatusAtOpen: thread.merchantAccountStatusAtOpen,
    storeId: thread.storeId ?? null,
    storeName: thread.storeName ?? null,
    createdAt: thread.createdAt,
    merchantName: merchant?.userName ?? "Merchant",
    merchantRole: normalizeRole(merchant?.role) as AppRole,
    assigneeName,
    lastMessagePreview,
    hasUnread,
  };
}

/** Merchant: start a support conversation. */
export const createThread = mutation({
  args: {
    topic: topicValidator,
    subject: v.string(),
    body: v.string(),
  },
  returns: v.id("supportThreads"),
  handler: async (ctx, args) => {
    const me = await requireSupportParticipant(ctx);
    await consumeRateLimit(ctx, `support:thread:${me._id}`, 3, 60 * 60 * 1000);

    const subject = trimSubject(args.subject);
    const body = trimBody(args.body);
    const now = Date.now();

    const connection = await ctx.db
      .query("lemonConnections")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .unique();

    const storeLive =
      connection && !isSoftDeleted(connection) ? connection : null;

    const threadId = await ctx.db.insert("supportThreads", {
      userId: me._id,
      topic: args.topic,
      subject,
      status: "open",
      lastMessageAt: now,
      lastCustomerMessageAt: now,
      customerLastReadAt: now,
      merchantAccountStatusAtOpen: accountStatusOf(me),
      storeId: storeLive?.storeId,
      storeName: storeLive?.storeName,
      createdAt: now,
    });

    await ctx.db.insert("supportMessages", {
      threadId,
      authorUserId: me._id,
      authorRole: "user",
      body,
      visibility: "customer",
      kind: "chat",
      createdAt: now,
    });

    return threadId;
  },
});

/** Merchant: list own threads. */
export const listMyThreads = query({
  args: {},
  returns: v.array(threadSummaryValidator),
  handler: async (ctx) => {
    const me = await requireSupportParticipant(ctx);
    const rows = await ctx.db
      .query("supportThreads")
      .withIndex("by_user_lastMessageAt", (q) => q.eq("userId", me._id))
      .order("desc")
      .take(50);
    const out = [];
    for (const row of rows) {
      out.push(await summarizeThread(ctx, row));
    }
    return out;
  },
});

/** Unread support chats for Help badge on the dashboard. */
export const countUnreadThreads = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    // Badge query — return 0 during auth transitions (sign-out / takeover)
    // instead of throwing and spamming the client/console.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;

    const me = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();
    if (!me || accountStatusOf(me) === "disabled") return 0;

    const rows = await ctx.db
      .query("supportThreads")
      .withIndex("by_user_lastMessageAt", (q) => q.eq("userId", me._id))
      .order("desc")
      .take(50);
    let n = 0;
    for (const row of rows) {
      if (row.status === "closed") continue;
      const readAt = row.customerLastReadAt ?? 0;
      const staffAt = row.lastStaffMessageAt ?? 0;
      if (staffAt > 0 && staffAt > readAt) n += 1;
    }
    return n;
  },
});

/** Merchant marks a chat as read (clears unread). */
export const markThreadRead = mutation({
  args: { threadId: v.id("supportThreads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = await requireSupportParticipant(ctx);
    const thread = await loadThreadOrThrow(ctx, args.threadId);
    if (thread.userId !== me._id) throw new Error("Not authorized");
    await ctx.db.patch(thread._id, { customerLastReadAt: Date.now() });
    return null;
  },
});

const messageValidator = v.object({
  _id: v.id("supportMessages"),
  threadId: v.id("supportThreads"),
  authorUserId: v.id("users"),
  authorRole: appRoleValidator,
  authorName: v.string(),
  authorProfilePic: v.union(v.string(), v.null()),
  body: v.string(),
  visibility: v.union(v.literal("customer"), v.literal("internal")),
  kind: v.union(v.literal("chat"), v.literal("system")),
  createdAt: v.number(),
});

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

/** List messages for a thread (merchants never see internal notes). */
export const listMessages = query({
  args: { threadId: v.id("supportThreads") },
  returns: v.array(messageValidator),
  handler: async (ctx, args) => {
    const me = await requireSupportParticipant(ctx);
    const thread = await ctx.db.get(args.threadId);
    if (!thread) return [];

    const role = normalizeRole(me.role);
    const isStaff = role === "staff" || role === "admin";
    if (!isStaff && thread.userId !== me._id) {
      throw new Error("Not authorized");
    }
    if (isStaff && role === "staff") {
      const unclaimed =
        thread.assigneeId == null &&
        (thread.status === "open" || thread.status === "waiting_staff");
      const mine = thread.assigneeId === me._id;
      if (!unclaimed && !mine) {
        throw new Error(
          "This chat is claimed by someone else. Ask an Admin to force-claim if needed.",
        );
      }
    }

    const rows = await ctx.db
      .query("supportMessages")
      .withIndex("by_thread_createdAt", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .take(200);

    const out = [];
    for (const row of rows) {
      if (!isStaff && row.visibility === "internal") continue;
      const author = await ctx.db.get(row.authorUserId);
      out.push({
        _id: row._id,
        threadId: row.threadId,
        authorUserId: row.authorUserId,
        authorRole: row.authorRole,
        authorName: author?.userName ?? "Unknown",
        authorProfilePic: author?.userProfilePic ?? null,
        body: row.body,
        visibility: row.visibility,
        kind: row.kind ?? "chat",
        createdAt: row.createdAt,
      });
    }
    return out;
  },
});

/** Merchant or assigned staff/admin: send a message. */
export const sendMessage = mutation({
  args: {
    threadId: v.id("supportThreads"),
    body: v.string(),
    visibility: v.optional(
      v.union(v.literal("customer"), v.literal("internal")),
    ),
  },
  returns: v.id("supportMessages"),
  handler: async (ctx, args) => {
    const me = await requireSupportParticipant(ctx);
    const thread = await loadThreadOrThrow(ctx, args.threadId);
    const role = normalizeRole(me.role);
    const isStaff = role === "staff" || role === "admin";
    const visibility = args.visibility ?? "customer";

    if (visibility === "internal" && !isStaff) {
      throw new Error("Only staff can post internal notes.");
    }

    if (!isStaff) {
      if (thread.userId !== me._id) throw new Error("Not authorized");
      if (thread.status === "closed") {
        throw new Error(
          "This conversation was closed. Start a new one if you still need help.",
        );
      }
      await consumeRateLimit(ctx, `support:msg:${me._id}`, 20, 60_000);
    } else {
      if (role === "staff") {
        if (thread.assigneeId !== me._id) {
          throw new Error("Claim this chat before replying.");
        }
      }
      // Admin can reply if assignee or after force-claim; require assignee for admin too unless open
      if (role === "admin" && thread.assigneeId != null && thread.assigneeId !== me._id) {
        throw new Error("Force-claim this chat before replying.");
      }
      if (thread.assigneeId == null) {
        throw new Error("Claim this chat before replying.");
      }
      await consumeRateLimit(ctx, `support:msg:staff:${me._id}`, 60, 60_000);
    }

    if (thread.status === "closed" && isStaff && visibility === "customer") {
      throw new Error("Re-open or leave closed; can’t message a closed chat.");
    }

    const body = trimBody(args.body);
    const now = Date.now();
    const authorRole: AppRole = isStaff ? role : "user";

    const messageId = await ctx.db.insert("supportMessages", {
      threadId: thread._id,
      authorUserId: me._id,
      authorRole,
      body,
      visibility,
      kind: "chat",
      createdAt: now,
    });

    // Internal notes don’t change customer-facing status
    if (visibility === "internal") {
      await ctx.db.patch(thread._id, { lastMessageAt: now });
      return messageId;
    }

    const patch: Partial<Doc<"supportThreads">> = {
      lastMessageAt: now,
    };

    if (!isStaff) {
      patch.lastCustomerMessageAt = now;
      patch.customerLastReadAt = now;
      if (thread.status === "resolved") {
        // Should use reopenThread — but if they send, treat as waiting_staff and clear assignee per plan
        patch.status = "waiting_staff";
        patch.assigneeId = undefined;
        patch.claimedAt = undefined;
      } else if (
        thread.status === "waiting_customer" ||
        thread.status === "claimed" ||
        thread.status === "open"
      ) {
        patch.status = thread.assigneeId ? "waiting_staff" : "open";
      } else if (thread.status === "waiting_staff") {
        // stay waiting_staff
      }
    } else {
      patch.lastStaffMessageAt = now;
      if (
        thread.status !== "resolved" &&
        thread.status !== "closed"
      ) {
        patch.status = "waiting_customer";
      }
    }

    await ctx.db.patch(thread._id, patch);
    return messageId;
  },
});

/** Merchant: reopen a resolved thread (clears assignee → unclaimed queue). */
export const reopenThread = mutation({
  args: { threadId: v.id("supportThreads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = await requireSupportParticipant(ctx);
    const thread = await loadThreadOrThrow(ctx, args.threadId);
    if (thread.userId !== me._id) throw new Error("Not authorized");
    if (thread.status === "closed") {
      throw new Error(
        "This conversation was closed. Please start a new chat.",
      );
    }
    if (thread.status !== "resolved") {
      throw new Error("Only resolved chats can be reopened.");
    }

    const now = Date.now();
    await ctx.db.patch(thread._id, {
      status: "waiting_staff",
      assigneeId: undefined,
      claimedAt: undefined,
      lastMessageAt: now,
    });
    await recordSupportEvent(ctx, {
      threadId: thread._id,
      actorUserId: me._id,
      type: "reopen",
    });
    return null;
  },
});

/** Staff inbox: unclaimed | mine | escalated (admin) | all (admin). */
export const listInbox = query({
  args: {
    filter: v.union(
      v.literal("unclaimed"),
      v.literal("mine"),
      v.literal("escalated"),
      v.literal("all"),
    ),
  },
  returns: v.array(threadSummaryValidator),
  handler: async (ctx, args) => {
    const me = await requireStaff(ctx);
    const role = normalizeRole(me.role);

    if (
      (args.filter === "all" || args.filter === "escalated") &&
      role !== "admin"
    ) {
      throw new Error("Only Admins can view that inbox.");
    }

    let rows: Doc<"supportThreads">[] = [];

    if (args.filter === "mine") {
      rows = await ctx.db
        .query("supportThreads")
        .withIndex("by_assignee_lastMessageAt", (q) =>
          q.eq("assigneeId", me._id),
        )
        .order("desc")
        .take(80);
      rows = rows.filter(
        (t) => t.status !== "closed" && t.status !== "resolved",
      );
    } else if (args.filter === "escalated") {
      const openRows = await ctx.db
        .query("supportThreads")
        .withIndex("by_status_lastMessageAt", (q) => q.eq("status", "open"))
        .order("desc")
        .take(80);
      const waiting = await ctx.db
        .query("supportThreads")
        .withIndex("by_status_lastMessageAt", (q) =>
          q.eq("status", "waiting_staff"),
        )
        .order("desc")
        .take(80);
      rows = [...openRows, ...waiting].filter(
        (t) => t.assigneeId == null && t.escalatedAt != null,
      );
      rows.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
      rows = rows.slice(0, 80);
    } else if (args.filter === "unclaimed") {
      // open + waiting_staff with no assignee; Staff skip escalated (Admin queue)
      const openRows = await ctx.db
        .query("supportThreads")
        .withIndex("by_status_lastMessageAt", (q) => q.eq("status", "open"))
        .order("desc")
        .take(60);
      const waiting = await ctx.db
        .query("supportThreads")
        .withIndex("by_status_lastMessageAt", (q) =>
          q.eq("status", "waiting_staff"),
        )
        .order("desc")
        .take(60);
      rows = [...openRows, ...waiting.filter((t) => t.assigneeId == null)];
      if (role !== "admin") {
        rows = rows.filter((t) => t.escalatedAt == null);
      } else {
        // Admins still see non-escalated in Waiting; escalated has its own tab
        rows = rows.filter((t) => t.escalatedAt == null);
      }
      rows.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
      rows = rows.slice(0, 80);
    } else {
      // admin all: recent non-closed
      const statuses = [
        "open",
        "claimed",
        "waiting_customer",
        "waiting_staff",
        "resolved",
      ] as const;
      const collected: Doc<"supportThreads">[] = [];
      for (const status of statuses) {
        const part = await ctx.db
          .query("supportThreads")
          .withIndex("by_status_lastMessageAt", (q) => q.eq("status", status))
          .order("desc")
          .take(40);
        collected.push(...part);
      }
      collected.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
      rows = collected.slice(0, 100);
    }

    const out = [];
    for (const row of rows) {
      out.push(await summarizeThread(ctx, row));
    }
    return out;
  },
});

export const getThread = query({
  args: { threadId: v.id("supportThreads") },
  returns: v.union(threadSummaryValidator, v.null()),
  handler: async (ctx, args) => {
    const me = await requireSupportParticipant(ctx);
    const thread = await ctx.db.get(args.threadId);
    if (!thread) return null;
    const role = normalizeRole(me.role);
    const isStaff = role === "staff" || role === "admin";
    if (!isStaff && thread.userId !== me._id) return null;
    if (isStaff && role === "staff") {
      const unclaimed =
        thread.assigneeId == null &&
        (thread.status === "open" || thread.status === "waiting_staff");
      const mine = thread.assigneeId === me._id;
      if (!unclaimed && !mine) {
        return null;
      }
    }
    return await summarizeThread(ctx, thread);
  },
});

export const claimThread = mutation({
  args: { threadId: v.id("supportThreads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = await requireStaff(ctx);
    const thread = await loadThreadOrThrow(ctx, args.threadId);
    const role = normalizeRole(me.role);

    if (thread.status === "closed") {
      throw new Error("This chat is closed.");
    }
    if (thread.escalatedAt != null && role !== "admin") {
      throw new Error(
        "This chat was handed to Admins. An Admin needs to claim it.",
      );
    }
    if (thread.assigneeId != null && thread.assigneeId !== me._id) {
      throw new Error(
        "Already claimed by someone else. Ask an Admin to force-claim if needed.",
      );
    }
    if (thread.assigneeId === me._id) return null;

    const wasEscalated = thread.escalatedAt != null;
    const now = Date.now();
    await ctx.db.patch(thread._id, {
      assigneeId: me._id,
      claimedAt: now,
      escalatedAt: undefined,
      escalatedBy: undefined,
      status:
        thread.status === "open" || thread.status === "waiting_staff"
          ? "claimed"
          : thread.status === "resolved"
            ? "claimed"
            : thread.status,
      lastMessageAt: now,
    });

    if (wasEscalated && role === "admin") {
      await insertSystemNote(ctx, {
        threadId: thread._id,
        authorUserId: me._id,
        authorRole: role,
        body: "An Admin joined your chat and will help from here.",
        now,
      });
    }

    await recordSupportEvent(ctx, {
      threadId: thread._id,
      actorUserId: me._id,
      type: "claim",
    });
    await writeAuditLog(ctx, {
      actorUserId: me._id,
      targetUserId: thread.userId,
      action: "support_claim",
      reason: `Claimed support chat: ${thread.subject}`,
      metadata: { threadId: thread._id },
    });
    return null;
  },
});

export const releaseThread = mutation({
  args: { threadId: v.id("supportThreads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = await requireStaff(ctx);
    const thread = await loadThreadOrThrow(ctx, args.threadId);
    const role = normalizeRole(me.role);

    if (thread.assigneeId !== me._id && role !== "admin") {
      throw new Error("You can only release chats you claimed.");
    }
    if (thread.assigneeId == null) return null;

    const now = Date.now();
    await ctx.db.patch(thread._id, {
      assigneeId: undefined,
      claimedAt: undefined,
      status: "open",
      lastMessageAt: now,
    });

    await recordSupportEvent(ctx, {
      threadId: thread._id,
      actorUserId: me._id,
      type: "release",
    });
    await writeAuditLog(ctx, {
      actorUserId: me._id,
      targetUserId: thread.userId,
      action: "support_release",
      reason: `Released support chat: ${thread.subject}`,
      metadata: { threadId: thread._id },
    });
    return null;
  },
});

/**
 * Staff (or Admin) hands a stuck chat to Admins.
 * Clears assignee, marks escalated, leaves an internal note with the reason.
 */
export const escalateThread = mutation({
  args: {
    threadId: v.id("supportThreads"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = await requireStaff(ctx);
    const thread = await loadThreadOrThrow(ctx, args.threadId);
    const role = normalizeRole(me.role);
    const reason = args.reason.trim();
    if (reason.length < 8) {
      throw new Error(
        "Say why you need an Admin (at least 8 characters).",
      );
    }

    if (thread.status === "closed") {
      throw new Error("This chat is closed.");
    }
    if (thread.assigneeId !== me._id && role !== "admin") {
      throw new Error("Claim this chat before asking an Admin.");
    }

    const now = Date.now();
    await ctx.db.patch(thread._id, {
      assigneeId: undefined,
      claimedAt: undefined,
      escalatedAt: now,
      escalatedBy: me._id,
      status: "open",
      lastMessageAt: now,
      lastStaffMessageAt: now,
    });

    await ctx.db.insert("supportMessages", {
      threadId: thread._id,
      authorUserId: me._id,
      authorRole: role,
      body: `Handed to Admin: ${reason}`,
      visibility: "internal",
      kind: "chat",
      createdAt: now,
    });

    await insertSystemNote(ctx, {
      threadId: thread._id,
      authorUserId: me._id,
      authorRole: role,
      body: "Your chat was handed to an Admin. Someone from the Admin team will take it from here.",
      now: now + 1,
    });

    await recordSupportEvent(ctx, {
      threadId: thread._id,
      actorUserId: me._id,
      type: "escalate",
      meta: { reason },
    });
    await writeAuditLog(ctx, {
      actorUserId: me._id,
      targetUserId: thread.userId,
      action: "support_escalate",
      reason,
      metadata: { threadId: thread._id },
    });
    return null;
  },
});

export const forceClaimThread = mutation({
  args: {
    threadId: v.id("supportThreads"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const thread = await loadThreadOrThrow(ctx, args.threadId);
    if (thread.status === "closed") {
      throw new Error("This chat is closed.");
    }
    const reason = args.reason.trim();
    if (reason.length < 8) {
      throw new Error("Leave a short reason (at least 8 characters).");
    }

    const previousAssignee = thread.assigneeId;
    const wasEscalated = thread.escalatedAt != null;
    const now = Date.now();
    await ctx.db.patch(thread._id, {
      assigneeId: me._id,
      claimedAt: now,
      escalatedAt: undefined,
      escalatedBy: undefined,
      status: "claimed",
      lastMessageAt: now,
    });

    if (wasEscalated) {
      await insertSystemNote(ctx, {
        threadId: thread._id,
        authorUserId: me._id,
        authorRole: "admin",
        body: "An Admin joined your chat and will help from here.",
        now,
      });
    }

    await recordSupportEvent(ctx, {
      threadId: thread._id,
      actorUserId: me._id,
      type: "force_claim",
      meta: { previousAssignee, reason },
    });
    await writeAuditLog(ctx, {
      actorUserId: me._id,
      targetUserId: thread.userId,
      action: "support_force_claim",
      reason,
      metadata: { threadId: thread._id, previousAssignee },
    });
    return null;
  },
});

export const resolveThread = mutation({
  args: { threadId: v.id("supportThreads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = await requireStaff(ctx);
    const thread = await loadThreadOrThrow(ctx, args.threadId);
    const role = normalizeRole(me.role);

    if (thread.assigneeId !== me._id && role !== "admin") {
      throw new Error("Claim this chat before resolving.");
    }
    if (thread.status === "closed") {
      throw new Error("This chat is already closed.");
    }

    const now = Date.now();
    await ctx.db.patch(thread._id, {
      status: "resolved",
      lastMessageAt: now,
    });
    await recordSupportEvent(ctx, {
      threadId: thread._id,
      actorUserId: me._id,
      type: "resolve",
    });
    await writeAuditLog(ctx, {
      actorUserId: me._id,
      targetUserId: thread.userId,
      action: "support_resolve",
      reason: `Resolved support chat: ${thread.subject}`,
      metadata: { threadId: thread._id },
    });
    return null;
  },
});

export const closeThread = mutation({
  args: {
    threadId: v.id("supportThreads"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = await requireStaff(ctx);
    const thread = await loadThreadOrThrow(ctx, args.threadId);
    const role = normalizeRole(me.role);
    const reason = args.reason.trim();
    if (reason.length < 8) {
      throw new Error("Leave a reason for closing (at least 8 characters).");
    }

    if (role !== "admin") {
      if (thread.assigneeId !== me._id && thread.status !== "open") {
        throw new Error("Claim this chat before closing, or ask an Admin.");
      }
    }

    const now = Date.now();
    await ctx.db.patch(thread._id, {
      status: "closed",
      lastMessageAt: now,
    });
    await recordSupportEvent(ctx, {
      threadId: thread._id,
      actorUserId: me._id,
      type: "close",
      meta: { reason },
    });
    await writeAuditLog(ctx, {
      actorUserId: me._id,
      targetUserId: thread.userId,
      action: "support_close",
      reason,
      metadata: { threadId: thread._id },
    });
    return null;
  },
});

/** Unclaimed count for staff badge (excludes escalated — those are Admin-only). */
export const unclaimedCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireStaff(ctx);
    const openRows = await ctx.db
      .query("supportThreads")
      .withIndex("by_status_lastMessageAt", (q) => q.eq("status", "open"))
      .take(100);
    const waiting = await ctx.db
      .query("supportThreads")
      .withIndex("by_status_lastMessageAt", (q) =>
        q.eq("status", "waiting_staff"),
      )
      .take(100);
    const pool = [
      ...openRows,
      ...waiting.filter((t) => t.assigneeId == null),
    ].filter((t) => t.escalatedAt == null);
    return pool.length;
  },
});

/** Escalated chats waiting for an Admin. */
export const escalatedCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const openRows = await ctx.db
      .query("supportThreads")
      .withIndex("by_status_lastMessageAt", (q) => q.eq("status", "open"))
      .take(100);
    const waiting = await ctx.db
      .query("supportThreads")
      .withIndex("by_status_lastMessageAt", (q) =>
        q.eq("status", "waiting_staff"),
      )
      .take(100);
    return [...openRows, ...waiting].filter(
      (t) => t.assigneeId == null && t.escalatedAt != null,
    ).length;
  },
});

/**
 * Live merchant diagnostics for Staff inbox — no Give Access required.
 * Read-only snapshot for triage.
 */
export const getMerchantSupportSnapshot = query({
  args: { merchantUserId: v.id("users") },
  returns: v.object({
    merchantName: v.string(),
    merchantRole: appRoleValidator,
    accountStatus: v.union(
      v.literal("active"),
      v.literal("frozen"),
      v.literal("disabled"),
    ),
    frozenReason: v.union(v.string(), v.null()),
    storeLinked: v.boolean(),
    storeName: v.union(v.string(), v.null()),
    storeId: v.union(v.string(), v.null()),
    testMode: v.union(v.boolean(), v.null()),
    connectionSoftDeleted: v.boolean(),
    openFailureCount: v.number(),
    openAtRiskCents: v.number(),
    openCurrency: v.union(v.string(), v.null()),
    webhookLastReceivedAt: v.union(v.number(), v.null()),
    webhookLastEventName: v.union(v.string(), v.null()),
    hasRecoverySettings: v.boolean(),
    recoveryTemplateId: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const merchant = await ctx.db.get(args.merchantUserId);
    if (!merchant) {
      return {
        merchantName: "Unknown",
        merchantRole: "user" as const,
        accountStatus: "active" as const,
        frozenReason: null,
        storeLinked: false,
        storeName: null,
        storeId: null,
        testMode: null,
        connectionSoftDeleted: false,
        openFailureCount: 0,
        openAtRiskCents: 0,
        openCurrency: null,
        webhookLastReceivedAt: null,
        webhookLastEventName: null,
        hasRecoverySettings: false,
        recoveryTemplateId: null,
      };
    }

    const connection = await ctx.db
      .query("lemonConnections")
      .withIndex("by_user", (q) => q.eq("userId", merchant._id))
      .unique();
    const live =
      connection && !isSoftDeleted(connection) ? connection : null;

    const openRows = (
      await ctx.db
        .query("failedPayments")
        .withIndex("by_user_status_failedAt", (q) =>
          q.eq("userId", merchant._id).eq("status", "open"),
        )
        .order("desc")
        .take(100)
    ).filter((r) => r.deletedAt == null);

    let openAtRiskCents = 0;
    let openCurrency: string | null = null;
    for (const row of openRows) {
      openAtRiskCents += row.amountCents;
      if (!openCurrency) openCurrency = row.currency;
    }

    let webhookLastReceivedAt: number | null = null;
    let webhookLastEventName: string | null = null;
    if (live) {
      const storeIds = new Set<string>([live.storeId]);
      for (const s of live.stores ?? []) storeIds.add(s.id);
      for (const storeId of storeIds) {
        const row = await ctx.db
          .query("lemonWebhookEvents")
          .withIndex("by_store_received", (q) => q.eq("storeId", storeId))
          .order("desc")
          .first();
        if (!row) continue;
        if (
          webhookLastReceivedAt == null ||
          row.receivedAt > webhookLastReceivedAt
        ) {
          webhookLastReceivedAt = row.receivedAt;
          webhookLastEventName = row.eventName;
        }
      }
    }

    const settings = await ctx.db
      .query("recoverySettings")
      .withIndex("by_user", (q) => q.eq("userId", merchant._id))
      .unique();
    const settingsLive =
      settings && !isSoftDeleted(settings) ? settings : null;

    return {
      merchantName: merchant.userName,
      merchantRole: normalizeRole(merchant.role),
      accountStatus: accountStatusOf(merchant),
      frozenReason: merchant.frozenReason ?? null,
      storeLinked: live != null,
      storeName: live?.storeName ?? null,
      storeId: live?.storeId ?? null,
      testMode: live?.testMode ?? null,
      connectionSoftDeleted: Boolean(
        connection && isSoftDeleted(connection),
      ),
      openFailureCount: openRows.length,
      openAtRiskCents,
      openCurrency,
      webhookLastReceivedAt,
      webhookLastEventName,
      hasRecoverySettings: settingsLive != null,
      recoveryTemplateId: settingsLive?.templateId ?? null,
    };
  },
});
