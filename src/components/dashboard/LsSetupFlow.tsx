import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import gsap from "gsap";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { validateDomainInputClient } from "@/lib/brandDomain";
import {
  normalizeEmailFont,
  type EmailFontId,
} from "@/lib/emailFonts";
import { DEFAULT_EMAIL_COPY } from "@/lib/recoveryEmailCopy";
import EmailPreviewBody from "./EmailPreviewBody";
import { applyClerkDisplayName } from "@/components/auth/clerkDisplayName";
import {
  AuthBrandMark,
  AuthHeading,
  AuthProgressDots,
  AuthSub,
} from "@/components/auth/AuthLinear";
import {
  authBtnPrimary,
  authBtnPrimaryCompact,
  fieldError,
  fieldInput,
  fieldLabel,
} from "@/components/auth/authFieldClasses";
import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Webhook,
} from "lucide-react";

type StoreOption = {
  id: string;
  name: string;
  slug: string;
};

type BrandKit = {
  domain: string;
  brandColor: string;
  secondaryColor: string;
  mutedTextColor: string;
  linkColor: string;
  pageBackgroundColor: string;
  pageTextColor: string;
  emailFont: EmailFontId;
  fontFamilyRaw: string | null;
  fromName: string;
  storeLogoUrl: string | null;
  ctaBackgroundColor: string;
  ctaTextColor: string;
  ctaBorderRadiusPx: number;
  emailBackgroundColor: string;
  emailTextColor: string;
  captureMethod: "browser" | "css" | "defaults";
};

const BRAND_SCAN_TIMEOUT_MS = 28_000;

function brandScanErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) {
    const msg = err.message.trim();
    if (/couldn't be completed|try again later/i.test(msg)) {
      return "Scan failed — the site may be too heavy. Try again in a moment.";
    }
    return msg;
  }
  if (typeof err === "string" && err.trim()) return err.trim();
  return "Couldn’t scan that domain";
}

type BrandPhase = "idle" | "scanning" | "ready" | "saving";

type Step = "welcome" | "link" | "webhook" | "verifying" | "brand" | "done";

type Props = {
  open: boolean;
  /** Walk UI without calling Lemon Squeezy / Convex mutations */
  preview?: boolean;
  /** Mount connected dashboard under the overlay before it slides away */
  onReveal: () => void;
  /** Overlay finished sliding — unmount the wizard */
  onComplete: () => void;
};

const PREVIEW_WEBHOOK_SETUP = {
  callbackUrl: "https://preview.declineguard.app/lemonsqueezy",
  serverConfigured: true,
} as const;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

const DEFAULT_BRAND = "#0c0c0c";
const DEFAULT_TEMPLATE = "gentle" as const;
const VERIFY_TIMEOUT_MS = 75_000;

const FLOW_STEPS = ["welcome", "link", "webhook", "brand"] as const;

function flowStepIndex(step: Step): number {
  if (step === "done") return FLOW_STEPS.length;
  if (step === "verifying") return FLOW_STEPS.indexOf("webhook");
  return FLOW_STEPS.indexOf(step);
}

