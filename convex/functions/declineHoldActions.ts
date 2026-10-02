import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

export const runMonthlyHeldDeclineRelease = internalAction({
  args: {},
  returns: v.object({ users: v.number(), released: v.number() }),
  handler: async (ctx): Promise<{ users: number; released: number }> => {
    const nowMs = Date.now();
    const userIds: Array<Id<"users">> = await ctx.runQuery(
      internal.functions.recoveries.listHeldDeclineUserIds,
      { nowMs },
    );
    let released = 0;
    for (const userId of userIds) {
      const result: { released: number } = await ctx.runMutation(
        internal.functions.recoveries.releaseHeldDeclinesForUser,
        { userId, nowMs },
      );
      released += result.released;
    }
    return { users: userIds.length, released };
  },
});
