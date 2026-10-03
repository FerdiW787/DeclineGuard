/**
 * Attribution window + monthly email-meter checks.
 * Run: npx tsx scripts/assert-recovery-fee-meter.ts
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ATTRIBUTION_WINDOW_MS,
  countLiveEmailSendsInMonth,
  isWithinAttributionWindow,
} from "../convex/lib/accountGuard";
import { utcNextMonthStartMs } from "../convex/lib/declineCapacity";

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

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const recoveriesSrc = readFileSync(
  join(repoRoot, "convex/functions/recoveries.ts"),
  "utf8",
);
const guardSrc = readFileSync(
  join(repoRoot, "convex/lib/accountGuard.ts"),
  "utf8",
);

assert(
  !recoveriesSrc.includes("EMAIL_QUOTA_SCAN_LIMIT"),
  "email meter must not use a newest-2000 scan cap",
);
assert(
  recoveriesSrc.includes("countLiveEmailSendsInMonth") &&
    recoveriesSrc.includes("utcNextMonthStartMs") &&
    recoveriesSrc.includes(".collect()"),
  "email meter must count the month-bounded email_sent range, not a newest slice",
);
assert(
  guardSrc.includes("gap >= 0 && gap <= ATTRIBUTION_WINDOW_MS"),
  "attribution window must reject recoveredAt before Day-0",
);

console.log(
  "asserts green: no Day-0 / before Day-0 skip fee; Day-0 instant and last-in-window owe; past 30d skip; meter counts live month sends over 2000 including deletes",
);
