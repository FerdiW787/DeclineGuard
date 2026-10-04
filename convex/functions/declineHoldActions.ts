import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

export const runMonthlyHeldDeclineRelease = internalAction({
  args: {},
  returns: v.object({ users: v.number(), released: v.number() }),
  handler: async (ctx): Promise<{ users: number; released: number }> => {
    const nowMs = Date.now();
    const processed = new Set<string>();
    let released = 0;
    let cursor: string | null = null;

    for (;;) {
      const page: {
        userIds: Array<Id<"users">>;
        isDone: boolean;
        continueCursor: string;
      } = await ctx.runQuery(
        internal.functions.recoveries.listHeldDeclineUserPage,
        {
          nowMs,
          paginationOpts: { numItems: 100, cursor },
        },
      );
      for (const userId of page.userIds) {
        if (processed.has(userId)) continue;
        processed.add(userId);
        const result: { released: number } = await ctx.runMutation(
          internal.functions.recoveries.releaseHeldDeclinesForUser,
          { userId, nowMs },
        );
        released += result.released;
      }
      if (page.isDone) break;
      cursor = page.continueCursor;
    }

    return { users: processed.size, released };
  },
});
