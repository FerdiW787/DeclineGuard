import type { Plan } from "./accountGuard";
import {
  DECLINE_PACK_EXTRA_DECLINES,
  packExtraDeclines,
} from "./billingProvider";
import { shouldIgnoreDodoTestEvent } from "./dodoPayments";

/** Keep in sync with `includedDeclinesPerMonth` in `src/lib/pricing.ts`. */
export function includedDeclinesPerMonth(plan: Plan): 50 | 500 {
  switch (plan) {
    case "free":
      return 50;
    case "pro":
      return 500;
    default: {
      const _exhaustive: never = plan;
      return 50;
    }
  }
}

export const MAX_PACK_QUANTITY = 20;

export function clampPackQuantity(raw: number): number {
  if (!Number.isFinite(raw) || raw < 1) return 1;
  return Math.min(MAX_PACK_QUANTITY, Math.floor(raw));
}

export function declineCapacity(args: {
  plan: Plan;
  packExtra: number | undefined;
}): number {
  const extra =
    typeof args.packExtra === "number" && Number.isFinite(args.packExtra)
      ? Math.max(0, Math.floor(args.packExtra))
      : 0;
  return includedDeclinesPerMonth(args.plan) + extra;
}

export function availableDeclineCapacity(args: {
  plan: Plan;
  packExtra: number | undefined;
  usedActive: number;
}): number {
  const used =
    typeof args.usedActive === "number" && Number.isFinite(args.usedActive)
      ? Math.max(0, Math.floor(args.usedActive))
      : 0;
  return Math.max(0, declineCapacity(args) - used);
}

export function shouldHoldNewDecline(args: {
  usedActive: number;
  capacity: number;
}): boolean {
  return args.usedActive >= args.capacity;
}

export function utcMonthStartMs(nowMs: number): number {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

/** Exclusive end of the UTC calendar month that contains `monthStartMs`. */
export function utcNextMonthStartMs(monthStartMs: number): number {
  const d = new Date(monthStartMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

/**
 * UTC month bounds for the email meter. Both ends are derived from `nowMs`
 * on the server — never treat a client local-midnight timestamp as a UTC
 * month start.
 */
export function emailMeterMonthBounds(nowMs: number): {
  startMs: number;
  endMs: number;
} {
  const startMs = utcMonthStartMs(nowMs);
  return { startMs, endMs: utcNextMonthStartMs(startMs) };
}

/**
 * Sum cents whose timestamp falls in the UTC month containing `nowMs`.
 * Same bounds as the email meter — never a client local midnight.
 */
export function sumCentsInUtcMonth(
  rows: Array<{ atMs: number; cents: number }>,
  nowMs: number,
): number {
  const { startMs, endMs } = emailMeterMonthBounds(nowMs);
  let total = 0;
  for (const row of rows) {
    if (row.atMs >= startMs && row.atMs < endMs) total += row.cents;
  }
  return total;
}

/**
 * Prefer Dodo `product_cart` quantity over checkout metadata.
 * Metadata is attacker-controlled; cart qty is what was charged.
 */
export function packQuantityPreferringCart(args: {
  cartQuantity: number | null;
  metadataQuantity: number | null;
}): number {
  if (args.cartQuantity != null && args.cartQuantity >= 1) {
    return clampPackQuantity(args.cartQuantity);
  }
  if (args.metadataQuantity != null && args.metadataQuantity >= 1) {
    return clampPackQuantity(args.metadataQuantity);
  }
  return 1;
}

export function parsePositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 1) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim());
    if (Number.isFinite(n) && n >= 1) return Math.floor(n);
  }
  return null;
}

export function matchesPackProduct(args: {
  productId: string | null;
  expectedProductId: string | null;
}): boolean {
  if (!args.expectedProductId) return false;
  if (!args.productId) return false;
  return args.productId === args.expectedProductId;
}

export function enteredDeclineCapacityAt(row: {
  failedAt: number;
  quotaReleasedAt?: number;
}): number {
  return row.quotaReleasedAt ?? row.failedAt;
}

export function countsTowardDeclineCapacity(
  row: {
    deletedAt?: number;
    testMode: boolean;
    quotaHeld?: boolean;
    failedAt?: number;
    quotaReleasedAt?: number;
  },
  monthStartMs?: number,
): boolean {
  if (row.deletedAt != null) return false;
  if (row.testMode) return false;
  if (row.quotaHeld === true) return false;
  if (monthStartMs == null) return true;
  if (typeof row.failedAt !== "number") return false;
  return enteredDeclineCapacityAt({
    failedAt: row.failedAt,
    quotaReleasedAt: row.quotaReleasedAt,
  }) >= monthStartMs;
}

