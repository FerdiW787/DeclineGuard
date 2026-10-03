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
 * in this month cannot mark it paid and the next cycle can still find it.
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
