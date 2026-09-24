import type { Id } from "../_generated/dataModel";

/** UTC calendar month used as the billing period (e.g. "2026-09"). */
export function utcPeriodKey(nowMs: number): string {
  const d = new Date(nowMs);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
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
