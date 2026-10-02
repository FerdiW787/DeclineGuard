/**
 * Standard Webhooks HMAC verify (Dodo Payments / Svix-compatible).
 * Spec: signed_content = `{webhook-id}.{webhook-timestamp}.{rawBody}`
 * Secret: optional `whsec_` prefix, then base64 of the signing key.
 * Header: space-separated `v1,<base64>` signatures.
 */

export const STANDARD_WEBHOOK_TOLERANCE_SEC = 5 * 60;

export type StandardWebhookHeaders = {
  id: string;
  timestamp: string;
  signature: string;
};

export function parseStandardWebhookSecret(raw: string): Uint8Array | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const encoded = trimmed.startsWith("whsec_")
    ? trimmed.slice("whsec_".length)
    : trimmed;
  try {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

export function parseStandardWebhookSignatures(header: string): string[] {
  const out: string[] = [];
  for (const part of header.trim().split(/\s+/)) {
    const comma = part.indexOf(",");
    if (comma < 0) continue;
    const version = part.slice(0, comma).trim();
    const value = part.slice(comma + 1).trim();
    if (version === "v1" && value) out.push(value);
  }
  return out;
}

export function standardWebhookTimestampOk(
  timestampHeader: string,
  nowSec: number,
  toleranceSec: number = STANDARD_WEBHOOK_TOLERANCE_SEC,
): boolean {
  if (!/^\d+$/.test(timestampHeader.trim())) return false;
  const ts = Number(timestampHeader.trim());
  if (!Number.isFinite(ts)) return false;
  return Math.abs(nowSec - ts) <= toleranceSec;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a[i]! ^ b[i]!;
  }
  return mismatch === 0;
}

function base64ToBytes(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export async function hmacSha256Base64(
  key: Uint8Array,
  content: string,
): Promise<string> {
  const keyCopy = new Uint8Array(key.byteLength);
  keyCopy.set(key);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyCopy,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(content),
  );
  return bytesToBase64(new Uint8Array(mac));
}

export async function verifyStandardWebhook(args: {
  rawBody: string;
  headers: StandardWebhookHeaders;
  secrets: string[];
  nowSec: number;
  toleranceSec?: number;
}): Promise<boolean> {
  const id = args.headers.id.trim();
  const timestamp = args.headers.timestamp.trim();
  const signatureHeader = args.headers.signature.trim();
  if (!id || !timestamp || !signatureHeader) return false;
  if (
    !standardWebhookTimestampOk(
      timestamp,
      args.nowSec,
      args.toleranceSec ?? STANDARD_WEBHOOK_TOLERANCE_SEC,
    )
  ) {
    return false;
  }

  const provided = parseStandardWebhookSignatures(signatureHeader);
  if (provided.length === 0) return false;

  const signedContent = `${id}.${timestamp}.${args.rawBody}`;
  let anyValid = false;
  for (const secret of args.secrets) {
    const key = parseStandardWebhookSecret(secret);
    if (!key) continue;
    const expectedB64 = await hmacSha256Base64(key, signedContent);
    const expectedBytes = base64ToBytes(expectedB64);
    if (!expectedBytes) continue;
    for (const candidate of provided) {
      const got = base64ToBytes(candidate);
      if (got && bytesEqual(expectedBytes, got)) {
        anyValid = true;
      }
    }
  }
  return anyValid;
}

export function dodoWebhookEventKey(args: {
  webhookId: string;
  eventType: string;
  resourceId: string | null;
}): string {
  const webhookId = args.webhookId.trim();
  if (webhookId) return `dodo:${webhookId}`;
  const resource = args.resourceId?.trim() || "unknown";
  return `dodo:${args.eventType.trim() || "event"}:${resource}`;
}
