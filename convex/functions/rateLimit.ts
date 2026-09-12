import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { consumeRateLimit } from "../lib/rateLimit";

/** For actions — mutations can call `consumeRateLimit` directly. */
export const consume = internalMutation({
  args: {
    key: v.string(),
    limit: v.number(),
    windowMs: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await consumeRateLimit(ctx, args.key, args.limit, args.windowMs);
    return null;
  },
});
