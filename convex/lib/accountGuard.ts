import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { normalizeRole, writeAuditLog } from "./admin";

type Ctx = MutationCtx | QueryCtx;

/** Must match freeze reason written in beginTakeoverSession. */
export const TAKEOVER_FREEZE_REASON =
  "Admin support takeover in progress — you will regain access when it ends.";

export function accountStatusOf(
  user: Doc<"users">,
): "active" | "frozen" | "disabled" {
  return user.accountStatus ?? "active";
}

export function isAccountActive(user: Doc<"users">): boolean {
  return accountStatusOf(user) === "active";
}

/** Block merchant write actions when frozen or disabled. */
export function assertAccountActive(user: Doc<"users">): void {
  const status = accountStatusOf(user);
  if (status === "frozen") {
    throw new Error(
      "This account is frozen. Contact DeclineGuard support to restore access.",
    );
  }
  if (status === "disabled") {
    throw new Error("This account is disabled. Contact DeclineGuard support.");
  }
}

export async function getAuthenticatedUser(ctx: Ctx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
    .unique();

  if (!user) throw new Error("User not found. Wait for account sync.");
  return user;
}

export async function getAuthenticatedUserOrNull(
  ctx: Ctx,
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
    .unique();
}

/** Active takeover owned by this Admin (not yet expired). */
export async function findActiveTakeoverForAdmin(
  ctx: Ctx,
  adminUserId: Id<"users">,
): Promise<Doc<"adminTakeovers"> | null> {
  const now = Date.now();
  const rows = await ctx.db
    .query("adminTakeovers")
    .withIndex("by_admin_status", (q) =>
      q.eq("adminUserId", adminUserId).eq("status", "active"),
    )
    .take(5);
  return rows.find((r) => r.expiresAt == null || r.expiresAt > now) ?? null;
}

/** Active takeover that has not yet passed expiresAt. */
export async function findActiveTakeoverForMerchant(
  ctx: Ctx,
  merchantUserId: Id<"users">,
): Promise<Doc<"adminTakeovers"> | null> {
  const now = Date.now();
  const rows = await ctx.db
    .query("adminTakeovers")
    .withIndex("by_merchant_status", (q) =>
      q.eq("merchantUserId", merchantUserId).eq("status", "active"),
    )
    .take(5);
  return rows.find((r) => r.expiresAt == null || r.expiresAt > now) ?? null;
}

/**
 * Model B: Admin stays signed in as Admin. While they own an active
 * takeover, product reads/writes resolve to the merchant account.
 */
export async function resolveProductUserOrNull(
  ctx: Ctx,
): Promise<Doc<"users"> | null> {
  const viewer = await getAuthenticatedUserOrNull(ctx);
  if (!viewer) return null;

  if (normalizeRole(viewer.role) === "admin") {
    const takeover = await findActiveTakeoverForAdmin(ctx, viewer._id);
    if (takeover) {
      return await ctx.db.get(takeover.merchantUserId);
    }
  }
  return viewer;
}

/**
 * Shared freeze/disabled gate for product writes.
 * Admin with an active takeover on this merchant may write while frozen.
 */
export async function assertUserAllowsProductWrites(
  ctx: Ctx,
  user: Doc<"users">,
): Promise<void> {
  const status = accountStatusOf(user);
  if (status === "disabled") {
    throw new Error("This account is disabled. Contact DeclineGuard support.");
  }
  if (status !== "frozen") return;

  const viewer = await getAuthenticatedUserOrNull(ctx);
  if (viewer && normalizeRole(viewer.role) === "admin") {
    const takeover = await findActiveTakeoverForAdmin(ctx, viewer._id);
    if (
      takeover &&
      takeover.merchantUserId === user._id &&
      (takeover.expiresAt == null || takeover.expiresAt > Date.now())
    ) {
      return;
    }
  }

  throw new Error(
    "This account is frozen. Contact DeclineGuard support to restore access.",
  );
}

/**
 * Product mutations/actions: returns the merchant when Admin is in
 * takeover mode; otherwise the signed-in user (must not be frozen).
 */
export async function requireActiveUser(ctx: Ctx): Promise<Doc<"users">> {
  const viewer = await getAuthenticatedUser(ctx);

  if (normalizeRole(viewer.role) === "admin") {
    const takeover = await findActiveTakeoverForAdmin(ctx, viewer._id);
    if (takeover) {
      const merchant = await ctx.db.get(takeover.merchantUserId);
      if (!merchant) throw new Error("Takeover merchant not found.");
      if (accountStatusOf(merchant) === "disabled") {
        throw new Error(
          "This account is disabled. Contact DeclineGuard support.",
        );
      }
      return merchant;
    }
  }

  await assertUserAllowsProductWrites(ctx, viewer);
  return viewer;
}

/**
 * When Admin is acting via takeover, attribute the product write to the
 * Admin in auditLogs (DB row still belongs to the merchant).
 */
export async function auditIfTakeoverWrite(
  ctx: MutationCtx,
  productUser: Doc<"users">,
  action: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const viewer = await getAuthenticatedUserOrNull(ctx);
  if (!viewer || viewer._id === productUser._id) return;
  if (normalizeRole(viewer.role) !== "admin") return;

  const takeover = await findActiveTakeoverForAdmin(ctx, viewer._id);
  if (!takeover || takeover.merchantUserId !== productUser._id) return;

  await writeAuditLog(ctx, {
    actorUserId: viewer._id,
    targetUserId: productUser._id,
    action: `takeover_write:${action}`,
    reason: "Admin product write during takeover",
    metadata: {
      takeoverId: takeover._id,
      ...metadata,
    },
  });
}

/** requireActiveUser + takeover write attribution (mutations only). */
export async function requireActiveUserForWrite(
  ctx: MutationCtx,
  writeKind: string,
  metadata?: Record<string, unknown>,
): Promise<Doc<"users">> {
  const user = await requireActiveUser(ctx);
  await auditIfTakeoverWrite(ctx, user, writeKind, metadata);
  return user;
}

/**
 * Signed-in user for support chat / admin portal: always the real
 * Clerk identity (never swapped to merchant).
 */
export async function requireSupportParticipant(
  ctx: Ctx,
): Promise<Doc<"users">> {
  const user = await getAuthenticatedUser(ctx);

  if (accountStatusOf(user) === "disabled") {
    throw new Error("This account is disabled.");
  }

  return user;
}

export function isSoftDeleted(row: { deletedAt?: number }): boolean {
  return row.deletedAt != null;
}

export type Plan = "free" | "pro";

/**
 * Resolve billing plan for a user. Defaults to "free" if unset.
 * Used by fee calculation to determine recovery fee rate.
 */
export function resolvePlan(user: Doc<"users">): Plan {
  return user.plan ?? "free";
}

/** Recovery fee rate by plan: Free = 10%, Pro = 4%. */
export function recoveryFeeRate(plan: Plan): number {
  switch (plan) {
    case "free":
      return 0.1;
    case "pro":
      return 0.04;
    default: {
      const _exhaustive: never = plan;
      return 0.1;
    }
  }
}

/** Integer percent shown to merchants: Free = 10, Pro = 4. */
export function recoveryFeePercent(plan: Plan): 10 | 4 {
  switch (plan) {
    case "free":
      return 10;
    case "pro":
      return 4;
    default: {
      const _exhaustive: never = plan;
      return 10;
    }
  }
}
