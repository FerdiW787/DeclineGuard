import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { withBillingReturnUrl } from "@/lib/billingUrls";

export function BillingPortalButton({
  className = "dg-btn dg-btn-secondary !px-4 !py-2 cursor-pointer text-xs",
  label = "Manage billing",
  busyLabel = "Opening portal…",
}: {
  className?: string;
  label?: string;
  busyLabel?: string;
}) {
  const createPortal = useAction(
    api.functions.lemonSqueezyActions.createBillingPortal,
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
              const { portalUrl } = await createPortal({
                ...withBillingReturnUrl(),
              });
              window.location.assign(portalUrl);
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Could not open the billing portal.",
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
