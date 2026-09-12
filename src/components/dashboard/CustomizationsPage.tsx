import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowRight,
  Mail,
  Monitor,
  Redo2,
  Smartphone,
  Undo2,
} from "lucide-react";
import EmailCustomizePanel, {
  emailCopyFromSettings,
  patchActiveDocument,
  type EmailCustomizationValues,
  type EmailCustomizeHandle,
} from "./EmailCustomizePanel";
import { socialLinksFromSettings } from "./EmailPreviewBody";
import GuidedContentPanel from "./email-builder/GuidedContentPanel";
import EmailBuilderCanvas from "./email-builder/EmailBuilderCanvas";
import {
  TEMPLATE_META,
  type EmailCopyOverrides,
  type RecoveryTemplateId,
} from "@/lib/recoveryEmailCopy";
import {
  blocksFromGuided,
  deriveLegacyFromBlocks,
  guidedFromDocument,
  type EmailBlock,
  type EmailDocument,
  type GuidedContent,
} from "@/lib/emailBuilder";
import { DEFAULT_EMAIL_COPY } from "@/lib/recoveryEmailCopy";
import {
  normalizeEmailFont,
  type EmailFontId,
} from "@/lib/emailFonts";
import {
  useMarketingDesktop,
  whenDesktop,
} from "@/components/homepage/marketing/MarketingDesktopContext";
import { cn } from "@/lib/utils";
import {
  formatMoneyAmount,
  PageHeader,
  Panel,
  type OpenFailureRow,
} from "./dashboardUi";
import BrandImportGate from "./BrandImportGate";

type DevicePreview = "desktop" | "mobile";

type ResizeEdge = "n" | "s" | "e" | "w";

const PREVIEW_DEFAULT_W: Record<DevicePreview, number> = {
  desktop: 512, // matches EmailBuilderCanvas 32rem default
  mobile: 380,
};
const PREVIEW_MIN_W = 280;
const PREVIEW_MAX_W = 920;
const PREVIEW_MIN_H = 360;
const PREVIEW_MAX_H = 1100;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export type { EmailCustomizeHandle };

type Props = {
  storeName: string;
  storeLogoUrl: string | null;
  brandColor: string;
  secondaryColor: string;
  emailFont?: EmailFontId | null;
  ctaBackgroundColor?: string | null;
  ctaTextColor?: string | null;
  ctaBorderRadiusPx?: number | null;
  linkColor?: string | null;
  emailBackgroundColor?: string | null;
  emailTextColor?: string | null;
  fromName: string | null;
  replyToEmail: string | null;
  supportEmail: string | null;
  socialX: string | null;
  socialLinkedin: string | null;
  socialYoutube: string | null;
  socialInstagram: string | null;
  emailCopy: EmailCopyOverrides | null;
  showDeclineGuardBadge: boolean;
  openFailures?: OpenFailureRow[] | undefined;
  fromAddressHint?: string | null;
  /** Last imported marketing domain — prefilled for re-import */
  brandDomain?: string | null;
  onGoToSequences?: () => void;
  onSave: (values: EmailCustomizationValues) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
  onUploadImage?: (file: File) => Promise<string>;
};

