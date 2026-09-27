import { useState } from "react";
import LayoutPresetPicker from "./LayoutPresetPicker";
import EmailLayoutPreview from "./EmailLayoutPreview";
import SegmentedControl from "../SegmentedControl";
import {
  DEFAULT_RECOVERY_SEQUENCE_STEP,
  RECOVERY_SEQUENCE_STEPS,
  RECOVERY_STEP_META,
  layoutPresetMeta,
  type RecoverySequenceStep,
} from "@/lib/emailLayoutPresets";
import {
  RECOVERY_STEP_TEMPLATE,
  recoveryColorsFromTheme,
  resolveTheme,
  type EmailThemeTokens,
  type LayoutPresetId,
  type StylingMode,
} from "@/lib/emailTheme";
import { buildRecoveryEmail } from "../../../../convex/lib/recoveryEmailTemplate";
import { useEmailLayoutDraft } from "@/lib/useEmailLayoutDraft";
import type { EmailFontId } from "@/lib/emailFonts";
import { cn } from "@/lib/utils";

export type EmailLayoutStudioVariant = "page" | "onboarding" | "gate";

type ConfiguredPatch = Partial<
  Pick<
    EmailThemeTokens,
    | "brandColor"
    | "mutedTextColor"
    | "linkColor"
    | "ctaBackgroundColor"
    | "ctaTextColor"
    | "emailBackgroundColor"
    | "emailTextColor"
  >
>;

type Props = {
  variant: EmailLayoutStudioVariant;
  storeName: string;
  storeLogoUrl: string | null;
  configured: Partial<EmailThemeTokens>;
  onConfiguredChange?: (patch: ConfiguredPatch) => void;
  onPersistTheme?: (patch: {
    stylingMode?: StylingMode;
    layoutPresetId?: string;
  }) => void;
  serverTheme?: {
    stylingMode?: string | null;
    layoutPresetId?: string | null;
  } | null;
  emailFont?: EmailFontId;
  footerSupport?: string;
  showDeclineGuardBadge?: boolean;
  previewVars?: {
    product: string;
    amount: string;
    firstName?: string;
  };
  className?: string;
};

const STEP_OPTIONS = RECOVERY_SEQUENCE_STEPS.map((id) => ({
  id,
  label: RECOVERY_STEP_META[id].label,
}));

const STYLING_OPTIONS = [
  { id: "preset" as const, label: "Use preset" },
  { id: "configured" as const, label: "Configured" },
];

