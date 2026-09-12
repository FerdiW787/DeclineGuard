import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import gsap from "gsap";
import {
  Check,
  Globe,
  Loader2,
  Palette,
  Sparkles,
  Store,
  Workflow,
  X,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import EmailPreviewBody from "./EmailPreviewBody";
import { DEFAULT_EMAIL_COPY } from "@/lib/recoveryEmailCopy";
import type { EmailFontId } from "@/lib/emailFonts";
import { validateDomainInputClient } from "@/lib/brandDomain";

type ImportResult = {
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
  ctaBackgroundColor: string;
  ctaTextColor: string;
  ctaBorderRadiusPx: number;
  ctaShape: "pill" | "rounded" | "square";
  emailBackgroundColor: string;
  emailTextColor: string;
  confidence: number;
  tierUsed: "tier1" | "tier2" | "browser";
  captureMethod: "browser" | "css" | "defaults";
  storeName: string;
  storeLogoUrl: string | null;
  sources: {
    logo: "lemon_squeezy" | "og_image" | "favicon" | "none";
    name: "lemon_squeezy" | "og_site" | "domain";
    colors: "domain_scrape" | "defaults";
    font: "domain_scrape" | "default";
    button: "homepage_cta" | "fallback";
  };
};

type Props = {
  storeName: string;
  storeLogoUrl: string | null;
  suggestedDomain?: string | null;
  /** Which dashboard area the merchant was trying to open */
  context: "sequences" | "customizations";
  showDeclineGuardBadge: boolean;
  /** Re-import after first setup (editor remains day-to-day path) */
  mode?: "first" | "reimport";
  onDismiss?: () => void;
  onComplete?: () => void;
};

type Step = "intro" | "scanning" | "preview" | "saving";

const SCAN_STEPS = [
  { id: "render", label: "Rendering your homepage" },
  { id: "colors", label: "Reading brand colors" },
  { id: "cta", label: "Matching the hero button" },
  { id: "merge", label: "Merging with Lemon Squeezy" },
] as const;

const FLOW_PHASES = [
  { id: "domain", label: "Domain" },
  { id: "capture", label: "Capture" },
  { id: "preview", label: "Preview" },
] as const;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function scanErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) {
    const msg = err.message.trim();
    if (/couldn't be completed|try again later/i.test(msg)) {
      return "Scan failed — the site may be too heavy. Try again in a moment.";
    }
    return msg;
  }
  if (typeof err === "string" && err.trim()) return err.trim();
  return "Could not scan that domain";
}

function sourceLabel(sources: ImportResult["sources"], method: string): string {
  const parts: string[] = [];
  if (method === "browser") parts.push("Computed from live homepage");
  else if (method === "css") parts.push("Colors from site CSS");
  if (sources.logo === "lemon_squeezy") parts.push("Logo from Lemon Squeezy");
  if (sources.button === "homepage_cta") parts.push("CTA from homepage");
  if (sources.font === "domain_scrape") parts.push("Font from your site");
  if (sources.name === "lemon_squeezy") parts.push("Name from Lemon Squeezy");
  return parts.join(" · ") || "Default branding applied";
}

function captureLabel(method: ImportResult["captureMethod"]): string {
  switch (method) {
    case "browser":
      return "Live homepage capture";
    case "css":
      return "CSS scrape";
    case "defaults":
      return "Safe defaults";
    default: {
      const _exhaustive: never = method;
      return _exhaustive;
    }
  }
}

function phaseIndex(step: Step): number {
  if (step === "intro") return 0;
  if (step === "scanning") return 1;
  return 2;
}

