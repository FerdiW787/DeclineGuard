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

export function countsTowardDeclineCapacity(row: {
  deletedAt?: number;
  testMode: boolean;
  quotaHeld?: boolean;
}): boolean {
  if (row.deletedAt != null) return false;
  if (row.testMode) return false;
  if (row.quotaHeld === true) return false;
  return true;
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