export function heldRowsToRelease(args: {
  heldCount: number;
  availableSlots: number;
}): number {
  const held =
    typeof args.heldCount === "number" && Number.isFinite(args.heldCount)
      ? Math.max(0, Math.floor(args.heldCount))
      : 0;
  const slots =
    typeof args.availableSlots === "number" &&
    Number.isFinite(args.availableSlots)
      ? Math.max(0, Math.floor(args.availableSlots))
      : 0;
  return Math.min(held, slots);
}

/** New UTC month has unused capacity — drain last month's hold backlog. */
export function shouldUnholdOnMonthRollover(args: {
  lastReleasedMonthStart: number | undefined;
  nowMs: number;
}): boolean {
  return args.lastReleasedMonthStart !== utcMonthStartMs(args.nowMs);
}

/**
 * After lazy month unhold, return the post-release row flag — never the
 * pre-release `open.quotaHeld`. Wait→nudge at month boundary must report
 * false so the webhook schedules sendForFailure.
 */
export function quotaHeldAfterLazyRelease(args: {
  rowStillHeld: boolean | undefined;
}): boolean {
  return args.rowStillHeld === true;
}

export function webhookSendsAfterUpsert(args: {
  quotaHeld: boolean;
  recoveryAction: "wait" | "nudge_update_pm" | "push_update_pm" | "stop";
}): boolean {
  if (args.quotaHeld) return false;
  return (
    args.recoveryAction === "nudge_update_pm" ||
    args.recoveryAction === "push_update_pm"
  );
}

/** Release emails rows that are already nudge/push at unhold time. */
export function releaseSchedulesEmail(
  recoveryAction: "wait" | "nudge_update_pm" | "push_update_pm" | "stop" | null,
): boolean {
  return (
    recoveryAction === "nudge_update_pm" ||
    recoveryAction === "push_update_pm"
  );
}

/**
 * Webhook must not schedule sendForFailure when this upsert's lazy
 * release already scheduled the same failureId (held open already
 * nudge/push). Wait→nudge still webhook-sends (release saw wait).
 */
export function webhookSchedulesAfterUpsert(args: {
  quotaHeld: boolean;
  recoveryAction: "wait" | "nudge_update_pm" | "push_update_pm" | "stop";
  releaseScheduledThisFailure: boolean;
}): boolean {
  if (args.releaseScheduledThisFailure) return false;
  return webhookSendsAfterUpsert({
    quotaHeld: args.quotaHeld,
    recoveryAction: args.recoveryAction,
  });
}

/** Hold-queue clock is wall time. Receipt `paidAt` must never rewind stamps. */
export function holdQueueNowMs(nowMs: number): number {
  if (!Number.isFinite(nowMs) || nowMs <= 0) return 0;
  return Math.floor(nowMs);
}

/** Free→Pro (or any included-cap increase) must unhold; demote must not. */
export function shouldUnholdOnPlanPromote(args: {
  priorPlan: Plan;
  nextPlan: Plan;
}): boolean {
  return (
    declineCapacity({ plan: args.nextPlan, packExtra: 0 }) >
    declineCapacity({ plan: args.priorPlan, packExtra: 0 })
  );
}

export type DodoPackCreditReason =
  | "ok"
  | "test_mode_ignored"
  | "product_mismatch"
  | "invalid_quantity";

/**
 * Same test_mode_ignored contract as applyDodoSubscription, plus pack
 * product-id gate and quantity clamp. Pure — webhook mutation must honor this.
 */
export function dodoPackCreditDecision(args: {
  testMode: boolean;
  allowTestBilling?: string;
  productId: string | null;
  expectedProductId: string | null;
  quantity: number;
}): {
  credit: boolean;
  reason: DodoPackCreditReason;
  quantity: number;
  extraDeclines: number;
} {
  if (shouldIgnoreDodoTestEvent(args.testMode, args.allowTestBilling)) {
    return {
      credit: false,
      reason: "test_mode_ignored",
      quantity: 0,
      extraDeclines: 0,
    };
  }
  if (
    !matchesPackProduct({
      productId: args.productId,
      expectedProductId: args.expectedProductId,
    })
  ) {
    return {
      credit: false,
      reason: "product_mismatch",
      quantity: 0,
      extraDeclines: 0,
    };
  }
  if (!Number.isFinite(args.quantity) || args.quantity < 1) {
    return {
      credit: false,
      reason: "invalid_quantity",
      quantity: 0,
      extraDeclines: 0,
    };
  }
  const quantity = clampPackQuantity(args.quantity);
  const extraDeclines = packExtraDeclines(quantity);
  if (extraDeclines <= 0) {
    return {
      credit: false,
      reason: "invalid_quantity",
      quantity: 0,
      extraDeclines: 0,
    };
  }
  return { credit: true, reason: "ok", quantity, extraDeclines };
}

export { DECLINE_PACK_EXTRA_DECLINES, packExtraDeclines };
