/**
 * Encrypt Lemon Squeezy API keys at rest.
 * Requires Convex env: LS_TOKEN_ENCRYPTION_KEY (32-byte key as 64 hex chars).
 * Generate: openssl rand -hex 32
 */

function requireEncryptionKey(): Uint8Array {
  const raw = process.env.LS_TOKEN_ENCRYPTION_KEY;
  if (!raw || raw.trim().length === 0) {
    throw new Error(
      "Missing LS_TOKEN_ENCRYPTION_KEY. Set it with: npx convex env set LS_TOKEN_ENCRYPTION_KEY $(openssl rand -hex 32)",
    );
  }

  const hex = raw.trim();
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "LS_TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes).",
    );
  }

  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function asBufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

async function importKey(): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    asBufferSource(requireEncryptionKey()),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

const B64 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const triple = (a << 16) | (b << 8) | c;
    out += B64[(triple >> 18) & 63] ?? "";
    out += B64[(triple >> 12) & 63] ?? "";
    out += i + 1 < bytes.length ? (B64[(triple >> 6) & 63] ?? "") : "=";
    out += i + 2 < bytes.length ? (B64[triple & 63] ?? "") : "=";
  }
  return out;
}

function fromBase64(value: string): Uint8Array {
  const clean = value.replace(/=+$/, "");
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      ((B64.indexOf(clean[i] ?? "A") & 63) << 18) |
      ((B64.indexOf(clean[i + 1] ?? "A") & 63) << 12) |
      ((B64.indexOf(clean[i + 2] ?? "A") & 63) << 6) |
      (B64.indexOf(clean[i + 3] ?? "A") & 63);
    out.push((n >> 16) & 255);
    if (clean[i + 2] !== undefined) out.push((n >> 8) & 255);
    if (clean[i + 3] !== undefined) out.push(n & 255);
  }
  return new Uint8Array(out);
}

/** Returns `iv.ciphertext` as base64.iv + "." + base64.ciphertext */
export async function encryptApiKey(plaintext: string): Promise<string> {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asBufferSource(iv) },
    key,
    encoded,
  );
  return `${toBase64(iv)}.${toBase64(new Uint8Array(cipherBuf))}`;
}

export async function decryptApiKey(payload: string): Promise<string> {
  const [ivB64, cipherB64] = payload.split(".");
  if (!ivB64 || !cipherB64) {
    throw new Error("Invalid encrypted API key payload");
  }
  const key = await importKey();
  const iv = fromBase64(ivB64);
  const cipher = fromBase64(cipherB64);
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: asBufferSource(iv) },
    key,
    asBufferSource(cipher),
  );
  return new TextDecoder().decode(plainBuf);
}

export function apiKeyLast4(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 4) return trimmed;
  return trimmed.slice(-4);
}
