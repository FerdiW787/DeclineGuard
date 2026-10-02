import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { resolvePlan, type Plan } from "./accountGuard";
import {
  availableDeclineCapacity,
  countsTowardDeclineCapacity,
  declineCapacity,
  releaseSchedulesEmail,
  shouldHoldNewDecline,
  shouldUnholdOnMonthRollover,
  utcMonthStartMs,
} from "./declineCapacity";

const MONTH_SCAN_LIMIT = 4000;

export async function countUsedDeclineCapacity(
  ctx: Pick<MutationCtx, "db">,
  userId: Id<"users">,
  nowMs: number,
): Promise<number> {
  const monthStart = utcMonthStartMs(nowMs);
  const byFailedAt = await ctx.db
    .query("failedPayments")
    .withIndex("by_user_failedAt", (q) =>
      q.eq("userId", userId).gte("failedAt", monthStart),
    )
    .take(MONTH_SCAN_LIMIT);
  const byReleasedAt = await ctx.db
    .query("failedPayments")
    .withIndex("by_user_quotaReleasedAt", (q) =>
      q.eq("userId", userId).gte("quotaReleasedAt", monthStart),
    )
    .take(MONTH_SCAN_LIMIT);

  const seen = new Set<string>();
  let used = 0;
  for (const row of [...byFailedAt, ...byReleasedAt]) {
    if (seen.has(row._id)) continue;
    seen.add(row._id);
    if (countsTowardDeclineCapacity(row, monthStart)) used += 1;
  }
  return used;
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
    await ctx.db.patch(row._id, {
      quotaHeld: false,
      quotaReleasedAt: args.nowMs,
    });
    released.push(row);
  }
  return released;
}

async function scheduleReleasedFailureEmails(
  ctx: MutationCtx,
  released: Array<Doc<"failedPayments">>,
): Promise<Array<Id<"failedPayments">>> {
  const scheduled: Array<Id<"failedPayments">> = [];
  for (const row of released) {
    if (!releaseSchedulesEmail(row.recoveryAction ?? null)) continue;
    await ctx.scheduler.runAfter(
      0,
      internal.functions.recoveryEmails.sendForFailure,
      { failureId: row._id },
    );
    scheduled.push(row._id);
  }
  return scheduled;
}

/**
 * Unhold oldest open held declines up to current capacity and email
 * nudge/push rows. `force` skips the per-month stamp (pack / promote).
 */
export async function releaseHeldAndSchedule(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    plan: Plan;
    packExtra: number | undefined;
    nowMs: number;
    force?: boolean;
  },
): Promise<{
  released: Array<Doc<"failedPayments">>;
  scheduledFailureIds: Array<Id<"failedPayments">>;
}> {
  const empty = {
    released: [] as Array<Doc<"failedPayments">>,
    scheduledFailureIds: [] as Array<Id<"failedPayments">>,
  };
  const user = await ctx.db.get(args.userId);
  if (!user) return empty;
  if (
    !args.force &&
    !shouldUnholdOnMonthRollover({
      lastReleasedMonthStart: user.declineHoldReleasedMonthStart,
      nowMs: args.nowMs,
    })
  ) {
    return empty;
  }

  const released = await releaseHeldDeclinesForCapacity(ctx, {
    userId: args.userId,
    plan: args.plan,
    packExtra: args.packExtra,
    nowMs: args.nowMs,
  });
  const scheduledFailureIds = await scheduleReleasedFailureEmails(ctx, released);
  await ctx.db.patch(args.userId, {
    declineHoldReleasedMonthStart: utcMonthStartMs(args.nowMs),
  });
  return { released, scheduledFailureIds };
}
