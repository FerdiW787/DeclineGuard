import { Webhook } from "svix";

export type SvixHeaders = {
  "svix-id": string;
  "svix-timestamp": string;
  "svix-signature": string;
};

/** Current secret plus optional previous secret for zero-downtime rotation. */
export function webhookSecrets(
  current: string | undefined,
  previous: string | undefined,
): string[] {
  return [current, previous]
    .map((value) => value?.trim())
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

/**
 * Verify a Svix-signed webhook against one or more secrets.
 * Tries each secret in order; throws if none validate.
 */
export function verifySvixPayload<T>(
  payload: string,
  headers: SvixHeaders,
  secrets: string[],
): T {
  if (secrets.length === 0) {
    throw new Error("No webhook secrets configured");
  }

  let lastError: unknown;
  for (const secret of secrets) {
    try {
      return new Webhook(secret).verify(payload, headers) as T;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Invalid signature");
}
