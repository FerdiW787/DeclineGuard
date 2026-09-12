import { useEffect, useState } from "react";
import {
  fieldInputClass,
  SettingsCard,
  SettingsRow,
  SettingsSection,
} from "./SettingsFields";
import type { SettingsEmailSetup } from "./settingsTypes";

export function EmailTab({
  storeName,
  emailSetup,
  onSaveSender,
  readOnly,
}: {
  storeName: string;
  emailSetup: SettingsEmailSetup | undefined;
  onSaveSender: (fromName: string, replyToEmail: string) => Promise<void>;
  readOnly: boolean;
}) {
  const [fromName, setFromName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [senderBusy, setSenderBusy] = useState(false);
  const [senderMsg, setSenderMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!emailSetup) return;
    setFromName(emailSetup.fromName ?? storeName);
    setReplyTo(emailSetup.replyToEmail ?? "");
  }, [emailSetup, storeName]);

  if (emailSetup === undefined) {
    return (
      <SettingsSection title="Email" description="How recovery emails are sent.">
        <p className="text-sm text-[#8a8f98]">Loading email setup…</p>
      </SettingsSection>
    );
  }

  if (emailSetup === null) {
    return (
      <SettingsSection title="Email" description="How recovery emails are sent.">
        <p className="text-sm text-[#8a8f98]">Email setup unavailable.</p>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title="Email"
      description="From address and reply-to for recovery messages."
    >
      <SettingsCard>
        <SettingsRow
          title="From address"
          description={
            emailSetup.hasApiKey
              ? "Production sending needs a verified domain in Resend."
              : "RESEND_API_KEY is not set — emails will not send."
          }
        >
          <div className="text-right">
            <p className="max-w-[16rem] truncate text-[13px] font-medium text-[#08090a]">
              {emailSetup.fromAddress}
            </p>
            <span
              className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                emailSetup.isProduction
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-amber-50 text-amber-800"
              }`}
            >
              {emailSetup.isProduction ? "Production" : "Test sender"}
            </span>
          </div>
        </SettingsRow>
      </SettingsCard>

      {!emailSetup.isProduction ? (
        <p className="text-[12px] leading-relaxed text-[#8a8f98]">
          Still on Resend’s test sender — you can only email your Resend account
          address. Verify a domain at resend.com/domains, then set{" "}
          <code className="rounded bg-black/5 px-1 py-0.5">RESEND_FROM_EMAIL</code>{" "}
          on Convex.
        </p>
      ) : null}

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (readOnly) return;
          setSenderBusy(true);
          setSenderMsg(null);
          void onSaveSender(fromName, replyTo)
            .then(() => setSenderMsg("Saved"))
            .catch((err: unknown) => {
              setSenderMsg(
                err instanceof Error ? err.message : "Could not save",
              );
            })
            .finally(() => setSenderBusy(false));
        }}
      >
        <label className="block">
          <span className="text-[12px] font-medium text-[#6b6f76]">
            From display name
          </span>
          <input
            type="text"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            className={fieldInputClass()}
            placeholder={storeName}
            disabled={readOnly || senderBusy}
          />
        </label>
        <label className="block">
          <span className="text-[12px] font-medium text-[#6b6f76]">
            Reply-To email
          </span>
          <input
            type="email"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            className={fieldInputClass()}
            placeholder="support@yourdomain.com"
            disabled={readOnly || senderBusy}
          />
          <span className="mt-1 block text-[12px] text-[#8a8f98]">
            Optional — where customer replies go.
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={readOnly || senderBusy}
            className="rounded-lg bg-[#08090a] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-black/85 disabled:opacity-50"
          >
            {senderBusy ? "Saving…" : "Save sender"}
          </button>
          {senderMsg ? (
            <span className="text-[12px] text-[#8a8f98]">{senderMsg}</span>
          ) : null}
        </div>
      </form>
    </SettingsSection>
  );
}
