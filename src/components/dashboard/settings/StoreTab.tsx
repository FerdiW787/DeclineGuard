import { useState } from "react";
import {
  SettingsCard,
  SettingsRow,
  SettingsSection,
} from "./SettingsFields";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon } from "@hugeicons/core-free-icons";

export function StoreTab({
  storeName,
  apiKeyLast4,
  testMode,
  onDisconnect,
  allowDisconnect,
  readOnly,
}: {
  storeName: string;
  apiKeyLast4: string;
  testMode: boolean;
  onDisconnect: (confirmStoreName: string) => Promise<void>;
  allowDisconnect: boolean;
  readOnly: boolean;
}) {
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [disconnectConfirm, setDisconnectConfirm] = useState("");
  const [disconnectBusy, setDisconnectBusy] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  const disconnectNameMatches =
    disconnectConfirm.trim() === storeName && storeName.length > 0;

  return (
    <SettingsSection
      title="Store"
      description="Lemon Squeezy connection for this DeclineGuard account."
    >
      <SettingsCard>
        <SettingsRow
          title="API key"
          description="Only the last four characters are stored in the browser."
        >
          <code className="text-[13px] text-muted-foreground">···{apiKeyLast4}</code>
        </SettingsRow>
        <SettingsRow
          title="Environment"
          description={
            testMode
              ? "Test mode — recoveries won’t hit live customers."
              : "Live mode — webhooks come from your production store."
          }
        >
          <span className="text-[13px] font-medium text-foreground">
            {testMode ? "Test" : "Live"}
          </span>
        </SettingsRow>
        <SettingsRow
          title="Disconnect store"
          description="Removes this connection and recovery history. Brand customizations stay if you reconnect."
        >
          {allowDisconnect && !readOnly ? (
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold text-muted-foreground transition hover:bg-black/[0.04] hover:text-foreground"
              onClick={() => {
                setDisconnectConfirm("");
                setDisconnectError(null);
                setDisconnectOpen(true);
              }}
            >
              Disconnect
            </button>
          ) : (
            <span className="text-[12px] font-medium text-muted-foreground">
              Disabled
            </span>
          )}
        </SettingsRow>
      </SettingsCard>

      {disconnectOpen ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="disconnect-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !disconnectBusy) {
              setDisconnectOpen(false);
            }
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.45)]">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10">
                <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-5 text-red-600" />
              </span>
              <div className="min-w-0">
                <h2
                  id="disconnect-title"
                  className="text-lg font-semibold tracking-tight text-foreground"
                >
                  Disconnect {storeName}?
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  This permanently removes your Lemon Squeezy connection and
                  all recovery history for this account. It cannot be undone.
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-2 rounded-lg bg-black/[0.03] px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
              <li>Failed payments, recoveries, and activity feed are deleted</li>
              <li>Pending Day 2 / Day 5 recovery emails are cancelled</li>
              <li>Webhook event log for this store is cleared</li>
              <li>Brand & email customizations are kept if you reconnect</li>
            </ul>

            <label className="mt-5 block">
              <span className="text-xs font-semibold text-foreground">
                Type <span className="font-mono">{storeName}</span> to confirm
              </span>
              <input
                type="text"
                value={disconnectConfirm}
                onChange={(e) => {
                  setDisconnectConfirm(e.target.value);
                  setDisconnectError(null);
                }}
                autoComplete="off"
                spellCheck={false}
                placeholder={storeName}
                disabled={disconnectBusy}
                className="mt-2 w-full rounded-lg border border-black/12 bg-white px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-black/30"
              />
            </label>

            {disconnectError ? (
              <p className="mt-2 text-xs font-medium text-red-600">
                {disconnectError}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-black/[0.04]"
                disabled={disconnectBusy}
                onClick={() => setDisconnectOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!disconnectNameMatches || disconnectBusy}
                onClick={() => {
                  void (async () => {
                    setDisconnectBusy(true);
                    setDisconnectError(null);
                    try {
                      await onDisconnect(disconnectConfirm.trim());
                      setDisconnectOpen(false);
                    } catch (err) {
                      setDisconnectError(
                        err instanceof Error
                          ? err.message
                          : "Could not disconnect store",
                      );
                    } finally {
                      setDisconnectBusy(false);
                    }
                  })();
                }}
              >
                {disconnectBusy ? "Disconnecting…" : "Disconnect & delete history"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </SettingsSection>
  );
}
