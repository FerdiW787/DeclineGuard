/**
 * Platform-admin analytics helpers.
 *
 * Timezone is UTC for every window, bucket, and label. Callers must pass
 * `nowMs` (do not use Date.now() inside Convex queries).
 *
 * Comparable YoY / MoM windows end on the same UTC month/day (clamped to
 * the last day of the shorter month), not a full prior calendar period.
 */

import {
  LAYOUT_PRESET_IDS,
  LEGACY_LAYOUT_PRESET_ID_MAP,
  isLayoutPresetId,
  type LayoutPresetId,
} from "./emailTheme";

export const ANALYTICS_TIMEZONE = "UTC" as const;

/** Trailing allTime series — always includes the current UTC month through nowMs. */
export const ALL_TIME_SERIES_YEARS = 5;

/** Per-table cap. Overview loads ≤4 sources; keep a single query well under Convex reads. */
export const ADMIN_ANALYTICS_SCAN_LIMIT = 800;

const ENUMERATE_BUCKET_GUARD = 240;

/** Soft floor/ceiling for client `nowMs` (not Date.now() — queries stay deterministic). */
export const MIN_NOW_MS = Date.UTC(2018, 0, 1);
export const MAX_NOW_MS = Date.UTC(2100, 0, 1);

export const SET_A_KIT_IDS = LAYOUT_PRESET_IDS;

export const PRO_UPGRADE_AUDIT_ACTIONS = [
  "plan_change:pro",
  "plan_webhook:pro",
] as const;

export type RecoveryDayStep = "day0" | "day2" | "day5";

export type PeriodKey =
  | "allTime"
  | "thisYear"
  | "lastYear"
  | "thisMonth"
  | "lastMonth";

export type SeriesGranularity = "month" | "day";

export type SeriesPoint = {
  t: number;
  label: string;
  value: number;
};

export type PeriodTotals = {
  total: number;
  series: SeriesPoint[];
};

export type MetricPeriods = {
  allTime: PeriodTotals;
  thisYear: PeriodTotals;
  lastYear: PeriodTotals;
  thisMonth: PeriodTotals;
  lastMonth: PeriodTotals;
};

export type AnalyticsEvent = {
  at: number;
  value?: number;
};

export type UtcParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  ms: number;
};

export function emptyPeriodTotals(): PeriodTotals {
  return { total: 0, series: [] };
}

export function emptyMetricPeriods(): MetricPeriods {
  return {
    allTime: emptyPeriodTotals(),
    thisYear: emptyPeriodTotals(),
    lastYear: emptyPeriodTotals(),
    thisMonth: emptyPeriodTotals(),
    lastMonth: emptyPeriodTotals(),
  };
}

export function utcParts(ms: number): UtcParts {
  const d = new Date(ms);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    ms: d.getUTCMilliseconds(),
  };
}

export function utcDateMs(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
): number {
  return Date.UTC(year, month - 1, day, hour, minute, second, ms);
}

export function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function clampUtcDay(year: number, month: number, day: number): number {
  return Math.min(Math.max(1, day), daysInUtcMonth(year, month));
}

/** Shift a UTC instant back one calendar year, clamping 29 Feb → 28 Feb. */
export function minusUtcYear(ms: number): number {
  const p = utcParts(ms);
  const year = p.year - 1;
  return utcDateMs(
    year,
    p.month,
    clampUtcDay(year, p.month, p.day),
    p.hour,
    p.minute,
    p.second,
    p.ms,
  );
}

/** Shift a UTC instant back one calendar month, clamping e.g. 31 → 28/30. */
export function minusUtcMonth(ms: number): number {
  const p = utcParts(ms);
  const month = p.month === 1 ? 12 : p.month - 1;
  const year = p.month === 1 ? p.year - 1 : p.year;
  return utcDateMs(
    year,
    month,
    clampUtcDay(year, month, p.day),
    p.hour,
    p.minute,
    p.second,
    p.ms,
  );
}

export function startOfUtcYear(ms: number): number {
  const p = utcParts(ms);
  return utcDateMs(p.year, 1, 1);
}

export function startOfUtcMonth(ms: number): number {
  const p = utcParts(ms);
  return utcDateMs(p.year, p.month, 1);
}

