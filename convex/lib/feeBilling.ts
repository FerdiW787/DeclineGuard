import type { Id } from "../_generated/dataModel";

/** UTC calendar month used as the billing period (e.g. "2026-09"). */
export function utcPeriodKey(nowMs: number): string {
  const d = new Date(nowMs);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * UTC month closed by a charge at `paidAtMs`.
 * February renewal covers January usage on that invoice — never `paidAt`'s month.
 */
export function previousUtcPeriodKey(paidAtMs: number): string {
  const d = new Date(paidAtMs);
  return utcPeriodKey(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
}

/**
 * Period a Pro charge at `atMs` covers (the UTC month that just closed).
 * Used by settle. The scheduled month-close job stamps this same key.
 */
export function dodoUsagePeriodKey(atMs: number): string {
  return previousUtcPeriodKey(atMs);
}

/**
 * Only the scheduled close of a finished usage month stamps the previous
 * period. A mid-month force-run stamps the current usage month so a charge
 * in this month cannot mark it paid. The scheduled close must reclaim that
 * same key and recompute the finished month — not skip the partial row.
 */
export function dodoIngestPeriodKey(args: {
  nowMs: number;
  scheduledMonthClose: boolean;
}): string {
  if (args.scheduledMonthClose) {
    return dodoUsagePeriodKey(args.nowMs);
  }
  return utcPeriodKey(args.nowMs);
}

/**
 * Scheduled month-close may reopen an unpaid Dodo usage claim so the
 * finished month includes fees accrued after a mid-month force-run.
 * Paid rows and Lemon checkouts stay blocked.
 */
export function unpaidDodoUsageClaimMayReclaim(args: {
  scheduledMonthClose: boolean;
  status: BillingInvoiceStatus;
  billingProvider?: "lemon" | "dodo" | null;
  dodoUsageSubmittedAt?: number | null;
  paidAt?: number | null;
  lsCheckoutId?: string | null;
}): boolean {
  if (!args.scheduledMonthClose) return false;
  if (args.status === "paid" || args.paidAt != null) return false;
  if (args.lsCheckoutId) return false;
  if (args.billingProvider === "lemon") return false;
  if (args.status !== "created" && args.status !== "claiming") return false;
  return (
    args.billingProvider === "dodo" || args.dodoUsageSubmittedAt != null
  );
}

export function dodoUsageReclaimDeltaCents(
  priorIngestedCents: number,
  nextTotalCents: number,
): number {
  if (!Number.isFinite(priorIngestedCents) || !Number.isFinite(nextTotalCents)) {
    return 0;
  }
  return Math.max(0, Math.round(nextTotalCents) - Math.round(priorIngestedCents));
}

/** Already-metered reclaim rows must not unlink or re-ingest accepted cents. */
export function shouldUnlinkFeesAfterDodoUsageFailure(args: {
  reclaimed: boolean;
  priorIngestedCents: number;
}): boolean {
  return !(args.reclaimed && args.priorIngestedCents > 0);
}

/**
 * After a failed scheduled close, keep only the previously accepted meter
 * amount. Those accepted cents stay settleable (`monthClosed`) so a later
 * Pro charge can mark them paid. They must not look metered at the
 * attempted new total.
 */
export function dodoUsageReclaimFailureSnapshot(args: {
  priorIngestedCents: number;
  attemptedTotalCents: number;
}): {
  totalCents: number;
  ingestedCents: number;
  monthClosed: boolean;
  looksMeteredAtAttempted: boolean;
} {
  const prior = Math.max(0, Math.round(args.priorIngestedCents));
  return {
    totalCents: prior,
    ingestedCents: prior,
    monthClosed: prior > 0,
    looksMeteredAtAttempted: false,
  };
}

export type DodoUsageCatchAction = "keep_accepted" | "rollback" | "unlink";

/**
 * Once Dodo accepts a meter POST, keep those cents locally. A throw
 * before accept still rolls back a reclaim or unlinks a first ingest.
 */
export function dodoUsageCatchAction(args: {
  dodoAccepted: boolean;
  reclaimed: boolean;
  priorIngestedCents: number;
}): DodoUsageCatchAction {
  if (args.dodoAccepted) return "keep_accepted";
  if (
    !shouldUnlinkFeesAfterDodoUsageFailure({
      reclaimed: args.reclaimed,
      priorIngestedCents: args.priorIngestedCents,
    })
  ) {
    return "rollback";
  }
  return "unlink";
}

/** Idempotency key: one LS charge per merchant per UTC month. */
export function feeInvoiceClaimKey(
  userId: Id<"users">,
  periodKey: string,
): string {
  return `fee-invoice:${userId}:${periodKey}`;
}

export type BillingInvoiceStatus =
  | "claiming"
  | "created"
  | "paid"
  | "failed";

/**
 * Existing claim rows that must not create another LS checkout.
 * `failed` is retryable. Empty `claiming` (no fees linked yet) is also
 * retryable so a crash before fee association can resume.
 */
export function existingClaimBlocksNewCharge(
  status: BillingInvoiceStatus,
  feeCount: number,
  hasLsCheckoutId: boolean,
): boolean {
  switch (status) {
    case "paid":
    case "created":
      return true;
    case "claiming":
      return hasLsCheckoutId || feeCount > 0;
    case "failed":
      return false;
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

export type BillingCustomData = {
  claimKey?: string;
  billingInvoiceId?: string;
};

/** Parse LS `meta.custom_data` from a checkout we created. */
export function parseBillingCustomData(
  value: unknown,
): BillingCustomData {
  if (typeof value !== "object" || value === null) return {};
  const rec = value as Record<string, unknown>;
  const claimKey =
    typeof rec.claim_key === "string" && rec.claim_key.trim()
      ? rec.claim_key.trim()
      : undefined;
  const billingInvoiceId =
    typeof rec.billing_invoice_id === "string" && rec.billing_invoice_id.trim()
      ? rec.billing_invoice_id.trim()
      : undefined;
  return { claimKey, billingInvoiceId };
}

export function isFeeInvoiceClaimKey(claimKey: string): boolean {
  return claimKey.startsWith("fee-invoice:");
}

/** LS checkout lifetime used by the monthly job (45 days). */
export const FEE_INVOICE_CHECKOUT_TTL_MS = 45 * 24 * 60 * 60 * 1000;

/**
 * Accept payment when subtotal or total covers the claimed cents.
 * Tax may push `total` above the claim — do not require equality.
 */
export function orderCoversClaimedCents(
  claimedCents: number,
  subtotalCents: number,
  totalCents: number,
): boolean {
  return subtotalCents >= claimedCents || totalCents >= claimedCents;
}
