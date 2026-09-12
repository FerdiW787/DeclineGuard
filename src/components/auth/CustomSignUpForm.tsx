import { useRef, useState } from "react";
import { waitForClerkClient } from "./useClerkClient";
import {
  clerkErrorMessage,
  isAlreadyVerifiedError,
  isIdentifierExistsError,
} from "./clerkErrors";
import { displayNameFromEmail } from "./clerkDisplayName";
import { finishSignUp, signInUrlForEmail } from "./finishSignUp";
import {
  AuthBackLink,
  AuthBrandMark,
  AuthHeading,
  AuthLegal,
  AuthSub,
  AuthSwitch,
} from "./AuthLinear";
import {
  authBtnPrimary,
  authBtnSecondary,
  fieldError,
  fieldInput,
} from "./authFieldClasses";

const SSO_CALLBACK = "/a/sso-callback";
const DASHBOARD = "/a/dashboard";

type Step = "choose" | "email" | "verify";

export default function CustomSignUpForm() {
  const [step, setStep] = useState<Step>("choose");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const verifyingRef = useRef(false);

  function goTo(next: Step) {
    setError("");
    setStep(next);
  }

  function goToSignIn() {
    window.location.href = signInUrlForEmail(email);
  }

  async function startEmailSignUp() {
    const clerk = await waitForClerkClient();
    try {
      await clerk.client.signUp.create({
        emailAddress: email.trim(),
        firstName: displayNameFromEmail(email),
      });
    } catch (err) {
      if (isIdentifierExistsError(err)) {
        goToSignIn();
        return;
      }
      throw err;
    }

    if ((clerk.client.signUp.unverifiedFields ?? []).includes("email_address")) {
      await clerk.client.signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      });
      setStep("verify");
      return;
    }

    if (!(await finishSignUp(clerk, email))) {
      goToSignIn();
    }
  }

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      await startEmailSignUp();
    } catch (err) {
      if (isIdentifierExistsError(err)) {
        goToSignIn();
        return;
      }
      setError(clerkErrorMessage(err, "Sign up failed"));
    } finally {
      setPending(false);
    }
  }

  async function verifyCode(nextCode: string) {
    const trimmed = nextCode.replace(/\s/g, "");
    if (verifyingRef.current || trimmed.length < 6) return;
    verifyingRef.current = true;
    setError("");
    setPending(true);
    try {
      const clerk = await waitForClerkClient();
      try {
        const result = await clerk.client.signUp.attemptEmailAddressVerification({
          code: trimmed,
        });
        if (!(await finishSignUp(clerk, email, result))) {
          goToSignIn();
        }
      } catch (err) {
        if (isAlreadyVerifiedError(err) || isIdentifierExistsError(err)) {
          if (!(await finishSignUp(clerk, email))) {
            goToSignIn();
          }
          return;
        }
        throw err;
      }
    } catch (err) {
      if (isIdentifierExistsError(err)) {
        goToSignIn();
        return;
      }
      setError(clerkErrorMessage(err, "Verification failed"));
      setCode("");
    } finally {
      verifyingRef.current = false;
      setPending(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    await verifyCode(code);
  }

  async function resendCode() {
    setError("");
    setCode("");
    setPending(true);
    try {
      const clerk = await waitForClerkClient();
      const verified =
        clerk.client.signUp.verifications.emailAddress?.status === "verified";
      if (verified || clerk.client.signUp.createdSessionId) {
        if (!(await finishSignUp(clerk, email))) {
          goToSignIn();
        }
        return;
      }
      await clerk.client.signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      });
    } catch (err) {
      if (isAlreadyVerifiedError(err) || isIdentifierExistsError(err)) {
        try {
          const clerk = await waitForClerkClient();
          if (!(await finishSignUp(clerk, email))) {
            goToSignIn();
          }
          return;
        } catch {
          goToSignIn();
          return;
        }
      }
      setError(clerkErrorMessage(err, "Couldn’t resend code"));
    } finally {
      setPending(false);
    }
  }

  async function signUpWithGoogle() {
    setError("");
    setPending(true);
    try {
      const clerk = await waitForClerkClient();
      await clerk.client.signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: SSO_CALLBACK,
        redirectUrlComplete: DASHBOARD,
      });
    } catch (err) {
      setError(clerkErrorMessage(err, "Google sign-up failed"));
      setPending(false);
    }
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

        <form onSubmit={(e) => void onVerify(e)} className="mt-6 space-y-3 text-left">
          <input
            id="signup-code"
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
                void verifyCode(next);
              }
            }}
            className={`${fieldInput} text-center font-mono text-[15px] tracking-[0.18em]`}
            placeholder="••••••"
            disabled={pending}
            aria-label="Email verification code"
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
            onClick={() => void resendCode()}
            disabled={pending}
          >
            Resend code
          </button>
          <AuthBackLink
            disabled={pending}
            onClick={() => {
              setCode("");
              goTo("email");
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
            id="signup-email"
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
            aria-label="Email address"
          />

          {error ? <p className={fieldError}>{error}</p> : null}

          <button type="submit" className={authBtnSecondary} disabled={pending}>
            {pending ? "Continuing…" : "Continue with email"}
          </button>
        </form>

        <div className="mt-5">
          <AuthBackLink disabled={pending} onClick={() => goTo("choose")}>
            Back
          </AuthBackLink>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AuthBrandMark />
      <AuthHeading>Create your account</AuthHeading>

      <div className="mt-6 space-y-2.5">
        <button
          type="button"
          className={authBtnPrimary}
          onClick={() => void signUpWithGoogle()}
          disabled={pending}
        >
          Continue with Google
        </button>
        <button
          type="button"
          className={authBtnSecondary}
          onClick={() => goTo("email")}
          disabled={pending}
        >
          Continue with email
        </button>
      </div>

      {error ? <p className={`${fieldError} mt-3`}>{error}</p> : null}

      <div className="mt-6 space-y-4">
        <AuthLegal />
        <AuthSwitch
          prompt="Already have an account?"
          href="/a/sign-in"
          label="Log in"
        />
      </div>
    </div>
  );
}