function buildInitial(props: {
  brandColor: string;
  secondaryColor: string;
  emailFont?: EmailFontId | null;
  ctaBackgroundColor?: string | null;
  ctaTextColor?: string | null;
  ctaBorderRadiusPx?: number | null;
  linkColor?: string | null;
  emailBackgroundColor?: string | null;
  emailTextColor?: string | null;
  fromName: string | null;
  replyToEmail: string | null;
  supportEmail: string | null;
  socialX: string | null;
  socialLinkedin: string | null;
  socialYoutube: string | null;
  socialInstagram: string | null;
  emailCopy: EmailCopyOverrides | null;
  storeName: string;
}): EmailCustomizationValues {
  const brand = props.brandColor || "#0c0c0c";
  const link =
    props.linkColor?.trim() ||
    brand;
  const emailCopy = emailCopyFromSettings(props.emailCopy);
  // Keep template docs aligned with brand link color for preview consistency
  for (const id of ["gentle", "direct", "urgent"] as const) {
    emailCopy[id] = { ...emailCopy[id], linkColor: link };
  }
  return {
    brandColor: brand,
    secondaryColor: props.secondaryColor,
    ctaBackgroundColor: props.ctaBackgroundColor?.trim() || brand,
    ctaTextColor: props.ctaTextColor?.trim() || "#ffffff",
    linkColor: link,
    emailFont: normalizeEmailFont(props.emailFont),
    fromName: props.fromName?.trim() || props.storeName,
    replyToEmail: props.replyToEmail ?? "",
    supportEmail: props.supportEmail ?? "",
    socialX: props.socialX ?? "",
    socialLinkedin: props.socialLinkedin ?? "",
    socialYoutube: props.socialYoutube ?? "",
    socialInstagram: props.socialInstagram ?? "",
    emailCopy,
  };
}

