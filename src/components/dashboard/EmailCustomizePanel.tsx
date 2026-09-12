import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Check, Loader2, RotateCcw } from "lucide-react";
import {
  DEFAULT_EMAIL_COPY,
  TEMPLATE_META,
  emailDocumentsFromSettings,
  type EmailCopyOverrides,
  type EmailDocument,
  type RecoveryTemplateId,
} from "@/lib/recoveryEmailCopy";
import {
  defaultEmailDocument,
  deriveLegacyFromBlocks,
  documentEquals,
  type EmailBlock,
} from "@/lib/emailBuilder";
import {
  DEFAULT_EMAIL_FONT,
  EMAIL_FONT_OPTIONS,
  emailFontFamily,
  type EmailFontId,
} from "@/lib/emailFonts";
import { useEmailFontLoader } from "./useEmailFontLoader";

export type EmailCustomizationValues = {
  brandColor: string;
  secondaryColor: string;
  /** Homepage-matched CTA fill — independent from brand/accent */
  ctaBackgroundColor: string;
  ctaTextColor: string;
  /** Inline links (billing, support, socials) */
  linkColor: string;
  emailFont: EmailFontId;
  fromName: string;
  replyToEmail: string;
  supportEmail: string;
  socialX: string;
  socialLinkedin: string;
  socialYoutube: string;
  socialInstagram: string;
  emailCopy: Record<RecoveryTemplateId, EmailDocument>;
};

export type EmailCustomizeHandle = {
  save: () => Promise<boolean>;
  discard: () => void;
  isDirty: () => boolean;
};

type SocialKey =
  | "socialX"
  | "socialLinkedin"
  | "socialYoutube"
  | "socialInstagram";

type Props = {
  draft: EmailCustomizationValues;
  initial: EmailCustomizationValues;
  activeTemplate: RecoveryTemplateId;
  onChange: (next: EmailCustomizationValues) => void;
  onSave: (next: EmailCustomizationValues) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
  showDeclineGuardBadge: boolean;
  fromAddressHint?: string | null;
  onActiveTemplateChange: (id: RecoveryTemplateId) => void;
  className?: string;
};

const HTTPS_ERROR = "Make Sure its a valid https:// url";
const TEMPLATE_ORDER: RecoveryTemplateId[] = ["gentle", "direct", "urgent"];

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

function valuesEqual(
  a: EmailCustomizationValues,
  b: EmailCustomizationValues,
): boolean {
  return (
    a.brandColor.trim().toLowerCase() === b.brandColor.trim().toLowerCase() &&
    a.secondaryColor.trim().toLowerCase() ===
      b.secondaryColor.trim().toLowerCase() &&
    a.ctaBackgroundColor.trim().toLowerCase() ===
      b.ctaBackgroundColor.trim().toLowerCase() &&
    a.ctaTextColor.trim().toLowerCase() ===
      b.ctaTextColor.trim().toLowerCase() &&
    a.linkColor.trim().toLowerCase() === b.linkColor.trim().toLowerCase() &&
    a.emailFont === b.emailFont &&
    a.fromName.trim() === b.fromName.trim() &&
    a.replyToEmail.trim() === b.replyToEmail.trim() &&
    a.supportEmail.trim() === b.supportEmail.trim() &&
    a.socialX.trim() === b.socialX.trim() &&
    a.socialLinkedin.trim() === b.socialLinkedin.trim() &&
    a.socialYoutube.trim() === b.socialYoutube.trim() &&
    a.socialInstagram.trim() === b.socialInstagram.trim() &&
    documentEquals(a.emailCopy.gentle, b.emailCopy.gentle) &&
    documentEquals(a.emailCopy.direct, b.emailCopy.direct) &&
    documentEquals(a.emailCopy.urgent, b.emailCopy.urgent)
  );
}

/** Persist templates that differ from defaults, including blocks. */
export function toEmailCopyOverrides(
  copy: Record<RecoveryTemplateId, EmailDocument>,
): {
  gentle?: Partial<EmailDocument>;
  direct?: Partial<EmailDocument>;
  urgent?: Partial<EmailDocument>;
} {
  const out: {
    gentle?: Partial<EmailDocument>;
    direct?: Partial<EmailDocument>;
    urgent?: Partial<EmailDocument>;
  } = {};
  for (const id of TEMPLATE_ORDER) {
    const doc = copy[id];
    const base = DEFAULT_EMAIL_COPY[id];
    const legacy = deriveLegacyFromBlocks(doc.subject, doc.blocks, base);
    const resolved: EmailDocument = {
      ...legacy,
      blocks: doc.blocks,
      linkColor: doc.linkColor,
      emailPadding: doc.emailPadding,
    };
    const defaultDoc = defaultEmailDocument(id);
    if (!documentEquals(resolved, defaultDoc)) {
      out[id] = {
        subject: resolved.subject,
        headline: resolved.headline,
        body: resolved.body,
        cta: resolved.cta,
        blocks: resolved.blocks,
        linkColor: resolved.linkColor,
        emailPadding: resolved.emailPadding,
      };
    }
  }
  return out;
}

