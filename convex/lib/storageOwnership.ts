import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Ensure a storage blob is claimed by `userId`.
 * Unguessable Convex storage IDs + first-claimer ownership blocks IDOR attach.
 */
export async function assertStorageOwnedByUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  storageId: Id<"_storage">,
): Promise<void> {
  const url = await ctx.storage.getUrl(storageId);
  if (!url) {
    throw new Error("Upload not found");
  }

  const existing = await ctx.db
    .query("storageClaims")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .unique();

  if (existing) {
    if (existing.userId !== userId) {
      throw new Error("Unauthorized storage access");
    }
    return;
  }

  await ctx.db.insert("storageClaims", {
    storageId,
    userId,
    createdAt: Date.now(),
  });
}
