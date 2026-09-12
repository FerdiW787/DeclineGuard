/** Allow only https URLs (blocks javascript:, data:, etc.). */
export function allowHttpsUrl(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

const FALLBACK_PAYMENT_URL = "https://app.lemonsqueezy.com/my-orders";

/** CTA / payment-update links used in recovery emails. */
export function safePaymentUpdateUrl(
  raw: string | null | undefined,
): string {
  return allowHttpsUrl(raw) ?? FALLBACK_PAYMENT_URL;
}
