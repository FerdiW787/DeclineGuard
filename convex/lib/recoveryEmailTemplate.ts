import {
  renderBlocksHtml,
  renderBlocksText,
  type EmailBlock,
} from "./emailBlocks";
import { safePaymentUpdateUrl } from "./safeUrl";
import {
  ensureCtaLabelContrast,
  ensureShellTextHierarchy,
} from "./brandImport/colors";
import {
  normalizeEmailFont,
  type EmailFontId,
} from "./emailFonts";
import {
  buildRecoveryLayoutHtml,
  type RecoverySocialLinks,
} from "./recoveryLayoutHtml";

export type RecoveryTemplateId = "gentle" | "direct" | "urgent";

export type { RecoverySocialLinks };

type TemplateCopy = {
  subject: string;
  headline: string;
  bodyHtml: string;
  cta: string;
  ignoreNote: string;
  blocks?: EmailBlock[];
  linkColor?: string;
  emailPadding?: number;
  shellBackground?: string;
  shellBorderColor?: string;
  shellBorder?: boolean;
  shellBorderWidth?: number;
  shellRadius?: number;
};

/** Merchant-editable fields. Keep in sync with src/lib/recoveryEmailCopy.ts */
export type EditableEmailCopy = {
  subject: string;
  headline: string;
  body: string;
  cta: string;
  blocks?: EmailBlock[];
  linkColor?: string;
  emailPadding?: number;
  shellBackground?: string;
  shellBorderColor?: string;
  shellBorder?: boolean;
  shellBorderWidth?: number;
  shellRadius?: number;
};

export type EmailCopyOverrides = Partial<
  Record<RecoveryTemplateId, Partial<EditableEmailCopy> | null | undefined>
>;

/**
 * Copy tuned from industry dunning patterns.
 * HTML structure is selected by layoutPresetId (five recovery layouts).
 */
const TEMPLATES: Record<RecoveryTemplateId, TemplateCopy> = {
  gentle: {
    subject: "Your payment for {{product}} didn’t go through",
    headline: "Quick update on your subscription",
    bodyHtml:
      "The payment of <strong>{{amount}}</strong> for <strong>{{product}}</strong> didn't go through. Update your card below — takes about a minute.",
    cta: "Update payment method",
    ignoreNote:
      "If you already updated your card, you can safely ignore this email.",
  },
  direct: {
    subject: "2nd notice: payment still needed for {{product}}",
    headline: "Still need an updated card",
    bodyHtml:
      "Your payment for <strong>{{product}}</strong> ({{amount}}) is still pending. Update billing so your access stays on.",
    cta: "Update billing",
    ignoreNote: "Already fixed it? You’re all set — no action needed.",
  },
  urgent: {
    subject: "Final notice: need updated billing for {{product}}",
    headline: "Last chance to keep access",
    bodyHtml:
      "Without an updated card, <strong>{{product}}</strong> ({{amount}}) may pause soon. Fix payment now to stay uninterrupted.",
    cta: "Fix payment now",
    ignoreNote:
      "If you’ve already updated your payment method, you can ignore this.",
  },
};

export type RecoveryEmailVars = {
  templateId: RecoveryTemplateId;
  /**
   * Selects HTML structure (Sonos / Avocode / Benchmark / FontBase / NordVPN).
   * Day step still selects copy/urgency via templateId.
   */
  layoutPresetId?: string | null;
  /** Primary — accents / monogram fallback (not always the CTA) */
  primaryColor: string;
  /** Secondary — muted text / links */
  secondaryColor: string;
  storeName: string;
  /** Lemon Squeezy store avatar URL (falls back to color mark) */
  storeLogoUrl?: string | null;
  customerName: string | null;
  customerEmail: string;
  productName: string;
  amountLabel: string;
  updatePaymentUrl: string | null;
  supportEmail?: string | null;
  socials?: RecoverySocialLinks;
  /** Free tier: show “Recovery sent by DeclineGuard” */
  showDeclineGuardBadge?: boolean;
  /** Optional merchant overrides from Customizations */
  copyOverrides?: EmailCopyOverrides | null;
  /** Body font — from Customizations */
  emailFont?: EmailFontId | string | null;
  /** Homepage-matched CTA button */
  ctaBackgroundColor?: string | null;
  ctaTextColor?: string | null;
  /** px — 9999 for pill */
  ctaBorderRadiusPx?: number | null;
  emailBackgroundColor?: string | null;
  emailTextColor?: string | null;
  pageBackgroundColor?: string | null;
  pageTextColor?: string | null;
  /** Homepage link color (billing / inline) */
  linkColor?: string | null;
  /** Raw CSS font-family from homepage — preferred in stack */
  fontFamilyRaw?: string | null;
};

