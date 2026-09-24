import { useState } from "react";
import { useAuth } from "@clerk/astro/react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

const SIGN_UP_HREF = "/a/sign-up?redirect=/pricing";

function defaultReturnUrl(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/a/dashboard?billing=1`;
}

export function ProCheckoutButton({
  className = "ln-btn-primary w-full justify-center",
  label = "Get Pro",
  busyLabel = "Redirecting to checkout…",
}: {
  className?: string;
  label?: string;
  busyLabel?: string;
}) {
  const { isSignedIn, isLoaded } = useAuth();
  const hasConvex = Boolean(import.meta.env.PUBLIC_CONVEX_URL);

  if (!isLoaded) {
    return (
      <span className={className} aria-disabled>
        {label}
      </span>
    );
  }

  if (!isSignedIn) {
    return (
      <a href={SIGN_UP_HREF} className={className}>
        {label}
      </a>
    );
  }

  if (!hasConvex) {
    return (
      <a href="/a/dashboard?upgrade=pro" className={className}>
        {label}
      </a>
    );
  }

  return (
    <ProCheckoutButtonConnected
      className={className}
      label={label}
      busyLabel={busyLabel}
    />
  );
}

function ProCheckoutButtonConnected({
  className,
  label,
  busyLabel,
}: {
  className: string;
  label: string;
  busyLabel: string;
}) {
  const createCheckout = useAction(
    api.functions.lemonSqueezyActions.createProCheckout,
  );
  const ensureCurrentUser = useMutation(api.functions.user.ensureCurrentUser);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="w-full">
      <button
        type="button"
        className={`${className} disabled:opacity-50`}
        disabled={busy}
        onClick={() => {
          void (async () => {
            setBusy(true);
            setError(null);
            try {
              await ensureCurrentUser({});
              const { checkoutUrl } = await createCheckout({
                returnUrl: defaultReturnUrl(),
              });
              window.location.assign(checkoutUrl);
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Could not start Pro checkout.",
              );
              setBusy(false);
            }
          })();
        }}
      >
        {busy ? busyLabel : label}
      </button>
      {error ? (
        <p className="mt-2 text-center text-[12px] text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}
