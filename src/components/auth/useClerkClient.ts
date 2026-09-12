import { useSyncExternalStore } from "react";
import { $clerkStore, $isLoadedStore, $userStore } from "@clerk/astro/client";
import type { Clerk, ClientResource, UserResource } from "@clerk/types";

type ReadyClerk = Clerk & { client: ClientResource };

/** Clerk instance from Astro's client store (no nested ClerkProvider). */
export function useClerkClient() {
  const clerk = useSyncExternalStore(
    (onChange) => $clerkStore.subscribe(onChange),
    () => $clerkStore.get(),
    () => null,
  );

  const isLoaded = useSyncExternalStore(
    (onChange) => $isLoadedStore.subscribe(onChange),
    () => $isLoadedStore.get(),
    () => false,
  );

  return { clerk, isLoaded };
}

/** Current user from Astro's client store (`@clerk/astro/react` has no useUser). */
export function useClerkUser(): UserResource | null | undefined {
  return useSyncExternalStore(
    (onChange) => $userStore.subscribe(onChange),
    () => $userStore.get(),
    () => undefined,
  );
}

export function requireClerkClient(
  clerk: Clerk | null,
): asserts clerk is ReadyClerk {
  if (!clerk?.client) {
    throw new Error("Clerk is not ready yet");
  }
}

/** Wait until Clerk is ready so forms can render immediately and submit later. */
export async function waitForClerkClient(
  timeoutMs = 12_000,
): Promise<ReadyClerk> {
  const ready = $clerkStore.get();
  if ($isLoadedStore.get() && ready?.client) {
    return ready as ReadyClerk;
  }

  return await new Promise<ReadyClerk>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      unsubClerk();
      unsubLoaded();
      reject(
        new Error("Auth is taking longer than expected. Refresh and try again."),
      );
    }, timeoutMs);

    const tryResolve = () => {
      const next = $clerkStore.get();
      if ($isLoadedStore.get() && next?.client) {
        window.clearTimeout(timer);
        unsubClerk();
        unsubLoaded();
        resolve(next as ReadyClerk);
      }
    };

    const unsubClerk = $clerkStore.subscribe(tryResolve);
    const unsubLoaded = $isLoadedStore.subscribe(tryResolve);
    tryResolve();
  });
}
