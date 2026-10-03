/**
 * Inclusive UTC calendar-month start.
 * Same bound as `utcMonthStartMs` in `convex/lib/declineCapacity.ts`.
 * Fee invoices use this UTC month — never the browser's local midnight.
 */
export function utcCalendarMonthStartMs(nowMs: number = Date.now()): number {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}
