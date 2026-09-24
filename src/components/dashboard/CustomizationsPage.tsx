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
import EmailCoverflow from "./email-builder/EmailCoverflow";
import CustomizeDock from "./email-builder/CustomizeDock";
import {
  applyCopyVars,
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
import { formatMoneyAmount, type OpenFailureRow } from "./dashboardUi";

const TEMPLATE_ORDER: RecoveryTemplateId[] = ["gentle", "direct", "urgent"];

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
      onSave,
      onDirtyChange,
      onUploadImage,
      onFocusModeChange,
    },
    ref,
  ) {
    const [previewTemplate, setPreviewTemplate] =
      useState<RecoveryTemplateId>("direct");
    const [focusMode, setFocusMode] = useState(false);
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
      setPast([]);
      setFuture([]);
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

    const primary = live.brandColor || "#0c0c0c";
    const secondary = live.secondaryColor || "#6b6b70";
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
    const dirty = !valuesEqual(live, initial);
    const hasUrlErrors = SOCIAL_FIELDS.some(
      (key) => !isValidHttpsUrl(live[key]),
    );

    useEffect(() => {
      onDirtyChange?.(dirty);
    }, [dirty, onDirtyChange]);

    const enterFocus = (id: RecoveryTemplateId) => {
      setPreviewTemplate(id);
      setFocusMode(true);
      onFocusModeChange?.(true);
    };

    const exitFocus = useCallback(() => {
      setFocusMode(false);
      onFocusModeChange?.(false);
    }, [onFocusModeChange]);

    const dismissFocus = useCallback(() => {
      if (focusSelectionRef.current.clear()) return;
      exitFocus();
    }, [exitFocus]);

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
        let emailCopy = {
          ...prev.emailCopy,
          [id]: { ...current, ...legacy, blocks },
        };
        emailCopy = syncBlockStylesAcrossTemplates(
          emailCopy,
          id,
          prevBlocks,
          blocks,
        );
        return { ...prev, emailCopy };
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
    const dockVisible = focusMode || dirty || saving || showSaved;
    const dockVariant =
      focusMode && (dirty || saving) ? "full" : "compact";

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
    }, []);

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

    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape" && focusMode) {
          e.preventDefault();
          dismissFocus();
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
    }, [dismissFocus, focusMode, redo, undo]);

    return (
      <div
        className={cn(
          "relative flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-visible transition-colors duration-500",
          focusMode ? "bg-white" : "bg-[#f7f8f8]",
        )}
      >
        <EmailCoverflow
          templates={TEMPLATE_ORDER}
          selected={previewTemplate}
          focusMode={focusMode}
          primaryColor={primary}
          onEnterFocus={enterFocus}
          onExitFocus={dismissFocus}
          inboxMeta={(id) => ({
            from: senderLine,
            subject: applyCopyVars(live.emailCopy[id].subject, copyVars),
          })}
          renderEmail={(id, frameWidth) => (
            <EmailBuilderCanvas
              document={live.emailCopy[id]}
              device="desktop"
              frameWidth={frameWidth}
              readOnly={!focusMode || id !== previewTemplate}
              inlineEdit={focusMode && id === previewTemplate}
              selectionApiRef={
                focusMode && id === previewTemplate
                  ? focusSelectionRef
                  : undefined
              }
              onChangeBlocks={(blocks) => changeBlocks(id, blocks)}
              onPatchDocument={(patch) => patchDocument(id, patch)}
              onRemoveBlock={(blockId) =>
                changeBlocks(id, removeBlock(live.emailCopy[id].blocks, blockId))
              }
              onUploadImage={onUploadImage}
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
              vars={copyVars}
              showDeclineGuardBadge={showDeclineGuardBadge}
              showInboxMeta={false}
              footerSupport={footerSupport}
              socialLinks={socialLinks}
            />
          )}
        />

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