export function startOfUtcDay(ms: number): number {
  const p = utcParts(ms);
  return utcDateMs(p.year, p.month, p.day);
}

export type PeriodWindow = {
  startMs: number;
  endMs: number;
  granularity: SeriesGranularity;
};

export type PeriodWindows = Record<PeriodKey, PeriodWindow>;

export function minusUtcYears(ms: number, years: number): number {
  const p = utcParts(ms);
  const year = p.year - years;
  return utcDateMs(
    year,
    p.month,
    clampUtcDay(year, p.month, p.day),
    p.hour,
    p.minute,
    p.second,
    p.ms,
  );
}

/**
 * allTime series start: max(earliest event, now − N years), month-aligned.
 * Empty data still opens N years back so the last bucket can reach nowMs.
 */
export function allTimeSeriesStartMs(
  nowMs: number,
  earliestEventMs?: number | null,
): number {
  const floor = startOfUtcMonth(minusUtcYears(nowMs, ALL_TIME_SERIES_YEARS));
  if (earliestEventMs == null || !Number.isFinite(earliestEventMs)) {
    return floor;
  }
  return Math.max(floor, startOfUtcMonth(earliestEventMs));
}

export function earliestEventMs(
  events: readonly AnalyticsEvent[],
): number | null {
  let min: number | null = null;
  for (const event of events) {
    if (!Number.isFinite(event.at)) continue;
    if (min == null || event.at < min) min = event.at;
  }
  return min;
}

export function assertNowMs(nowMs: number): number {
  if (!Number.isFinite(nowMs) || nowMs < MIN_NOW_MS || nowMs > MAX_NOW_MS) {
    throw new Error("Invalid nowMs");
  }
  return nowMs;
}

/**
 * Newest-first cap — when truncated, recent windows keep their events.
 */
export function takeNewestEvents(
  events: readonly AnalyticsEvent[],
  limit: number,
): { events: AnalyticsEvent[]; truncated: boolean } {
  if (limit <= 0) return { events: [], truncated: events.length > 0 };
  if (events.length <= limit) {
    return { events: [...events], truncated: false };
  }
  const sorted = [...events].sort((a, b) => b.at - a.at);
  return { events: sorted.slice(0, limit), truncated: true };
}

/**
 * Inclusive start, exclusive end. YoY / MoM use comparable end instants
 * (same UTC month/day last year / last month).
 *
 * allTime is a trailing series (default 5y, or first event if later) so
 * monthly buckets always reach `nowMs` and total === sum(series).
 */
export function periodWindows(
  nowMs: number,
  earliestEventMsValue?: number | null,
): PeriodWindows {
  const thisYearStart = startOfUtcYear(nowMs);
  const lastYearNow = minusUtcYear(nowMs);
  const lastYearStart = startOfUtcYear(lastYearNow);
  const thisMonthStart = startOfUtcMonth(nowMs);
  const lastMonthNow = minusUtcMonth(nowMs);
  const lastMonthStart = startOfUtcMonth(lastMonthNow);
  return {
    allTime: {
      startMs: allTimeSeriesStartMs(nowMs, earliestEventMsValue),
      endMs: nowMs,
      granularity: "month",
    },
    thisYear: {
      startMs: thisYearStart,
      endMs: nowMs,
      granularity: "month",
    },
    lastYear: {
      startMs: lastYearStart,
      endMs: lastYearNow,
      granularity: "month",
    },
    thisMonth: {
      startMs: thisMonthStart,
      endMs: nowMs,
      granularity: "day",
    },
    lastMonth: {
      startMs: lastMonthStart,
      endMs: lastMonthNow,
      granularity: "day",
    },
  };
}

export function inWindow(at: number, window: PeriodWindow): boolean {
  return at >= window.startMs && at < window.endMs;
}

export function monthBucketStart(ms: number): number {
  return startOfUtcMonth(ms);
}

export function dayBucketStart(ms: number): number {
  return startOfUtcDay(ms);
}

export function bucketStart(ms: number, granularity: SeriesGranularity): number {
  return granularity === "month" ? monthBucketStart(ms) : dayBucketStart(ms);
}

