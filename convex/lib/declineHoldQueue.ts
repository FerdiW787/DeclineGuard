import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { resolvePlan, type Plan } from "./accountGuard";
import {
  availableDeclineCapacity,
  countsTowardDeclineCapacity,
  declineCapacity,
  shouldHoldNewDecline,
  utcMonthStartMs,
} from "./declineCapacity";

const MONTH_SCAN_LIMIT = 4000;

export async function countUsedDeclineCapacity(
  ctx: Pick<MutationCtx, "db">,
  userId: Id<"users">,
  nowMs: number,
): Promise<number> {
  const monthStart = utcMonthStartMs(nowMs);
  const rows = await ctx.db
    .query("failedPayments")
    .withIndex("by_user_failedAt", (q) =>
      q.eq("userId", userId).gte("failedAt", monthStart),
    )
    .take(MONTH_SCAN_LIMIT);
  return rows.filter(countsTowardDeclineCapacity).length;
}

export async function shouldHoldInsert(
  ctx: Pick<MutationCtx, "db">,
  user: Doc<"users">,
  args: { testMode: boolean; nowMs: number },
): Promise<boolean> {
  if (args.testMode) return false;
  const usedActive = await countUsedDeclineCapacity(ctx, user._id, args.nowMs);
  return shouldHoldNewDecline({
    usedActive,
    capacity: declineCapacity({
      plan: resolvePlan(user),
      packExtra: user.declinePackExtra,
    }),
  });
}

export async function releaseHeldDeclinesForCapacity(
  ctx: Pick<MutationCtx, "db">,
  args: {
    userId: Id<"users">;
    plan: Plan;
    packExtra: number | undefined;
    nowMs: number;
  },
): Promise<Array<Doc<"failedPayments">>> {
  const usedActive = await countUsedDeclineCapacity(
    ctx,
    args.userId,
    args.nowMs,
  );
  const slots = availableDeclineCapacity({
    plan: args.plan,
    packExtra: args.packExtra,
    usedActive,
  });
  if (slots <= 0) return [];

  const held = await ctx.db
    .query("failedPayments")
    .withIndex("by_user_quotaHeld_failedAt", (q) =>
      q.eq("userId", args.userId).eq("quotaHeld", true),
    )
    .order("asc")
    .take(slots + 50);

  const released: Array<Doc<"failedPayments">> = [];
  for (const row of held) {
    if (released.length >= slots) break;
    if (row.deletedAt != null) continue;
    if (row.status !== "open") continue;
    await ctx.db.patch(row._id, { quotaHeld: false });
    released.push(row);
  }
  return released;
}