export default function LsSetupFlow({ open, preview = false, onReveal, onComplete }: Props) {
  const connectStore = useAction(api.functions.lemonSqueezyActions.connectStore);
  const installStoreWebhook = useAction(
    api.functions.lemonSqueezyActions.installStoreWebhook,
  );
  const sendWebhookTestPing = useAction(
    api.functions.lemonSqueezyActions.sendWebhookTestPing,
  );
  const saveRecoverySettings = useMutation(
    api.functions.recoverySettings.saveSettings,
  );
  const importBrand = useAction(
    api.functions.brandImportActions.importBrandFromDomain,
  );
  const completeBrandImport = useMutation(
    api.functions.recoverySettings.completeBrandImport,
  );
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const verifyPulseRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<Step>("welcome");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [pendingStores, setPendingStores] = useState<StoreOption[] | null>(
    null,
  );
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [linkError, setLinkError] = useState("");
  const [linking, setLinking] = useState(false);
  const [webhookError, setWebhookError] = useState("");
  const [installingWebhook, setInstallingWebhook] = useState(false);
  const [showManualWebhook, setShowManualWebhook] = useState(false);
  /** True after API install (or a successful ping). Skips waiting on LS “Send test”. */
  const [, setWebhookReady] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [pingError, setPingError] = useState("");
  /** Only count webhook deliveries after this connect (ignores old store history). */
  const [setupSessionSinceMs, setSetupSessionSinceMs] = useState<number | null>(
    null,
  );
  const [verifyStartedAt, setVerifyStartedAt] = useState<number | null>(null);
  const [brandPhase, setBrandPhase] = useState<BrandPhase>("idle");
  const [brandDomain, setBrandDomain] = useState("");
  const [brandError, setBrandError] = useState("");
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);

  const completedRef = useRef(false);
  const revealedRef = useRef(false);
  const verifyFailHandledRef = useRef(false);

  const connected = step !== "link";
  const webhookSetupQuery = useQuery(
    api.functions.lemonSqueezy.getWebhookSetup,
    open && connected && !preview ? {} : "skip",
  );
  /** Fresh delivery only — events from before this setup session do not count. */
  const webhookStatus = useQuery(
    api.functions.lemonSqueezy.getWebhookStatus,
    open && step === "verifying" && setupSessionSinceMs != null && !preview
      ? { sinceMs: setupSessionSinceMs }
      : "skip",
  );
  const webhookSetup = preview
    ? PREVIEW_WEBHOOK_SETUP
    : webhookSetupQuery;

  const connection = useQuery(
    api.functions.lemonSqueezy.getConnection,
    open && !preview && step === "brand" ? {} : "skip",
  );

  // Reset when opened
  useEffect(() => {
    if (!open) return;
    completedRef.current = false;
    revealedRef.current = false;
    verifyFailHandledRef.current = false;
    setStep("welcome");
    setApiKey("");
    setShowKey(false);
    setStoreName("");
    setPendingStores(null);
    setSelectedStoreId(null);
    setLinkError("");
    setLinking(false);
    setWebhookError("");
    setInstallingWebhook(false);
    setShowManualWebhook(false);
    setWebhookReady(false);
    setPinging(false);
    setPingError("");
    setSetupSessionSinceMs(null);
    setVerifyStartedAt(null);
    setBrandPhase("idle");
    setBrandDomain("");
    setBrandError("");
    setBrandKit(null);
    gsap.set(overlayRef.current, { yPercent: 0, clearProps: "transform" });
  }, [open]);

  const goToWebhook = useCallback(() => {
    setWebhookError("");
    setStep("webhook");
  }, []);

  const linkStore = useCallback(async () => {
    if (linking) return;
    if (!preview && !apiKey.trim()) return;
    setLinking(true);
    setLinkError("");
    try {
      if (preview) {
        await delay(550);
        setStoreName("Acme Preview");
        setApiKey("");
        setPendingStores(null);
        setSelectedStoreId(null);
        setSetupSessionSinceMs(Date.now());
        setWebhookReady(false);
        goToWebhook();
        return;
      }

      const result = await connectStore({
        apiKey: apiKey.trim(),
        storeId: selectedStoreId ?? undefined,
      });

      if (result.status === "pick_store") {
        setPendingStores(result.stores);
        setSelectedStoreId(result.stores[0]?.id ?? null);
        return;
      }

      setStoreName(result.storeName);
      void applyClerkDisplayName(result.storeName).catch(() => {
        /* display name is best-effort */
      });
      setApiKey("");
      setPendingStores(null);
      setSelectedStoreId(null);
      // Gate verify on deliveries after this moment (not historical store events).
      setSetupSessionSinceMs(Date.now());
      setWebhookReady(false);
      // Defaults for first-time settings row (brand can be refined next)
      void saveRecoverySettings({
        brandColor: DEFAULT_BRAND,
        templateId: DEFAULT_TEMPLATE,
      }).catch((err) => {
        console.error("Failed to save recovery settings", err);
      });
      goToWebhook();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Couldn’t connect store";
      setLinkError(message);
    } finally {
      setLinking(false);
    }
  }, [
    linking,
    preview,
    apiKey,
    selectedStoreId,
    connectStore,
    saveRecoverySettings,
    goToWebhook,
  ]);

  const installWebhook = useCallback(async () => {
    if (installingWebhook) return;
    setInstallingWebhook(true);
    setWebhookError("");
    try {
      if (preview) {
        await delay(700);
        setWebhookReady(true);
        setSetupSessionSinceMs((prev) => prev ?? Date.now());
        setVerifyStartedAt(Date.now());
        setStep("verifying");
        return;
      }
      await installStoreWebhook({});
      setWebhookReady(true);
      setSetupSessionSinceMs((prev) => prev ?? Date.now());
      setVerifyStartedAt(Date.now());
      setPingError("");
      setStep("verifying");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Couldn’t install the webhook automatically";
      setWebhookError(message);
      setShowManualWebhook(true);
    } finally {
      setInstallingWebhook(false);
    }
  }, [installingWebhook, installStoreWebhook, preview]);

  const runTestPing = useCallback(async () => {
    if (pinging) return;
    setPinging(true);
    setPingError("");
    try {
      if (preview) {
        await delay(650);
        setWebhookReady(true);
        setStep("brand");
        return;
      }
      await sendWebhookTestPing({});
      setWebhookReady(true);
      setStep("brand");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Test ping failed";
      setPingError(message);
    } finally {
      setPinging(false);
    }
  }, [pinging, sendWebhookTestPing, preview]);


  // Prefill marketing domain suggestion when entering the emails step
  useEffect(() => {
    if (!open || step !== "brand") return;
    if (brandDomain.trim()) return;
    const slug = connection?.storeSlug?.trim();
    if (!slug) return;
    setBrandDomain(slug.includes(".") ? slug : `${slug}.com`);
  }, [open, step, connection?.storeSlug, brandDomain]);

  const runBrandImport = useCallback(async () => {
    if (brandPhase === "scanning" || brandPhase === "saving") return;
    setBrandError("");
    let domain: string;
    try {
      domain = validateDomainInputClient(brandDomain);
    } catch (e) {
      setBrandError(e instanceof Error ? e.message : "Enter a valid domain");
      return;
    }

    setBrandPhase("scanning");
    setBrandKit(null);
    let timeoutId = 0;
    try {
      if (preview) {
        await delay(1400);
        setBrandKit({
          domain,
          brandColor: "#0c0c0c",
          secondaryColor: "#6b6b70",
          mutedTextColor: "#6b6b70",
          linkColor: "#0c0c0c",
          pageBackgroundColor: "#ffffff",
          pageTextColor: "#0c0c0c",
          emailFont: "system",
          fontFamilyRaw: null,
          fromName: storeName.trim() || "Your store",
          storeLogoUrl: null,
          ctaBackgroundColor: "#0c0c0c",
          ctaTextColor: "#ffffff",
          ctaBorderRadiusPx: 8,
          emailBackgroundColor: "#ffffff",
          emailTextColor: "#0c0c0c",
          captureMethod: "browser",
        });
        setBrandPhase("ready");
        return;
      }

      const imported = await Promise.race([
        importBrand({ domain }),
        new Promise<never>((_, reject) => {
          timeoutId = window.setTimeout(() => {
            reject(
              new Error(
                "Scan timed out — try again, or use a simpler domain like yourstore.com",
              ),
            );
          }, BRAND_SCAN_TIMEOUT_MS);
        }),
      ]);
      setBrandKit({
        domain: imported.domain,
        brandColor: imported.brandColor,
        secondaryColor: imported.secondaryColor,
        mutedTextColor: imported.mutedTextColor,
        linkColor: imported.linkColor,
        pageBackgroundColor: imported.pageBackgroundColor,
        pageTextColor: imported.pageTextColor,
        emailFont: normalizeEmailFont(imported.emailFont),
        fontFamilyRaw: imported.fontFamilyRaw,
        fromName: imported.fromName,
        storeLogoUrl: imported.storeLogoUrl,
        ctaBackgroundColor: imported.ctaBackgroundColor,
        ctaTextColor: imported.ctaTextColor,
        ctaBorderRadiusPx: imported.ctaBorderRadiusPx,
        emailBackgroundColor: imported.emailBackgroundColor,
        emailTextColor: imported.emailTextColor,
        captureMethod: imported.captureMethod,
      });
      setBrandDomain(imported.domain);
      setBrandPhase("ready");
    } catch (err) {
      setBrandError(brandScanErrorMessage(err));
      setBrandPhase("idle");
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, [
    brandDomain,
    brandPhase,
    importBrand,
    preview,
    storeName,
  ]);

  const applyBrandKit = useCallback(async () => {
    if (!brandKit || brandPhase === "saving") return;
    setBrandPhase("saving");
    setBrandError("");
    try {
      if (preview) {
        await delay(500);
        setStep("done");
        return;
      }
      await completeBrandImport({
        domain: brandKit.domain,
        brandColor: brandKit.brandColor,
        secondaryColor: brandKit.mutedTextColor || brandKit.secondaryColor,
        emailFont: brandKit.emailFont,
        fromName: brandKit.fromName,
        ctaBackgroundColor: brandKit.ctaBackgroundColor,
        ctaTextColor: brandKit.ctaTextColor,
        ctaBorderRadiusPx: brandKit.ctaBorderRadiusPx,
        emailBackgroundColor:
          brandKit.pageBackgroundColor || brandKit.emailBackgroundColor,
        emailTextColor: brandKit.pageTextColor || brandKit.emailTextColor,
        pageBackgroundColor: brandKit.pageBackgroundColor,
        pageTextColor: brandKit.pageTextColor,
        mutedTextColor: brandKit.mutedTextColor,
        linkColor: brandKit.linkColor,
        fontFamilyRaw: brandKit.fontFamilyRaw ?? undefined,
        brandCaptureMethod: brandKit.captureMethod,
      });
      setStep("done");
    } catch (err) {
      setBrandError(
        err instanceof Error ? err.message : "Couldn’t save email branding",
      );
      setBrandPhase("ready");
    }
  }, [brandKit, brandPhase, completeBrandImport, preview]);

  const failVerifyBackToWebhook = useCallback(() => {
    if (verifyFailHandledRef.current) return;
    verifyFailHandledRef.current = true;
    setWebhookError(
      "We couldn’t confirm your webhook yet. Use “Install webhook for me”, or set it up manually and send a test ping.",
    );
    setShowManualWebhook(true);
    setStep("webhook");
    setVerifyStartedAt(null);
  }, []);

  // Auto-pass when a webhook lands
  useEffect(() => {
    if (!open || step !== "verifying") return;
    if (webhookStatus?.verified) {
      setStep("brand");
    }
  }, [open, step, webhookStatus?.verified]);

  // Timeout → slide back to webhook
  useEffect(() => {
    if (!open || preview || step !== "verifying" || verifyStartedAt == null)
      return;
    const remaining = VERIFY_TIMEOUT_MS - (Date.now() - verifyStartedAt);
    const id = window.setTimeout(
      () => failVerifyBackToWebhook(),
      Math.max(0, remaining),
    );
    return () => window.clearTimeout(id);
  }, [open, preview, step, verifyStartedAt, failVerifyBackToWebhook]);

  // Gentle pulse on verifying radar
  useLayoutEffect(() => {
    if (!open || step !== "verifying") return;
    const el = verifyPulseRef.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    if (reduced) return;
    const tween = gsap.to(el, {
      scale: 1.08,
      opacity: 0.55,
      duration: 1.1,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });
    return () => {
      tween.kill();
    };
  }, [open, step]);

  // Done: reveal dashboard under overlay → hold → slide up → onComplete
  useLayoutEffect(() => {
    if (!open || step !== "done") return;
    const overlay = overlayRef.current;
    if (!overlay || completedRef.current) return;

    if (!revealedRef.current) {
      revealedRef.current = true;
      onReveal();
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    const tl = gsap.timeline({
      onComplete: () => {
        if (completedRef.current) return;
        completedRef.current = true;
        onComplete();
      },
    });

    tl.to({}, { duration: reduced ? 0.35 : 0.85 });
    tl.to(overlay, {
      yPercent: -100,
      duration: reduced ? 0.35 : 0.75,
      ease: "power3.inOut",
    });

    return () => {
      tl.kill();
    };
  }, [open, step, onReveal, onComplete]);

  // Soft step panel entrance + shake when webhook error appears
  useLayoutEffect(() => {
    if (!open) return;
    if (step === "done") return;
    const el = panelRef.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;

    gsap.fromTo(
      el,
      { opacity: 0, y: step === "webhook" && webhookError ? 0 : 14 },
      { opacity: 1, y: 0, duration: 0.38, ease: "power2.out" },
    );

    if (step === "webhook" && webhookError && !reduced) {
      gsap.fromTo(
        el,
        { x: -10 },
        {
          x: 0,
          duration: 0.55,
          ease: "elastic.out(1, 0.55)",
        },
      );
    }
  }, [open, step, webhookError]);

  if (!open) return null;

  const currentIndex = flowStepIndex(step);

  const stepCopy: Record<
    Exclude<Step, "welcome" | "done">,
    { title: string; body: string }
  > = {
    link: {
      title: "Add your API key",
      body: "Paste a Lemon Squeezy API key to connect your store.",
    },
    webhook: {
      title: "Set up your webhook",
      body: `Without this, ${storeName.trim() || "your store"} declines never reach DeclineGuard.`,
    },
    verifying: {
      title: "Confirm the webhook",
      body: "Send a test ping so we know events will arrive.",
    },
    brand: {
      title:
        brandPhase === "ready" || brandPhase === "saving"
          ? "Your email template"
          : brandPhase === "scanning"
            ? "Building your emails"
            : "Add your domain",
      body:
        brandPhase === "ready" || brandPhase === "saving"
          ? "Confirm the kit — you can tweak anything later in Customizations."
          : brandPhase === "scanning"
            ? `Capturing ${brandDomain.trim() || "your site"} and shaping Day 0.`
            : "We’ll match colors, CTA, and fonts from your marketing site.",
    },
  };

  return (
    <div
      ref={overlayRef}
      className="dg-shell light ln-surface fixed inset-0 z-[90] overflow-hidden bg-[#f7f8f8] text-[#08090a]"
      aria-modal
      role="dialog"
      aria-label="Connect Lemon Squeezy store"
    >
      {preview ? (
        <div className="absolute left-6 top-5 z-10">
          <span className="text-[11px] font-medium tracking-[-0.01em] text-[#8a8f98]">
            Preview
          </span>
        </div>
      ) : null}

      <div className="flex h-full flex-col items-center justify-center overflow-y-auto px-5 py-16">
        <div
          className={`w-full text-center ${
            step === "brand" &&
            (brandPhase === "ready" || brandPhase === "saving")
              ? "max-w-[26rem]"
              : "max-w-[20.5rem]"
          }`}
        >
          {step === "done" ? (
            <div ref={panelRef}>
              <AuthBrandMark href={null} />
              <AuthHeading>You’re in</AuthHeading>
              <AuthSub>
                {storeName.trim() || "Your store"} is linked. Opening your
                dashboard…
              </AuthSub>
            </div>
          ) : step === "welcome" ? (
            <div ref={panelRef}>
              <AuthBrandMark href={null} />
              <AuthHeading>Welcome to DeclineGuard</AuthHeading>
              <AuthSub>
                Recover failed Lemon Squeezy payments with branded emails.
                You only pay when we recover money.
              </AuthSub>
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  className={authBtnPrimaryCompact}
                  onClick={() => setStep("link")}
                >
                  Get started
                </button>
              </div>
            </div>
          ) : (
            <div ref={panelRef}>
              <AuthBrandMark href={null} />
              <AuthHeading>{stepCopy[step].title}</AuthHeading>
              <AuthSub>{stepCopy[step].body}</AuthSub>

                  {step === "link" ? (
                    <div className="mt-8 space-y-5 text-left">
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <label
                            htmlFor="ls-api-key"
                            className={fieldLabel}
                          >
                            API key
                            {preview ? (
                              <span className="font-normal text-[#5c5c5c]">
                                {" "}
                                (optional)
                              </span>
                            ) : null}
                          </label>
                          <a
                            href="https://app.lemonsqueezy.com/settings/api"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[12px] font-medium text-[#8a8f98] transition hover:text-[#08090a]"
                          >
                            Open settings
                            <ExternalLink className="size-3 opacity-70" />
                          </a>
                        </div>
                        <div className="relative">
                          <input
                            id="ls-api-key"
                            type="text"
                            name="ls-api-key"
                            value={apiKey}
                            onChange={(e) => {
                              setApiKey(e.target.value);
                              setLinkError("");
                              setPendingStores(null);
                              setSelectedStoreId(null);
                            }}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            inputMode="text"
                            data-1p-ignore
                            data-lpignore="true"
                            data-bwignore
                            data-form-type="other"
                            className={`${fieldInput} pr-11 font-mono text-[13px] ${
                              showKey ? "" : "[-webkit-text-security:disc]"
                            }`}
                            placeholder="ls_…"
                            disabled={linking}
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#8a8f98] transition hover:text-[#08090a]"
                            onClick={() => setShowKey((v) => !v)}
                            aria-label={
                              showKey ? "Hide API key" : "Show API key"
                            }
                          >
                            {showKey ? (
                              <EyeOff className="size-4" />
                            ) : (
                              <Eye className="size-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {pendingStores && pendingStores.length > 1 ? (
                        <div>
                          <p className={fieldLabel}>Choose a store</p>
                          <ul className="space-y-1.5">
                            {pendingStores.map((store) => {
                              const active = selectedStoreId === store.id;
                              return (
                                <li key={store.id}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedStoreId(store.id)
                                    }
                                    className={`flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-left text-[14px] transition ${
                                      active
                                        ? "border-black/20 bg-white"
                                        : "border-black/[0.08] bg-white hover:border-black/15"
                                    }`}
                                    disabled={linking}
                                  >
                                    <span>
                                      <span className="font-medium text-[#08090a]">
                                        {store.name}
                                      </span>
                                      {store.slug ? (
                                        <span className="mt-0.5 block text-[12px] text-[#8a8f98]">
                                          {store.slug}
                                        </span>
                                      ) : null}
                                    </span>
                                    {active ? (
                                      <Check className="size-4 shrink-0 text-[#08090a]" />
                                    ) : null}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ) : null}

                      {linkError ? (
                        <p className="text-[13px] text-red-400" role="alert">
                          {linkError}
                        </p>
                      ) : null}

                      <div className="flex items-center justify-end pt-2">
                        <button
                          type="button"
                          className={authBtnPrimary}
                          onClick={() => void linkStore()}
                          disabled={
                            linking ||
                            (!preview && !apiKey.trim()) ||
                            (pendingStores != null &&
                              pendingStores.length > 1 &&
                              !selectedStoreId)
                          }
                        >
                          {linking ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" />
                              Connecting…
                            </>
                          ) : (
                            "Continue"
                          )}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {step === "webhook" ? (
                    <div className="mt-7 text-left">
                      <div className="overflow-hidden rounded-xl border border-black/[0.08] bg-white">
                        {[
                          "Failed and recovered payments reach DeclineGuard automatically",
                          "Recovery emails can start without waiting on a real decline",
                          "We never ask for storefront or customer passwords",
                        ].map((line, i, lines) => (
                          <div
                            key={line}
                            className={`flex items-start gap-2.5 px-3.5 py-3 ${
                              i < lines.length - 1
                                ? "border-b border-black/[0.06]"
                                : ""
                            }`}
                          >
                            <Check className="mt-0.5 size-3.5 shrink-0 text-[#08090a]" />
                            <p className="text-[13px] leading-relaxed text-[#6b6f76]">
                              {line}
                            </p>
                          </div>
                        ))}
                      </div>

                      {webhookError ? (
                        <div
                          className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] leading-relaxed text-red-700"
                          role="alert"
                        >
                          <p className="font-medium text-red-800">
                            Automatic install failed
                          </p>
                          <p className="mt-1">{webhookError}</p>
                        </div>
                      ) : null}

                      {webhookSetup != null &&
                      !webhookSetup.serverConfigured ? (
                        <p className="mt-5 text-[13px] leading-relaxed text-amber-700">
                          Automatic install needs{" "}
                          <code className="rounded bg-black/[0.04] px-1.5 py-0.5 text-[11px] text-[#08090a]">
                            LEMONSQUEEZY_WEBHOOK_SECRET
                          </code>{" "}
                          on Convex.
                        </p>
                      ) : null}
                      {webhookSetup === null ? (
                        <p className="mt-5 text-[13px] leading-relaxed text-amber-700">
                          Automatic install needs{" "}
                          <code className="rounded bg-black/[0.04] px-1.5 py-0.5 text-[11px] text-[#08090a]">
                            CONVEX_SITE_URL
                          </code>{" "}
                          on Convex.
                        </p>
                      ) : null}

                      {!showManualWebhook ? (
                        <div className="mt-8 space-y-3">
                          <button
                            type="button"
                            className={authBtnPrimary}
                            onClick={() => void installWebhook()}
                            disabled={
                              installingWebhook ||
                              webhookSetup == null ||
                              !webhookSetup.serverConfigured
                            }
                          >
                            {installingWebhook ? (
                              <>
                                <Loader2 className="size-3.5 animate-spin" />
                                Creating webhook in Lemon Squeezy…
                              </>
                            ) : (
                              <>
                                <Webhook className="size-3.5" />
                                Create webhook for me
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            className="w-full text-center text-[12px] font-medium text-[#8a8f98] transition hover:text-[#08090a]"
                            onClick={() => setShowManualWebhook(true)}
                          >
                            I’ll create it myself
                          </button>
                        </div>
                      ) : (
                        <div className="mt-6 space-y-4 border-t border-black/[0.06] pt-5">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[13px] font-medium text-[#08090a]">
                              Manual webhook
                            </p>
                            <button
                              type="button"
                              className="text-[12px] font-medium text-[#8a8f98] transition hover:text-[#08090a]"
                              onClick={() => {
                                setShowManualWebhook(false);
                                setWebhookError("");
                              }}
                            >
                              Use automatic
                            </button>
                          </div>

                          <div>
                            <p className="mb-1.5 text-[12px] font-medium text-[#6b6b6b]">
                              1. Copy callback URL
                            </p>
                            {webhookSetup === undefined ? (
                              <p className="text-[13px] text-[#6b6b6b]">
                                Loading…
                              </p>
                            ) : webhookSetup == null ? (
                              <p className="text-[13px] text-amber-300/90">
                                Unavailable — set{" "}
                                <code className="rounded bg-white/[0.06] px-1 py-0.5 text-[11px]">
                                  CONVEX_SITE_URL
                                </code>
                              </p>
                            ) : (
                              <SetupCopyField
                                label="Callback URL"
                                value={webhookSetup.callbackUrl}
                              />
                            )}
                          </div>

                          <div>
                            <p className="mb-1.5 text-[12px] font-medium text-[#6b6b6b]">
                              2. Create webhook in Lemon Squeezy
                            </p>
                            <p className="text-[13px] leading-relaxed text-[#6b6b6b]">
                              Paste the URL, turn on the two events above, save.
                            </p>
                            <a
                              href="https://app.lemonsqueezy.com/settings/webhooks"
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#08090a] underline decoration-black/20 underline-offset-4 transition hover:decoration-black/50"
                            >
                              Open Lemon Squeezy → Webhooks
                              <ExternalLink className="size-3 opacity-70" />
                            </a>
                          </div>

                          {webhookSetup != null &&
                          !webhookSetup.serverConfigured ? (
                            <p className="text-[12px] leading-relaxed text-amber-700">
                              Also set{" "}
                              <code className="rounded bg-black/[0.04] px-1 py-0.5 text-[11px] text-[#08090a]">
                                LEMONSQUEEZY_WEBHOOK_SECRET
                              </code>{" "}
                              on Convex.
                            </p>
                          ) : null}

                          <button
                            type="button"
                            className={authBtnPrimary}
                            onClick={() => {
                              setWebhookReady(false);
                              setSetupSessionSinceMs((prev) => prev ?? Date.now());
                              setVerifyStartedAt(Date.now());
                              setPingError("");
                              setStep("verifying");
                            }}
                            disabled={
                              webhookSetup == null ||
                              !webhookSetup.serverConfigured
                            }
                          >
                            Webhook added — continue
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {step === "verifying" ? (
                    <div className="mt-8 space-y-5 text-left">
                      <ul className="space-y-4">
                        <li>
                          <p className="text-[14px] font-medium text-[#08090a]">
                            Harmless signed ping
                          </p>
                          <p className="mt-0.5 text-[13px] leading-relaxed text-[#6b6f76]">
                            Confirms URL + secret without waiting on a real
                            failed payment
                          </p>
                        </li>
                        <li>
                          <p className="text-[14px] font-medium text-[#08090a]">
                            Or wait for a real event
                          </p>
                          <p className="mt-0.5 text-[13px] leading-relaxed text-[#6b6f76]">
                            A live delivery also unlocks this step
                          </p>
                        </li>
                      </ul>

                      {pingError ? (
                        <p className="text-[13px] text-red-400" role="alert">
                          {pingError}
                        </p>
                      ) : null}

                      <div className="flex items-center justify-end gap-4 pt-2">
                        <button
                          type="button"
                          className="text-[13px] font-medium text-[#8a8f98] transition hover:text-[#08090a]"
                          onClick={() => {
                            verifyFailHandledRef.current = false;
                            setShowManualWebhook(true);
                            setStep("webhook");
                            setVerifyStartedAt(null);
                            setWebhookError("");
                            setPingError("");
                          }}
                          disabled={pinging}
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          className={authBtnPrimary}
                          onClick={() => void runTestPing()}
                          disabled={pinging}
                        >
                          {pinging ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" />
                              Sending…
                            </>
                          ) : (
                            "Send test ping"
                          )}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {step === "brand" ? (
                    <div className="mt-8 space-y-5 text-left">
                      {brandPhase === "idle" || brandPhase === "scanning" ? (
                        <>
                          <div>
                            <label
                              htmlFor="ls-brand-domain"
                              className={fieldLabel}
                            >
                              Marketing domain
                            </label>
                            <div className="relative">
                              <Globe className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5c5c5c]" />
                              <input
                                id="ls-brand-domain"
                                type="text"
                                value={brandDomain}
                                onChange={(e) => {
                                  setBrandDomain(e.target.value);
                                  setBrandError("");
                                }}
                                onKeyDown={(e) => {
                                  if (
                                    e.key === "Enter" &&
                                    brandPhase === "idle"
                                  ) {
                                    void runBrandImport();
                                  }
                                }}
                                disabled={brandPhase === "scanning"}
                                placeholder="yourstore.com"
                                className={`${fieldInput} pl-10`}
                              />
                            </div>
                          </div>

                          {brandPhase === "scanning" ? (
                            <div className="rounded-lg border border-black/[0.08] bg-white px-3.5 py-3">
                              <div className="flex items-center gap-2.5">
                                <Loader2 className="size-4 animate-spin text-[#08090a]" />
                                <div>
                                  <p className="text-[13px] font-medium text-[#08090a]">
                                    Building your emails
                                  </p>
                                  <p className="mt-0.5 text-[12px] text-[#8a8f98]">
                                    Capturing {brandDomain.trim() || "your site"}…
                                  </p>
                                </div>
                              </div>
                              <ul className="mt-3 space-y-1.5 text-[12px] text-[#8a8f98]">
                                <li>Reading homepage colors</li>
                                <li>Matching hero button</li>
                                <li>Merging with Lemon Squeezy</li>
                              </ul>
                            </div>
                          ) : null}

                          {brandError ? (
                            <p className={fieldError} role="alert">
                              {brandError}
                            </p>
                          ) : null}

                          <div className="flex items-center justify-end pt-1">
                            <button
                              type="button"
                              className={authBtnPrimary}
                              onClick={() => void runBrandImport()}
                              disabled={
                                brandPhase === "scanning" ||
                                !brandDomain.trim()
                              }
                            >
                              {brandPhase === "scanning" ? (
                                <>
                                  <Loader2 className="size-3.5 animate-spin" />
                                  Building…
                                </>
                              ) : (
                                "Build emails"
                              )}
                            </button>
                          </div>
                        </>
                      ) : null}

                      {brandPhase === "ready" || brandPhase === "saving" ? (
                        <>
                          <div className="overflow-hidden rounded-lg border border-black/[0.08] bg-white">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] px-3.5 py-2.5">
                              <p className="text-[11px] font-medium text-[#8a8f98]">
                                {brandKit?.domain} · Day 0
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  brandKit?.pageBackgroundColor,
                                  brandKit?.pageTextColor,
                                  brandKit?.ctaBackgroundColor,
                                ].map((color, i) => (
                                  <span
                                    key={i}
                                    className="size-3 rounded-sm border border-white/10"
                                    style={{ background: color }}
                                  />
                                ))}
                              </div>
                            </div>
                            {brandKit ? (
                              <EmailPreviewBody
                                content={{
                                  headline: DEFAULT_EMAIL_COPY.gentle.headline,
                                  body: DEFAULT_EMAIL_COPY.gentle.body,
                                  cta: DEFAULT_EMAIL_COPY.gentle.cta,
                                }}
                                storeName={
                                  brandKit.fromName ||
                                  storeName.trim() ||
                                  "Your store"
                                }
                                storeLogoUrl={
                                  brandKit.storeLogoUrl ??
                                  connection?.storeAvatarUrl ??
                                  null
                                }
                                primary={brandKit.brandColor}
                                secondary={brandKit.mutedTextColor}
                                emailFont={brandKit.emailFont}
                                ctaStyle={{
                                  backgroundColor: brandKit.ctaBackgroundColor,
                                  textColor: brandKit.ctaTextColor,
                                  borderRadiusPx: brandKit.ctaBorderRadiusPx,
                                }}
                                emailBackgroundColor={
                                  brandKit.pageBackgroundColor
                                }
                                emailTextColor={brandKit.pageTextColor}
                                footerSupport={`support@${brandKit.domain}`}
                                socialLinks={[]}
                                showDeclineGuardBadge={false}
                                className="px-4 py-5"
                              />
                            ) : null}
                          </div>

                          {brandError ? (
                            <p className={fieldError} role="alert">
                              {brandError}
                            </p>
                          ) : null}

                          <div className="flex items-center justify-end gap-4 pt-1">
                            <button
                              type="button"
                              className="text-[13px] font-medium text-[#8a8f98] transition hover:text-[#08090a]"
                              onClick={() => {
                                setBrandPhase("idle");
                                setBrandKit(null);
                                setBrandError("");
                              }}
                              disabled={brandPhase === "saving"}
                            >
                              Try another
                            </button>
                            <button
                              type="button"
                              className={authBtnPrimary}
                              onClick={() => void applyBrandKit()}
                              disabled={brandPhase === "saving"}
                            >
                              {brandPhase === "saving" ? (
                                <>
                                  <Loader2 className="size-3.5 animate-spin" />
                                  Saving…
                                </>
                              ) : (
                                "Use this & finish"
                              )}
                            </button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
        </div>

        {step !== "done" ? (
          <div className="absolute inset-x-0 bottom-8">
            <AuthProgressDots
              count={FLOW_STEPS.length}
              activeIndex={currentIndex}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SetupCopyField({
  label,
  value,
  secret = false,
}: {
  label: string;
  value: string;
  secret?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const display =
    secret && !revealed ? "•".repeat(Math.min(value.length, 32)) : value;

  return (
    <div>
      <p className="text-[12px] font-medium text-[#6b6b6b]">
        {label}
      </p>
      <div className="mt-1.5 flex items-stretch gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-black/[0.08] bg-white px-3 py-2.5 font-mono text-[12px] text-[#08090a]">
          {display}
        </code>
        {secret ? (
          <button
            type="button"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-black/[0.08] bg-white text-[#8a8f98] transition hover:text-[#08090a]"
            aria-label={revealed ? "Hide secret" : "Show secret"}
            onClick={() => setRevealed((v) => !v)}
          >
            {revealed ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        ) : null}
        <button
          type="button"
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 text-xs font-medium text-[#8a8f98] transition hover:text-[#08090a]"
          onClick={() => {
            void navigator.clipboard.writeText(value).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            });
          }}
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-[#08090a]" />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
    </div>
  );
}