export function nextBucketStart(
  start: number,
  granularity: SeriesGranularity,
): number {
  const p = utcParts(start);
  if (granularity === "month") {
    const month = p.month === 12 ? 1 : p.month + 1;
    const year = p.month === 12 ? p.year + 1 : p.year;
    return utcDateMs(year, month, 1);
  }
  return utcDateMs(p.year, p.month, p.day + 1);
}

export function bucketLabel(ms: number, granularity: SeriesGranularity): string {
  const p = utcParts(ms);
  const month = String(p.month).padStart(2, "0");
  if (granularity === "month") return `${p.year}-${month}`;
  return `${p.year}-${month}-${String(p.day).padStart(2, "0")}`;
}

export function enumerateBuckets(window: PeriodWindow): number[] {
  if (window.endMs <= window.startMs) return [];
  const first = bucketStart(window.startMs, window.granularity);
  const out: number[] = [];
  let cursor = first;
  let guard = 0;
  while (cursor < window.endMs && guard < ENUMERATE_BUCKET_GUARD) {
    out.push(cursor);
    cursor = nextBucketStart(cursor, window.granularity);
    guard += 1;
  }
  return out;
}

export function aggregateEvents(
  events: readonly AnalyticsEvent[],
  window: PeriodWindow,
  mode: "count" | "sum",
): PeriodTotals {
  const buckets = enumerateBuckets(window);
  const sums = new Map<number, number>();
  for (const start of buckets) sums.set(start, 0);

  let total = 0;
  for (const event of events) {
    if (!inWindow(event.at, window)) continue;
    const amount = mode === "sum" ? (event.value ?? 0) : 1;
    total += amount;
    const start = bucketStart(event.at, window.granularity);
    sums.set(start, (sums.get(start) ?? 0) + amount);
  }

  const series = buckets.map((t) => ({
    t,
    label: bucketLabel(t, window.granularity),
    value: sums.get(t) ?? 0,
  }));
  return { total, series };
}

export function metricPeriodsFromEvents(
  events: readonly AnalyticsEvent[],
  nowMs: number,
  mode: "count" | "sum",
): MetricPeriods {
  const windows = periodWindows(nowMs, earliestEventMs(events));
  return {
    allTime: aggregateEvents(events, windows.allTime, mode),
    thisYear: aggregateEvents(events, windows.thisYear, mode),
    lastYear: aggregateEvents(events, windows.lastYear, mode),
    thisMonth: aggregateEvents(events, windows.thisMonth, mode),
    lastMonth: aggregateEvents(events, windows.lastMonth, mode),
  };
}

export function lastSeriesBucketStart(nowMs: number): number {
  return startOfUtcMonth(nowMs - 1);
}

export function periodTotalsMatchSeries(period: PeriodTotals): boolean {
  const seriesSum = period.series.reduce((n, point) => n + point.value, 0);
  return period.total === seriesSum;
}

/**
 * Sticky arm only — do not fall back to quiet-column.
 * Legacy aliases map onto Set A; missing / unknown → null.
 */
export function assignedKitIdOrNull(
  value: string | null | undefined,
): LayoutPresetId | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (isLayoutPresetId(raw)) return raw;
  const mapped = LEGACY_LAYOUT_PRESET_ID_MAP[raw];
  return mapped ?? null;
}

export type RecoveryDayFields = {
  recoveredAt?: number | null;
  day0SentAt?: number | null;
  day2SentAt?: number | null;
  day5SentAt?: number | null;
};

/**
 * Last sequence email sent at or before recoveredAt.
 * Recovered before Day 0 (or with no send) → null.
 */
export function recoveryAttributedDay(
  row: RecoveryDayFields,
): RecoveryDayStep | null {
  const recoveredAt = row.recoveredAt;
  if (recoveredAt == null) return null;
  if (row.day5SentAt != null && recoveredAt >= row.day5SentAt) return "day5";
  if (row.day2SentAt != null && recoveredAt >= row.day2SentAt) return "day2";
  if (row.day0SentAt != null && recoveredAt >= row.day0SentAt) return "day0";
  return null;
}

export function isCountableRecovery(row: {
  status: string;
  recoveredAt?: number | null;
  testMode?: boolean;
  deletedAt?: number | null;
}): boolean {
  return (
    row.status === "recovered" &&
    row.recoveredAt != null &&
    row.testMode !== true &&
    row.deletedAt == null
  );
}