export default function EmailLayoutStudio({
  variant,
  storeName,
  storeLogoUrl,
  configured,
  onConfiguredChange,
  onPersistTheme,
  serverTheme,
  emailFont,
  footerSupport,
  showDeclineGuardBadge = false,
  previewVars,
  className,
}: Props) {
  const [draft, setDraft] = useEmailLayoutDraft(serverTheme);
  const [step, setStep] = useState<RecoverySequenceStep>(
    DEFAULT_RECOVERY_SEQUENCE_STEP,
  );

  const mergedConfigured: Partial<EmailThemeTokens> = {
    ...configured,
    emailFont: configured.emailFont ?? emailFont,
    emailBackgroundColor:
      draft.shellOverrides.emailBackgroundColor ??
      configured.emailBackgroundColor ??
      configured.pageBackgroundColor,
    emailTextColor:
      draft.shellOverrides.emailTextColor ??
      configured.emailTextColor ??
      configured.pageTextColor,
  };

  const resolved = resolveTheme({
    stylingMode: draft.stylingMode,
    layoutPresetId: draft.layoutPresetId,
    configured: mergedConfigured,
  });
  const theme = resolved.tokens;
  const colors = recoveryColorsFromTheme(theme);
  const templateId = RECOVERY_STEP_TEMPLATE[step];
  const copyOverride = draft.copyOverrides[step];
  const built = buildRecoveryEmail({
    templateId,
    layoutPresetId: resolved.layoutPresetId,
    primaryColor: colors.primaryColor,
    secondaryColor: colors.secondaryColor,
    storeName,
    storeLogoUrl,
    customerName: previewVars?.firstName ?? "Maya",
    customerEmail: "preview@merchant.test",
    productName: previewVars?.product ?? "Pro Monthly",
    amountLabel: previewVars?.amount ?? "€29.00",
    updatePaymentUrl: "https://app.lemonsqueezy.com/my-orders",
    supportEmail: footerSupport ?? null,
    showDeclineGuardBadge,
    copyOverrides: copyOverride
      ? {
          [templateId]: {
            headline: copyOverride.headline,
            body: copyOverride.body,
            cta: copyOverride.cta,
          },
        }
      : null,
    emailFont: colors.emailFont,
    ctaBackgroundColor: colors.ctaBackgroundColor,
    ctaTextColor: colors.ctaTextColor,
    ctaBorderRadiusPx: colors.ctaBorderRadiusPx,
    emailBackgroundColor: colors.emailBackgroundColor,
    emailTextColor: colors.emailTextColor,
    linkColor: colors.linkColor,
    fontFamilyRaw: colors.fontFamilyRaw,
  });

  const meta = layoutPresetMeta(draft.layoutPresetId);
  const showFields = variant === "page" || variant === "onboarding";

  const updateCopy = (
    field: "headline" | "body" | "cta" | "secondaryLink",
    value: string,
  ) => {
    setDraft((prev) => ({
      ...prev,
      copyOverrides: {
        ...prev.copyOverrides,
        [step]: {
          ...prev.copyOverrides[step],
          [field]: value,
        },
      },
    }));
  };

  const updateShell = (
    field: "emailBackgroundColor" | "emailTextColor",
    value: string,
  ) => {
    setDraft((prev) => ({
      ...prev,
      shellOverrides: { ...prev.shellOverrides, [field]: value },
    }));
    onConfiguredChange?.({ [field]: value });
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-black/8 bg-white",
        variant === "page" ? "p-5 md:p-6" : "p-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a8f98]">
            Email layout
          </p>
          <p className="mt-1 text-[13px] text-[#6b6f76]">
            {meta.label} for recovery Day 0, Day 2, and Day 5. One layout for
            all three sends.
          </p>
        </div>
        <SegmentedControl
          options={STYLING_OPTIONS}
          value={draft.stylingMode}
          onChange={(next) => {
            setDraft((prev) => ({ ...prev, stylingMode: next }));
            onPersistTheme?.({ stylingMode: next });
          }}
          ariaLabel="Styling source"
          idPrefix="email-styling"
        />
      </div>

      <LayoutPresetPicker
        value={draft.layoutPresetId}
        onChange={(id: LayoutPresetId) => {
          setDraft((prev) => ({ ...prev, layoutPresetId: id }));
          onPersistTheme?.({ layoutPresetId: id });
        }}
        className="mt-4"
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-[#8a8f98]">
          {draft.stylingMode === "preset"
            ? "Showing the DeclineGuard theme for this layout."
            : "Showing your store colors, buttons, and links."}
        </p>
        <SegmentedControl
          options={STEP_OPTIONS}
          value={step}
          onChange={setStep}
          ariaLabel="Recovery sequence step"
          idPrefix="recovery-step"
        />
      </div>

      <div
        className={cn(
          "mt-4 grid gap-4",
          variant === "page"
            ? "lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]"
            : "grid-cols-1",
        )}
      >
        <div className="overflow-hidden rounded-lg border border-black/8">
          <div className="border-b border-black/6 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8f98]">
              Preview · {RECOVERY_STEP_META[step].label}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-[#6b6f76]">
              {built.subject}
            </p>
          </div>
          <EmailLayoutPreview
            html={built.html}
            background={theme.emailBackgroundColor}
            title={`Recovery ${RECOVERY_STEP_META[step].label} preview`}
          />
        </div>

        {showFields ? (
          <div className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-[11px] font-medium uppercase tracking-[0.08em] text-black/45">
                Colors
              </legend>
              <p className="text-[11px] leading-relaxed text-[#8a8f98]">
                {draft.stylingMode === "preset"
                  ? "Edits apply when you switch to Configured. The selected layout stays."
                  : "These are your store tokens."}
              </p>
              <ColorField
                label="Primary"
                value={mergedConfigured.brandColor ?? theme.brandColor}
                onChange={(v) => onConfiguredChange?.({ brandColor: v })}
              />
              <ColorField
                label="Button"
                value={
                  mergedConfigured.ctaBackgroundColor ?? theme.ctaBackgroundColor
                }
                onChange={(v) => onConfiguredChange?.({ ctaBackgroundColor: v })}
              />
              <ColorField
                label="Button text"
                value={mergedConfigured.ctaTextColor ?? theme.ctaTextColor}
                onChange={(v) => onConfiguredChange?.({ ctaTextColor: v })}
              />
              <ColorField
                label="Links"
                value={mergedConfigured.linkColor ?? theme.linkColor}
                onChange={(v) => onConfiguredChange?.({ linkColor: v })}
              />
              <ColorField
                label="Muted text"
                value={mergedConfigured.mutedTextColor ?? theme.mutedTextColor}
                onChange={(v) => onConfiguredChange?.({ mutedTextColor: v })}
              />
              <ColorField
                label="Email background"
                value={
                  mergedConfigured.emailBackgroundColor ??
                  theme.emailBackgroundColor
                }
                onChange={(v) => updateShell("emailBackgroundColor", v)}
              />
              <ColorField
                label="Email text"
                value={mergedConfigured.emailTextColor ?? theme.emailTextColor}
                onChange={(v) => updateShell("emailTextColor", v)}
              />
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-[11px] font-medium uppercase tracking-[0.08em] text-black/45">
                Short copy
              </legend>
              <p className="text-[11px] text-[#8a8f98]">
                Overrides for {RECOVERY_STEP_META[step].label} only.
              </p>
              <TextField
                label="Headline"
                value={copyOverride?.headline ?? ""}
                placeholder={copyOverride?.headline ? "" : "Default for this step"}
                onChange={(v) => updateCopy("headline", v)}
              />
              <TextField
                label="Body"
                value={copyOverride?.body ?? ""}
                placeholder="Leave blank to keep the default"
                multiline
                onChange={(v) => updateCopy("body", v)}
              />
              <TextField
                label="Button"
                value={copyOverride?.cta ?? ""}
                onChange={(v) => updateCopy("cta", v)}
              />
              <TextField
                label="Link"
                value={copyOverride?.secondaryLink ?? ""}
                onChange={(v) => updateCopy("secondaryLink", v)}
              />
            </fieldset>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const hex = /^#([0-9a-fA-F]{6})$/.test(value) ? value : "#0c0c0c";
  return (
    <label className="flex items-center justify-between gap-2 rounded-md border border-black/8 px-2.5 py-2">
      <span className="text-[12px] font-medium text-[#08090a]">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-8 shrink-0 cursor-pointer rounded border border-black/10 bg-transparent p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="w-[5.5rem] rounded-md border border-black/10 px-1.5 py-1 font-mono text-[11px] outline-none focus:border-black/25"
        />
      </span>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const fieldClass =
    "w-full rounded-md border border-black/10 bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-black/25";
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-black/50">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={fieldClass}
        />
      ) : (
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={fieldClass}
        />
      )}
    </label>
  );
}
