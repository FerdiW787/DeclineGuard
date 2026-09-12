import { useState } from "react";
import type {
  EmailCodeFactor,
  SignInResource,
  SignInSecondFactor,
} from "@clerk/types";
import { waitForClerkClient } from "./useClerkClient";
import { clerkErrorMessage } from "./clerkErrors";
import OtpInput, { OTP_LENGTH } from "./OtpInput";
import {
  AuthBackLink,
  AuthBrandMark,
  AuthHeading,
  AuthSub,
  AuthSwitch,
} from "./AuthLinear";
import {
  authBtnPrimary,
  authBtnSecondary,
  fieldError,
  fieldInput,
  fieldLabel,
  linkAction,
  mutedText,
} from "./authFieldClasses";

const DASHBOARD = "/a/dashboard";
const SSO_CALLBACK = "/a/sso-callback";

/** Same-origin relative path only (blocks open redirects). */
function postAuthRedirect(): string {
  try {
    const raw = new URLSearchParams(window.location.search).get("redirect");
    if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
      return DASHBOARD;
    }
    return raw;
  } catch {
    return DASHBOARD;
  }
}

type Step = "choose" | "email" | "verify" | "mfa";
type MfaStrategy = "totp" | "phone_code" | "email_code" | "backup_code";

function emailFromQuery(): string {
  try {
    return new URLSearchParams(window.location.search).get("email")?.trim() ?? "";
  } catch {
    return "";
  }
}

