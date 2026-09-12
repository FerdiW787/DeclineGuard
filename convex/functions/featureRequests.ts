import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  getAuthenticatedUser,
  getAuthenticatedUserOrNull,
} from "../lib/accountGuard";
import {
  isPrivilegedRole,
  normalizeRole,
  requireAdmin,
  writeAuditLog,
} from "../lib/admin";
import { consumeRateLimit } from "../lib/rateLimit";

const statusValidator = v.union(v.literal("open"), v.literal("added"));

const listItemValidator = v.object({
  _id: v.id("featureRequests"),
  title: v.string(),
  body: v.string(),
  voteCount: v.number(),
  createdAt: v.number(),
  authorName: v.string(),
  status: statusValidator,
  viewerHasVoted: v.boolean(),
  viewerIsAuthor: v.boolean(),
  /** Staff/Admin only — null for everyone else. */
  signedInVoteCount: v.union(v.number(), v.null()),
});

const VOTER_KEY_RE = /^(u|a):[a-zA-Z0-9_-]{8,128}$/;
const MAX_VOTE_COUNT = 5_000;

function assertVoterKeyFormat(voterKey: string): void {
  if (!VOTER_KEY_RE.test(voterKey)) {
    throw new Error("Invalid voter key.");
  }
}

function sanitizeTitle(raw: string): string {
  const title = raw.trim().replace(/\s+/g, " ");
  if (title.length < 8) {
    throw new Error("Title must be at least 8 characters.");
  }
  if (title.length > 80) {
    throw new Error("Title must be at most 80 characters.");
  }
  return title;
}

function sanitizeBody(raw: string): string {
  const body = raw.trim().replace(/\r\n/g, "\n");
  if (body.length === 0) {
    throw new Error("Please add a short description.");
  }
  if (body.length > 1000) {
    throw new Error("Description must be at most 1000 characters.");
  }
  return body;
}

function signedInCountOf(row: Doc<"featureRequests">): number {
  return row.signedInVoteCount ?? 0;
}

async function resolveVoterKey(
  ctx: QueryCtx | MutationCtx,
  clientVoterKey: string,
): Promise<string> {
  assertVoterKeyFormat(clientVoterKey);
  const viewer = await getAuthenticatedUserOrNull(ctx);
  if (viewer) {
    return `u:${viewer._id}`;
  }
  if (!clientVoterKey.startsWith("a:")) {
    throw new Error("Sign in or use a valid anonymous voter key.");
  }
  return clientVoterKey;
}

async function loadVotedSet(
  ctx: QueryCtx | MutationCtx,
  requestIds: Id<"featureRequests">[],
  voterKey: string | null,
): Promise<Set<string>> {
  const voted = new Set<string>();
  if (!voterKey || requestIds.length === 0) return voted;

  await Promise.all(
    requestIds.map(async (requestId) => {
      const vote = await ctx.db
        .query("featureVotes")
        .withIndex("by_request_voter", (q) =>
          q.eq("requestId", requestId).eq("voterKey", voterKey),
        )
        .unique();
      if (vote) voted.add(requestId);
    }),
  );
  return voted;
}

function mapListItem(
  row: Doc<"featureRequests">,
  voted: Set<string>,
  showSignedInBreakdown: boolean,
  viewerUserId: Id<"users"> | null,
): {
  _id: Id<"featureRequests">;
  title: string;
  body: string;
  voteCount: number;
  createdAt: number;
  authorName: string;
  status: "open" | "added";
  viewerHasVoted: boolean;
  viewerIsAuthor: boolean;
  signedInVoteCount: number | null;
} {
  return {
    _id: row._id,
    title: row.title,
    body: row.body,
    voteCount: row.voteCount,
    createdAt: row.createdAt,
    authorName: row.authorName || "Merchant",
    status: row.status,
    viewerHasVoted: voted.has(row._id),
    viewerIsAuthor: viewerUserId != null && row.authorUserId === viewerUserId,
    signedInVoteCount: showSignedInBreakdown
      ? signedInCountOf(row)
      : null,
  };
}

async function deleteVotesForRequest(
  ctx: MutationCtx,
  requestId: Id<"featureRequests">,
): Promise<void> {
  // Bound by MAX_VOTE_COUNT; drain in chunks if needed.
  for (;;) {
    const batch = await ctx.db
      .query("featureVotes")
      .withIndex("by_request_voter", (q) => q.eq("requestId", requestId))
      .take(256);
    if (batch.length === 0) return;
    for (const vote of batch) {
      await ctx.db.delete(vote._id);
    }
  }
}

