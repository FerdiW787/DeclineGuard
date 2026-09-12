import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import {
  SettingsCard,
  SettingsRow,
  SettingsSection,
} from "./SettingsFields";

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
          <code className="text-[13px] text-[#6b6f76]">···{apiKeyLast4}</code>
        </SettingsRow>
        <SettingsRow
          title="Environment"
          description={
            testMode
              ? "Test mode — recoveries won’t hit live customers."
              : "Live mode — webhooks come from your production store."
          }
        >
          <span className="text-[13px] font-medium text-[#08090a]">
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
              className="rounded-lg border border-black/8 px-3 py-1.5 text-[12px] font-semibold text-[#6b6f76] transition hover:bg-black/[0.04] hover:text-[#08090a]"
              onClick={() => {
                setDisconnectConfirm("");
                setDisconnectError(null);
                setDisconnectOpen(true);
              }}
            >
              Disconnect
            </button>
          ) : (
            <span className="text-[12px] font-medium text-[#8a8f98]">
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
          <div className="w-full max-w-md rounded-xl border border-black/8 bg-white p-6 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.45)]">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10">
                <TriangleAlert className="size-5 text-red-600" />
              </span>
              <div className="min-w-0">
                <h2
                  id="disconnect-title"
                  className="text-lg font-semibold tracking-tight text-[#08090a]"
                >
                  Disconnect {storeName}?
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[#6b6f76]">
                  This permanently removes your Lemon Squeezy connection and
                  all recovery history for this account. It cannot be undone.
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-2 rounded-lg bg-black/[0.03] px-4 py-3 text-[13px] leading-relaxed text-[#6b6f76]">
              <li>Failed payments, recoveries, and activity feed are deleted</li>
              <li>Pending Day 2 / Day 5 recovery emails are cancelled</li>
              <li>Webhook event log for this store is cleared</li>
              <li>Brand & email customizations are kept if you reconnect</li>
            </ul>

            <label className="mt-5 block">
              <span className="text-xs font-semibold text-[#08090a]">
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
                className="mt-2 w-full rounded-lg border border-black/12 bg-white px-3.5 py-2.5 text-sm text-[#08090a] outline-none placeholder:text-[#8a8f98] focus:border-black/30"
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
                className="rounded-lg border border-black/8 px-4 py-2.5 text-xs font-semibold text-[#6b6f76] transition hover:bg-black/[0.04]"
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