export default function CustomSignInForm() {
  const [email, setEmail] = useState(emailFromQuery);
  const [step, setStep] = useState<Step>(() => (emailFromQuery() ? "email" : "choose"));
  const [code, setCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [mfaStrategy, setMfaStrategy] = useState<MfaStrategy>("totp");
  const [primaryMfaStrategy, setPrimaryMfaStrategy] =
    useState<Exclude<MfaStrategy, "backup_code">>("totp");
  const [hasBackupCode, setHasBackupCode] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const codeComplete = code.length === OTP_LENGTH;

  async function activateSession(sessionId: string | null | undefined) {
    if (!sessionId) {
      setError("Couldn’t finish sign-in. Try again.");
      return;
    }
    const clerk = await waitForClerkClient();
    await clerk.setActive({ session: sessionId });
    window.location.href = postAuthRedirect();
  }

  async function prepareMfa(
    signIn: SignInResource,
    factors: SignInSecondFactor[],
  ): Promise<MfaStrategy> {
    const hasTotp = factors.some((f) => f.strategy === "totp");
    const phoneFactor = factors.find((f) => f.strategy === "phone_code");
    const emailFactor = factors.find((f) => f.strategy === "email_code");
    setHasBackupCode(factors.some((f) => f.strategy === "backup_code"));

    if (hasTotp) {
      return "totp";
    }

    if (phoneFactor && phoneFactor.strategy === "phone_code") {
      await signIn.prepareSecondFactor({
        strategy: "phone_code",
        phoneNumberId: phoneFactor.phoneNumberId,
      });
      return "phone_code";
    }

    if (emailFactor && emailFactor.strategy === "email_code") {
      await signIn.prepareSecondFactor({
        strategy: "email_code",
        emailAddressId: emailFactor.emailAddressId,
      });
      return "email_code";
    }

    if (factors.some((f) => f.strategy === "backup_code")) {
      return "backup_code";
    }

    throw new Error("No supported two-factor method is available for this account.");
  }

  function emailCodeFactor(signIn: SignInResource): EmailCodeFactor | undefined {
    return signIn.supportedFirstFactors?.find(
      (factor): factor is EmailCodeFactor => factor.strategy === "email_code",
    );
  }

  async function continueAfterSignIn(result: SignInResource) {
    if (result.status === "complete") {
      await activateSession(result.createdSessionId);
      return;
    }

    if (result.status === "needs_second_factor") {
      const factors = result.supportedSecondFactors ?? [];
      const strategy = await prepareMfa(result, factors);
      setMfaStrategy(strategy);
      if (strategy !== "backup_code") {
        setPrimaryMfaStrategy(strategy);
      }
      setCode("");
      setBackupCode("");
      setStep("mfa");
      return;
    }

    setError("Couldn’t finish sign-in. Try again.");
  }

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const clerk = await waitForClerkClient();
      const result = await clerk.client.signIn.create({
        identifier: email.trim(),
      });
      const emailFactor = emailCodeFactor(result);

      if (emailFactor) {
        await result.prepareFirstFactor({
          strategy: "email_code",
          emailAddressId: emailFactor.emailAddressId,
        });
        setCode("");
        setStep("verify");
        return;
      }

      setError("This account has no email login code available.");
    } catch (err) {
      setError(clerkErrorMessage(err, "Sign in failed"));
    } finally {
      setPending(false);
    }
  }

  async function verifyEmailCode(nextCode: string) {
    const trimmed = nextCode.trim();
    if (pending || trimmed.length < 6) return;
    setError("");
    setPending(true);
    try {
      const clerk = await waitForClerkClient();
      const result = await clerk.client.signIn.attemptFirstFactor({
        strategy: "email_code",
        code: trimmed,
      });
      await continueAfterSignIn(result);
    } catch (err) {
      setError(clerkErrorMessage(err, "Verification failed"));
      setCode("");
    } finally {
      setPending(false);
    }
  }

  async function verifySecondFactor(nextCode: string, strategy: MfaStrategy) {
    if (pending) return;
    if (strategy !== "backup_code" && nextCode.length !== OTP_LENGTH) return;

    setError("");
    setPending(true);
    try {
      const clerk = await waitForClerkClient();
      const signIn = clerk.client.signIn;
      let result: SignInResource;
      switch (strategy) {
        case "totp":
          result = await signIn.attemptSecondFactor({
            strategy: "totp",
            code: nextCode,
          });
          break;
        case "phone_code":
          result = await signIn.attemptSecondFactor({
            strategy: "phone_code",
            code: nextCode,
          });
          break;
        case "email_code":
          result = await signIn.attemptSecondFactor({
            strategy: "email_code",
            code: nextCode,
          });
          break;
        case "backup_code":
          result = await signIn.attemptSecondFactor({
            strategy: "backup_code",
            code: nextCode.trim(),
          });
          break;
        default: {
          const _exhaustive: never = strategy;
          throw new Error(`Unsupported MFA strategy: ${_exhaustive}`);
        }
      }

      if (result.status === "complete") {
        await activateSession(result.createdSessionId);
        return;
      }

      setError("Verification incomplete. Check the code and try again.");
    } catch (err) {
      setError(clerkErrorMessage(err, "Verification failed"));
      if (strategy === "backup_code") {
        setBackupCode("");
      } else {
        setCode("");
      }
    } finally {
      setPending(false);
    }
  }

  async function onVerifyMfa(e: React.FormEvent) {
    e.preventDefault();
    if (mfaStrategy === "backup_code") {
      await verifySecondFactor(backupCode, "backup_code");
      return;
    }
    await verifySecondFactor(code, mfaStrategy);
  }

  async function resendEmailCode() {
    setError("");
    setCode("");
    setPending(true);
    try {
      const clerk = await waitForClerkClient();
      const factor = emailCodeFactor(clerk.client.signIn);
      if (!factor) {
        throw new Error("Couldn’t resend code");
      }
      await clerk.client.signIn.prepareFirstFactor({
        strategy: "email_code",
        emailAddressId: factor.emailAddressId,
      });
    } catch (err) {
      setError(clerkErrorMessage(err, "Couldn’t resend code"));
    } finally {
      setPending(false);
    }
  }

  async function resendCode() {
    if (mfaStrategy !== "phone_code" && mfaStrategy !== "email_code") return;
    setError("");
    setCode("");
    setPending(true);
    try {
      const clerk = await waitForClerkClient();
      const factors = clerk.client.signIn.supportedSecondFactors ?? [];
      await prepareMfa(clerk.client.signIn, factors);
    } catch (err) {
      setError(clerkErrorMessage(err, "Couldn’t resend code"));
    } finally {
      setPending(false);
    }
  }

  function useBackupCodes() {
    setError("");
    setCode("");
    setBackupCode("");
    setMfaStrategy("backup_code");
  }

  function backToPrimaryMfa() {
    setError("");
    setBackupCode("");
    setCode("");
    setMfaStrategy(primaryMfaStrategy);
  }

  async function signInWithGoogle() {
    setError("");
    setPending(true);
    try {
      const clerk = await waitForClerkClient();
      await clerk.client.signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: SSO_CALLBACK,
        redirectUrlComplete: postAuthRedirect(),
      });
    } catch (err) {
      setError(clerkErrorMessage(err, "Google sign-in failed"));
      setPending(false);
    }
  }

  if (step === "mfa") {
    const isBackup = mfaStrategy === "backup_code";
    const hint =
      mfaStrategy === "totp"
        ? "Enter the 6-digit code from your authenticator app."
        : mfaStrategy === "phone_code"
          ? "Enter the 6-digit code we sent to your phone."
          : mfaStrategy === "email_code"
            ? "Enter the 6-digit code we sent to your email."
            : "Enter one of your backup codes.";

    return (
      <div>
        <AuthBrandMark />
        <AuthHeading>
          {mfaStrategy === "totp"
            ? "Two-factor authentication"
            : mfaStrategy === "phone_code"
              ? "Check your phone"
              : mfaStrategy === "backup_code"
                ? "Enter a backup code"
                : "Check your email"}
        </AuthHeading>
        <AuthSub>{hint}</AuthSub>
      <form onSubmit={(e) => void onVerifyMfa(e)} className="mt-6 space-y-4 text-left">

        {isBackup ? (
          <div>
            <label htmlFor="signin-backup-code" className={fieldLabel}>
              Backup code
            </label>
            <input
              id="signin-backup-code"
              name="backupCode"
              type="text"
              autoComplete="one-time-code"
              required
              value={backupCode}
              onChange={(e) => setBackupCode(e.target.value)}
              className={fieldInput}
              placeholder="xxxx-xxxx-xxxx"
              disabled={pending}
              autoFocus
            />
          </div>
        ) : (
          <div>
            <p className={fieldLabel} id="signin-mfa-label">
              Verification code
            </p>
            <OtpInput
              id="signin-mfa-code"
              value={code}
              disabled={pending}
              aria-label="Two-factor verification code"
              onChange={(next) => {
                setCode(next);
                if (next.length === OTP_LENGTH) {
                  void verifySecondFactor(next, mfaStrategy);
                }
              }}
            />
          </div>
        )}

        {error ? <p className={fieldError}>{error}</p> : null}

        <button
          type="submit"
          className={authBtnPrimary}
          disabled={
            pending ||
            (isBackup ? backupCode.trim().length === 0 : !codeComplete)
          }
        >
          {pending ? "Verifying…" : "Continue"}
        </button>

        {(mfaStrategy === "phone_code" || mfaStrategy === "email_code") && (
          <p className={`text-center ${mutedText}`}>
            Didn’t get it?{" "}
            <button
              type="button"
              className={linkAction}
              onClick={() => void resendCode()}
              disabled={pending}
            >
              Resend code
            </button>
          </p>
        )}

        {hasBackupCode && !isBackup ? (
          <p className={`text-center ${mutedText}`}>
            Lost your authenticator?{" "}
            <button
              type="button"
              className={linkAction}
              onClick={useBackupCodes}
              disabled={pending}
            >
              Use a backup code
            </button>
          </p>
        ) : null}

        {isBackup ? (
          <p className={`text-center ${mutedText}`}>
            <button
              type="button"
              className={linkAction}
              onClick={backToPrimaryMfa}
              disabled={pending}
            >
              {primaryMfaStrategy === "totp"
                ? "Use authenticator app instead"
                : "Use verification code instead"}
            </button>
          </p>
        ) : null}

        <div className="pt-1">
          <AuthBackLink
            disabled={pending}
            onClick={() => {
              setStep("email");
              setCode("");
              setBackupCode("");
              setError("");
            }}
          >
            Back
          </AuthBackLink>
        </div>
      </form>
      </div>
    );
  }

  if (step === "verify") {
    return (
      <div>
        <AuthBrandMark />
        <AuthHeading>Check your email</AuthHeading>
        <AuthSub>
          We’ve sent you a temporary login code. Please check your inbox at{" "}
          <span className="font-medium text-[#08090a]">{email}</span>.
        </AuthSub>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verifyEmailCode(code);
          }}
          className="mt-6 space-y-3 text-left"
        >
          <input
            id="signin-code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            value={code}
            onChange={(e) => {
              const next = e.target.value.replace(/\s/g, "");
              setCode(next);
              if (next.length >= 6) {
                void verifyEmailCode(next);
              }
            }}
            className={`${fieldInput} text-center font-mono text-[15px] tracking-[0.18em]`}
            placeholder="••••••"
            disabled={pending}
            aria-label="Email login code"
          />

          {error ? <p className={fieldError}>{error}</p> : null}

          <button
            type="submit"
            className={authBtnPrimary}
            disabled={pending || code.trim().length < 6}
          >
            {pending ? "Verifying…" : "Continue with login code"}
          </button>
        </form>

        <div className="mt-5 flex flex-col items-center gap-3">
          <button
            type="button"
            className="text-[13px] text-[#8a8f98] transition hover:text-[#08090a] disabled:opacity-50"
            onClick={() => void resendEmailCode()}
            disabled={pending}
          >
            Resend code
          </button>
          <AuthBackLink
            disabled={pending}
            onClick={() => {
              setError("");
              setCode("");
              setStep("email");
            }}
          >
            Back
          </AuthBackLink>
        </div>
      </div>
    );
  }

  if (step === "email") {
    return (
      <div>
        <AuthBrandMark />
        <AuthHeading>What’s your email address?</AuthHeading>

        <form onSubmit={(e) => void onEmail(e)} className="mt-6 space-y-3 text-left">
          <input
            id="signin-email"
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldInput}
            placeholder="you@store.com"
            disabled={pending}
            aria-label="Email"
          />

          {error ? <p className={fieldError}>{error}</p> : null}

          <button type="submit" className={authBtnSecondary} disabled={pending}>
            {pending ? "Continuing…" : "Continue with email"}
          </button>
        </form>

        <div className="mt-5">
          <AuthBackLink
            disabled={pending}
            onClick={() => {
              setError("");
              setStep("choose");
            }}
          >
            Back
          </AuthBackLink>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AuthBrandMark />
      <AuthHeading>Log in to DeclineGuard</AuthHeading>

      <div className="mt-6 space-y-2.5">
        <button
          type="button"
          className={authBtnPrimary}
          onClick={() => void signInWithGoogle()}
          disabled={pending}
        >
          Continue with Google
        </button>
        <button
          type="button"
          className={authBtnSecondary}
          onClick={() => {
            setError("");
            setStep("email");
          }}
          disabled={pending}
        >
          Continue with email
        </button>
      </div>

      {error ? <p className={`${fieldError} mt-3`}>{error}</p> : null}

      <div className="mt-6">
        <AuthSwitch
          prompt="Don’t have an account?"
          href="/a/sign-up"
          label="Sign up"
        />
      </div>
    </div>
  );
}
