/**
 * Pure-function checks for admin analytics periods, kit mapping, and day attribution.
 * Run: npx tsx scripts/assert-admin-analytics.ts
 */
import {
  assignedKitIdOrNull,
  aggregateEvents,
  bucketLabel,
  clampUtcDay,
  daysInUtcMonth,
  emptyMetricPeriods,
  enumerateBuckets,
  inWindow,
  isCountableRecovery,
  metricPeriodsFromEvents,
  minusUtcMonth,
  minusUtcYear,
  periodWindows,
  recoveryAttributedDay,
  startOfUtcMonth,
  startOfUtcYear,
  utcDateMs,
} from "../convex/lib/adminAnalytics";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const now = utcDateMs(2026, 10, 2, 15, 30, 0, 0);
const windows = periodWindows(now);

assert(windows.thisYear.startMs === utcDateMs(2026, 1, 1), "this year starts Jan 1 UTC 2026");
assert(windows.thisYear.endMs === now, "this year ends at nowMs");
assert(windows.lastYear.startMs === utcDateMs(2025, 1, 1), "last year comparable starts Jan 1 UTC 2025");
assert(windows.lastYear.endMs === utcDateMs(2025, 10, 2, 15, 30, 0, 0), "last year comparable ends same UTC instant −1y");
assert(windows.thisMonth.startMs === utcDateMs(2026, 10, 1), "this month starts Oct 1 UTC");
assert(windows.lastMonth.startMs === utcDateMs(2025, 9, 1) || windows.lastMonth.startMs === utcDateMs(2026, 9, 1), "last month starts Sep 1 UTC");
assert(windows.lastMonth.startMs === utcDateMs(2026, 9, 1), "last month start is 2026-09-01");
assert(windows.lastMonth.endMs === utcDateMs(2026, 9, 2, 15, 30, 0, 0), "last month comparable ends Sep 2 15:30 UTC");

assert(minusUtcYear(utcDateMs(2024, 2, 29)) === utcDateMs(2023, 2, 28), "leap day YoY clamps to Feb 28");
assert(minusUtcMonth(utcDateMs(2026, 3, 31, 8)) === utcDateMs(2026, 2, 28, 8), "Mar 31 MoM clamps to Feb 28");
assert(daysInUtcMonth(2026, 2) === 28, "2026 Feb has 28 days");
assert(clampUtcDay(2024, 2, 31) === 29, "clamp 31 into leap Feb");

assert(startOfUtcYear(now) === utcDateMs(2026, 1, 1), "startOfUtcYear");
assert(startOfUtcMonth(now) === utcDateMs(2026, 10, 1), "startOfUtcMonth");

const empty = metricPeriodsFromEvents([], now, "count");
assert(empty.thisYear.total === 0, "empty thisYear total");
assert(empty.lastYear.total === 0, "empty lastYear total");
assert(empty.thisMonth.total === 0, "empty thisMonth total");
assert(empty.lastMonth.total === 0, "empty lastMonth total");
assert(empty.thisYear.series.length > 0, "empty thisYear still emits monthly buckets");
assert(empty.thisYear.series.every((p) => p.value === 0), "empty thisYear series is zeros");
assert(empty.thisMonth.series.every((p) => p.value === 0), "empty thisMonth series is zeros");
assert(emptyMetricPeriods().allTime.total === 0, "emptyMetricPeriods allTime");

const oct1 = utcDateMs(2026, 10, 1, 12);
const sep1 = utcDateMs(2026, 9, 1, 12);
const lastOct = utcDateMs(2025, 10, 1, 12);
const events = [
  { at: oct1 },
  { at: sep1 },
  { at: lastOct },
  { at: utcDateMs(2024, 6, 1) },
];
const counted = metricPeriodsFromEvents(events, now, "count");
assert(counted.allTime.total === 4, "all-time counts every event before now");
assert(counted.thisYear.total === 2, "this year = Oct + Sep 2026");
assert(counted.lastYear.total === 1, "last year comparable includes 2025-10-01 only");
assert(counted.thisMonth.total === 1, "this month = Oct 1");
assert(counted.lastMonth.total === 1, "last month comparable includes Sep 1");

const cents = metricPeriodsFromEvents(
  [
    { at: oct1, value: 2900 },
    { at: sep1, value: 1000 },
  ],
  now,
  "sum",
);
assert(cents.thisMonth.total === 2900, "recovered $ this month sums cents");
assert(cents.lastMonth.total === 1000, "recovered $ last month sums cents");

assert(!inWindow(now, windows.thisYear), "nowMs itself is excluded from the window");
assert(inWindow(now - 1, windows.thisYear), "instant before now is in this year");

assert(bucketLabel(utcDateMs(2026, 10, 2), "month") === "2026-10", "month label");
assert(bucketLabel(utcDateMs(2026, 10, 2), "day") === "2026-10-02", "day label");

const monthBuckets = enumerateBuckets(windows.thisYear);
assert(monthBuckets[0] === utcDateMs(2026, 1, 1), "first this-year bucket is January");
assert(
  aggregateEvents([], windows.thisMonth, "count").series.length ===
    enumerateBuckets(windows.thisMonth).length,
  "zero fill keeps bucket count",
);

assert(assignedKitIdOrNull(null) === null, "missing arm is not quiet-column");
assert(assignedKitIdOrNull("") === null, "empty arm is not quiet-column");
assert(assignedKitIdOrNull("unknown-kit") === null, "unknown arm is not quiet-column");
assert(assignedKitIdOrNull("quiet-column") === "quiet-column", "Set A id passes through");
assert(assignedKitIdOrNull("sonos") === "quiet-column", "sonos maps to quiet-column");
assert(assignedKitIdOrNull("avocode") === "amount-due", "avocode maps to amount-due");

assert(
  recoveryAttributedDay({
    recoveredAt: 300,
    day0SentAt: 100,
    day2SentAt: 200,
    day5SentAt: 250,
  }) === "day5",
  "recovery after day5 attributes to day5",
);
assert(
  recoveryAttributedDay({
    recoveredAt: 220,
    day0SentAt: 100,
    day2SentAt: 200,
  }) === "day2",
  "recovery after day2 before day5 attributes to day2",
);
assert(
  recoveryAttributedDay({
    recoveredAt: 150,
    day0SentAt: 100,
  }) === "day0",
  "recovery after day0 only attributes to day0",
);
assert(
  recoveryAttributedDay({
    recoveredAt: 50,
    day0SentAt: 100,
  }) === null,
  "recovered before day0 is unattributed",
);
assert(
  recoveryAttributedDay({ recoveredAt: 50 }) === null,
  "recovered with no send is unattributed",
);

assert(
  isCountableRecovery({
    status: "recovered",
    recoveredAt: 1,
    testMode: false,
  }),
  "live recovered counts",
);
assert(
  !isCountableRecovery({
    status: "recovered",
    recoveredAt: 1,
    testMode: true,
  }),
  "test-mode recovered excluded",
);
assert(
  !isCountableRecovery({
    status: "recovered",
    recoveredAt: 1,
    deletedAt: 2,
  }),
  "soft-deleted recovered excluded",
);
assert(
  !isCountableRecovery({ status: "open", recoveredAt: null }),
  "open failure is not a recovery",
);

console.log(
  "asserts green: UTC comparable YoY/MoM, empty zero-fill, missing kit arm, day5>day2>day0 attribution, test-mode/deleted excluded",
);
