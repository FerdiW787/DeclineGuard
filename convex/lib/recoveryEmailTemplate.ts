import {
  renderBlocksHtml,
  renderBlocksText,
  type EmailBlock,
} from "./emailBlocks";
import { allowHttpsUrl, safePaymentUpdateUrl } from "./safeUrl";
import {
  ensureCtaLabelContrast,
  ensureShellTextHierarchy,
} from "./brandImport/colors";
import {
  emailFontHeadLinks,
  emailFontStackWithRaw,
  normalizeEmailFont,
  type EmailFontId,
} from "./emailFonts";

export type RecoveryTemplateId = "gentle" | "direct" | "urgent";

export type RecoverySocialLinks = {
  x?: string | null;
  linkedin?: string | null;
  youtube?: string | null;
  instagram?: string | null;
};

type TemplateCopy = {
  subject: string;
  headline: string;
  bodyHtml: string;
  cta: string;
  ignoreNote: string;
  blocks?: EmailBlock[];
  linkColor?: string;
  emailPadding?: number;
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
};

export type EmailCopyOverrides = Partial<
  Record<RecoveryTemplateId, Partial<EditableEmailCopy> | null | undefined>
>;

/**
 * Copy tuned from industry dunning patterns.
 * Layout inspired by Mobbin transactional emails.
 */
