import type { Clerk, ClientResource, SignUpResource } from "@clerk/types";
import { displayNameFromEmail } from "./clerkDisplayName";

type ReadyClerk = Clerk & { client: ClientResource };

const DASHBOARD = "/a/dashboard";

export function signInUrlForEmail(email: string): string {
  return `/a/sign-in?email=${encodeURIComponent(email.trim())}`;
}

async function activateCreatedSession(
  clerk: ReadyClerk,
  sessionId?: string | null,
): Promise<boolean> {
  const id = sessionId ?? clerk.client.signUp.createdSessionId;
  if (!id) return false;
  await clerk.setActive({ session: id });
  window.location.href = DASHBOARD;
  return true;
}

/** Fill leftover name fields if the instance still collects them. Never invent a password. */
async function fillMissingSignUpFields(
  signUp: SignUpResource,
  email: string,
): Promise<SignUpResource> {
  const missing = new Set(signUp.missingFields ?? []);
  const needsAny =
    signUp.status === "missing_requirements" || missing.size > 0;
  if (!needsAny) return signUp;

  const firstName = displayNameFromEmail(email);
  const update: { firstName?: string; lastName?: string } = {};
  if (missing.size === 0 || missing.has("first_name")) {
    update.firstName = firstName;
  }
  if (missing.has("last_name")) {
    update.lastName = "";
  }
  if (Object.keys(update).length === 0) return signUp;

  return await signUp.update(update);
}

export async function finishSignUp(
  clerk: ReadyClerk,
  email: string,
  signUp: SignUpResource = clerk.client.signUp,
): Promise<boolean> {
  if (await activateCreatedSession(clerk, signUp.createdSessionId)) return true;

  const next = await fillMissingSignUpFields(signUp, email);
  if (await activateCreatedSession(clerk, next.createdSessionId)) return true;

  return false;
}
