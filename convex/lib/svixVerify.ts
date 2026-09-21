import { Webhook } from "svix";

/**
 * Collect current + previous webhook secrets, dropping empty/whitespace values.
 * Either secret may validate during a rotation window.
 */
export function collectWebhookSecrets(
  current: string | undefined,
  previous: string | undefined,
): string[] {
  return [current, previous]
    .map((s) => s?.trim())
    .filter((s): s is string => typeof s === "string" && s.length > 0);
}

/**
 * Verify a Svix-signed payload against any of the given secrets.
 * Succeeds on the first valid signature; throws if none validate.
 */
export function verifySvixPayload(
  payload: string,
  headers: {
    "svix-id": string;
    "svix-timestamp": string;
    "svix-signature": string;
  },
  secrets: string[],
): unknown {
  let lastError: unknown;
  for (const secret of secrets) {
    try {
      return new Webhook(secret).verify(payload, headers);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error("Webhook verification failed");
}
