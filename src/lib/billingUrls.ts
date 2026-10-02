/**
 * Client-side Pro/portal/pack return URLs.
 * Must be https on an allowlisted DeclineGuard host — same rule as
 * `allowAppHttpsUrl` on Convex. Omit rather than send http or a foreign host.
 */

const BUILTIN_APP_HOSTS = new Set([
  "declineguard.com",
  "www.declineguard.com",
  "app.declineguard.com",
]);

const BILLING_RETURN_PATH = "/a/dashboard?billing=1";

function configuredOrigins(): string[] {
  const single =
    import.meta.env.PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || "";
  const extras =
    import.meta.env.PUBLIC_APP_URLS || process.env.PUBLIC_APP_URLS || "";
  return [single, ...extras.split(",")].map((part) => part.trim()).filter(Boolean);
}

function hostnameFromHttpsOrigin(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function allowedAppHosts(): Set<string> {
  const hosts = new Set(BUILTIN_APP_HOSTS);
  for (const origin of configuredOrigins()) {
    const host = hostnameFromHttpsOrigin(origin);
    if (host) hosts.add(host);
  }
  return hosts;
}

function asAllowlistedHttps(raw: string, hosts: Set<string>): string | undefined {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return undefined;
    if (url.username || url.password) return undefined;
    if (!hosts.has(url.hostname.toLowerCase())) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

/** https + allowlisted app host, or undefined so callers omit `returnUrl`. */
export function billingReturnUrl(
  path: string = BILLING_RETURN_PATH,
): string | undefined {
  const hosts = allowedAppHosts();
  const candidates: string[] = [];

  if (typeof window !== "undefined") {
    candidates.push(`${window.location.origin}${path}`);
  }

  for (const origin of configuredOrigins()) {
    try {
      candidates.push(new URL(path, origin).toString());
    } catch {
      /* skip malformed PUBLIC_APP_URL* */
    }
  }

  for (const raw of candidates) {
    const allowed = asAllowlistedHttps(raw, hosts);
    if (allowed) return allowed;
  }
  return undefined;
}

/** Spread onto checkout/portal action args so http/foreign hosts are never sent. */
export function withBillingReturnUrl(
  path?: string,
): { returnUrl: string } | Record<string, never> {
  const returnUrl = billingReturnUrl(path);
  return returnUrl ? { returnUrl } : {};
}
