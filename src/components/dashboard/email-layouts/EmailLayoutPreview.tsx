import {
  applyLayoutCopyVars,
  resolveLayoutCopy,
  type EmailCopyOverride,
} from "@/lib/emailLayoutCopy";
import type { LayoutPresetId, RecoveryDayId } from "@/lib/emailLayoutPresets";
import type { EmailThemeTokens } from "@/lib/emailTheme";
import {
  buildRecoveryLayoutHtml,
  recoveryStepFromTemplate,
} from "@/lib/recoveryLayoutHtml";
import { cn } from "@/lib/utils";

type PreviewVars = {
  product: string;
  amount: string;
  firstName?: string;
};

type Props = {
  layoutPresetId: LayoutPresetId;
  recoveryDay: RecoveryDayId;
  theme: EmailThemeTokens;
  storeName: string;
  storeLogoUrl?: string | null;
  copyOverride?: EmailCopyOverride;
  footerSupport?: string;
  previewVars?: PreviewVars;
  showDeclineGuardBadge?: boolean;
  className?: string;
};

/**
 * Renders the shared table-based HTML builder (`buildRecoveryLayoutHtml`)
 * in an iframe. Structure is keyed by locked `layoutPresetId` × Day 0/2/5.
 */
export default function EmailLayoutPreview({
  layoutPresetId,
  recoveryDay,
  theme,
  storeName,
  storeLogoUrl = null,
  copyOverride,
  footerSupport,
  previewVars,
  showDeclineGuardBadge = false,
  className,
}: Props) {
  const vars = {
    product: previewVars?.product ?? "Pro Monthly",
    amount: previewVars?.amount ?? "€29",
    firstName: previewVars?.firstName ?? "Maya",
    storeName,
  };
  const raw = resolveLayoutCopy(layoutPresetId, recoveryDay, copyOverride);
  const copy = {
    eyebrow: applyLayoutCopyVars(raw.eyebrow, vars),
    headline: applyLayoutCopyVars(raw.headline, vars),
    body: applyLayoutCopyVars(raw.body, vars),
    cta: applyLayoutCopyVars(raw.cta, vars),
    secondaryLink: applyLayoutCopyVars(raw.secondaryLink, vars),
    support: raw.support.map((line) => applyLayoutCopyVars(line, vars)),
    status: applyLayoutCopyVars(raw.status, vars),
  };
  const step = recoveryStepFromTemplate(recoveryDay);
  const { html } = buildRecoveryLayoutHtml({
    layoutPresetId,
    step,
    theme,
    copy,
    storeName,
    storeLogoUrl,
    supportEmail: footerSupport,
    firstName: vars.firstName,
    productName: vars.product,
    amountLabel: vars.amount,
    showDeclineGuardBadge,
    copyrightYear: 2026,
  });

  return (
    <div
      className={cn("overflow-hidden bg-[#f4f4f4]", className)}
      style={{ background: theme.pageBackgroundColor }}
    >
      <iframe
        title={`Recovery layout preview · ${layoutPresetId} · ${step}`}
        srcDoc={html}
        sandbox=""
        className="block w-full border-0"
        style={{ height: 840, background: theme.pageBackgroundColor }}
      />
    </div>
  );
}
