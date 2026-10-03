/**
 * Attribution window + monthly email-meter checks.
 * Run: npx tsx scripts/assert-recovery-fee-meter.ts
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ATTRIBUTION_WINDOW_DAYS,
  ATTRIBUTION_WINDOW_MS,
  countLiveEmailSendsInMonth,
  isWithinAttributionWindow,
  recoveryActivityDetail,
} from "../convex/lib/accountGuard";
import {
  emailMeterMonthBounds,
  utcNextMonthStartMs,
} from "../convex/lib/declineCapacity";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const day0 = Date.UTC(2026, 8, 1, 12, 0, 0);
const recoveredAt = day0 + 3 * 24 * 60 * 60 * 1000;

assert(
  !isWithinAttributionWindow(null, recoveredAt),
  "no Day-0 (null) must not owe a fee",
);
assert(
  !isWithinAttributionWindow(undefined, recoveredAt),
  "no Day-0 (undefined) must not owe a fee",
);
assert(
  !isWithinAttributionWindow(day0, day0 - 1),
  "recoveredAt before Day-0 must not owe a fee",
);
assert(
  isWithinAttributionWindow(day0, day0),
  "recoveredAt equal to the Day-0 send must owe a fee",
);
assert(
  isWithinAttributionWindow(day0, day0 + 10 * 24 * 60 * 60 * 1000),
  "recoveredAt inside 30 days must owe a fee",
);
assert(
  isWithinAttributionWindow(day0, day0 + ATTRIBUTION_WINDOW_MS),
  "recoveredAt at the last moment still inside 30 days must owe a fee",
);
assert(
  !isWithinAttributionWindow(day0, day0 + ATTRIBUTION_WINDOW_MS + 1),
  "recoveredAt past 30 days must not owe a fee",
);

const beforeDay0Line = recoveryActivityDetail("$10.00", day0, day0 - 1);
assert(
  !isWithinAttributionWindow(day0, day0 - 1),
  "pre-Day-0 still writes no fee",
);
assert(
  !beforeDay0Line.includes("attribution window") &&
    !beforeDay0Line.includes(`${ATTRIBUTION_WINDOW_DAYS}-day`),
  "pre-Day-0 activity line must not use the past-30-days wording",
);
assert(
  beforeDay0Line.includes("before our sequence"),
  "pre-Day-0 activity line must say the recovery was before the sequence",
);
assert(
  recoveryActivityDetail("$10.00", null, recoveredAt).includes(
    "before our sequence",
  ),
  "no Day-0 activity line stays before-sequence",
);
assert(
  recoveryActivityDetail("$10.00", day0, day0 + ATTRIBUTION_WINDOW_MS + 1).includes(
    `${ATTRIBUTION_WINDOW_DAYS}-day attribution window`,
  ),
  "past-30-days activity line still names the window",
);

const monthStartMs = Date.UTC(2026, 9, 1);
const monthEndMs = utcNextMonthStartMs(monthStartMs);
assert(monthEndMs === Date.UTC(2026, 10, 1), "next month after Oct 1 is Nov 1");

const liveThisMonth = 1600;
const deletedThisMonth = 500;
const livePriorMonth = 250;
const liveNextMonth = 100;
const rows: Array<{ occurredAt: number; deletedAt?: number | null }> = [];

for (let i = 0; i < liveThisMonth; i += 1) {
  rows.push({ occurredAt: monthStartMs + i * 1_000 });
}
for (let i = 0; i < deletedThisMonth; i += 1) {
  rows.push({
    occurredAt: monthStartMs + liveThisMonth * 1_000 + i * 1_000,
    deletedAt: monthStartMs + 90_000,
  });
}
for (let i = 0; i < livePriorMonth; i += 1) {
  rows.push({ occurredAt: monthStartMs - 1 - i * 1_000 });
}
for (let i = 0; i < liveNextMonth; i += 1) {
  rows.push({ occurredAt: monthEndMs + i * 1_000 });
}

assert(
  rows.length === liveThisMonth + deletedThisMonth + livePriorMonth + liveNextMonth,
  "fixture must include every generated row",
);
assert(
  liveThisMonth + deletedThisMonth > 2000,
  "this month must have more than 2000 email_sent rows including deleted ones",
);

const sent = countLiveEmailSendsInMonth(rows, monthStartMs, monthEndMs);
assert(
  sent === liveThisMonth,
  `meter must equal live sends in this month only (got ${sent}, want ${liveThisMonth})`,
);

const newest2000ThenDropDeletes = rows
  .slice()
  .sort((a, b) => b.occurredAt - a.occurredAt)
  .slice(0, 2000)
  .filter((row) => row.deletedAt == null)
  .filter((row) => row.occurredAt >= monthStartMs && row.occurredAt < monthEndMs)
  .length;
assert(
  newest2000ThenDropDeletes !== liveThisMonth,
  "buggy newest-2000-then-drop-deletes path must not match the live month count",
);

// UTC+10 local 1 Oct 00:00 is still 30 Sep 14:00 UTC. Treating that instant
// as a UTC month start ends the range at 1 Oct 00:00 UTC and drops October.
const eastOfUtcLocalMidnight = Date.UTC(2026, 8, 30, 14, 0, 0);
const nowInOctoberUtc = Date.UTC(2026, 9, 15, 6, 0, 0);
const liveSendThisUtcMonth = Date.UTC(2026, 9, 10, 12, 0, 0);
const buggyEnd = utcNextMonthStartMs(eastOfUtcLocalMidnight);
assert(
  buggyEnd === Date.UTC(2026, 9, 1),
  "legacy utcNextMonthStartMs(local midnight) ends at 1 Oct 00:00 UTC",
);
assert(
  !(
    liveSendThisUtcMonth >= eastOfUtcLocalMidnight &&
    liveSendThisUtcMonth < buggyEnd
  ),
  "legacy mixed bounds drop an October send for an east-of-UTC merchant",
);

const utcBounds = emailMeterMonthBounds(nowInOctoberUtc);
assert(
  utcBounds.startMs === Date.UTC(2026, 9, 1) &&
    utcBounds.endMs === Date.UTC(2026, 10, 1),
  "server UTC bounds are 1 Oct–1 Nov when now is mid-October",
);
assert(
  countLiveEmailSendsInMonth(
    [
      { occurredAt: liveSendThisUtcMonth },
      { occurredAt: Date.UTC(2026, 8, 30, 12, 0, 0) },
      { occurredAt: Date.UTC(2026, 10, 1, 0, 0, 0) },
      { occurredAt: liveSendThisUtcMonth + 1_000, deletedAt: nowInOctoberUtc },
    ],
    utcBounds.startMs,
    utcBounds.endMs,
  ) === 1,
  "east-of-UTC local midnight must not drop this UTC month's live sends",
);
assert(
  emailMeterMonthBounds(eastOfUtcLocalMidnight).endMs === Date.UTC(2026, 9, 1),
  "local midnight is not a nowMs — only nowMs selects the current UTC month",
);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const recoveriesSrc = readFileSync(
  join(repoRoot, "convex/functions/recoveries.ts"),
  "utf8",
);
const guardSrc = readFileSync(
  join(repoRoot, "convex/lib/accountGuard.ts"),
  "utf8",
);
const dashboardSrc = readFileSync(
  join(repoRoot, "src/components/dashboard/Dashboard.tsx"),
  "utf8",
);

assert(
  !recoveriesSrc.includes("EMAIL_QUOTA_SCAN_LIMIT"),
  "email meter must not use a newest-2000 scan cap",
);
assert(
  recoveriesSrc.includes("countLiveEmailSendsInMonth") &&
    recoveriesSrc.includes("emailMeterMonthBounds") &&
    recoveriesSrc.includes("args.nowMs") &&
    recoveriesSrc.includes(".collect()") &&
    !recoveriesSrc.includes("utcNextMonthStartMs(args.monthStartMs)"),
  "email meter must use server UTC bounds from nowMs, not client local midnight",
);
assert(
  recoveriesSrc.includes("recoveryActivityDetail"),
  "recoveries must use recoveryActivityDetail for the activity line",
);
assert(
  dashboardSrc.includes("getEmailQuotaStatus") &&
    dashboardSrc.includes("nowMs: emailQuotaNowMs"),
  "dashboard must pass nowMs to the email meter, not local midnight",
);
assert(
  guardSrc.includes("gap >= 0 && gap <= ATTRIBUTION_WINDOW_MS"),
  "attribution window must reject recoveredAt before Day-0",
);

console.log(
  "asserts green: no Day-0 / before Day-0 skip fee; Day-0 instant and last-in-window owe; past 30d skip; meter counts live month sends over 2000 including deletes; UTC bounds keep east-of-UTC October sends; pre-Day-0 activity line is not past-window",
);
