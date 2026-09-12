import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { v } from "convex/values";

type Ctx = MutationCtx | QueryCtx;

/** Canonical app roles. `standard` is legacy storage for merchants. */
export const roleValidator = v.union(
  v.literal("user"),
  v.literal("staff"),
  v.literal("admin"),
  v.literal("standard"),
);

export type AppRole = "user" | "staff" | "admin";
export type StoredRole = AppRole | "standard";

export function normalizeRole(role: string | undefined | null): AppRole {
  if (role === "admin") return "admin";
  if (role === "staff") return "staff";
  return "user";
}

export function isPrivilegedRole(role: string | undefined | null): boolean {
  const r = normalizeRole(role);
  return r === "staff" || r === "admin";
}

export function canAccessStaffPortal(role: string | undefined | null): boolean {
  return isPrivilegedRole(role);
}

export function canBanAccounts(role: string | undefined | null): boolean {
  return normalizeRole(role) === "admin";
}

/**
 * Staff may only help merchants (user).
 * Admins may act on anyone (including other staff/admins).
 */
export function canActOnTarget(
  actorRole: string | undefined | null,
  targetRole: string | undefined | null,
): boolean {
  if (normalizeRole(actorRole) === "admin") return true;
  if (normalizeRole(actorRole) === "staff") {
    return normalizeRole(targetRole) === "user";
  }
  return false;
}

export function assertCanActOnTarget(
  actor: Doc<"users">,
  target: Doc<"users">,
): void {
  if (canActOnTarget(actor.role, target.role)) return;
  throw new Error(
    "Staff can only help merchants (User role). Ask an Admin to act on Staff or Admin accounts.",
  );
}

async function loadCurrentUser(ctx: Ctx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
    .unique();

  if (!user) throw new Error("User not found");
  return user;
}

/** Staff or Admin — can open the recovery console. */
export async function requireStaff(ctx: Ctx): Promise<Doc<"users">> {
  const user = await loadCurrentUser(ctx);
  if (!canAccessStaffPortal(user.role)) {
    throw new Error("Staff access required");
  }
  return user;
}

/** Admin only — ban / unban / act on privileged accounts. */
export async function requireAdmin(ctx: Ctx): Promise<Doc<"users">> {
  const user = await loadCurrentUser(ctx);
  if (normalizeRole(user.role) !== "admin") {
    throw new Error("Admin access required");
  }
  return user;
}

export function requireActionReason(reason: string | undefined): string {
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

export async function writeAuditLog(
  ctx: MutationCtx,
  args: {
    actorUserId: Id<"users"> | null;
    targetUserId?: Id<"users">;
    action: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<Id<"auditLogs">> {
  return await ctx.db.insert("auditLogs", {
    actorUserId: args.actorUserId,
    targetUserId: args.targetUserId,
    action: args.action,
    reason: args.reason,
    metadata: args.metadata ? JSON.stringify(args.metadata) : undefined,
    createdAt: Date.now(),
  });
}

/** Actions an Admin can automatically undo from the live log. */
export function isReversibleAuditAction(action: string): boolean {
  switch (action) {
    case "account_status:frozen":
    case "account_status:disabled":
    case "ban_user":
      return true;
    case "account_status:active":
    case "unban_user":
    case "restore_account":
    case "reclaim_store":
    case "revoke_sessions":
    case "purge_expired_soft_deletes":
    case "audit_revoked":
      return false;
    default:
      return false;
  }
}
