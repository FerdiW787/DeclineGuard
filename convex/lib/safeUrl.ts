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

/** Built-in DeclineGuard app hosts for post-pay redirects. */
const BUILTIN_APP_HOSTS = new Set([
  "declineguard.com",
  "www.declineguard.com",
  "app.declineguard.com",
]);

function hostnameFromOriginEnv(raw: string | undefined): string | null {
  if (!raw) return null;
  const https = allowHttpsUrl(raw);
  if (!https) return null;
  try {
    return new URL(https).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Hosts allowed as Pro checkout return/receipt URLs (never arbitrary https). */
export function allowedAppHosts(): Set<string> {
  const hosts = new Set(BUILTIN_APP_HOSTS);
  const single = hostnameFromOriginEnv(process.env.PUBLIC_APP_URL);
  if (single) hosts.add(single);
  const extras = process.env.PUBLIC_APP_URLS ?? "";
  for (const part of extras.split(",")) {
    const host = hostnameFromOriginEnv(part.trim());
    if (host) hosts.add(host);
  }
  return hosts;
}

/**
 * https + DeclineGuard app origin only.
 * Rejects random https hosts (open-redirect / phishing after checkout).
 */
export function allowAppHttpsUrl(
  raw: string | null | undefined,
): string | null {
  const https = allowHttpsUrl(raw);
  if (!https) return null;
  const host = new URL(https).hostname.toLowerCase();
  if (!allowedAppHosts().has(host)) return null;
  return https;
}

const FALLBACK_PAYMENT_URL = "https://app.lemonsqueezy.com/my-orders";

/** CTA / payment-update links used in recovery emails. */
export function safePaymentUpdateUrl(
  raw: string | null | undefined,
): string {
  return allowHttpsUrl(raw) ?? FALLBACK_PAYMENT_URL;
}
