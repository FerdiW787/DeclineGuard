import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { withBillingReturnUrl } from "@/lib/billingUrls";

export function PackCheckoutButton({
  className = "dg-btn dg-btn-secondary !px-4 !py-2 cursor-pointer text-xs",
  label = "Buy decline pack",
  busyLabel = "Redirecting to checkout…",
  quantity = 1,
}: {
  className?: string;
  label?: string;
  busyLabel?: string;
  quantity?: number;
}) {
  const createPackCheckout = useAction(
    api.functions.dodoBillingActions.createPackCheckout,
  );
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
              const { checkoutUrl } = await createPackCheckout({
                ...withBillingReturnUrl(),
                quantity,
              });
              window.location.assign(checkoutUrl);
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Could not start pack checkout.",
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
