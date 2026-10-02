import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  emailCopyFromSettings,
  valuesEqual,
  type EmailCustomizationValues,
  type EmailCustomizeHandle,
} from "./EmailCustomizePanel";
import { socialLinksFromSettings } from "./EmailPreviewBody";
import EmailBuilderCanvas, {
  type EmailSelectionApi,
} from "./email-builder/EmailBuilderCanvas";
import CustomizeDock from "./email-builder/CustomizeDock";
import EmailCustomizeSidebar from "./email-builder/EmailCustomizeSidebar";
import EmailLabSidebar from "./email-builder/EmailLabSidebar";
import {
  applyCopyVars,
  TEMPLATE_META,
  type EmailCopyOverrides,
  type RecoveryTemplateId,
} from "@/lib/recoveryEmailCopy";
import {
  deriveLegacyFromBlocks,
  removeBlock,
  type EmailBlock,
  type EmailDocument,
} from "@/lib/emailBuilder";
import {
  applyShortCopyToDocument,
  shortCopyFromDocument,
  type ShortCopyField,
} from "@/lib/emailBlockCopy";
import {
  applyLayoutStructureToCopy,
  seedEmptyDaysWithKit,
} from "@/lib/emailLayoutStructure";
import {
  kitCopyFromDocument,
  kitLogoAlign,
  kitShowsAccentBar,
  kitShowsGreeting,
  kitShowsStoreName,
} from "@/lib/emailBlockKits";
import {
  cloneEmailCopy,
  mergeEmailCopyDocumentPatch,
  syncBlockStylesAcrossTemplates,
  type EmailCopyByTemplate,
} from "@/lib/emailStyleSync";
import {
  normalizeEmailFont,
  type EmailFontId,
} from "@/lib/emailFonts";
import { cn } from "@/lib/utils";
import {
  formatMoneyAmount,
  PageHeader,
  Panel,
  type OpenFailureRow,
} from "./dashboardUi";
import SegmentedControl from "./SegmentedControl";
import {
  configuredTokensFromSettings,
  resolveTheme,
  type StylingMode,
} from "@/lib/emailTheme";
import {
  loadEmailLayoutDraft,
  persistEmailLayoutSettings,
} from "@/lib/emailLayoutDraft";
import { useEmailLayoutDraft } from "@/lib/useEmailLayoutDraft";
import type { LayoutPresetId } from "@/lib/emailLayoutPresets";
import { ArrowRight, FlaskConical } from "lucide-react";

const TEMPLATE_ORDER: RecoveryTemplateId[] = ["gentle", "direct", "urgent"];

const DAY_OPTIONS = TEMPLATE_ORDER.map((id) => ({
  id,
  label: TEMPLATE_META[id].day,
}));

const STYLING_OPTIONS = [
  { id: "preset" as const, label: "Use preset" },
  { id: "configured" as const, label: "Configured" },
];

const HTTPS_ERROR = "Make Sure its a valid https:// url";

type SocialKey =
  | "socialX"
  | "socialLinkedin"
  | "socialYoutube"
  | "socialInstagram";

const SOCIAL_FIELDS: SocialKey[] = [
  "socialX",
  "socialLinkedin",
  "socialYoutube",
  "socialInstagram",
];

function isValidHttpsUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:";
  } catch {
    return false;
  }
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
  onPersistTheme?: (patch: {
    stylingMode?: StylingMode;
    layoutPresetId?: string;
  }) => void;
  serverTheme?: {
    stylingMode?: string | null;
    layoutPresetId?: string | null;
  } | null;
  onSave: (values: EmailCustomizationValues) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
  onUploadImage?: (file: File) => Promise<string>;
  onFocusModeChange?: (focused: boolean) => void;
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
  const link = props.linkColor?.trim() || brand;
  const emailCopy = emailCopyFromSettings(props.emailCopy);
  for (const id of TEMPLATE_ORDER) {
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
      onPersistTheme,
      serverTheme,
      onGoToSequences,
      onSave,
      onDirtyChange,
      onUploadImage,
      onFocusModeChange,
    },
    ref,
  ) {
    const [previewTemplate, setPreviewTemplate] =
      useState<RecoveryTemplateId>("gentle");
    const [labMode, setLabMode] = useState(false);
    const [hasSelection, setHasSelection] = useState(false);
    const focusSelectionRef = useRef<EmailSelectionApi>({
      clear: () => false,
    });
    const [past, setPast] = useState<EmailCopyByTemplate[]>([]);
    const [future, setFuture] = useState<EmailCopyByTemplate[]>([]);
    const [saving, setSaving] = useState(false);
    const [showSaved, setShowSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const savedHideRef = useRef<number | null>(null);
    const historyArmedRef = useRef(true);
    const onSaveRef = useRef(onSave);
    onSaveRef.current = onSave;
    const onPersistThemeRef = useRef(onPersistTheme);
    onPersistThemeRef.current = onPersistTheme;

    const [layoutDraft, setLayoutDraft] = useEmailLayoutDraft(serverTheme);

    const [live, setLive] = useState(() => {
      const built = buildInitial({
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
      });
      return {
        ...built,
        emailCopy: seedEmptyDaysWithKit(
          built.emailCopy,
          layoutDraft.layoutPresetId,
        ),
      };
    });

    const initial = useMemo(
      () => {
        const built = buildInitial({
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
        });
        return {
          ...built,
          emailCopy: seedEmptyDaysWithKit(
            built.emailCopy,
            layoutDraft.layoutPresetId,
          ),
        };
      },
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

    const liveRef = useRef(live);
    liveRef.current = live;
    const initialRef = useRef(initial);
    initialRef.current = initial;

    useEffect(() => {
      setLive(initial);
      setPast([]);
      setFuture([]);
    }, [initial]);

    useEffect(() => {
      onFocusModeChange?.(labMode);
      return () => onFocusModeChange?.(false);
    }, [labMode, onFocusModeChange]);

    useEffect(() => {
      setPast([]);
      setFuture([]);
      setHasSelection(false);
      focusSelectionRef.current.clear();
    }, [previewTemplate]);

    useEffect(() => {
      return () => {
        if (savedHideRef.current !== null) {
          window.clearTimeout(savedHideRef.current);
        }
      };
    }, []);

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

    const configured = configuredTokensFromSettings({
      brandColor: live.brandColor,
      secondaryColor: live.secondaryColor,
      mutedTextColor: live.secondaryColor,
      emailBackgroundColor:
        layoutDraft.shellOverrides.emailBackgroundColor ?? emailBackgroundColor,
      emailTextColor:
        layoutDraft.shellOverrides.emailTextColor ?? emailTextColor,
      pageBackgroundColor: emailBackgroundColor,
      pageTextColor: emailTextColor,
      linkColor: live.linkColor,
      ctaBackgroundColor: live.ctaBackgroundColor,
      ctaTextColor: live.ctaTextColor,
      ctaBorderRadiusPx,
      emailFont: live.emailFont,
    });

    const resolved = resolveTheme({
      stylingMode: layoutDraft.stylingMode,
      layoutPresetId: layoutDraft.layoutPresetId,
      configured,
    });
    const theme = resolved.tokens;

    const footerSupport =
      live.supportEmail.trim() ||
      live.replyToEmail.trim() ||
      supportEmail ||
      "support@yourstore.com";
    const socialLinks = socialLinksFromSettings(live);
    const fromNameLine = live.fromName.trim() || storeName;
    const fromAddress =
      fromAddressHint?.match(/<([^>]+)>/)?.[1] ??
      fromAddressHint?.match(/\S+@\S+/)?.[0] ??
      fromAddressHint?.trim() ??
      "";
    const senderLine = fromAddress
      ? `${fromNameLine} · ${fromAddress}`
      : fromNameLine;
    const copyVars = {
      product: previewSample.product,
      amount: previewSample.amount,
      firstName: previewSample.customer,
    };
    const activeDoc = live.emailCopy[previewTemplate];
    const shortCopy = shortCopyFromDocument(activeDoc);
    const labPreviewCopy = (() => {
      const raw = kitCopyFromDocument(previewTemplate, activeDoc);
      return {
        subject: applyCopyVars(raw.subject, copyVars),
        eyebrow: applyCopyVars(raw.eyebrow, copyVars),
        headline: applyCopyVars(raw.headline, copyVars),
        body: applyCopyVars(raw.body, copyVars),
        cta: applyCopyVars(raw.cta, copyVars),
        link: applyCopyVars(raw.link, copyVars),
      };
    })();
    const dayMeta = TEMPLATE_META[previewTemplate];
    const dirty = !valuesEqual(live, initial);
    const hasUrlErrors = SOCIAL_FIELDS.some(
      (key) => !isValidHttpsUrl(live[key]),
    );

    useEffect(() => {
      onDirtyChange?.(dirty);
    }, [dirty, onDirtyChange]);

    const pushEmailCopyHistory = () => {
      if (!historyArmedRef.current) return;
      historyArmedRef.current = false;
      setPast((p) => [
        ...p.slice(-59),
        cloneEmailCopy(liveRef.current.emailCopy),
      ]);
      setFuture([]);
      window.setTimeout(() => {
        historyArmedRef.current = true;
      }, 800);
    };

    const restoreEmailCopy = (snap: EmailCopyByTemplate) => {
      setLive((prev) => ({
        ...prev,
        emailCopy: cloneEmailCopy(snap),
      }));
    };

    const patchDocument = (
      id: RecoveryTemplateId,
      patch: Partial<EmailDocument>,
    ) => {
      pushEmailCopyHistory();
      setLive((prev) => ({
        ...prev,
        emailCopy: mergeEmailCopyDocumentPatch(prev.emailCopy, id, patch),
      }));
    };

    const changeBlocks = (id: RecoveryTemplateId, blocks: EmailBlock[]) => {
      pushEmailCopyHistory();
      setLive((prev) => {
        const current = prev.emailCopy[id];
        const prevBlocks = current.blocks;
        const legacy = deriveLegacyFromBlocks(current.subject, blocks, current);
        let nextCopy = {
          ...prev.emailCopy,
          [id]: { ...current, ...legacy, blocks },
        };
        nextCopy = syncBlockStylesAcrossTemplates(
          nextCopy,
          id,
          prevBlocks,
          blocks,
        );
        return { ...prev, emailCopy: nextCopy };
      });
    };

    const changeShortCopy = (field: ShortCopyField, value: string) => {
      pushEmailCopyHistory();
      setLive((prev) => {
        const current = prev.emailCopy[previewTemplate];
        const nextDoc = applyShortCopyToDocument(current, field, value);
        return {
          ...prev,
          emailCopy: {
            ...prev.emailCopy,
            [previewTemplate]: nextDoc,
          },
        };
      });
    };

    const undo = useCallback(() => {
      setPast((p) => {
        if (p.length === 0) return p;
        const prevSnap = p[p.length - 1]!;
        setFuture((f) =>
          [cloneEmailCopy(liveRef.current.emailCopy), ...f].slice(0, 60),
        );
        restoreEmailCopy(prevSnap);
        return p.slice(0, -1);
      });
    }, []);

    const redo = useCallback(() => {
      setFuture((f) => {
        if (f.length === 0) return f;
        const nextSnap = f[0]!;
        setPast((p) => [
          ...p.slice(-59),
          cloneEmailCopy(liveRef.current.emailCopy),
        ]);
        restoreEmailCopy(nextSnap);
        return f.slice(1);
      });
    }, []);

    const canUndo = past.length > 0;
    const canRedo = future.length > 0;
    const canSave = dirty && !hasUrlErrors && !saving;
    const dockVisible = hasSelection || dirty || saving || showSaved;
    const dockVariant =
      hasSelection || dirty || saving ? "full" : "compact";

    const runSave = useCallback(async (): Promise<boolean> => {
      const current = liveRef.current;
      for (const key of SOCIAL_FIELDS) {
        if (!isValidHttpsUrl(current[key])) {
          setError(HTTPS_ERROR);
          return false;
        }
      }
      setSaving(true);
      setError(null);
      setShowSaved(false);
      if (savedHideRef.current !== null) {
        window.clearTimeout(savedHideRef.current);
        savedHideRef.current = null;
      }
      let ok = false;
      try {
        const draft = loadEmailLayoutDraft();
        persistEmailLayoutSettings({
          draft,
          configured: configuredTokensFromSettings({
            brandColor: current.brandColor,
            secondaryColor: current.secondaryColor,
            mutedTextColor: current.secondaryColor,
            emailBackgroundColor:
              draft.shellOverrides.emailBackgroundColor ?? emailBackgroundColor,
            emailTextColor:
              draft.shellOverrides.emailTextColor ?? emailTextColor,
            pageBackgroundColor: emailBackgroundColor,
            pageTextColor: emailTextColor,
            linkColor: current.linkColor,
            ctaBackgroundColor: current.ctaBackgroundColor,
            ctaTextColor: current.ctaTextColor,
            ctaBorderRadiusPx,
            emailFont: current.emailFont,
          }),
        });
        await onPersistThemeRef.current?.({
          stylingMode: draft.stylingMode,
          layoutPresetId: draft.layoutPresetId,
        });
        await onSaveRef.current(current);
        ok = true;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Couldn’t save");
        ok = false;
      } finally {
        setSaving(false);
        if (ok) {
          setShowSaved(true);
          savedHideRef.current = window.setTimeout(() => {
            setShowSaved(false);
            savedHideRef.current = null;
          }, 2500);
        }
      }
      return ok;
    }, [ctaBorderRadiusPx, emailBackgroundColor, emailTextColor]);

    useImperativeHandle(
      ref,
      () => ({
        save: runSave,
        discard: () => {
          setLive(initialRef.current);
          setPast([]);
          setFuture([]);
          setError(null);
          setShowSaved(false);
        },
        isDirty: () => !valuesEqual(liveRef.current, initialRef.current),
      }),
      [runSave],
    );

    const dismissSelection = useCallback(() => {
      if (focusSelectionRef.current.clear()) {
        setHasSelection(false);
        return true;
      }
      return false;
    }, []);

    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          if (dismissSelection()) {
            e.preventDefault();
            return;
          }
          if (labMode) {
            e.preventDefault();
            setLabMode(false);
          }
          return;
        }
        if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
        const el = document.activeElement;
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
    }, [dismissSelection, labMode, redo, undo]);

    const onColorChange = (
      key:
        | "brandColor"
        | "ctaBackgroundColor"
        | "ctaTextColor"
        | "linkColor"
        | "mutedTextColor"
        | "emailBackgroundColor"
        | "emailTextColor",
      value: string,
    ) => {
      if (key === "emailBackgroundColor" || key === "emailTextColor") {
        setLayoutDraft((prev) => ({
          ...prev,
          shellOverrides: { ...prev.shellOverrides, [key]: value },
        }));
        return;
      }
      if (key === "mutedTextColor") {
        setLive((prev) => ({ ...prev, secondaryColor: value }));
        return;
      }
      setLive((prev) => ({ ...prev, [key]: value }));
    };

    const onLayoutPresetChange = (id: LayoutPresetId) => {
      if (id === layoutDraft.layoutPresetId) return;
      pushEmailCopyHistory();
      setLayoutDraft((prev) => ({ ...prev, layoutPresetId: id }));
      onPersistTheme?.({ layoutPresetId: id });
      setLive((prev) => ({
        ...prev,
        emailCopy: applyLayoutStructureToCopy(prev.emailCopy, id),
      }));
    };

    const onStylingModeChange = (next: StylingMode) => {
      setLayoutDraft((prev) => ({ ...prev, stylingMode: next }));
      onPersistTheme?.({ stylingMode: next });
    };

    return (
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f7f8f8]">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-24 pt-3 lg:px-6 lg:pt-5">
        <PageHeader
          eyebrow={labMode ? "Customizations · Lab" : "Customizations"}
          title="Recovery emails"
          description={
            labMode
              ? "QA the ten starter kits across Day 0, Day 2, and Day 5. Exit Lab to restore the usual chrome."
              : "One in-email layout for Day 0, Day 2, and Day 5. Click a block to edit it in place."
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {labMode ? null : (
                <SegmentedControl
                  options={STYLING_OPTIONS}
                  value={layoutDraft.stylingMode}
                  onChange={onStylingModeChange}
                  ariaLabel="Styling source"
                  idPrefix="email-styling"
                />
              )}
              {labMode || !onGoToSequences ? null : (
                <button
                  type="button"
                  onClick={onGoToSequences}
                  className="dg-link-arrow-host inline-flex cursor-pointer items-center gap-1 text-[12px] font-semibold text-[#08090a] underline-offset-2 hover:underline"
                >
                  Sequences
                  <ArrowRight className="dg-link-arrow size-3.5" />
                </button>
              )}
              <button
                type="button"
                id="email-lab-toggle"
                aria-pressed={labMode}
                aria-label={labMode ? "Exit lab" : "Open lab"}
                onClick={() => setLabMode((open) => !open)}
                className={cn(
                  "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border transition-colors duration-300",
                  labMode
                    ? "border-black/12 bg-[#08090a] text-white"
                    : "border-black/8 bg-white text-[#08090a] hover:border-black/16",
                )}
              >
                <FlaskConical className="size-3.5" />
              </button>
            </div>
          }
        />

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl
            options={DAY_OPTIONS}
            value={previewTemplate}
            onChange={setPreviewTemplate}
            ariaLabel="Recovery day"
            idPrefix="recovery-day"
          />
          <p className="text-[12px] text-[#6b6f76]">
            {dayMeta.label} · {dayMeta.when}
          </p>
        </div>

        <div
          className={cn(
            "mt-5 min-h-0 flex-1 gap-5",
            "lg:grid",
            labMode
              ? "lg:grid-cols-[minmax(0,1fr)_minmax(17rem,21rem)]"
              : "lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]",
          )}
        >
          <Panel className="flex min-h-0 flex-col p-5 md:p-6">
            <div className="mb-4 shrink-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8a8f98]">
                {dayMeta.day} · {dayMeta.label}
              </p>
              <p className="mt-2 text-[12px] text-[#6b6f76]">
                {hasSelection
                  ? "Editing this block. Esc clears the selection."
                  : labMode
                    ? "Switch kits on the right. Day 0 / 2 / 5 reuse this layout."
                    : "Click a block to edit copy, the button, or the link."}
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto rounded-md bg-[#f7f8f8] px-3 py-5 md:px-6">
              <EmailBuilderCanvas
                document={activeDoc}
                device="desktop"
                readOnly={false}
                inlineEdit
                selectionApiRef={focusSelectionRef}
                onSelect={(id) => {
                  setHasSelection(id != null);
                }}
                onChangeBlocks={(blocks) =>
                  changeBlocks(previewTemplate, blocks)
                }
                onPatchDocument={(patch) =>
                  patchDocument(previewTemplate, patch)
                }
                onRemoveBlock={(blockId) =>
                  changeBlocks(
                    previewTemplate,
                    removeBlock(activeDoc.blocks, blockId),
                  )
                }
                onUploadImage={onUploadImage}
                storeName={storeName}
                storeLogoUrl={storeLogoUrl}
                primary={theme.brandColor}
                secondary={theme.mutedTextColor}
                emailFont={theme.emailFont}
                ctaBackgroundColor={theme.ctaBackgroundColor}
                ctaTextColor={theme.ctaTextColor}
                ctaBorderRadiusPx={theme.ctaBorderRadiusPx}
                linkColor={theme.linkColor}
                emailBackgroundColor={theme.emailBackgroundColor}
                emailTextColor={theme.emailTextColor}
                senderLine={senderLine}
                customerFirstName={previewSample.customer}
                vars={copyVars}
                showDeclineGuardBadge={showDeclineGuardBadge}
                showInboxMeta
                footerSupport={footerSupport}
                socialLinks={socialLinks}
                logoAlign={kitLogoAlign(layoutDraft.layoutPresetId)}
                showStoreName={kitShowsStoreName(layoutDraft.layoutPresetId)}
                showGreeting={kitShowsGreeting(layoutDraft.layoutPresetId)}
                showAccentBar={kitShowsAccentBar(layoutDraft.layoutPresetId)}
              />
            </div>
          </Panel>

          <div className="relative min-w-0 overflow-hidden lg:w-[21rem]">
            <div
              className={cn(
                "transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                labMode
                  ? "pointer-events-none absolute inset-x-0 top-0 -translate-x-8 opacity-0"
                  : "relative translate-x-0 opacity-100",
              )}
            >
              <EmailCustomizeSidebar
                stylingMode={layoutDraft.stylingMode}
                layoutPresetId={layoutDraft.layoutPresetId}
                onLayoutPresetChange={onLayoutPresetChange}
                colors={{
                  brandColor: live.brandColor,
                  ctaBackgroundColor: live.ctaBackgroundColor,
                  ctaTextColor: live.ctaTextColor,
                  linkColor: live.linkColor,
                  mutedTextColor: live.secondaryColor,
                  emailBackgroundColor:
                    layoutDraft.shellOverrides.emailBackgroundColor ??
                    emailBackgroundColor ??
                    theme.emailBackgroundColor,
                  emailTextColor:
                    layoutDraft.shellOverrides.emailTextColor ??
                    emailTextColor ??
                    theme.emailTextColor,
                }}
                onColorChange={onColorChange}
                copy={shortCopy}
                onCopyChange={changeShortCopy}
                dayLabel={`${dayMeta.day} · ${dayMeta.label}`}
              />
            </div>
            <div
              className={cn(
                "transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                labMode
                  ? "relative translate-x-0 opacity-100"
                  : "pointer-events-none absolute inset-x-0 top-0 translate-x-full opacity-0",
              )}
              aria-hidden={!labMode}
            >
              <EmailLabSidebar
                layoutPresetId={layoutDraft.layoutPresetId}
                stylingMode={layoutDraft.stylingMode}
                theme={theme}
                storeName={storeName}
                storeLogoUrl={storeLogoUrl}
                previewCopy={labPreviewCopy}
                onSelectKit={(id) => {
                  onLayoutPresetChange(id);
                }}
                onStylingModeChange={onStylingModeChange}
              />
            </div>
          </div>
        </div>
        </div>

        <CustomizeDock
          visible={dockVisible}
          variant={dockVariant}
          canUndo={canUndo}
          canRedo={canRedo}
          canSave={canSave}
          saving={saving}
          showSaved={showSaved}
          error={error}
          onUndo={undo}
          onRedo={redo}
          onSave={() => {
            void runSave();
          }}
          onAdd={() => {
            /* Add-to-template comes next */
          }}
        />
      </div>
    );
  },
);

export default CustomizationsPage;
