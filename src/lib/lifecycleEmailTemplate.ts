/**
 * FE mirror of Riley’s `convex/lib/lifecycleEmailTemplate.ts` (`buildLifecycleEmail`).
 * After their branch merges to `dev`, re-export from that path.
 */

import {
  ensureCtaLabelContrast,
  ensureShellTextHierarchy,
} from "../../convex/lib/brandImport/colors";
import {
  emailFontHeadLinks,
  emailFontStackWithRaw,
} from "../../convex/lib/emailFonts";
import {
  LIFECYCLE_EMAIL_TYPES,
  isLifecycleEmailType,
  recoveryColorsFromTheme,
  resolveTheme,
  type LifecycleEmailType,
  type ResolveThemeInput,
  type ResolvedEmailTheme,
} from "./emailTheme";

const LIFECYCLE_COPY: Record<
  LifecycleEmailType,
  { subject: string; headline: string; body: string; cta: string }
> = {
  verify: {
    subject: "Verify your email for {{store}}",
    headline: "Confirm this email address",
    body: "Verify your email so {{store}} can keep you updated about {{product}}.",
    cta: "Verify email",
  },
  decline_pause: {
    subject: "Your {{product}} payment was declined",
    headline: "Payment declined — access may pause",
    body: "We couldn’t charge {{amount}} for {{product}}. Update billing to keep access.",
    cta: "Update payment",
  },
  trial_ended: {
    subject: "Your {{product}} trial has ended",
    headline: "Trial ended",
    body: "Your trial for {{product}} is over. Add a payment method to continue.",
    cta: "Continue subscription",
  },
  renewal: {
    subject: "{{product}} renews soon",
    headline: "Upcoming renewal",
    body: "{{product}} renews soon for {{amount}}. No action needed if your card is up to date.",
    cta: "Review billing",
  },
  expiry: {
    subject: "Your {{product}} access is ending",
    headline: "Subscription ending",
    body: "Access to {{product}} is ending. Renew to keep your account active.",
    cta: "Renew now",
  },
};

export type LifecycleEmailVars = {
  emailType: LifecycleEmailType;
  storeName: string;
  productName: string;
  amountLabel: string;
  customerName: string | null;
  ctaUrl: string;
  supportEmail?: string | null;
  theme: ResolveThemeInput | ResolvedEmailTheme;
};

export type BuiltLifecycleEmail = {
  emailType: LifecycleEmailType;
  layoutPresetId: string;
  stylingMode: ResolvedEmailTheme["stylingMode"];
  subject: string;
  html: string;
  text: string;
};

function applyVars(template: string, vars: Record<string, string>): string {
  return template
    .replace(/\{\{store\}\}/g, vars.store)
    .replace(/\{\{product\}\}/g, vars.product)
    .replace(/\{\{amount\}\}/g, vars.amount);
}

function firstName(name: string | null): string {
  const part = name?.trim().split(/\s+/)[0];
  return part || "there";
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

export function buildLifecycleEmail(input: LifecycleEmailVars): BuiltLifecycleEmail {
  if (!isLifecycleEmailType(input.emailType)) {
    throw new Error("Unknown lifecycle email type");
  }

  const theme =
    "tokens" in input.theme && input.theme.tokens
      ? input.theme
      : resolveTheme(input.theme);
  const colors = recoveryColorsFromTheme(theme.tokens);
  const copy = LIFECYCLE_COPY[input.emailType];
  const vars = {
    store: input.storeName.trim() || "your store",
    product: input.productName.trim() || "your subscription",
    amount: input.amountLabel.trim() || "your plan",
  };
  const greeting = firstName(input.customerName);
  const subject = applyVars(copy.subject, vars);
  const headline = applyVars(copy.headline, vars);
  const body = applyVars(copy.body, vars);
  const ctaUrl = input.ctaUrl.trim() || "#";
  const shellBg = colors.emailBackgroundColor;
  const hierarchy = ensureShellTextHierarchy(
    shellBg,
    colors.emailTextColor,
    colors.secondaryColor,
  );
  const ctaText = ensureCtaLabelContrast(
    colors.ctaBackgroundColor,
    colors.ctaTextColor,
  );
  const fontFamily = emailFontStackWithRaw(
    colors.emailFont,
    colors.fontFamilyRaw,
  );
  const support = input.supportEmail?.trim() || null;
  const supportLine = support
    ? `Questions? ${support}`
    : "Questions? Reply to this email.";

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
    ${emailFontHeadLinks(colors.emailFont)}
  </head>
  <body style="margin:0;padding:0;background:${escapeAttr(shellBg)};font-family:${escapeAttr(fontFamily)};color:${escapeAttr(hierarchy.bodyText)};">
    <div style="max-width:480px;margin:0 auto;padding:40px 24px 48px;background:${escapeAttr(shellBg)};">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${escapeAttr(hierarchy.mutedText)};">${escapeHtml(theme.layoutPresetId)}</p>
      <p style="margin:0 0 20px;font-size:17px;font-weight:600;color:${escapeAttr(hierarchy.bodyText)};">${escapeHtml(vars.store)}</p>
      <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:${escapeAttr(hierarchy.bodyText)};">Hi ${escapeHtml(greeting)},</p>
      <p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:${escapeAttr(hierarchy.mutedText)};">${escapeHtml(headline)}</p>
      <p style="margin:0 0 28px;font-size:16px;line-height:1.6;color:${escapeAttr(hierarchy.bodyText)};">${escapeHtml(body)}</p>
      <p style="margin:0 0 28px;">
        <a href="${escapeAttr(ctaUrl)}" style="display:inline-block;background:${escapeAttr(colors.ctaBackgroundColor)};color:${escapeAttr(ctaText)};text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:${colors.ctaBorderRadiusPx}px;">${escapeHtml(copy.cta)}</a>
      </p>
      <p style="margin:0;font-size:13px;line-height:1.5;color:${escapeAttr(hierarchy.mutedText)};">${escapeHtml(supportLine)}</p>
    </div>
  </body>
</html>`;

  const text = [
    `Hi ${greeting},`,
    "",
    headline,
    "",
    body,
    "",
    `${copy.cta}: ${ctaUrl}`,
    "",
    supportLine,
    `— ${vars.store}`,
  ].join("\n");

  return {
    emailType: input.emailType,
    layoutPresetId: theme.layoutPresetId,
    stylingMode: theme.stylingMode,
    subject,
    html,
    text,
  };
}

export function listLifecycleEmailTypes(): LifecycleEmailType[] {
  return [...LIFECYCLE_EMAIL_TYPES];
}
