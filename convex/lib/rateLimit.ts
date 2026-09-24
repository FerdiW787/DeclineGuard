import type { MutationCtx } from "../_generated/server";

/**
 * Fixed-window rate limiter backed by `rateLimitBuckets`.
 * Throws a user-facing error when the limit is exceeded.
 */
export async function consumeRateLimit(
  ctx: MutationCtx,
  key: string,
  limit: number,
  windowMs: number,
  message = "Too many requests. Please try again shortly.",
): Promise<void> {
  const now = Date.now();
  const existing = await ctx.db
    .query("rateLimitBuckets")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();

  if (!existing || now - existing.windowStart >= windowMs) {
    if (existing) {
      await ctx.db.patch(existing._id, { windowStart: now, count: 1 });
    } else {
      await ctx.db.insert("rateLimitBuckets", {
        key,
        windowStart: now,
        count: 1,
      });
    }
    return;
  }

  if (existing.count >= limit) {
    throw new Error(message);
  }

  await ctx.db.patch(existing._id, { count: existing.count + 1 });
}