const CustomizationsPage = forwardRef<EmailCustomizeHandle, Props>(
  function CustomizationsPage(
    {
      storeName,
      storeLogoUrl,
      brandColor,
      secondaryColor,
      emailFont,
      ctaBackgroundColor,
      ctaTextColor,
      ctaBorderRadiusPx,
      linkColor,
      emailBackgroundColor,
      emailTextColor,
      fromName,
      replyToEmail,
      supportEmail,
      socialX,
      socialLinkedin,
      socialYoutube,
      socialInstagram,
      emailCopy,
      showDeclineGuardBadge,
      openFailures,
      fromAddressHint,
      brandDomain,
      onGoToSequences,
      onSave,
      onDirtyChange,
      onUploadImage,
    },
    ref,
  ) {
    const desk = useMarketingDesktop();
    const [previewTemplate, setPreviewTemplate] =
      useState<RecoveryTemplateId>("gentle");
    const [device, setDevice] = useState<DevicePreview>("desktop");
    const [showInboxMeta, setShowInboxMeta] = useState(true);
    const [previewW, setPreviewW] = useState(PREVIEW_DEFAULT_W.desktop);
    /** null = fit content height (default — never clips the email) */
    const [previewH, setPreviewH] = useState<number | null>(null);
    const previewStageRef = useRef<HTMLDivElement>(null);
    const previewFrameRef = useRef<HTMLDivElement>(null);
    const resizeRef = useRef<{
      edge: ResizeEdge;
      startX: number;
      startY: number;
      startW: number;
      startH: number;
    } | null>(null);
    const [past, setPast] = useState<EmailDocument[]>([]);
    const [future, setFuture] = useState<EmailDocument[]>([]);
    const [showReimport, setShowReimport] = useState(false);
    const lastCommitRef = useRef(0);

    useEffect(() => {
      setPreviewW(PREVIEW_DEFAULT_W[device]);
      setPreviewH(null);
    }, [device]);

    const onPreviewResizePointerDown = useCallback(
      (edge: ResizeEdge, e: ReactPointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const target = e.currentTarget;
        target.setPointerCapture(e.pointerId);

        const frame = previewFrameRef.current;
        const measuredH =
          previewH ??
          Math.round(frame?.getBoundingClientRect().height ?? PREVIEW_MIN_H);

        resizeRef.current = {
          edge,
          startX: e.clientX,
          startY: e.clientY,
          startW: previewW,
          startH: measuredH,
        };

        const stage = previewStageRef.current;
        const maxW = stage
          ? Math.min(PREVIEW_MAX_W, stage.clientWidth - 24)
          : PREVIEW_MAX_W;
        const maxH = stage
          ? Math.min(PREVIEW_MAX_H, stage.clientHeight - 24)
          : PREVIEW_MAX_H;

        const onMove = (ev: PointerEvent) => {
          const drag = resizeRef.current;
          if (!drag) return;
          if (drag.edge === "e" || drag.edge === "w") {
            const dx =
              drag.edge === "e"
                ? ev.clientX - drag.startX
                : drag.startX - ev.clientX;
            // Symmetric: one side drag grows both sides equally
            setPreviewW(
              clamp(Math.round(drag.startW + dx * 2), PREVIEW_MIN_W, maxW),
            );
          } else {
            const dy =
              drag.edge === "s"
                ? ev.clientY - drag.startY
                : drag.startY - ev.clientY;
            setPreviewH(
              clamp(Math.round(drag.startH + dy * 2), PREVIEW_MIN_H, maxH),
            );
          }
        };

        const onUp = (ev: PointerEvent) => {
          resizeRef.current = null;
          try {
            target.releasePointerCapture(ev.pointerId);
          } catch {
            /* already released */
          }
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
      },
      [previewW, previewH],
    );
    const [live, setLive] = useState(() =>
      buildInitial({
        brandColor,
        secondaryColor,
        emailFont,
        ctaBackgroundColor,
        ctaTextColor,
        linkColor,
        fromName,
        replyToEmail,
        supportEmail,
        socialX,
        socialLinkedin,
        socialYoutube,
        socialInstagram,
        emailCopy,
        storeName,
      }),
    );

    const initial = useMemo(
      () =>
        buildInitial({
          brandColor,
          secondaryColor,
          emailFont,
          ctaBackgroundColor,
          ctaTextColor,
          linkColor,
          fromName,
          replyToEmail,
          supportEmail,
          socialX,
          socialLinkedin,
          socialYoutube,
          socialInstagram,
          emailCopy,
          storeName,
        }),
      [
        brandColor,
        secondaryColor,
        emailFont,
        ctaBackgroundColor,
        ctaTextColor,
        linkColor,
        fromName,
        replyToEmail,
        supportEmail,
        socialX,
        socialLinkedin,
        socialYoutube,
        socialInstagram,
        emailCopy,
        storeName,
      ],
    );

    useEffect(() => {
      setLive(initial);
      setPast([]);
      setFuture([]);
    }, [initial]);

    useEffect(() => {
      setPast([]);
      setFuture([]);
    }, [previewTemplate]);

    const previewSample = useMemo(() => {
      const source =
        openFailures?.find((r) => r.productName?.trim()) ??
        openFailures?.[0] ??
        null;
      const product = source?.productName?.trim() || "Pro Monthly";
      const amount = source
        ? formatMoneyAmount(source.amountCents, source.currency)
        : "€29";
      const customer =
        source?.customerName?.trim()?.split(/\s+/)[0] ||
        source?.customerEmail?.split("@")[0] ||
        "Maya";
      return {
        product,
        amount,
        customer,
        fromCase: source != null,
      };
    }, [openFailures]);

    const primary = live.brandColor || "#0c0c0c";
    const secondary = live.secondaryColor || "#6b6b70";
    const footerSupport =
      live.supportEmail.trim() ||
      live.replyToEmail.trim() ||
      supportEmail ||
      "support@yourstore.com";
    const socialLinks = socialLinksFromSettings(live);
    const senderLine = `${live.fromName.trim() || storeName}${
      fromAddressHint ? ` · ${fromAddressHint}` : ""
    }`;
    const activeDoc = live.emailCopy[previewTemplate];
    const meta = TEMPLATE_META[previewTemplate];
    const activeDocRef = useRef(activeDoc);
    activeDocRef.current = activeDoc;

    // Push the current doc onto the undo stack (coalescing rapid edits like
    // typing) before applying the next one. `discrete` forces a new entry.
    const pushHistory = useCallback((discrete: boolean) => {
      const now = Date.now();
      const coalesce = !discrete && now - lastCommitRef.current < 550;
      lastCommitRef.current = discrete ? 0 : now;
      if (!coalesce) {
        setPast((p) => [...p.slice(-59), activeDocRef.current]);
      }
      setFuture([]);
    }, []);

    const updateActiveDoc = (
      patch: Partial<EmailDocument>,
      opts?: { discrete?: boolean },
    ) => {
      pushHistory(opts?.discrete ?? false);
      setLive((prev) => patchActiveDocument(prev, previewTemplate, patch));
    };

    const updateBlocks = (
      blocks: EmailBlock[],
      opts?: { discrete?: boolean },
    ) => {
      const legacy = deriveLegacyFromBlocks(
        activeDoc.subject,
        blocks,
        DEFAULT_EMAIL_COPY[previewTemplate],
      );
      updateActiveDoc({ ...legacy, blocks }, opts);
    };

    const guided = useMemo(() => guidedFromDocument(activeDoc), [activeDoc]);

    const updateGuided = (next: GuidedContent) => {
      updateBlocks(blocksFromGuided(next));
    };

    const restoreDoc = (doc: EmailDocument) => {
      setLive((prev) => ({
        ...prev,
        emailCopy: { ...prev.emailCopy, [previewTemplate]: doc },
      }));
    };

    const undo = useCallback(() => {
      lastCommitRef.current = 0;
      setPast((p) => {
        if (p.length === 0) return p;
        const prevDoc = p[p.length - 1]!;
        setFuture((f) => [activeDocRef.current, ...f].slice(0, 60));
        restoreDoc(prevDoc);
        return p.slice(0, -1);
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [previewTemplate]);

    const redo = useCallback(() => {
      lastCommitRef.current = 0;
      setFuture((f) => {
        if (f.length === 0) return f;
        const nextDoc = f[0]!;
        setPast((p) => [...p.slice(-59), activeDocRef.current]);
        restoreDoc(nextDoc);
        return f.slice(1);
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [previewTemplate]);

    const canUndo = past.length > 0;
    const canRedo = future.length > 0;

    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
        const el = document.activeElement;
        // Let native undo win inside text fields.
        if (
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement ||
          (el instanceof HTMLElement && el.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [undo, redo]);

    if (showReimport) {
      return (
        <BrandImportGate
          storeName={storeName}
          storeLogoUrl={storeLogoUrl}
          suggestedDomain={brandDomain}
          context="customizations"
          showDeclineGuardBadge={showDeclineGuardBadge}
          mode="reimport"
          onDismiss={() => setShowReimport(false)}
          onComplete={() => setShowReimport(false)}
        />
      );
    }

    return (
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-10 pt-3",
          "lg:min-h-0 lg:px-6 lg:gap-4 lg:overflow-visible lg:pb-5 lg:pt-5",
          whenDesktop(desk, "min-h-0 px-6 gap-4 overflow-visible pb-5 pt-5"),
        )}
      >
        <PageHeader
          eyebrow="Customizations"
          title="Email builder"
          description="Design each recovery email. Day-to-day tweaks stay here — re-import from your homepage at most once a month."
          actions={
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setShowReimport(true)}
                className="dg-interactive inline-flex items-center gap-1.5 rounded-md border border-black/10 bg-white px-3 py-1.5 text-[12px] font-semibold text-[#6b6f76]"
              >
                Re-import brand
              </button>
              <div className="inline-flex items-center rounded-md border border-black/10 bg-white p-0.5">
                <button
                  type="button"
                  onClick={undo}
                  disabled={!canUndo}
                  title="Undo (⌘Z)"
                  aria-label="Undo"
                  className={`inline-flex size-7 items-center justify-center rounded-[5px] transition-colors ${
                    canUndo
                      ? "cursor-pointer text-[#6b6f76] hover:bg-black/5 hover:text-[#08090a]"
                      : "cursor-not-allowed text-black/20"
                  }`}
                >
                  <Undo2 className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={redo}
                  disabled={!canRedo}
                  title="Redo (⌘⇧Z)"
                  aria-label="Redo"
                  className={`inline-flex size-7 items-center justify-center rounded-[5px] transition-colors ${
                    canRedo
                      ? "cursor-pointer text-[#6b6f76] hover:bg-black/5 hover:text-[#08090a]"
                      : "cursor-not-allowed text-black/20"
                  }`}
                >
                  <Redo2 className="size-3.5" />
                </button>
              </div>
              {onGoToSequences ? (
                <button
                  type="button"
                  onClick={onGoToSequences}
                  className="dg-interactive inline-flex items-center gap-1.5 rounded-md border border-black/10 bg-white px-3 py-1.5 text-[12px] font-semibold text-[#6b6f76]"
                >
                  Preview sequence
                  <ArrowRight className="size-3.5" />
                </button>
              ) : null}
            </div>
          }
        />

        {/* 3-panel builder grid — same rounded-md Panel language as siblings */}
        <div
          data-enter
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-4",
            "lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)_17.5rem] lg:gap-4",
            whenDesktop(
              desk,
              "grid grid-cols-[16.5rem_minmax(0,1fr)_17.5rem] gap-4",
            ),
          )}
        >
          {/* Left: brand + steps */}
          <Panel className="relative z-20 flex min-h-0 flex-col overflow-visible">
            <EmailCustomizePanel
              ref={ref}
              className="min-h-0 flex-1"
              draft={live}
              initial={initial}
              activeTemplate={previewTemplate}
              onActiveTemplateChange={setPreviewTemplate}
              fromAddressHint={fromAddressHint}
              onChange={setLive}
              onSave={onSave}
              onDirtyChange={onDirtyChange}
              showDeclineGuardBadge={showDeclineGuardBadge}
            />
          </Panel>

          {/* Center: email card preview */}
          <Panel className="relative flex min-h-0 flex-col overflow-visible">
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: `
                  radial-gradient(ellipse 70% 50% at 50% 0%, ${primary}14, transparent 55%),
                  radial-gradient(ellipse 60% 40% at 80% 100%, ${secondary}10, transparent 50%)
                `,
              }}
              aria-hidden
            />
            <div className="relative z-10 flex shrink-0 items-center justify-between gap-3 border-b border-black/6 px-4 py-2">
              <p className="truncate text-[11px] font-medium text-black/55">
                <span className="uppercase tracking-[0.08em] text-black/40">
                  {meta.day}
                </span>
                <span className="mx-1.5 text-black/20">·</span>
                {meta.label}
                <span className="mx-1.5 text-black/20">·</span>
                <span className="font-normal text-black/40">{meta.when}</span>
              </p>
              <div className="inline-flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowInboxMeta((on) => !on)}
                  aria-pressed={showInboxMeta}
                  title={
                    showInboxMeta
                      ? "Hide From and subject"
                      : "Show From and subject"
                  }
                  className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-[11px] font-semibold transition-colors ${
                    showInboxMeta
                      ? "border-black/10 bg-black/[0.06] text-black"
                      : "border-black/10 bg-white text-black/45 hover:text-black/70"
                  }`}
                >
                  <Mail className="size-3.5" />
                  From
                </button>
                <div className="inline-flex items-center rounded-md border border-black/10 bg-white p-0.5">
                {(
                  [
                    ["desktop", Monitor, "Desktop"],
                    ["mobile", Smartphone, "Mobile"],
                  ] as const
                ).map(([id, Icon, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDevice(id)}
                    aria-pressed={device === id}
                    title={label}
                    className={`inline-flex size-7 cursor-pointer items-center justify-center rounded-[5px] transition-colors ${
                      device === id
                        ? "bg-black/[0.06] text-black"
                        : "text-black/40 hover:text-black/70"
                    }`}
                  >
                    <Icon className="size-3.5" />
                  </button>
                ))}
                </div>
              </div>
            </div>
            <div
              ref={previewStageRef}
              className="relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-auto p-4"
            >
              <div
                ref={previewFrameRef}
                className="group/preview relative shrink-0"
                style={{
                  width: previewW,
                  ...(previewH != null ? { height: previewH } : {}),
                }}
              >
                <div
                  className={`overflow-x-hidden rounded-md ${
                    previewH != null ? "h-full overflow-y-auto" : ""
                  }`}
                >
                  <EmailBuilderCanvas
                    document={activeDoc}
                    device={device}
                    frameWidth={previewW}
                    readOnly
                    storeName={storeName}
                    storeLogoUrl={storeLogoUrl}
                    primary={primary}
                    secondary={secondary}
                    emailFont={live.emailFont}
                    ctaBackgroundColor={live.ctaBackgroundColor}
                    ctaTextColor={live.ctaTextColor}
                    ctaBorderRadiusPx={ctaBorderRadiusPx}
                    linkColor={live.linkColor}
                    emailBackgroundColor={emailBackgroundColor}
                    emailTextColor={emailTextColor}
                    senderLine={senderLine}
                    customerFirstName={previewSample.customer}
                    vars={{
                      product: previewSample.product,
                      amount: previewSample.amount,
                      firstName: previewSample.customer,
                    }}
                    showDeclineGuardBadge={showDeclineGuardBadge}
                    showInboxMeta={showInboxMeta}
                    footerSupport={footerSupport}
                    socialLinks={socialLinks}
                  />
                </div>

                {/* Symmetric resize: drag one edge grows the opposite side too */}
                {(
                  [
                    {
                      edge: "n" as const,
                      hit: "inset-x-8 top-0 h-3 -translate-y-1/2 cursor-ns-resize",
                      grip: "top-0 left-1/2 h-1.5 w-10 -translate-x-1/2 -translate-y-1/2",
                      label: "height",
                    },
                    {
                      edge: "s" as const,
                      hit: "inset-x-8 bottom-0 h-3 translate-y-1/2 cursor-ns-resize",
                      grip: "bottom-0 left-1/2 h-1.5 w-10 -translate-x-1/2 translate-y-1/2",
                      label: "height",
                    },
                    {
                      edge: "w" as const,
                      hit: "inset-y-8 left-0 w-3 -translate-x-1/2 cursor-ew-resize",
                      grip: "left-0 top-1/2 h-10 w-1.5 -translate-x-1/2 -translate-y-1/2",
                      label: "width",
                    },
                    {
                      edge: "e" as const,
                      hit: "inset-y-8 right-0 w-3 translate-x-1/2 cursor-ew-resize",
                      grip: "right-0 top-1/2 h-10 w-1.5 translate-x-1/2 -translate-y-1/2",
                      label: "width",
                    },
                  ] as const
                ).map(({ edge, hit, grip, label }) => (
                  <button
                    key={edge}
                    type="button"
                    aria-label={`Resize preview ${label}`}
                    onPointerDown={(ev) =>
                      onPreviewResizePointerDown(edge, ev)
                    }
                    className={`absolute z-20 touch-none ${hit}`}
                  >
                    <span
                      className={`pointer-events-none absolute rounded-full border border-black/12 bg-white opacity-0 shadow-sm transition-opacity group-hover/preview:opacity-80 hover:opacity-100 ${grip}`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </Panel>

          {/* Right: guided content editor */}
          <Panel className="relative z-20 flex min-h-0 flex-col overflow-visible">
            <GuidedContentPanel
              subject={activeDoc.subject}
              content={guided}
              onChangeSubject={(subject) => updateActiveDoc({ subject })}
              onChangeContent={updateGuided}
              onUploadImage={onUploadImage}
            />
          </Panel>
        </div>
      </div>
    );
  },
);

export default CustomizationsPage;
