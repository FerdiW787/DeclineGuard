const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "169.254.169.254",
  "[::1]",
]);

const BLOCKED_SUFFIXES = [".local", ".internal", ".localhost"];

/** Strip protocol/path → bare hostname for display + fetch */
export function normalizeDomainInput(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/\/.*$/, "");
  s = s.replace(/^www\./, "");
  s = s.replace(/:\d+$/, "");
  return s;
}

export function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().trim();
  if (!h || h.includes("/") || h.includes("@")) return true;
  if (BLOCKED_HOSTS.has(h)) return true;
  if (BLOCKED_SUFFIXES.some((s) => h.endsWith(s))) return true;
  if (h.includes(":")) return true;
  // Private IPv4 ranges
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  return false;
}

export function validateDomainInput(raw: string): {
  domain: string;
  url: string;
} {
  const domain = normalizeDomainInput(raw);
  if (!domain || domain.length > 253) {
    throw new Error("Enter a valid domain like yourstore.com");
  }
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain)) {
    throw new Error("Enter a valid domain like yourstore.com");
  }
  if (isBlockedHostname(domain)) {
    throw new Error("That domain cannot be scanned");
  }
  return { domain, url: `https://${domain}` };
}

export function hostnameMatchesDomain(url: string, expectedDomain: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    const expected = expectedDomain.toLowerCase().replace(/^www\./, "");
    return host === expected || host.endsWith(`.${expected}`);
  } catch {
    return false;
  }
}

const FETCH_HEADERS = {
  "User-Agent":
    "DeclineGuard-BrandBot/1.0 (+https://declineguard.com; merchant brand import)",
  Accept: "text/html,application/xhtml+xml,text/css;q=0.9,*/*;q=0.5",
} as const;

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_CSS_BYTES = 768 * 1024;

export async function fetchTextSafe(
  url: string,
  expectedDomain: string,
  maxBytes: number,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: FETCH_HEADERS,
      redirect: "follow",
    });
    if (!res.ok) return null;
    const finalUrl = res.url || url;
    // Same registrable host, or CDN/subdomain of the page we landed on
    let allowed = hostnameMatchesDomain(finalUrl, expectedDomain);
    if (!allowed) {
      try {
        const finalHost = new URL(finalUrl).hostname.replace(/^www\./, "");
        const expected = expectedDomain.replace(/^www\./, "");
        // e.g. static.linear.app ↔ linear.app already covered; also allow
        // stylesheets on the redirected marketing host (fortune.domains).
        allowed =
          finalHost === expected ||
          finalHost.endsWith(`.${expected}`) ||
          expected.endsWith(`.${finalHost}`);
        if (!allowed && !isBlockedHostname(finalHost)) {
          // Last resort: stylesheet host is public and was linked from HTML
          allowed = true;
        }
      } catch {
        allowed = false;
      }
    }
    if (!allowed) {
      return null;
    }
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > maxBytes) return null;
    const text = await res.text();
    if (text.length > maxBytes) return null;
    return text;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchHomepageHtml(
  domain: string,
): Promise<{ html: string; finalUrl: string } | null> {
  const { url } = validateDomainInput(domain);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: FETCH_HEADERS,
        redirect: "follow",
      });
      if (!res.ok) {
        throw new Error(`Could not reach ${domain} (${res.status})`);
      }
      const finalUrl = res.url || url;
      // Allow public marketing redirects (domain parking, www, vanity hosts).
      // Still reject private/local final hosts.
      try {
        const finalHost = new URL(finalUrl).hostname;
        if (isBlockedHostname(finalHost)) {
          throw new Error("Domain redirected to a blocked host");
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes("blocked")) throw err;
        throw new Error("Could not resolve homepage URL");
      }
      const len = Number(res.headers.get("content-length") ?? 0);
      if (len > MAX_HTML_BYTES) {
        throw new Error("Homepage response is too large to scan");
      }
      const html = await res.text();
      if (html.length > MAX_HTML_BYTES) {
        throw new Error("Homepage response is too large to scan");
      }
      return { html, finalUrl };
    } catch (err) {
      lastError =
        err instanceof Error
          ? err
          : new Error(`Could not reach ${domain}`);
      if (lastError.name === "AbortError") {
        lastError = new Error(`Timed out reaching ${domain}`);
      }
      // Retry once on transient network blips
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error(`Could not reach ${domain}`);
}

export function resolveStylesheetUrl(href: string, pageUrl: string): string | null {
  try {
    if (href.startsWith("data:")) return null;
    const resolved = new URL(href, pageUrl);
    if (resolved.protocol !== "https:" && resolved.protocol !== "http:") {
      return null;
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

/** Prefer design-token + button sheets so CTA colors/radius resolve. */
export function prioritizeStylesheetHrefs(hrefs: string[]): string[] {
  const rank = (href: string): number => {
    const h = href.toLowerCase();
    if (/\/index\.[^/]*\.css/.test(h)) return 100;
    if (/button[^/]*\.css/.test(h)) return 95;
    if (/color[^/]*\.css/.test(h) || /token[^/]*\.css/.test(h)) return 90;
    if (/theme[^/]*\.css/.test(h) || /global[^/]*\.css/.test(h)) return 80;
    if (/variables?[^/]*\.css/.test(h) || /base[^/]*\.css/.test(h)) return 70;
    if (h.includes("/_next/static/css/")) return 40;
    return 10;
  };
  return [...hrefs].sort((a, b) => rank(b) - rank(a));
}

export async function fetchStylesheets(
  hrefs: string[],
  pageUrl: string,
  domain: string,
  limit = 6,
): Promise<string[]> {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const href of prioritizeStylesheetHrefs(hrefs)) {
    const resolved = resolveStylesheetUrl(href, pageUrl);
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    urls.push(resolved);
    if (urls.length >= limit) break;
  }

  const settled = await Promise.all(
    urls.map((url) => fetchTextSafe(url, domain, MAX_CSS_BYTES)),
  );
  return settled.filter((css): css is string => Boolean(css));
}
