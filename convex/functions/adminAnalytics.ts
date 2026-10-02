import { v } from "convex/values";
import { query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { requireAdmin } from "../lib/admin";
import {
  layoutPresetIdValidator,
  type LayoutPresetId,
} from "../lib/emailTheme";
import {
  ADMIN_ANALYTICS_SCAN_LIMIT,
  ANALYTICS_TIMEZONE,
  PRO_UPGRADE_AUDIT_ACTIONS,
  SET_A_KIT_IDS,
  allTimeSeriesStartMs,
  assertNowMs,
  assignedKitIdOrNull,
  isCountableRecovery,
  rowMatchesKit,
  metricPeriodsFromEvents,
  recoveryAttributedDay,
  type AnalyticsEvent,
  type MetricPeriods,
  type RecoveryDayStep,
} from "../lib/adminAnalytics";

const seriesPointValidator = v.object({
  t: v.number(),
  label: v.string(),
  value: v.number(),
});

const periodTotalsValidator = v.object({
  total: v.number(),
  series: v.array(seriesPointValidator),
});

const metricPeriodsValidator = v.object({
  allTime: periodTotalsValidator,
  thisYear: periodTotalsValidator,
  lastYear: periodTotalsValidator,
  thisMonth: periodTotalsValidator,
  lastMonth: periodTotalsValidator,
});

const kitListRowValidator = v.object({
  kitId: layoutPresetIdValidator,
  recoveries: v.number(),
  recoveredCents: v.number(),
  day0: v.number(),
  day2: v.number(),
  day5: v.number(),
  unattributed: v.number(),
});

function emptyDays(): Record<RecoveryDayStep | "unattributed", number> {
  return { day0: 0, day2: 0, day5: 0, unattributed: 0 };
}

const AUDIT_SCAN_LIMIT = Math.floor(ADMIN_ANALYTICS_SCAN_LIMIT / 2);

async function loadEmailSendEvents(
  ctx: QueryCtx,
  nowMs: number,
): Promise<{ events: AnalyticsEvent[]; truncated: boolean }> {
  const startMs = allTimeSeriesStartMs(nowMs);
  const rows = await ctx.db
    .query("emailSends")
    .withIndex("by_sentAt", (q) =>
      q.gte("sentAt", startMs).lt("sentAt", nowMs),
    )
    .order("desc")
    .take(ADMIN_ANALYTICS_SCAN_LIMIT);
  return {
    events: rows.map((row) => ({ at: row.sentAt })),
    truncated: rows.length >= ADMIN_ANALYTICS_SCAN_LIMIT,
  };
}

async function loadRecoveredPayments(
  ctx: QueryCtx,
  nowMs: number,
): Promise<{ rows: Doc<"failedPayments">[]; truncated: boolean }> {
  const startMs = allTimeSeriesStartMs(nowMs);
  const rows = await ctx.db
    .query("failedPayments")
    .withIndex("by_status_recoveredAt", (q) =>
      q.eq("status", "recovered").gte("recoveredAt", startMs).lt("recoveredAt", nowMs),
    )
    .order("desc")
    .take(ADMIN_ANALYTICS_SCAN_LIMIT);
  const countable = rows.filter((row) => isCountableRecovery(row));
  return {
    rows: countable,
    truncated: rows.length >= ADMIN_ANALYTICS_SCAN_LIMIT,
  };
}

async function loadRecoveredPaymentsForKit(
  ctx: QueryCtx,
  kitId: LayoutPresetId,
  nowMs: number,
): Promise<{ rows: Doc<"failedPayments">[]; truncated: boolean }> {
  // Same recovered set as listTemplates, then map leftover ids → Set A.
  // A kit-only index eq(assignedKitId, Set A id) would miss sonos/avocode/…
  const recovered = await loadRecoveredPayments(ctx, nowMs);
  return {
    rows: recovered.rows.filter((row) =>
      rowMatchesKit(row.assignedKitId, kitId),
    ),
    truncated: recovered.truncated,
  };
}

async function loadSignupEvents(
  ctx: QueryCtx,
  nowMs: number,
): Promise<{ events: AnalyticsEvent[]; truncated: boolean }> {
  const startMs = allTimeSeriesStartMs(nowMs);
  const rows = await ctx.db
    .query("users")
    .withIndex("by_creation_time", (q) =>
      q.gte("_creationTime", startMs).lt("_creationTime", nowMs),
    )
    .order("desc")
    .take(ADMIN_ANALYTICS_SCAN_LIMIT);
  return {
    events: rows.map((row) => ({ at: row._creationTime })),
    truncated: rows.length >= ADMIN_ANALYTICS_SCAN_LIMIT,
  };
}

async function loadProUpgradeEvents(
  ctx: QueryCtx,
  nowMs: number,
): Promise<{ events: AnalyticsEvent[]; truncated: boolean }> {
  const startMs = allTimeSeriesStartMs(nowMs);
  const events: AnalyticsEvent[] = [];
  let truncated = false;
  for (const action of PRO_UPGRADE_AUDIT_ACTIONS) {
    const rows = await ctx.db
      .query("auditLogs")
      .withIndex("by_action_createdAt", (q) =>
        q.eq("action", action).gte("createdAt", startMs).lt("createdAt", nowMs),
      )
      .order("desc")
      .take(AUDIT_SCAN_LIMIT);
    if (rows.length >= AUDIT_SCAN_LIMIT) truncated = true;
    for (const row of rows) {
      events.push({ at: row.createdAt });
    }
  }
  return { events, truncated };
}

function recoveryEvents(rows: readonly Doc<"failedPayments">[]): AnalyticsEvent[] {
  return rows.flatMap((row) =>
    row.recoveredAt != null ? [{ at: row.recoveredAt }] : [],
  );
}

function recoveredCentsEvents(
  rows: readonly Doc<"failedPayments">[],
): AnalyticsEvent[] {
  return rows.flatMap((row) =>
    row.recoveredAt != null
      ? [{ at: row.recoveredAt, value: row.amountCents }]
      : [],
  );
}

function currenciesMixed(rows: readonly Doc<"failedPayments">[]): boolean {
  const codes = new Set(
    rows.map((row) => row.currency.trim().toUpperCase()).filter(Boolean),
  );
  return codes.size > 1;
}

function kitRowsFromRecoveries(rows: readonly Doc<"failedPayments">[]) {
  const byKit = new Map(
    SET_A_KIT_IDS.map((kitId) => [
      kitId,
      { recoveries: 0, recoveredCents: 0, ...emptyDays() },
    ]),
  );
  for (const row of rows) {
    const kitId = assignedKitIdOrNull(row.assignedKitId);
    if (!kitId) continue;
    const bucket = byKit.get(kitId);
    if (!bucket) continue;
    bucket.recoveries += 1;
    bucket.recoveredCents += row.amountCents;
    const day = recoveryAttributedDay(row);
    if (day === null) bucket.unattributed += 1;
    else bucket[day] += 1;
  }
  return SET_A_KIT_IDS.map((kitId) => {
    const bucket = byKit.get(kitId)!;
    return {
      kitId,
      recoveries: bucket.recoveries,
      recoveredCents: bucket.recoveredCents,
      day0: bucket.day0,
      day2: bucket.day2,
      day5: bucket.day5,
      unattributed: bucket.unattributed,
    };
  });
}

function dayEvents(
  rows: readonly Doc<"failedPayments">[],
  day: RecoveryDayStep,
): AnalyticsEvent[] {
  return rows.flatMap((row) => {
    if (recoveryAttributedDay(row) !== day || row.recoveredAt == null) {
      return [];
    }
    return [{ at: row.recoveredAt }];
  });
}

/**
 * Platform-wide overview (all merchants). Admin only.
 * Totals + UTC series: monthly for all-time/YoY, daily for MoM.
 *
 * Reads: one newest-first index range per source, capped at
 * ADMIN_ANALYTICS_SCAN_LIMIT (800) from the trailing 5y window
 * (~3.2k docs worst case, not 8k×4). Jules shapes unchanged.
 */
export const getOverview = query({
  args: { nowMs: v.number() },
  returns: v.object({
    timezone: v.literal("UTC"),
    asOfMs: v.number(),
    truncated: v.boolean(),
    recoveredCurrencyMixed: v.boolean(),
    emailsSent: metricPeriodsValidator,
    recoveries: metricPeriodsValidator,
    recoveredCents: metricPeriodsValidator,
    signups: metricPeriodsValidator,
    proUpgrades: metricPeriodsValidator,
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const nowMs = assertNowMs(args.nowMs);
    const sends = await loadEmailSendEvents(ctx, nowMs);
    const recovered = await loadRecoveredPayments(ctx, nowMs);
    const signups = await loadSignupEvents(ctx, nowMs);
    const upgrades = await loadProUpgradeEvents(ctx, nowMs);
    return {
      timezone: ANALYTICS_TIMEZONE,
      asOfMs: nowMs,
      truncated:
        sends.truncated ||
        recovered.truncated ||
        signups.truncated ||
        upgrades.truncated,
      recoveredCurrencyMixed: currenciesMixed(recovered.rows),
      emailsSent: metricPeriodsFromEvents(sends.events, nowMs, "count"),
      recoveries: metricPeriodsFromEvents(
        recoveryEvents(recovered.rows),
        nowMs,
        "count",
      ),
      recoveredCents: metricPeriodsFromEvents(
        recoveredCentsEvents(recovered.rows),
        nowMs,
        "sum",
      ),
      signups: metricPeriodsFromEvents(signups.events, nowMs, "count"),
      proUpgrades: metricPeriodsFromEvents(upgrades.events, nowMs, "count"),
    };
  },
});

/**
 * Set A kit recovery rollup (platform-wide, trailing 5y window). Admin only.
 * Period charts live on getTemplateDetail. Legacy assignedKitId values
 * map onto Set A the same way as getTemplateDetail.
 */
export const listTemplates = query({
  args: { nowMs: v.number() },
  returns: v.object({
    timezone: v.literal("UTC"),
    asOfMs: v.number(),
    truncated: v.boolean(),
    kits: v.array(kitListRowValidator),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const nowMs = assertNowMs(args.nowMs);
    const recovered = await loadRecoveredPayments(ctx, nowMs);
    return {
      timezone: ANALYTICS_TIMEZONE,
      asOfMs: nowMs,
      truncated: recovered.truncated,
      kits: kitRowsFromRecoveries(recovered.rows),
    };
  },
});

/**
 * One Set A kit: recovery + $ periods, plus Day 0/2/5 period charts.
 */
export const getTemplateDetail = query({
  args: {
    kitId: layoutPresetIdValidator,
    nowMs: v.number(),
  },
  returns: v.object({
    timezone: v.literal("UTC"),
    asOfMs: v.number(),
    kitId: layoutPresetIdValidator,
    truncated: v.boolean(),
    recoveredCurrencyMixed: v.boolean(),
    recoveries: metricPeriodsValidator,
    recoveredCents: metricPeriodsValidator,
    day0: metricPeriodsValidator,
    day2: metricPeriodsValidator,
    day5: metricPeriodsValidator,
    unattributed: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const nowMs = assertNowMs(args.nowMs);
    const recovered = await loadRecoveredPaymentsForKit(ctx, args.kitId, nowMs);
    const rows = recovered.rows;
    return {
      timezone: ANALYTICS_TIMEZONE,
      asOfMs: nowMs,
      kitId: args.kitId,
      truncated: recovered.truncated,
      recoveredCurrencyMixed: currenciesMixed(rows),
      recoveries: metricPeriodsFromEvents(recoveryEvents(rows), nowMs, "count"),
      recoveredCents: metricPeriodsFromEvents(
        recoveredCentsEvents(rows),
        nowMs,
        "sum",
      ),
      day0: metricPeriodsFromEvents(dayEvents(rows, "day0"), nowMs, "count"),
      day2: metricPeriodsFromEvents(dayEvents(rows, "day2"), nowMs, "count"),
      day5: metricPeriodsFromEvents(dayEvents(rows, "day5"), nowMs, "count"),
      unattributed: rows.filter(
        (row) => recoveryAttributedDay(row) === null,
      ).length,
    };
  },
});

export type AdminOverview = {
  timezone: "UTC";
  asOfMs: number;
  truncated: boolean;
  recoveredCurrencyMixed: boolean;
  emailsSent: MetricPeriods;
  recoveries: MetricPeriods;
  recoveredCents: MetricPeriods;
  signups: MetricPeriods;
  proUpgrades: MetricPeriods;
};