const TEMPLATES: Record<RecoveryTemplateId, TemplateCopy> = {
  gentle: {
    subject: "Your payment for {{product}} didn’t go through",
    headline: "Quick update on your subscription",
    bodyHtml:
      "We couldn’t charge <strong>{{amount}}</strong> for <strong>{{product}}</strong>. Update your card below — takes about a minute.",
    cta: "Update payment method",
    ignoreNote:
      "If you already updated your card, you can safely ignore this email.",
  },
  direct: {
    subject: "2nd notice: unsuccessful payment for {{product}}",
    headline: "Still need an updated card",
    bodyHtml:
      "Another attempt for <strong>{{product}}</strong> ({{amount}}) didn’t work. Update billing so your access stays on.",
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

function socialRowHtml(
  socials: RecoverySocialLinks | undefined,
  linkColor = "#0c0c0c",
): string {
  const items: Array<{ label: string; href: string }> = [];
  const push = (label: string, href: string | null | undefined) => {
    const safe = allowHttpsUrl(href);
    if (safe) items.push({ label, href: safe });
  };
  push("X", socials?.x);
  push("LinkedIn", socials?.linkedin);
  push("YouTube", socials?.youtube);
  push("Instagram", socials?.instagram);

  if (items.length === 0) return "";

  const links = items
    .map(
      (item, i) =>
        `<a href="${escapeAttr(item.href)}" style="color:${escapeAttr(linkColor)};text-decoration:none;${
          i < items.length - 1 ? "margin-right:14px;" : ""
        }">${escapeHtml(item.label)}</a>`,
    )
    .join("");

  return `<p style="margin:0 0 16px;font-size:13px;line-height:1.5;">${links}</p>`;
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
  const body = applyVars(copy.bodyHtml, vars, "html");
  const ctaUrl = safePaymentUpdateUrl(input.updatePaymentUrl);
  const year = new Date().getFullYear();
  const primary = input.primaryColor.trim() || "#0c0c0c";
  const shellBg = input.emailBackgroundColor?.trim() || "#ffffff";
  const hierarchy = ensureShellTextHierarchy(
    shellBg,
    input.emailTextColor?.trim() || "#0c0c0c",
    input.secondaryColor.trim() || "#6b6b70",
  );
  const shellText = hierarchy.bodyText;
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
  const ctaRadiusCss = `${ctaRadius}px`;
  const isDarkShell = shellBg.toLowerCase() !== "#ffffff" && shellBg !== "#fff";
  const ruleColor = isDarkShell ? "rgba(255,255,255,0.12)" : "#e8e8ea";
  const mutedFooter = secondary;
  const faintFooter = isDarkShell ? "#6b6b70" : "#a1a1a6";
  // Brand-level link color (Customizations) wins over per-template copy.
  const linkColor =
    input.linkColor?.trim() ||
    copy.linkColor?.trim() ||
    primary;
  const pad = copy.emailPadding ?? 24;
  const support = input.supportEmail?.trim() || null;
  const supportBlock = support
    ? `Questions or feedback? Drop us a line at
        <a href="mailto:${escapeAttr(support)}" style="color:${escapeAttr(linkColor)};text-decoration:underline;">${escapeHtml(support)}</a>.`
    : `Questions or feedback? Just reply to this email.`;
  const helpHref = support ? `mailto:${escapeAttr(support)}` : escapeAttr(ctaUrl);
  const socialHtml = socialRowHtml(input.socials, linkColor);
  const badgeHtml = input.showDeclineGuardBadge
    ? `<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid ${ruleColor};font-size:11px;line-height:1.5;color:${faintFooter};text-align:center;">
        Recovery sent by <span style="color:${escapeAttr(linkColor)};font-weight:600;">DeclineGuard</span>
      </p>`
    : "";
  const logoUrl = allowHttpsUrl(input.storeLogoUrl);
  const initials = storeInitials(input.storeName);
  const logoMark = logoUrl
    ? `<img src="${escapeAttr(logoUrl)}" alt="${escapeHtml(input.storeName)}" width="44" height="44" style="display:block;width:44px;height:44px;border-radius:10px;object-fit:cover;" />`
    : `<div style="display:inline-block;width:44px;height:44px;border-radius:10px;background:${escapeAttr(primary)};color:#ffffff;font-size:15px;font-weight:700;letter-spacing:-0.02em;line-height:44px;text-align:center;">${escapeHtml(initials)}</div>`;
  const headerHtml = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 36px;">
        <tr>
          <td style="vertical-align:middle;padding:0 12px 0 0;">${logoMark}</td>
          <td style="vertical-align:middle;padding:0;">
            <p style="margin:0;font-size:17px;line-height:1.3;font-weight:600;letter-spacing:-0.01em;color:${escapeAttr(shellText)};">${escapeHtml(input.storeName)}</p>
          </td>
        </tr>
      </table>`;
  const emailFont = normalizeEmailFont(input.emailFont);
  const fontFamily = emailFontStackWithRaw(emailFont, input.fontFamilyRaw);
  const fontHeadLinks = emailFontHeadLinks(emailFont);

  const useBlocks = copy.blocks && copy.blocks.length > 0;
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
    : "";

  const bodySection = useBlocks
    ? `
      <p style="margin:0 0 16px;font-size:18px;line-height:1.4;font-weight:600;color:${escapeAttr(shellText)};">
        Hi ${escapeHtml(vars.first_name)},
      </p>
      ${blocksHtml}
      <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:${faintFooter};">
        ${escapeHtml(copy.ignoreNote)}
      </p>`
    : `
      <p style="margin:0 0 8px;font-size:18px;line-height:1.4;font-weight:600;color:${escapeAttr(shellText)};">
        Hi ${escapeHtml(vars.first_name)},
      </p>
      <p style="margin:0 0 28px;font-size:16px;line-height:1.5;color:${escapeAttr(secondary)};">
        ${escapeHtml(headline)}
      </p>

      <p style="margin:0 0 28px;font-size:16px;line-height:1.6;color:${escapeAttr(shellText)};">
        ${body}
      </p>

      <p style="margin:0 0 28px;">
        <a href="${escapeAttr(ctaUrl)}"
           style="display:inline-block;background:${escapeAttr(ctaBg)};color:${escapeAttr(ctaText)};text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:${ctaRadiusCss};">
          ${escapeHtml(copy.cta)}
        </a>
      </p>

      <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:${mutedFooter};">
        Or <a href="${escapeAttr(ctaUrl)}" style="color:${escapeAttr(linkColor)};text-decoration:underline;">open the billing page</a> to update your card.
      </p>
      <p style="margin:0;font-size:13px;line-height:1.5;color:${faintFooter};">
        ${escapeHtml(copy.ignoreNote)}
      </p>`;

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
    ${fontHeadLinks}
  </head>
  <body style="margin:0;padding:0;background:${escapeAttr(shellBg)};font-family:${escapeAttr(fontFamily)};color:${escapeAttr(shellText)};-webkit-font-smoothing:antialiased;">
    <div style="max-width:480px;margin:0 auto;padding:40px ${pad}px 48px;">
      ${headerHtml}

      ${bodySection}

      <hr style="border:none;border-top:1px solid ${ruleColor};margin:40px 0 28px;" />

      <p style="margin:0 0 10px;font-size:28px;line-height:1.15;font-weight:700;letter-spacing:-0.03em;color:${escapeAttr(shellText)};">
        ${escapeHtml(input.storeName)}
      </p>
      <p style="margin:0 0 20px;font-size:13px;line-height:1.5;color:${mutedFooter};">
        ${supportBlock}
      </p>

      ${socialHtml}

      <p style="margin:0 0 20px;font-size:13px;line-height:1.5;">
        <a href="${escapeAttr(ctaUrl)}" style="color:${escapeAttr(linkColor)};text-decoration:underline;margin-right:16px;">Manage subscription</a>
        <a href="${helpHref}" style="color:${escapeAttr(linkColor)};text-decoration:underline;">Help center</a>
      </p>

      <p style="margin:0;font-size:12px;line-height:1.5;color:${faintFooter};">
        © ${year} ${escapeHtml(input.storeName)}. All rights reserved.
      </p>

      ${badgeHtml}
    </div>
  </body>
</html>`;

  const blockText = useBlocks
    ? applyVars(renderBlocksText(copy.blocks!, ctaUrl), vars, "text")
    : body.replace(/<[^>]+>/g, "");

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

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
