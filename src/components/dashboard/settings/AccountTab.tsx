import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import OtpInput, { OTP_LENGTH } from "@/components/auth/OtpInput";
import { clerkErrorMessage } from "@/components/auth/clerkErrors";
import { waitForClerkClient } from "@/components/auth/useClerkClient";
import {
  fieldInputClass,
  SettingsCard,
  SettingsRow,
  SettingsSection,
} from "./SettingsFields";

export function AccountTab({
  email,
  readOnly,
}: {
  email: string;
  readOnly: boolean;
}) {
  const deleteMyAccount = useMutation(api.functions.user.deleteMyAccount);
  const [changeOpen, setChangeOpen] = useState(false);
  const [nextEmail, setNextEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "verify">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteMatches =
    deleteConfirm.trim().toLowerCase() === email.trim().toLowerCase() &&
    email.length > 0;

  async function signOut() {
    const clerk = await waitForClerkClient();
    await clerk.signOut({ redirectUrl: "/" });
    window.location.href = "/";
  }

  async function startChangeEmail() {
    setError(null);
    setBusy(true);
    try {
      const clerk = await waitForClerkClient();
      const user = clerk.user;
      if (!user) throw new Error("Not signed in");
      const created = await user.createEmailAddress({ email: nextEmail.trim() });
      await created.prepareVerification({ strategy: "email_code" });
      setStep("verify");
    } catch (err) {
      setError(clerkErrorMessage(err, "Couldn’t start email change"));
    } finally {
      setBusy(false);
    }
  }

  async function verifyChangeEmail(nextCode: string) {
    const trimmed = nextCode.replace(/\s/g, "");
    if (trimmed.length < OTP_LENGTH || busy) return;
    setError(null);
    setBusy(true);
    try {
      const clerk = await waitForClerkClient();
      const user = clerk.user;
      if (!user) throw new Error("Not signed in");
      const pending = user.emailAddresses.find(
        (item) =>
          item.emailAddress.toLowerCase() === nextEmail.trim().toLowerCase(),
      );
      if (!pending) throw new Error("Email change expired. Start again.");
      await pending.attemptVerification({ code: trimmed });
      await user.update({ primaryEmailAddressId: pending.id });
      setChangeOpen(false);
      setStep("email");
      setNextEmail("");
      setCode("");
    } catch (err) {
      setError(clerkErrorMessage(err, "Verification failed"));
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setDeleteError(null);
    setDeleteBusy(true);
    try {
      await deleteMyAccount({ confirmEmail: deleteConfirm.trim() });
      const clerk = await waitForClerkClient();
      if (clerk.user) {
        await clerk.user.delete();
      }
      await clerk.signOut({ redirectUrl: "/" });
      window.location.href = "/";
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Could not delete account",
      );
      setDeleteBusy(false);
    }
  }

  return (
    <SettingsSection
      title="Account"
      description="Sign-in email and account controls."
    >
      <SettingsCard>
        <SettingsRow title="Email" description="Used to sign in and get codes.">
          <p className="max-w-[16rem] truncate text-[13px] font-medium text-[#08090a]">
            {email || "—"}
          </p>
        </SettingsRow>
        <SettingsRow
          title="Change email"
          description="We’ll send a login code to the new address."
        >
          <button
            type="button"
            disabled={readOnly}
            className="rounded-lg border border-black/8 px-3 py-1.5 text-[12px] font-semibold text-[#6b6f76] transition hover:bg-black/[0.04] hover:text-[#08090a] disabled:opacity-40"
            onClick={() => {
              setChangeOpen(true);
              setStep("email");
              setNextEmail("");
              setCode("");
              setError(null);
            }}
          >
            Change
          </button>
        </SettingsRow>
        <SettingsRow title="Sign out" description="End this session on this device.">
          <button
            type="button"
            disabled={readOnly}
            className="rounded-lg border border-black/8 px-3 py-1.5 text-[12px] font-semibold text-[#6b6f76] transition hover:bg-black/[0.04] hover:text-[#08090a] disabled:opacity-40"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </SettingsRow>
        <SettingsRow
          title="Delete account"
          description="Removes your DeclineGuard data and signs you out."
        >
          <button
            type="button"
            disabled={readOnly}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-[12px] font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-40"
            onClick={() => {
              setDeleteConfirm("");
              setDeleteError(null);
              setDeleteOpen(true);
            }}
          >
            Delete
          </button>
        </SettingsRow>
      </SettingsCard>

      {changeOpen ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="change-email-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setChangeOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-black/8 bg-white p-6">
            <h2
              id="change-email-title"
              className="text-lg font-semibold tracking-tight text-[#08090a]"
            >
              {step === "email" ? "Change email" : "Check your email"}
            </h2>
            {step === "email" ? (
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void startChangeEmail();
                }}
              >
                <label className="block">
                  <span className="text-[12px] font-medium text-[#6b6f76]">
                    New email
                  </span>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={nextEmail}
                    onChange={(e) => setNextEmail(e.target.value)}
                    className={fieldInputClass()}
                    disabled={busy}
                  />
                </label>
                {error ? (
                  <p className="text-xs font-medium text-red-600">{error}</p>
                ) : null}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-[#6b6f76]"
                    disabled={busy}
                    onClick={() => setChangeOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-[#08090a] px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    disabled={busy || !nextEmail.trim()}
                  >
                    {busy ? "Sending…" : "Send code"}
                  </button>
                </div>
              </form>
            ) : (
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void verifyChangeEmail(code);
                }}
              >
                <p className="text-sm text-[#6b6f76]">
                  Enter the code we sent to{" "}
                  <span className="font-medium text-[#08090a]">{nextEmail}</span>.
                </p>
                <OtpInput
                  value={code}
                  onChange={(next) => {
                    setCode(next);
                    if (next.length >= OTP_LENGTH) {
                      void verifyChangeEmail(next);
                    }
                  }}
                  disabled={busy}
                />
                {error ? (
                  <p className="text-xs font-medium text-red-600">{error}</p>
                ) : null}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-[#6b6f76]"
                    disabled={busy}
                    onClick={() => setStep("email")}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-[#08090a] px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    disabled={busy || code.length < OTP_LENGTH}
                  >
                    {busy ? "Verifying…" : "Update email"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {deleteOpen ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleteBusy) {
              setDeleteOpen(false);
            }
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-black/8 bg-white p-6">
            <h2
              id="delete-account-title"
              className="text-lg font-semibold tracking-tight text-[#08090a]"
            >
              Delete account?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#6b6f76]">
              This removes your store connection, recovery history, and
              DeclineGuard account. It cannot be undone.
            </p>
            <label className="mt-5 block">
              <span className="text-xs font-semibold text-[#08090a]">
                Type <span className="font-mono">{email}</span> to confirm
              </span>
              <input
                type="email"
                value={deleteConfirm}
                onChange={(e) => {
                  setDeleteConfirm(e.target.value);
                  setDeleteError(null);
                }}
                autoComplete="off"
                disabled={deleteBusy}
                className={fieldInputClass()}
              />
            </label>
            {deleteError ? (
              <p className="mt-2 text-xs font-medium text-red-600">
                {deleteError}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-black/8 px-4 py-2.5 text-xs font-semibold text-[#6b6f76]"
                disabled={deleteBusy}
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
                disabled={!deleteMatches || deleteBusy}
                onClick={() => void confirmDelete()}
              >
                {deleteBusy ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </SettingsSection>
  );
}