export default function BrandImportGate({
  storeName,
  storeLogoUrl,
  suggestedDomain,
  context,
  showDeclineGuardBadge,
  mode = "first",
  onDismiss,
  onComplete,
}: Props) {
  const importBrand = useAction(
    api.functions.brandImportActions.importBrandFromDomain,
  );
  const completeImport = useMutation(
    api.functions.recoverySettings.completeBrandImport,
  );
  const quota = useQuery(api.functions.recoverySettings.getBrandImportQuota);

  const [step, setStep] = useState<Step>("intro");
  const [domain, setDomain] = useState(() => suggestedDomain?.trim() || "");
  const [error, setError] = useState<string | null>(null);
  const [scanDoneCount, setScanDoneCount] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const scanListRef = useRef<HTMLUListElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const previewTokensRef = useRef<HTMLDivElement>(null);
  const previewEmailRef = useRef<HTMLDivElement>(null);
  const pendingResultRef = useRef<ImportResult | null>(null);
  const scanAdvanceRef = useRef<number | null>(null);

  const contextTitle =
    context === "sequences" ? "Recovery sequence" : "Email customizations";
  const ContextIcon = context === "sequences" ? Workflow : Palette;
  const blocked = quota != null && !quota.canImport;
  const activePhase = phaseIndex(step);

  const previewCopy = DEFAULT_EMAIL_COPY.gentle;

  const footerSupport = useMemo(
    () => `support@${result?.domain ?? "yourstore.com"}`,
    [result?.domain],
  );

  const quotaMessage = useMemo(() => {
    if (!quota) return null;
    if (quota.reason === "ok_unlimited") {
      return "Dev mode: unlimited homepage re-imports on this deployment.";
    }
    if (quota.reason === "ok_first") {
      return "Import once from your homepage, then tweak anytime in the editor.";
    }
    if (quota.reason === "ok_bonus") {
      return `Support granted ${quota.brandImportBonusCredits} extra re-import${quota.brandImportBonusCredits === 1 ? "" : "s"}.`;
    }
    if (quota.reason === "ok_cooldown") {
      return "You can re-import from your homepage once per month.";
    }
    const when = quota.nextImportAt
      ? new Date(quota.nextImportAt).toLocaleDateString()
      : "later this month";
    return `You can re-import from your homepage once per month. Next free import: ${when}. Need an extra after a rebrand? Contact support. Day-to-day changes stay in the editor.`;
  }, [quota]);

  const clearScanAdvance = useCallback(() => {
    if (scanAdvanceRef.current != null) {
      window.clearInterval(scanAdvanceRef.current);
      scanAdvanceRef.current = null;
    }
  }, []);

  const revealPreview = useCallback((imported: ImportResult) => {
    setResult(imported);
    setScanDoneCount(SCAN_STEPS.length);
    setStep("preview");
  }, []);

  const runScan = useCallback(async () => {
    if (blocked) {
      setError(quotaMessage);
      return;
    }
    const trimmed = domain.trim();
    if (!trimmed) {
      setError("Enter your marketing domain, e.g. cursor.com");
      return;
    }
    try {
      validateDomainInputClient(trimmed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid domain");
      return;
    }

    setError(null);
    setResult(null);
    pendingResultRef.current = null;
    setScanDoneCount(0);
    setStep("scanning");
    clearScanAdvance();

    const reduced = prefersReducedMotion();
    scanAdvanceRef.current = window.setInterval(
      () => {
        setScanDoneCount((n) => Math.min(n + 1, SCAN_STEPS.length - 1));
      },
      reduced ? 280 : 900,
    );

    const SCAN_TIMEOUT_MS = 28_000;
    let timeoutId = 0;
    try {
      const imported = await Promise.race([
        importBrand({ domain: trimmed }),
        new Promise<never>((_, reject) => {
          timeoutId = window.setTimeout(() => {
            reject(
              new Error(
                "Scan timed out — try again, or use a simpler domain like yourstore.com",
              ),
            );
          }, SCAN_TIMEOUT_MS);
        }),
      ]);
      clearScanAdvance();
      pendingResultRef.current = imported as ImportResult;
      // Finish remaining checklist, then morph into preview
      setScanDoneCount(SCAN_STEPS.length);
      window.setTimeout(
        () => {
          const next = pendingResultRef.current;
          if (next) revealPreview(next);
        },
        reduced ? 120 : 520,
      );
    } catch (e) {
      clearScanAdvance();
      pendingResultRef.current = null;
      setError(scanErrorMessage(e));
      setStep("intro");
      setScanDoneCount(0);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, [
    blocked,
    clearScanAdvance,
    domain,
    importBrand,
    quotaMessage,
    revealPreview,
  ]);

  const applyBranding = useCallback(async () => {
    if (!result) return;
    setStep("saving");
    setError(null);
    try {
      await completeImport({
        domain: result.domain,
        brandColor: result.brandColor,
        secondaryColor: result.mutedTextColor || result.secondaryColor,
        emailFont: result.emailFont,
        fromName: result.fromName,
        ctaBackgroundColor: result.ctaBackgroundColor,
        ctaTextColor: result.ctaTextColor,
        ctaBorderRadiusPx: result.ctaBorderRadiusPx,
        emailBackgroundColor:
          result.pageBackgroundColor || result.emailBackgroundColor,
        emailTextColor: result.pageTextColor || result.emailTextColor,
        pageBackgroundColor: result.pageBackgroundColor,
        pageTextColor: result.pageTextColor,
        mutedTextColor: result.mutedTextColor,
        linkColor: result.linkColor,
        fontFamilyRaw: result.fontFamilyRaw ?? undefined,
        brandCaptureMethod: result.captureMethod,
      });
      onComplete?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save branding");
      setStep("preview");
    }
  }, [completeImport, onComplete, result]);

  // Stage crossfade whenever the main step changes
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const reduced = prefersReducedMotion();
    gsap.killTweensOf(el);
    if (reduced) {
      gsap.set(el, { opacity: 1, y: 0, filter: "none" });
      return;
    }
    gsap.fromTo(
      el,
      { opacity: 0, y: 18, filter: "blur(6px)" },
      {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        duration: 0.55,
        ease: "power3.out",
      },
    );
  }, [step]);

  // Progress bar fill
  useLayoutEffect(() => {
    const fill = progressFillRef.current;
    if (!fill) return;
    const reduced = prefersReducedMotion();
    const pct =
      step === "intro"
        ? 8
        : step === "scanning"
          ? 18 + (scanDoneCount / SCAN_STEPS.length) * 52
          : step === "saving"
            ? 92
            : 78;
    gsap.to(fill, {
      width: `${pct}%`,
      duration: reduced ? 0.15 : 0.55,
      ease: "power2.out",
    });
  }, [scanDoneCount, step]);

  // Checklist row entrances while scanning
  useLayoutEffect(() => {
    if (step !== "scanning") return;
    const list = scanListRef.current;
    if (!list) return;
    const reduced = prefersReducedMotion();
    const rows = list.querySelectorAll("[data-scan-row]");
    gsap.killTweensOf(rows);
    if (reduced) {
      gsap.set(rows, { opacity: 1, x: 0 });
      return;
    }
    gsap.fromTo(
      rows,
      { opacity: 0, x: -10 },
      {
        opacity: 1,
        x: 0,
        duration: 0.4,
        stagger: 0.07,
        ease: "power2.out",
      },
    );
  }, [step]);

  // Preview tokens + email reveal
  useLayoutEffect(() => {
    if (step !== "preview" && step !== "saving") return;
    const reduced = prefersReducedMotion();
    const tokens = previewTokensRef.current?.querySelectorAll("[data-token]");
    const email = previewEmailRef.current;
    if (reduced) {
      if (tokens) gsap.set(tokens, { opacity: 1, y: 0 });
      if (email) gsap.set(email, { opacity: 1, y: 0, scale: 1 });
      return;
    }
    if (tokens?.length) {
      gsap.fromTo(
        tokens,
        { opacity: 0, y: 12 },
        {
          opacity: 1,
          y: 0,
          duration: 0.45,
          stagger: 0.055,
          ease: "power2.out",
          delay: 0.08,
        },
      );
    }
    if (email) {
      gsap.fromTo(
        email,
        { opacity: 0, y: 22, scale: 0.985 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.65,
          ease: "power3.out",
          delay: 0.12,
        },
      );
    }
  }, [step, result?.domain]);

  useEffect(() => () => clearScanAdvance(), [clearScanAdvance]);

  const previewPrimary = result?.brandColor ?? "#0c0c0c";
  const previewSecondary =
    result?.mutedTextColor ?? result?.secondaryColor ?? "#6b6b70";
  const previewFont = result?.emailFont ?? "system";
  const previewName = result?.storeName ?? storeName;
  const previewLogo = result?.storeLogoUrl ?? storeLogoUrl;
  const shellBg =
    result?.pageBackgroundColor ?? result?.emailBackgroundColor ?? "#ffffff";
  const shellText =
    result?.pageTextColor ?? result?.emailTextColor ?? "#0c0c0c";

  return (
    <div
      ref={rootRef}
      className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-5 py-10 md:px-8"
    >
      <div className="w-full max-w-3xl">
        <div className="mb-7 text-center">
          {mode === "reimport" && onDismiss ? (
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={onDismiss}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-[#8a8f98] transition hover:bg-black/[0.04] hover:text-[#08090a]"
              >
                <X className="size-4" />
                Back to editor
              </button>
            </div>
          ) : null}

          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl border border-black/8 bg-white">
            <ContextIcon className="size-5 text-[#08090a]" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a8f98]">
            {mode === "reimport"
              ? "Re-import homepage branding"
              : `One step before ${contextTitle.toLowerCase()}`}
          </p>
          <h2 className="mt-2 ln-h1 text-2xl font-medium tracking-tight text-[#08090a] md:text-3xl">
            {step === "scanning"
              ? "Building your recovery emails"
              : step === "preview" || step === "saving"
                ? "Looking good — confirm your kit"
                : mode === "reimport"
                  ? "Pull fresh tokens from your site"
                  : "Paste your domain — we'll build your recovery emails"}
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-[#8a8a8e]">
            {step === "scanning"
              ? `Capturing ${domain.trim() || "your site"} and shaping Day 0 to match.`
              : step === "preview" || step === "saving"
                ? "Tokens on the left, live email on the right. Tweak anytime after in the editor."
                : "We capture homepage colors, hero CTA, links, and fonts that email can render, merge them with your Lemon Squeezy store, then you fine-tune anytime."}
          </p>
          {quotaMessage && step === "intro" ? (
            <p className="mx-auto mt-3 max-w-lg text-[12px] leading-relaxed text-[#8a8f98]">
              {quotaMessage}
            </p>
          ) : null}
        </div>

        {/* Phase rail */}
        <div className="mx-auto mb-6 max-w-md">
          <div className="mb-3 flex items-center justify-between gap-2">
            {FLOW_PHASES.map((phase, i) => {
              const done = i < activePhase;
              const current = i === activePhase;
              return (
                <div
                  key={phase.id}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-colors duration-500 ${
                      done
                        ? "bg-[#08090a] text-[#f7f8f8]"
                        : current
                          ? "bg-[#08090a] text-[#f7f8f8]"
                          : "bg-black/[0.06] text-[#8a8f98]"
                    }`}
                  >
                    {done ? <Check className="size-3" /> : i + 1}
                  </span>
                  <span
                    className={`truncate text-[11px] font-medium transition-colors duration-500 ${
                      current || done ? "text-[#08090a]" : "text-[#8a8f98]"
                    }`}
                  >
                    {phase.label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-black/8">
            <div
              ref={progressFillRef}
              className="h-full rounded-full bg-[#08090a]"
              style={{ width: "8%" }}
            />
          </div>
        </div>

        <div ref={stageRef}>
          {step === "intro" ? (
            <div className="rounded-xl border border-black/8 bg-white p-6 md:p-8">
              <label className="block space-y-2">
                <span className="text-[12px] font-medium text-[#8a8f98]">
                  Your marketing domain
                </span>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Globe className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a8f98]" />
                    <input
                      type="text"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !blocked) void runScan();
                      }}
                      disabled={blocked}
                      placeholder="cursor.com"
                      className="w-full rounded-xl border border-black/8 bg-[#f7f8f8] py-3 pl-10 pr-4 text-sm text-[#08090a] outline-none transition focus:border-black/20 focus:ring-2 focus:ring-black/10 disabled:opacity-60"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void runScan()}
                    disabled={blocked}
                    className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full bg-[#08090a] px-5 py-3 text-sm font-semibold text-[#f7f8f8] transition hover:bg-[#2a2b2e] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Sparkles className="size-4" />
                    {mode === "reimport" ? "Re-import" : "Build my emails"}
                  </button>
                </div>
              </label>

              <div className="mt-5 flex flex-wrap gap-3 text-[11px] text-[#8a8f98]">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-black/8 px-2.5 py-1">
                  <Store className="size-3" />
                  Logo & name from Lemon Squeezy
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-black/8 px-2.5 py-1">
                  <Palette className="size-3" />
                  Page bg, CTA, links & font from your site
                </span>
              </div>

              {error ? (
                <p className="mt-4 text-sm text-red-400">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null}

          {step === "scanning" ? (
            <div className="rounded-xl border border-black/8 bg-white p-6 md:p-8">
              <div className="flex items-center gap-3 border-b border-black/6 pb-5">
                <div className="relative flex size-10 items-center justify-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-black/8" />
                  <span className="relative flex size-10 items-center justify-center rounded-full border border-black/8 bg-[#f7f8f8]">
                    <Loader2 className="size-4 animate-spin text-[#08090a]" />
                  </span>
                </div>
                <div className="min-w-0 text-left">
                  <p className="truncate text-sm font-semibold text-[#08090a]">
                    {domain.trim()}
                  </p>
                  <p className="text-[12px] text-[#8a8f98]">
                    Composing your branded recovery email…
                  </p>
                </div>
              </div>

              <ul ref={scanListRef} className="mt-5 space-y-2.5">
                {SCAN_STEPS.map((item, i) => {
                  const done = i < scanDoneCount;
                  const active = i === scanDoneCount && scanDoneCount < SCAN_STEPS.length;
                  return (
                    <li
                      key={item.id}
                      data-scan-row
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-500 ${
                        done
                          ? "bg-black/[0.03]"
                          : active
                            ? "bg-black/[0.03]"
                            : "bg-transparent"
                      }`}
                    >
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full transition-all duration-500 ${
                          done
                            ? "bg-[#08090a] text-[#f7f8f8]"
                            : active
                              ? "border border-black/15 bg-[#f7f8f8]"
                              : "border border-black/8 bg-black/[0.02]"
                        }`}
                      >
                        {done ? (
                          <Check className="size-3.5" />
                        ) : active ? (
                          <Loader2 className="size-3 animate-spin text-[#8a8f98]" />
                        ) : (
                          <span className="size-1.5 rounded-full bg-black/15" />
                        )}
                      </span>
                      <span
                        className={`text-sm transition-colors duration-500 ${
                          done
                            ? "font-medium text-[#08090a]"
                            : active
                              ? "font-medium text-[#08090a]"
                              : "text-[#8a8f98]"
                        }`}
                      >
                        {item.label}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {/* Soft skeleton email while building */}
              <div className="mt-6 overflow-hidden rounded-xl border border-black/6 bg-[#fafafa] p-5">
                <div className="flex items-center gap-3">
                  <div className="size-9 animate-pulse rounded-lg bg-black/8" />
                  <div className="h-3 w-28 animate-pulse rounded-full bg-black/8" />
                </div>
                <div className="mt-5 h-3.5 w-40 animate-pulse rounded-full bg-black/10" />
                <div className="mt-3 h-3 w-full max-w-xs animate-pulse rounded-full bg-black/6" />
                <div className="mt-2 h-3 w-full max-w-[14rem] animate-pulse rounded-full bg-black/6" />
                <div className="mt-6 h-9 w-36 animate-pulse rounded-lg bg-black/12" />
              </div>
            </div>
          ) : null}

          {step === "preview" || step === "saving" ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <div
                ref={previewTokensRef}
                className="rounded-xl border border-black/8 bg-white p-5 md:p-6"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a8f98]">
                  Brand kit tokens
                </p>
                <p className="mt-2 text-sm text-[#8a8f98]">
                  {result
                    ? sourceLabel(result.sources, result.captureMethod)
                    : ""}
                </p>
                {result ? (
                  <p className="mt-1 text-[11px] text-[#8a8f98]">
                    Confidence {result.confidence}% ·{" "}
                    {captureLabel(result.captureMethod)}
                  </p>
                ) : null}

                <div className="mt-5 space-y-3">
                  <TokenRow
                    label="Page / hero bg"
                    value={shellBg}
                    swatch={shellBg}
                  />
                  <TokenRow
                    label="Body text"
                    value={shellText}
                    swatch={shellText}
                  />
                  <TokenRow
                    label="Muted text"
                    value={previewSecondary}
                    swatch={previewSecondary}
                  />
                  <TokenRow
                    label="Links"
                    value={result?.linkColor ?? previewPrimary}
                    swatch={result?.linkColor ?? previewPrimary}
                  />
                  <TokenRow
                    label="Button"
                    value={`${result?.ctaShape ?? "rounded"} · ${result?.ctaBackgroundColor ?? previewPrimary}`}
                    swatch={result?.ctaBackgroundColor}
                    pill={result?.ctaShape === "pill"}
                  />
                  <TokenRow
                    label="Button text"
                    value={result?.ctaTextColor ?? "#ffffff"}
                    swatch={result?.ctaTextColor}
                  />
                  <TokenRow
                    label="Font"
                    value={
                      result?.fontFamilyRaw
                        ?.split(",")[0]
                        ?.replace(/['"]/g, "") || previewFont
                    }
                  />
                  <TokenRow
                    label="From name"
                    value={result?.fromName ?? storeName}
                  />
                </div>

                <p className="mt-4 text-[11px] leading-relaxed text-[#8a8f98]">
                  After this, use Customizations to tweak colors and copy
                  anytime. Homepage re-import is limited to once per month.
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("intro");
                      setResult(null);
                      setScanDoneCount(0);
                    }}
                    disabled={step === "saving"}
                    className="cursor-pointer rounded-xl border border-black/10 px-4 py-2.5 text-sm font-medium text-[#6b6f76] transition hover:bg-black/[0.03] disabled:opacity-50"
                  >
                    Try another domain
                  </button>
                  <button
                    type="button"
                    onClick={() => void applyBranding()}
                    disabled={step === "saving"}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#08090a] px-5 py-2.5 text-sm font-semibold text-[#f7f8f8] transition hover:bg-[#2a2b2e] disabled:opacity-60"
                  >
                    {step === "saving" ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Check className="size-4" />
                        Use this branding
                      </>
                    )}
                  </button>
                </div>

                {error ? (
                  <p className="mt-3 text-sm text-red-600">{error}</p>
                ) : null}
              </div>

              <div
                ref={previewEmailRef}
                className="overflow-hidden rounded-xl border border-black/8 bg-white"
              >
                <div className="border-b border-black/8 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8f98]">
                    Email preview · Day 0
                  </p>
                </div>
                <EmailPreviewBody
                  content={{
                    headline: previewCopy.headline,
                    body: previewCopy.body,
                    cta: previewCopy.cta,
                  }}
                  storeName={previewName}
                  storeLogoUrl={previewLogo}
                  primary={previewPrimary}
                  secondary={previewSecondary}
                  emailFont={previewFont}
                  ctaStyle={{
                    backgroundColor: result?.ctaBackgroundColor,
                    textColor: result?.ctaTextColor,
                    borderRadiusPx: result?.ctaBorderRadiusPx,
                  }}
                  emailBackgroundColor={shellBg}
                  emailTextColor={shellText}
                  footerSupport={footerSupport}
                  socialLinks={[]}
                  showDeclineGuardBadge={showDeclineGuardBadge}
                  className="px-5 py-7 md:px-6 md:py-8"
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TokenRow({
  label,
  value,
  swatch,
  pill,
}: {
  label: string;
  value: string;
  swatch?: string;
  pill?: boolean;
}) {
  return (
    <div
      data-token
      className="flex items-center justify-between gap-3 rounded-lg border border-black/6 bg-black/[0.02] px-3 py-2.5"
    >
      <span className="text-[12px] text-[#8a8a8e]">{label}</span>
      <span className="flex min-w-0 items-center gap-2 text-[12px] font-medium text-[#08090a]">
        {swatch ? (
          <span
            className={`size-4 shrink-0 border border-black/10 ${pill ? "rounded-full" : "rounded-md"}`}
            style={{ background: swatch }}
          />
        ) : null}
        <span className="truncate">{value}</span>
      </span>
    </div>
  );
}
