"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { createClerkClient } from "@clerk/backend";
import type { Id } from "../_generated/dataModel";

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

/**
 * Model B: Admin stays signed in as Admin. We freeze the merchant, kick
 * their Clerk sessions (best-effort), and return — no Clerk actor tokens.
 * Product APIs resolve to the merchant via requireActiveUser while this
 * takeover is active.
 */
export const startTakeover = action({
  args: {
    takeoverId: v.id("adminTakeovers"),
    reason: v.string(),
  },
  returns: v.object({
    expiresAt: v.number(),
    merchantUserId: v.id("users"),
    takeoverId: v.id("adminTakeovers"),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    expiresAt: number;
    merchantUserId: Id<"users">;
    takeoverId: Id<"adminTakeovers">;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const me = await ctx.runQuery(api.functions.user.getCurrentUser, {});
    if (!me || me.role !== "admin") {
      throw new Error("Admin access required");
    }

    const reason = requireReason(args.reason);

    let prepared: {
      merchantClerkUserId: string;
      adminClerkUserId: string;
      expiresAt: number;
      merchantUserId: typeof me._id;
    };

    try {
      prepared = await ctx.runMutation(
        internal.functions.adminTakeover.beginTakeoverSession,
        {
          takeoverId: args.takeoverId,
          adminUserId: me._id,
          reason,
        },
      );
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }

    // Best-effort session kick — freeze already blocks product writes.
    // Failures here must not leave a half-started actor login (there is none).
    try {
      const client = clerkClient();
      const sessions = await client.sessions.getSessionList({
        userId: prepared.merchantClerkUserId,
        status: "active",
      });
      for (const session of sessions.data) {
        await client.sessions.revokeSession(session.id);
      }
    } catch (err) {
      console.error("Takeover session revoke failed (continuing):", err);
    }

    return {
      expiresAt: prepared.expiresAt,
      merchantUserId: prepared.merchantUserId,
      takeoverId: args.takeoverId,
    };
  },
});
