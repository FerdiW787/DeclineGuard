/** Client-side domain normalization (mirrors convex/lib/brandImport/domain.ts) */

export function normalizeDomainInput(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/\/.*$/, "");
  s = s.replace(/^www\./, "");
  s = s.replace(/:\d+$/, "");
  return s;
}

export function validateDomainInputClient(raw: string): string {
  const domain = normalizeDomainInput(raw);
  if (!domain || domain.length > 253) {
    throw new Error("Enter a valid domain like yourstore.com");
  }
  if (
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
      domain,
    )
  ) {
    throw new Error("Enter a valid domain like yourstore.com");
  }
  return domain;
}