export function emailCopyFromSettings(
  overrides: EmailCopyOverrides | null | undefined,
): Record<RecoveryTemplateId, EmailDocument> {
  return emailDocumentsFromSettings(overrides);
}

/** Brand + delivery left rail + sticky save. */
const EmailCustomizePanel = forwardRef<EmailCustomizeHandle, Props>(
  function EmailCustomizePanel(
    {
      draft,
      initial,
      activeTemplate,
      onChange,
      onSave,
      onDirtyChange,
      showDeclineGuardBadge,
      fromAddressHint,
      onActiveTemplateChange,
      className,
    },
    ref,
  ) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSaved, setShowSaved] = useState(false);
    const [urlErrors, setUrlErrors] = useState<
      Partial<Record<SocialKey, string>>
    >({});
    const savedHideRef = useRef<number | null>(null);
    const draftRef = useRef(draft);
    draftRef.current = draft;
    const initialRef = useRef(initial);
    initialRef.current = initial;
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const onSaveRef = useRef(onSave);
    onSaveRef.current = onSave;

    useEmailFontLoader(draft.emailFont);

    const dirty = !valuesEqual(draft, initial);

    useEffect(() => {
      onDirtyChange?.(dirty);
    }, [dirty, onDirtyChange]);

    useEffect(() => {
      return () => {
        if (savedHideRef.current !== null) {
          window.clearTimeout(savedHideRef.current);
        }
      };
    }, []);

    const socialFields = [
      ["socialX", "X (Twitter)"],
      ["socialLinkedin", "LinkedIn"],
      ["socialYoutube", "YouTube"],
      ["socialInstagram", "Instagram"],
    ] as const;

    const hasUrlErrors = socialFields.some(
      ([key]) => urlErrors[key] || !isValidHttpsUrl(draft[key]),
    );

    const activeDoc = draft.emailCopy[activeTemplate];
    const activeIsDefault = documentEquals(
      activeDoc,
      defaultEmailDocument(activeTemplate),
    );

    const runSave = async (): Promise<boolean> => {
      const nextErrors: Partial<Record<SocialKey, string>> = {};
      const current = draftRef.current;
      for (const [key] of socialFields) {
        if (!isValidHttpsUrl(current[key])) {
          nextErrors[key] = HTTPS_ERROR;
        }
      }
      if (Object.keys(nextErrors).length > 0) {
        setUrlErrors(nextErrors);
        return false;
      }
      setSaving(true);
      setError(null);
      setShowSaved(false);
      if (savedHideRef.current !== null) {
        window.clearTimeout(savedHideRef.current);
        savedHideRef.current = null;
      }
      const started = Date.now();
      let ok = false;
      try {
        await onSaveRef.current(current);
        ok = true;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Couldn’t save");
        ok = false;
      } finally {
        const remaining = 2000 - (Date.now() - started);
        if (remaining > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, remaining));
        }
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
    };

    useImperativeHandle(
      ref,
      () => ({
        save: runSave,
        discard: () => {
          const next = initialRef.current;
          onChangeRef.current(next);
          setUrlErrors({});
          setError(null);
          setShowSaved(false);
        },
        isDirty: () => !valuesEqual(draftRef.current, initialRef.current),
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    );

    const update = <K extends keyof EmailCustomizationValues>(
      key: K,
      value: EmailCustomizationValues[K],
    ) => {
      const current = draftRef.current;
      if (key === "linkColor" && typeof value === "string") {
        const linkColor = value;
        const emailCopy = { ...current.emailCopy } as Record<
          RecoveryTemplateId,
          EmailDocument
        >;
        for (const id of TEMPLATE_ORDER) {
          emailCopy[id] = { ...emailCopy[id], linkColor };
        }
        onChange({ ...current, linkColor, emailCopy });
      } else {
        onChange({ ...current, [key]: value });
      }
      setShowSaved(false);
    };

    const resetActive = () => {
      const current = draftRef.current;
      const next = {
        ...current,
        emailCopy: {
          ...current.emailCopy,
          [activeTemplate]: {
            ...defaultEmailDocument(activeTemplate),
            linkColor: current.linkColor,
          },
        },
      };
      onChange(next);
      setShowSaved(false);
    };

    const canSave = dirty && !hasUrlErrors && !saving;

    return (
      <div className={`flex h-full min-h-0 flex-col ${className ?? ""}`}>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 [overflow-x:visible]">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-black/45">
                Sequence step
              </p>
              <button
                type="button"
                disabled={activeIsDefault}
                onClick={resetActive}
                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                  activeIsDefault
                    ? "cursor-not-allowed text-black/25"
                    : "cursor-pointer text-black/50 hover:bg-black/5 hover:text-black"
                }`}
              >
                <RotateCcw className="size-3" aria-hidden />
                Reset
              </button>
            </div>
            <div className="mt-2 space-y-1.5">
              {TEMPLATE_ORDER.map((id, i) => {
                const meta = TEMPLATE_META[id];
                const active = id === activeTemplate;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onActiveTemplateChange(id)}
                    aria-pressed={active}
                    className={`dg-interactive flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left ${
                      active
                        ? "border-teal-600/25 bg-teal-50/70"
                        : "border-black/8 bg-transparent"
                    }`}
                  >
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${
                        active
                          ? "bg-teal-600 text-white"
                          : "bg-black/[0.06] text-black/45"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-semibold text-black">
                        {meta.label}
                      </span>
                      <span className="block truncate text-[10px] text-black/40">
                        {meta.day} · {meta.when}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-[11px] font-medium uppercase tracking-[0.08em] text-black/45">
              Brand colors
            </legend>
            <div className="grid grid-cols-1 gap-2">
              <ColorField
                label="Primary"
                hint="Accent"
                value={draft.brandColor}
                onChange={(v) => update("brandColor", v)}
              />
              <ColorField
                label="Button"
                hint="Email CTA"
                value={draft.ctaBackgroundColor}
                onChange={(v) => update("ctaBackgroundColor", v)}
              />
              <ColorField
                label="Button text"
                hint="On CTA"
                value={draft.ctaTextColor}
                onChange={(v) => update("ctaTextColor", v)}
              />
              <ColorField
                label="Secondary"
                hint="Muted text"
                value={draft.secondaryColor}
                onChange={(v) => update("secondaryColor", v)}
              />
              <ColorField
                label="Links"
                hint="Billing & inline"
                value={draft.linkColor}
                onChange={(v) => update("linkColor", v)}
              />
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-[11px] font-medium uppercase tracking-[0.08em] text-black/45">
              Email font
            </legend>
            <p className="text-[11px] leading-relaxed text-black/40">
              Applied to body text in recovery emails and previews.
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {EMAIL_FONT_OPTIONS.map((option) => {
                const active = draft.emailFont === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => update("emailFont", option.id)}
                    aria-pressed={active}
                    className={`dg-interactive flex w-full items-center justify-between rounded-md border px-3 py-2 text-left ${
                      active
                        ? "border-teal-600/25 bg-teal-50/70"
                        : "border-black/8 bg-transparent"
                    }`}
                  >
                    <span
                      className="text-[13px] font-medium text-black"
                      style={{ fontFamily: emailFontFamily(option.id) }}
                    >
                      {option.label}
                    </span>
                    {active ? (
                      <Check className="size-3.5 shrink-0 text-teal-600" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-[11px] font-medium uppercase tracking-[0.08em] text-black/45">
              Sender
            </legend>
            <p className="text-[11px] leading-relaxed text-[#6b6f76]">
              From name and Reply-To live here. From address and API key are in
              Settings → Email.
            </p>
            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-black/55">
                From name
              </span>
              <input
                type="text"
                value={draft.fromName}
                onChange={(e) => update("fromName", e.target.value)}
                className={inputClass}
              />
              {fromAddressHint ? (
                <span className="block text-[11px] text-black/40">
                  Delivered as{" "}
                  <span className="font-medium text-black/55">
                    {fromAddressHint}
                  </span>
                </span>
              ) : null}
            </label>
            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-black/55">
                Reply-To
              </span>
              <input
                type="text"
                inputMode="email"
                value={draft.replyToEmail}
                onChange={(e) => update("replyToEmail", e.target.value)}
                placeholder="hello@yourstore.com"
                className={inputClass}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-black/55">
                Support email
              </span>
              <input
                type="text"
                inputMode="email"
                value={draft.supportEmail}
                onChange={(e) => update("supportEmail", e.target.value)}
                placeholder="support@yourstore.com"
                className={inputClass}
              />
            </label>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-[11px] font-medium uppercase tracking-[0.08em] text-black/45">
              Social links
            </legend>
            {socialFields.map(([key, label]) => (
              <SocialUrlField
                key={key}
                label={label}
                value={draft[key]}
                error={urlErrors[key]}
                onChange={(v) => update(key, v)}
                onDebouncedValidate={(valid, message) => {
                  setUrlErrors((prev) => {
                    const next = { ...prev };
                    if (valid) delete next[key];
                    else next[key] = message;
                    return next;
                  });
                }}
              />
            ))}
          </fieldset>

          {showDeclineGuardBadge ? (
            <div className="rounded-md border border-black/8 bg-black/[0.02] px-3 py-2.5 text-[11px] leading-relaxed text-black/50">
              Free plan emails include “Recovery sent by DeclineGuard” in the
              footer.
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-black/6 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!canSave}
              onClick={() => {
                void runSave();
              }}
              className={`inline-flex items-center justify-center rounded-md px-3.5 py-2 text-xs font-semibold transition-[background-color,color,opacity] ${
                canSave
                  ? "dg-btn dg-btn-primary !px-3.5 !py-2 cursor-pointer"
                  : saving
                    ? "cursor-wait bg-[#0c0c0c] text-white"
                    : "cursor-not-allowed bg-black/10 text-black/35"
              }`}
            >
              <span
                className={`inline-flex overflow-hidden transition-[max-width,opacity,margin] ${
                  saving
                    ? "mr-2 max-w-3.5 opacity-100"
                    : "mr-0 max-w-0 opacity-0"
                }`}
                aria-hidden
              >
                <Loader2
                  className={`size-3.5 shrink-0 ${saving ? "animate-spin" : ""}`}
                />
              </span>
              Save
            </button>
            <span
              className={`inline-flex items-center gap-1 overflow-hidden whitespace-nowrap rounded-full bg-emerald-50 text-[11px] font-semibold text-emerald-700 transition-[max-width,opacity,padding] ${
                showSaved && !saving
                  ? "max-w-28 px-2 py-1 opacity-100"
                  : "pointer-events-none max-w-0 px-0 py-1 opacity-0"
              }`}
              aria-live="polite"
            >
              <Check className="size-3.5 shrink-0" aria-hidden />
              Saved
            </span>
            {error ? (
              <span className="text-[11px] font-medium text-amber-800">
                {error}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    );
  },
);

export default EmailCustomizePanel;

export function patchActiveDocument(
  values: EmailCustomizationValues,
  templateId: RecoveryTemplateId,
  patch: Partial<EmailDocument>,
): EmailCustomizationValues {
  const current = values.emailCopy[templateId];
  const nextDoc = { ...current, ...patch };
  if (patch.blocks) {
    const legacy = deriveLegacyFromBlocks(
      nextDoc.subject,
      patch.blocks as EmailBlock[],
      DEFAULT_EMAIL_COPY[templateId],
    );
    Object.assign(nextDoc, legacy, { blocks: patch.blocks });
  }
  return {
    ...values,
    emailCopy: {
      ...values.emailCopy,
      [templateId]: nextDoc,
    },
  };
}

function SocialUrlField({
  label,
  value,
  error,
  onChange,
  onDebouncedValidate,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onDebouncedValidate: (valid: boolean, message: string) => void;
}) {
  const validateRef = useRef(onDebouncedValidate);
  validateRef.current = onDebouncedValidate;

  useEffect(() => {
    const id = window.setTimeout(() => {
      const valid = isValidHttpsUrl(value);
      validateRef.current(valid, HTTPS_ERROR);
    }, 450);
    return () => window.clearTimeout(id);
  }, [value]);

  return (
    <label className="block space-y-1">
      <span className="text-[12px] font-medium text-black/55">{label}</span>
      <input
        type="text"
        inputMode="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://"
        className={`${inputClass} ${
          error ? "border-amber-500/60 focus:border-amber-600" : ""
        }`}
      />
      {error ? (
        <span className="block text-[11px] font-medium text-amber-800">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function ColorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5 rounded-md border border-black/8 px-3 py-2.5">
      <span className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold">{label}</span>
        <span className="text-[10px] text-black/40">{hint}</span>
      </span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#0c0c0c"}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 shrink-0 cursor-pointer rounded-md border border-black/10 bg-transparent p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="min-w-0 flex-1 rounded-md border border-black/10 px-2 py-1 font-mono text-[12px] outline-none focus:border-black/25"
        />
      </span>
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/25";
