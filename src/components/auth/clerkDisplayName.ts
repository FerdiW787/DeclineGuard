import { waitForClerkClient } from "./useClerkClient";

export function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0]?.replace(/[._+\-]+/g, " ").trim() ?? "";
  if (!local) return "Store";
  return local.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 50);
}

/** Workspace-less product: the signed-in name is the connected store. */
export async function applyClerkDisplayName(name: string): Promise<void> {
  const clerk = await waitForClerkClient();
  const user = clerk.user;
  if (!user) return;
  const firstName = name.trim().slice(0, 80) || "Store";
  try {
    await user.update({ firstName, lastName: "" });
  } catch {
    await user.update({ firstName });
  }
}
