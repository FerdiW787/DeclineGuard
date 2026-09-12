/**
 * Resolve Resend `from` address.
 * - No env → Resend test sender
 * - @resend.dev → keep test sender
 * - Verified domain → "Display Name <email@domain>"
 */
export function resolveFromAddress(displayName: string): string {
  const envFrom = process.env.RESEND_FROM_EMAIL?.trim();
  if (!envFrom) {
    return "DeclineGuard <onboarding@resend.dev>";
  }

  const angled = envFrom.match(/^(.*?)\s*<([^>]+)>$/);
  const bare = !angled ? envFrom.match(/^([^\s<>]+@[^\s<>]+)$/) : null;
  const email = (angled?.[2] ?? bare?.[1] ?? "").trim();
  if (!email) return envFrom;

  if (email.toLowerCase().endsWith("@resend.dev")) {
    return envFrom.includes("<") ? envFrom : `DeclineGuard <${email}>`;
  }

  const name = displayName.trim().replace(/[<>]/g, "") || "DeclineGuard";
  return `${name} <${email}>`;
}

export function isProductionFromAddress(fromAddress: string): boolean {
  return !fromAddress.toLowerCase().includes("@resend.dev");
}