function resolveCopy(
  templateId: RecoveryTemplateId,
  overrides?: EmailCopyOverrides | null,
): TemplateCopy {
  const base = TEMPLATES[templateId] ?? TEMPLATES.gentle;
  const over = overrides?.[templateId];
  if (!over) return base;

  const subject = over.subject?.trim();
  const headline = over.headline?.trim();
  const body = over.body?.trim();
  const cta = over.cta?.trim();
  const blocks =
    Array.isArray(over.blocks) && over.blocks.length > 0
      ? (over.blocks as EmailBlock[])
      : undefined;

  return {
    subject: subject || base.subject,
    headline: headline || base.headline,
    bodyHtml: body ? plainBodyToHtmlTemplate(body) : base.bodyHtml,
    cta: cta || base.cta,
    ignoreNote: base.ignoreNote,
    blocks,
    linkColor: over.linkColor?.trim() || undefined,
    emailPadding:
      typeof over.emailPadding === "number" ? over.emailPadding : undefined,
    shellBackground: over.shellBackground?.trim() || undefined,
    shellBorderColor: over.shellBorderColor?.trim() || undefined,
    shellBorder:
      typeof over.shellBorder === "boolean" ? over.shellBorder : undefined,
    shellBorderWidth:
      typeof over.shellBorderWidth === "number"
        ? over.shellBorderWidth
        : undefined,
    shellRadius:
      typeof over.shellRadius === "number" ? over.shellRadius : undefined,
  };
}

/** Turn merchant plain-text body into an HTML template (placeholders intact). */
function plainBodyToHtmlTemplate(plain: string): string {
  const parts = plain.split(/(\{\{(?:product|amount|first_name)\}\})/g);
  return parts
    .map((part) => {
      if (
        part === "{{product}}" ||
        part === "{{amount}}" ||
        part === "{{first_name}}"
      ) {
        if (part === "{{first_name}}") return "{{first_name}}";
        return `<strong>${part}</strong>`;
      }
      return escapeHtml(part).replace(/\n/g, "<br />");
    })
    .join("");
}

function firstName(name: string | null, email: string): string {
  if (name?.trim()) {
    return name.trim().split(/\s+/)[0] ?? "there";
  }
  const local = email.split("@")[0]?.trim();
  return local || "there";
}

/** Monogram when Lemon Squeezy has no store avatar */
export function storeInitials(storeName: string): string {
  const parts = storeName
    .trim()
    .split(/[\s._-]+/)
    .filter((p) => p.length > 0);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    const word = parts[0]!;
    return word.slice(0, 2).toUpperCase();
  }
  const a = parts[0]![0] ?? "";
  const b = parts[1]![0] ?? "";
  return `${a}${b}`.toUpperCase();
}

function applyVars(
  template: string,
  vars: Record<string, string>,
  mode: "text" | "html",
): string {
  const product = mode === "html" ? escapeHtml(vars.product) : vars.product;
  const amount = mode === "html" ? escapeHtml(vars.amount) : vars.amount;
  const first = mode === "html" ? escapeHtml(vars.first_name) : vars.first_name;
  return template
    .replace(/\{\{first_name\}\}/g, first)
    .replace(/\{\{product\}\}/g, product)
    .replace(/\{\{amount\}\}/g, amount);
}