/** Public board — Open or Added, sorted by votes then newest. */
export const listByStatus = query({
  args: {
    status: statusValidator,
    paginationOpts: paginationOptsValidator,
    voterKey: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(listItemValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const numItems = Math.min(Math.max(1, args.paginationOpts.numItems), 40);
    let voterKey: string | null = null;
    const viewer = await getAuthenticatedUserOrNull(ctx);
    if (viewer) {
      voterKey = `u:${viewer._id}`;
    } else if (args.voterKey) {
      assertVoterKeyFormat(args.voterKey);
      if (args.voterKey.startsWith("a:")) {
        voterKey = args.voterKey;
      }
    }

    const showSignedInBreakdown =
      viewer != null && isPrivilegedRole(viewer.role);

    const result = await ctx.db
      .query("featureRequests")
      .withIndex("by_status_votes_created", (q) =>
        q.eq("status", args.status),
      )
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems,
      });

    const voted = await loadVotedSet(
      ctx,
      result.page.map((row) => row._id),
      voterKey,
    );

    return {
      page: result.page.map((row) =>
        mapListItem(row, voted, showSignedInBreakdown, viewer?._id ?? null),
      ),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    body: v.string(),
  },
  returns: v.id("featureRequests"),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (user.accountStatus === "disabled") {
      throw new Error("This account is disabled.");
    }

    await consumeRateLimit(
      ctx,
      `feature:create:${user._id}`,
      5,
      24 * 60 * 60 * 1000,
    );
    await consumeRateLimit(ctx, "feature:create:burst", 30, 60 * 60 * 1000);

    const title = sanitizeTitle(args.title);
    const body = sanitizeBody(args.body);
    const now = Date.now();
    const authorName = user.userName?.trim() || "Merchant";

    return await ctx.db.insert("featureRequests", {
      authorUserId: user._id,
      authorName,
      title,
      body,
      status: "open",
      voteCount: 0,
      signedInVoteCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const toggleVote = mutation({
  args: {
    requestId: v.id("featureRequests"),
    voterKey: v.string(),
  },
  returns: v.object({
    voteCount: v.number(),
    viewerHasVoted: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const voterKey = await resolveVoterKey(ctx, args.voterKey);
    const isSignedInVote = voterKey.startsWith("u:");

    await consumeRateLimit(ctx, `feature:vote:${voterKey}`, 30, 60_000);
    await consumeRateLimit(
      ctx,
      `feature:vote:req:${args.requestId}`,
      40,
      60_000,
    );
    await consumeRateLimit(ctx, "feature:vote:burst", 80, 60_000);

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Feature request not found.");
    }
    if (request.status === "added") {
      throw new Error("Added features can’t be voted on.");
    }

    const existingRows = await ctx.db
      .query("featureVotes")
      .withIndex("by_request_voter", (q) =>
        q.eq("requestId", args.requestId).eq("voterKey", voterKey),
      )
      .take(5);

    if (existingRows.length > 0) {
      for (const row of existingRows) {
        await ctx.db.delete(row._id);
      }
      const next = Math.max(0, request.voteCount - 1);
      const nextSignedIn = isSignedInVote
        ? Math.max(0, signedInCountOf(request) - 1)
        : signedInCountOf(request);
      await ctx.db.patch(args.requestId, {
        voteCount: next,
        signedInVoteCount: nextSignedIn,
        updatedAt: Date.now(),
      });
      return { voteCount: next, viewerHasVoted: false };
    }

    if (request.voteCount >= MAX_VOTE_COUNT) {
      throw new Error("This idea has reached the vote limit.");
    }

    const voteId = await ctx.db.insert("featureVotes", {
      requestId: args.requestId,
      voterKey,
      createdAt: Date.now(),
    });

    const afterInsert = await ctx.db
      .query("featureVotes")
      .withIndex("by_request_voter", (q) =>
        q.eq("requestId", args.requestId).eq("voterKey", voterKey),
      )
      .take(5);
    afterInsert.sort((a, b) => a._creationTime - b._creationTime);
    const keeper = afterInsert[0];
    for (const row of afterInsert.slice(1)) {
      await ctx.db.delete(row._id);
    }
    if (!keeper || keeper._id !== voteId) {
      const latest = await ctx.db.get(args.requestId);
      return {
        voteCount: latest?.voteCount ?? request.voteCount,
        viewerHasVoted: true,
      };
    }

    const next = Math.min(MAX_VOTE_COUNT, request.voteCount + 1);
    const nextSignedIn = isSignedInVote
      ? Math.min(MAX_VOTE_COUNT, signedInCountOf(request) + 1)
      : signedInCountOf(request);
    await ctx.db.patch(args.requestId, {
      voteCount: next,
      signedInVoteCount: nextSignedIn,
      updatedAt: Date.now(),
    });
    return { voteCount: next, viewerHasVoted: true };
  },
});

export const setStatus = mutation({
  args: {
    requestId: v.id("featureRequests"),
    status: statusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Feature request not found.");
    }
    if (request.status === args.status) {
      return null;
    }

    const now = Date.now();
    if (args.status === "added") {
      await ctx.db.patch(args.requestId, {
        status: "added",
        addedAt: now,
        addedByUserId: admin._id,
        updatedAt: now,
      });
      await writeAuditLog(ctx, {
        actorUserId: admin._id,
        targetUserId: request.authorUserId,
        action: "feature_request:added",
        reason: "Marked feature request as added",
        metadata: { requestId: args.requestId, title: request.title },
      });
    } else {
      await ctx.db.patch(args.requestId, {
        status: "open",
        addedAt: undefined,
        addedByUserId: undefined,
        updatedAt: now,
      });
      await writeAuditLog(ctx, {
        actorUserId: admin._id,
        targetUserId: request.authorUserId,
        action: "feature_request:reopened",
        reason: "Reopened feature request",
        metadata: { requestId: args.requestId, title: request.title },
      });
    }
    return null;
  },
});

/** Author or Admin can permanently delete a request (+ its votes). */
export const remove = mutation({
  args: { requestId: v.id("featureRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Feature request not found.");
    }

    const isAuthor = request.authorUserId === user._id;
    const isAdmin = normalizeRole(user.role) === "admin";
    if (!isAuthor && !isAdmin) {
      throw new Error("Only the author or an Admin can delete this request.");
    }

    await consumeRateLimit(
      ctx,
      `feature:delete:${user._id}`,
      20,
      60 * 60 * 1000,
    );

    await deleteVotesForRequest(ctx, args.requestId);
    await ctx.db.delete(args.requestId);

    await writeAuditLog(ctx, {
      actorUserId: user._id,
      targetUserId: request.authorUserId,
      action: "feature_request:deleted",
      reason: isAdmin && !isAuthor
        ? "Admin deleted feature request"
        : "Author deleted feature request",
      metadata: {
        requestId: args.requestId,
        title: request.title,
        deletedByRole: normalizeRole(user.role),
      },
    });
    return null;
  },
});