export function buildRecoveryEmail(input: RecoveryEmailVars): {
  subject: string;
  html: string;
  text: string;
} {
  const copy = resolveCopy(input.templateId, input.copyOverrides);
  const vars = {
    first_name: firstName(input.customerName, input.customerEmail),
    product: input.productName,
    amount: input.amountLabel,
  };

  const subject = applyVars(copy.subject, vars, "text");
  const headline = applyVars(copy.headline, vars, "text");
  const bodyText = applyVars(copy.bodyHtml.replace(/<[^>]+>/g, ""), vars, "text");
  const ctaUrl = safePaymentUpdateUrl(input.updatePaymentUrl);
  const year = new Date().getFullYear();
  const primary = input.primaryColor.trim() || "#0c0c0c";
  const shellBg = input.emailBackgroundColor?.trim() || "#ffffff";
  const pageBg = input.pageBackgroundColor?.trim() || shellBg;
  const hierarchy = ensureShellTextHierarchy(
    shellBg,
    input.emailTextColor?.trim() || "#0c0c0c",
    input.secondaryColor.trim() || "#6b6b70",
  );
  const shellText = hierarchy.bodyText;
  const pageText = input.pageTextColor?.trim() || shellText;
  const secondary = hierarchy.mutedText;
  const ctaBg = input.ctaBackgroundColor?.trim() || primary;
  const ctaText = ensureCtaLabelContrast(
    ctaBg,
    input.ctaTextColor?.trim() || "#ffffff",
  );
  const ctaRadius =
    typeof input.ctaBorderRadiusPx === "number" &&
    Number.isFinite(input.ctaBorderRadiusPx)
      ? Math.max(0, Math.min(9999, input.ctaBorderRadiusPx))
      : 12;
  const linkColor =
    input.linkColor?.trim() ||
    copy.linkColor?.trim() ||
    primary;
  const support = input.supportEmail?.trim() || null;
  const emailFont = normalizeEmailFont(input.emailFont);

  const useBlocks = Boolean(copy.blocks && copy.blocks.length > 0);
  const blockText = useBlocks
    ? applyVars(renderBlocksText(copy.blocks!, ctaUrl), vars, "text")
    : bodyText;
  const blocksHtml = useBlocks
    ? applyVars(
        renderBlocksHtml(copy.blocks!, {
          primaryColor: primary,
          linkColor,
          mutedColor: secondary,
          ctaUrl,
          ctaBackgroundColor: ctaBg,
          ctaTextColor: ctaText,
          ctaBorderRadiusPx: ctaRadius,
          bodyTextColor: shellText,
        }),
        vars,
        "html",
      )
    : undefined;

  const hasShell =
    copy.emailPadding !== undefined ||
    Boolean(copy.shellBackground) ||
    copy.shellBorder !== undefined ||
    copy.shellBorderColor !== undefined ||
    copy.shellBorderWidth !== undefined ||
    copy.shellRadius !== undefined;

  const built = buildRecoveryLayoutHtml({
    layoutPresetId: input.layoutPresetId ?? "sonos",
    step: input.templateId,
    theme: {
      brandColor: primary,
      secondaryColor: secondary,
      mutedTextColor: secondary,
      linkColor,
      pageBackgroundColor: pageBg,
      pageTextColor: pageText,
      emailBackgroundColor: shellBg,
      emailTextColor: shellText,
      ctaBackgroundColor: ctaBg,
      ctaTextColor: ctaText,
      ctaBorderRadiusPx: ctaRadius,
      emailFont,
      fontFamilyRaw: input.fontFamilyRaw ?? null,
    },
    copy: {
      headline,
      body: useBlocks ? blockText : bodyText,
      cta: copy.cta,
    },
    bodyHtml: blocksHtml,
    ignoreNote: copy.ignoreNote,
    socials: input.socials,
    shell: hasShell
      ? {
          emailPadding: copy.emailPadding,
          shellBackground: copy.shellBackground,
          shellBorderColor: copy.shellBorderColor,
          shellBorder: copy.shellBorder,
          shellBorderWidth: copy.shellBorderWidth,
          shellRadius: copy.shellRadius,
        }
      : undefined,
    storeName: input.storeName,
    storeLogoUrl: input.storeLogoUrl,
    supportEmail: support,
    firstName: vars.first_name,
    productName: input.productName,
    amountLabel: input.amountLabel,
    ctaUrl,
    showDeclineGuardBadge: input.showDeclineGuardBadge,
    copyrightYear: year,
  });
  const html = built.html;

  const textParts = [
    `Hi ${vars.first_name},`,
    "",
    ...(useBlocks ? [] : [headline, ""]),
    blockText,
    "",
    ...(useBlocks ? [] : [`${copy.cta}: ${ctaUrl}`, ""]),
    copy.ignoreNote,
    "",
    "—",
    input.storeName,
    support ? `Questions? ${support}` : "Questions? Reply to this email.",
    `© ${year} ${input.storeName}`,
  ];
  if (input.showDeclineGuardBadge) {
    textParts.push("", "Recovery sent by DeclineGuard");
  }

  return { subject, html, text: textParts.join("\n") };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
