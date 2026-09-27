/**
 * Shared table-based recovery-layout HTML.
 *
 * Locked catalog IDs (CoS + Riley):
 *   sonos              → src/components/dashboard/email-layouts/refs/sonos.png
 *   avocode            → src/components/dashboard/email-layouts/refs/avocode.png
 *   benchmark          → src/components/dashboard/email-layouts/refs/benchmark.png
 *   fontbase           → src/components/dashboard/email-layouts/refs/fontbase.png
 *   nordvpn-structure  → src/components/dashboard/email-layouts/refs/nordvpn-structure.png
 *
 * Keyed by layoutPresetId × day0|day2|day5. Merchant branding only —
 * no third-party logos or cloned marketing copy.
 */

import { LEGACY_LAYOUT_PRESET_ID_MAP } from "./emailTheme";
import {
  emailFontHeadLinks,
  emailFontStackWithRaw,
  normalizeEmailFont,
  type EmailFontId,
} from "./emailFonts";
import { allowHttpsUrl } from "./safeUrl";

export const RECOVERY_LAYOUT_IDS = [
  "sonos",
  "avocode",
  "benchmark",
  "fontbase",
  "nordvpn-structure",
] as const;

export type RecoveryLayoutId = (typeof RECOVERY_LAYOUT_IDS)[number];

export const RECOVERY_LAYOUT_STEPS = ["day0", "day2", "day5"] as const;
export type RecoveryLayoutStep = (typeof RECOVERY_LAYOUT_STEPS)[number];

export type RecoveryLayoutTheme = {
  brandColor: string;
  secondaryColor: string;
  mutedTextColor: string;
  linkColor: string;
  pageBackgroundColor: string;
  pageTextColor: string;
  emailBackgroundColor: string;
  emailTextColor: string;
  ctaBackgroundColor: string;
  ctaTextColor: string;
  ctaBorderRadiusPx: number;
  emailFont: EmailFontId | string;
  fontFamilyRaw: string | null;
};

export type RecoveryLayoutCopy = {
  headline: string;
  body: string;
  cta: string;
  secondaryLink?: string;
  eyebrow?: string;
  status?: string;
  support?: readonly string[];
};

export type RecoverySocialLinks = {
  x?: string | null;
  linkedin?: string | null;
  youtube?: string | null;
  instagram?: string | null;
};

/** Customizations shell chrome — applied to the inner layout card. */
export type RecoveryLayoutShell = {
  emailPadding?: number;
  shellBackground?: string;
  shellBorderColor?: string;
  shellBorder?: boolean;
  shellBorderWidth?: number;
  shellRadius?: number;
};

export type BuildRecoveryLayoutHtmlInput = {
  layoutPresetId: string;
  step: RecoveryLayoutStep | "gentle" | "direct" | "urgent";
  theme: RecoveryLayoutTheme;
  copy: RecoveryLayoutCopy;
  storeName: string;
  storeLogoUrl?: string | null;
  supportEmail?: string | null;
  firstName?: string | null;
  productName?: string | null;
  amountLabel?: string | null;
  ctaUrl?: string | null;
  showDeclineGuardBadge?: boolean;
  copyrightYear?: number;
  /**
   * Pre-rendered merchant-block HTML. When set, replaces the escaped
   * `copy.body` paragraph (layout chrome stays around this slot).
   */
  bodyHtml?: string;
  ignoreNote?: string | null;
  socials?: RecoverySocialLinks | null;
  shell?: RecoveryLayoutShell | null;
};

export type BuiltRecoveryLayoutHtml = {
  layoutPresetId: RecoveryLayoutId;
  step: RecoveryLayoutStep;
  html: string;
};

export function isRecoveryLayoutId(value: string): value is RecoveryLayoutId {
  return (RECOVERY_LAYOUT_IDS as readonly string[]).includes(value);
}

export function normalizeRecoveryLayoutId(
  value: string | null | undefined,
): RecoveryLayoutId {
  const raw = value?.trim() ?? "";
  const mapped = LEGACY_LAYOUT_PRESET_ID_MAP[raw] ?? raw;
  return isRecoveryLayoutId(mapped) ? mapped : "sonos";
}

export function recoveryStepFromTemplate(
  id: "gentle" | "direct" | "urgent",
): RecoveryLayoutStep {
  switch (id) {
    case "gentle":
      return "day0";
    case "direct":
      return "day2";
    case "urgent":
      return "day5";
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export function normalizeRecoveryStep(
  step: BuildRecoveryLayoutHtmlInput["step"],
): RecoveryLayoutStep {
  if (step === "gentle" || step === "direct" || step === "urgent") {
    return recoveryStepFromTemplate(step);
  }
  if ((RECOVERY_LAYOUT_STEPS as readonly string[]).includes(step)) {
    return step;
  }
  return "day0";
}

export function recoveryStepDayNumber(step: RecoveryLayoutStep): 0 | 2 | 5 {
  switch (step) {
    case "day0":
      return 0;
    case "day2":
      return 2;
    case "day5":
      return 5;
    default: {
      const _exhaustive: never = step;
      return _exhaustive;
    }
  }
}

export function recoveryStepLabel(step: RecoveryLayoutStep): string {
  switch (step) {
    case "day0":
      return "Day 0";
    case "day2":
      return "Day 2";
    case "day5":
      return "Day 5";
    default: {
      const _exhaustive: never = step;
      return _exhaustive;
    }
  }
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

function pillRadius(px: number): string {
  return `${Math.max(0, Math.min(9999, Math.round(px)))}px`;
}

function logoImg(
  storeName: string,
  storeLogoUrl: string | null | undefined,
  size: number,
): string {
  const src = allowHttpsUrl(storeLogoUrl ?? null);
  if (!src) return "";
  return `<img src="${escapeAttr(src)}" alt="${escapeAttr(storeName)}" width="${size}" height="${size}" style="display:block;border:0;width:${size}px;height:${size}px;object-fit:contain;" />`;
}

function wordmarkRow(
  storeName: string,
  storeLogoUrl: string | null | undefined,
  color: string,
  tracking: string,
  size: number,
): string {
  const img = logoImg(storeName, storeLogoUrl, size);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>${
    img
      ? `<td style="padding-right:8px;vertical-align:middle;">${img}</td>`
      : ""
  }<td style="vertical-align:middle;font-size:${size === 18 ? "11px" : "13px"};font-weight:600;letter-spacing:${tracking};text-transform:uppercase;color:${escapeAttr(color)};">${escapeHtml(storeName)}</td></tr></table>`;
}

function ctaButton(
  theme: RecoveryLayoutTheme,
  label: string,
  href: string,
  opts?: { fullWidth?: boolean; uppercase?: boolean },
): string {
  const text = opts?.uppercase ? label.toUpperCase() : label;
  const width = opts?.fullWidth ? "width:100%;" : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ${opts?.fullWidth ? 'width="100%"' : ""}><tr><td align="${opts?.fullWidth ? "center" : "left"}" style="${width}"><a href="${escapeAttr(href)}" style="display:${opts?.fullWidth ? "block" : "inline-block"};${width}box-sizing:border-box;background:${escapeAttr(theme.ctaBackgroundColor)};color:${escapeAttr(theme.ctaTextColor)};text-decoration:none;font-size:13px;font-weight:600;line-height:20px;padding:12px 24px;border-radius:${pillRadius(theme.ctaBorderRadiusPx)};text-align:center;letter-spacing:${opts?.uppercase ? "0.04em" : "0"};">${escapeHtml(text)}</a></td></tr></table>`;
}

function socialRow(
  color: string,
  socials?: RecoverySocialLinks | null,
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

  if (items.length > 0) {
    const cells = items
      .map(
        (item) =>
          `<td align="center" style="padding:0 10px;font-size:13px;font-weight:600;"><a href="${escapeAttr(item.href)}" style="color:${escapeAttr(color)};text-decoration:none;">${escapeHtml(item.label)}</a></td>`,
      )
      .join("");
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>${cells}</tr></table>`;
  }

  const marks = ["f", "o", "x", "▶"];
  const cells = marks
    .map(
      (mark) =>
        `<td align="center" style="padding:0 10px;font-size:13px;font-weight:600;color:${escapeAttr(color)};">${mark}</td>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>${cells}</tr></table>`;
}

function ignoreNoteBlock(note: string | null | undefined, color: string): string {
  const trimmed = note?.trim();
  if (!trimmed) return "";
  return `<p data-ignore-note="true" style="margin:8px 0 0;font-size:11px;line-height:16px;color:${escapeAttr(color)};">${escapeHtml(trimmed)}</p>`;
}

function bodyInner(
  copy: RecoveryLayoutCopy,
  bodyHtml: string | undefined,
): string {
  const html = bodyHtml?.trim();
  return html ? html : escapeHtml(copy.body);
}

function bodySlot(
  copy: RecoveryLayoutCopy,
  bodyHtml: string | undefined,
  style: string,
): string {
  const html = bodyHtml?.trim();
  if (html) {
    return `<div data-body-slot="blocks" style="${style}">${html}</div>`;
  }
  return `<p data-body-slot="copy" style="${style}">${escapeHtml(copy.body)}</p>`;
}

function resolveShellChrome(
  theme: RecoveryLayoutTheme,
  shell?: RecoveryLayoutShell | null,
): { cardStyle: string; pagePad: string } {
  const bg = shell?.shellBackground?.trim() || theme.emailBackgroundColor;
  const parts = [`background:${escapeAttr(bg)}`];
  if (typeof shell?.shellRadius === "number" && Number.isFinite(shell.shellRadius)) {
    const radius = Math.max(0, Math.min(48, Math.round(shell.shellRadius)));
    parts.push(`border-radius:${radius}px`, "overflow:hidden");
  }
  if (shell?.shellBorder === false) {
    parts.push("border:0");
  } else if (shell?.shellBorder === true) {
    const width =
      typeof shell.shellBorderWidth === "number" &&
      Number.isFinite(shell.shellBorderWidth)
        ? Math.max(1, Math.min(8, Math.round(shell.shellBorderWidth)))
        : 1;
    const color = shell.shellBorderColor?.trim() || theme.brandColor;
    parts.push(`border:${width}px solid ${escapeAttr(color)}`);
  }
  const pagePad =
    typeof shell?.emailPadding === "number" && Number.isFinite(shell.emailPadding)
      ? `padding:${Math.max(0, Math.min(80, Math.round(shell.emailPadding)))}px;`
      : "";
  return { cardStyle: parts.join(";"), pagePad };
}

function declineGuardNote(linkColor: string, muted: string): string {
  return `<p style="margin:20px 0 0;font-size:11px;line-height:16px;color:${escapeAttr(muted)};">Recovery sent by <strong style="color:${escapeAttr(linkColor)};">DeclineGuard</strong></p>`;
}

function wrapDocument(
  theme: RecoveryLayoutTheme,
  inner: string,
  ctx: RenderCtx,
): string {
  const fontId = normalizeEmailFont(theme.emailFont);
  const stack = emailFontStackWithRaw(fontId, theme.fontFamilyRaw);
  const links = emailFontHeadLinks(fontId);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>Recovery email</title>${links}<style>body{margin:0;padding:0;}</style></head><body data-layout="${escapeAttr(ctx.layoutPresetId)}" data-compose="${ctx.compose}" style="margin:0;padding:0;background:${escapeAttr(theme.pageBackgroundColor)};color:${escapeAttr(theme.pageTextColor)};font-family:${escapeAttr(stack)};">${inner}</body></html>`;
}

function sonosHtml(
  input: BuildRecoveryLayoutHtmlInput,
  ctx: RenderCtx,
): string {
  const { theme, copy, storeName, storeLogoUrl } = input;
  const hero = `<td height="176" align="center" valign="bottom" style="background:#ececec;height:176px;">
      <div style="width:80px;height:80px;border-radius:40px;background:#d8d8d8;margin:0 auto 32px;"></div>
    </td>`;
  return wrapDocument(
    theme,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${escapeAttr(theme.pageBackgroundColor)};">
  <tr><td align="center" style="${ctx.pagePad || "padding:0;"}">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:480px;${ctx.cardStyle}">
      <tr><td align="center" style="padding:40px 32px 24px;">${wordmarkRow(storeName, storeLogoUrl, theme.emailTextColor, "0.24em", 22)}</td></tr>
      <tr>${hero}</tr>
      <tr><td align="center" style="padding:40px 32px 0;">
        <h1 style="margin:0;font-size:26px;line-height:32px;font-weight:600;letter-spacing:-0.03em;color:${escapeAttr(theme.emailTextColor)};">${escapeHtml(copy.headline)}</h1>
        ${bodySlot(copy, ctx.bodyHtml, `margin:16px auto 0;max-width:352px;font-size:14px;line-height:22px;color:${escapeAttr(theme.mutedTextColor)};`)}
        <div style="margin:32px 0 0;">${ctaButton(theme, copy.cta, ctx.ctaUrl, { fullWidth: true })}</div>
      </td></tr>
      <tr><td align="center" style="padding:32px 32px 16px;">${socialRow(theme.emailTextColor, input.socials)}</td></tr>
      <tr><td style="padding:0 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid rgba(0,0,0,0.08);border-bottom:1px solid rgba(0,0,0,0.08);">
          <tr>
            <td style="padding:16px 0;font-size:13px;color:${escapeAttr(theme.emailTextColor)};">Questions? We’re here to help.</td>
            <td align="right" style="padding:16px 0;font-size:16px;color:${escapeAttr(theme.mutedTextColor)};">›</td>
          </tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding:24px 32px 32px;">
        <p style="margin:0;font-size:11px;line-height:16px;color:rgba(12,12,12,0.38);">© ${ctx.year} ${escapeHtml(storeName)}. All rights reserved.</p>
        <p style="margin:8px 0 0;font-size:11px;line-height:16px;color:rgba(12,12,12,0.38);">This email was sent to a customer of ${escapeHtml(storeName)}. Please do not reply.</p>
        ${ignoreNoteBlock(input.ignoreNote, "rgba(12,12,12,0.38)")}
        <p style="margin:12px 0 0;font-size:11px;color:rgba(12,12,12,0.38);">Privacy statement · Terms</p>
        ${ctx.showBadge ? declineGuardNote(theme.linkColor, "rgba(12,12,12,0.38)") : ""}
      </td></tr>
    </table>
  </td></tr>
</table>`,
    ctx,
  );
}

function nordvpnHtml(
  input: BuildRecoveryLayoutHtmlInput,
  ctx: RenderCtx,
): string {
  const { theme, copy, storeName, storeLogoUrl } = input;
  const tens = String(Math.floor(ctx.day / 10));
  const ones = String(ctx.day % 10);
  const img = logoImg(storeName, storeLogoUrl, 22);
  const flip = (n: string) =>
    `<td align="center" width="64" height="80" style="width:64px;height:80px;background:#1a1a1a;border-radius:6px;color:#ffffff;font-size:44px;font-weight:600;line-height:80px;">${n}</td>`;
  return wrapDocument(
    theme,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${escapeAttr(theme.pageBackgroundColor)};">
  <tr><td align="center" style="${ctx.pagePad || "padding:16px 12px 8px;"}">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:480px;">
      <tr>
        <td style="padding:0 4px 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${
            img
              ? `<td style="padding-right:8px;vertical-align:middle;">${img}</td>`
              : ""
          }<td style="font-size:13px;font-weight:600;color:${escapeAttr(theme.pageTextColor)};">${escapeHtml(storeName)}</td></tr></table>
        </td>
        <td align="right" style="padding:0 4px 12px;font-size:10px;line-height:14px;color:${escapeAttr(theme.mutedTextColor)};">Payment recovery. Keep access.</td>
      </tr>
      <tr><td colspan="2" style="${ctx.cardStyle};padding:32px 24px;">
        <h1 style="margin:0;font-size:28px;line-height:34px;font-weight:600;letter-spacing:-0.03em;color:${escapeAttr(theme.emailTextColor)};">${escapeHtml(copy.headline)}</h1>
        <p style="margin:12px 0 0;font-size:14px;color:${escapeAttr(theme.mutedTextColor)};">${escapeHtml(copy.status || copy.eyebrow || ctx.stepLabel)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;background:#111111;">
          <tr><td align="center" height="144" style="height:144px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${flip(tens)}<td width="12"></td>${flip(ones)}</tr></table>
          </td></tr>
        </table>
        ${bodySlot(copy, ctx.bodyHtml, `margin:24px 0 0;font-size:14px;line-height:22px;color:${escapeAttr(theme.emailTextColor)};`)}
        <p style="margin:12px 0 0;font-size:13px;color:${escapeAttr(theme.mutedTextColor)};">${escapeHtml(ctx.product)} · ${escapeHtml(ctx.amount)}</p>
        <div style="margin:28px 0 0;">${ctaButton(theme, copy.cta, ctx.ctaUrl)}</div>
        <p style="margin:32px 0 0;font-size:13px;line-height:20px;color:${escapeAttr(theme.emailTextColor)};">Best regards,<br />The ${escapeHtml(storeName)} team</p>
      </td></tr>
      <tr><td colspan="2" align="center" style="padding:20px 8px 8px;">${socialRow(theme.mutedTextColor, input.socials)}</td></tr>
      <tr><td colspan="2" align="center" style="padding:8px 8px 24px;">
        <p style="margin:0;font-size:11px;line-height:16px;color:rgba(12,12,12,0.4);">${escapeHtml(storeName)} sends this recovery email after a failed payment.</p>
        ${ignoreNoteBlock(input.ignoreNote, "rgba(12,12,12,0.4)")}
        ${
          copy.secondaryLink
            ? `<p style="margin:8px 0 0;font-size:11px;"><a href="${escapeAttr(ctx.ctaUrl)}" style="color:${escapeAttr(theme.linkColor)};">${escapeHtml(copy.secondaryLink)}</a></p>`
            : ""
        }
        ${ctx.showBadge ? declineGuardNote(theme.linkColor, "rgba(12,12,12,0.4)") : ""}
      </td></tr>
    </table>
  </td></tr>
</table>`,
    ctx,
  );
}

function avocodeHtml(
  input: BuildRecoveryLayoutHtmlInput,
  ctx: RenderCtx,
): string {
  const { theme, copy, storeName, storeLogoUrl } = input;
  return wrapDocument(
    theme,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${escapeAttr(theme.pageBackgroundColor)};">
  <tr><td align="center" style="${ctx.pagePad || "padding:24px 16px 8px;"}">${wordmarkRow(storeName, storeLogoUrl, theme.pageTextColor, "0.22em", 18)}</td></tr>
  <tr><td align="center" style="padding:0 16px;">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:480px;${ctx.cardStyle}">
      <tr><td align="center" style="padding:48px 32px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(0,0,0,0.08);background:#ffffff;">
          <tr><td height="12" style="height:12px;background:#f3f4f6;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr><td align="center" width="96" height="64" style="width:96px;height:64px;font-size:32px;font-weight:600;color:${escapeAttr(theme.ctaBackgroundColor)};">${ctx.day}</td></tr>
        </table>
        <h1 style="margin:32px 0 0;font-size:26px;line-height:32px;font-weight:600;letter-spacing:-0.03em;color:${escapeAttr(theme.emailTextColor)};">${escapeHtml(copy.headline)}</h1>
        ${bodySlot(copy, ctx.bodyHtml, `margin:16px auto 0;max-width:352px;font-size:14px;line-height:22px;color:${escapeAttr(theme.mutedTextColor)};`)}
        <div style="margin:32px 0 40px;">${ctaButton(theme, copy.cta, ctx.ctaUrl, { uppercase: true })}</div>
      </td></tr>
      <tr><td align="center" style="padding:20px 24px;border-top:1px solid rgba(0,0,0,0.06);font-size:13px;color:${escapeAttr(theme.mutedTextColor)};">
        Questions? Mail us at <a href="mailto:${escapeAttr(ctx.support)}" style="color:${escapeAttr(theme.emailTextColor)};text-decoration:none;">${escapeHtml(ctx.support)}</a>
      </td></tr>
    </table>
  </td></tr>
  <tr><td align="center" style="padding:16px 24px 24px;font-size:11px;color:rgba(17,24,39,0.4);">News about our product · Updates
    ${ignoreNoteBlock(input.ignoreNote, "rgba(17,24,39,0.4)")}
    ${ctx.showBadge ? declineGuardNote(theme.linkColor, "rgba(17,24,39,0.4)") : ""}
  </td></tr>
</table>`,
    ctx,
  );
}

function fontbaseHtml(
  input: BuildRecoveryLayoutHtmlInput,
  ctx: RenderCtx,
): string {
  const { theme, copy, storeName, storeLogoUrl } = input;
  const img = logoImg(storeName, storeLogoUrl, 22);
  const mark = img
    ? img
    : `<span style="display:inline-block;width:22px;height:22px;border-radius:11px;background:${escapeAttr(theme.brandColor)};"></span>`;
  return wrapDocument(
    theme,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${escapeAttr(theme.pageBackgroundColor)};">
  <tr><td align="center" style="${ctx.pagePad || "padding:24px 16px 32px;"}">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:480px;">
      <tr><td align="center" style="padding-bottom:0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" width="48" height="48" style="width:48px;height:48px;border-radius:24px;background:${escapeAttr(theme.emailBackgroundColor)};">${mark}</td></tr></table>
      </td></tr>
      <tr><td style="${ctx.cardStyle};padding:40px 32px 48px;margin-top:-24px;">
        <h1 style="margin:16px 0 0;text-align:center;font-size:28px;line-height:34px;font-weight:600;letter-spacing:-0.03em;color:${escapeAttr(theme.emailTextColor)};">${escapeHtml(copy.headline)}</h1>
        ${bodySlot(copy, ctx.bodyHtml, `margin:20px auto 0;max-width:352px;text-align:center;font-size:14px;line-height:22px;color:${escapeAttr(theme.mutedTextColor)};`)}
        <p style="margin:32px 0 0;text-align:center;font-size:32px;line-height:38px;font-weight:600;letter-spacing:-0.03em;color:${escapeAttr(theme.emailTextColor)};">${escapeHtml(ctx.stepLabel)}</p>
        <p style="margin:24px auto 0;max-width:352px;text-align:center;font-size:14px;line-height:22px;color:${escapeAttr(theme.mutedTextColor)};">You can always update billing or manage your subscription from the dashboard.${
          copy.secondaryLink
            ? ` <a href="${escapeAttr(ctx.ctaUrl)}" style="color:${escapeAttr(theme.linkColor)};">${escapeHtml(copy.secondaryLink)}</a>`
            : ""
        }</p>
        <div style="margin:32px 0 0;text-align:center;">${ctaButton(theme, copy.cta, ctx.ctaUrl)}</div>
      </td></tr>
      <tr><td align="center" style="padding:24px 16px 0;font-size:11px;line-height:16px;color:rgba(250,250,250,0.55);">${escapeHtml(storeName)}<br />Recovery email · ${escapeHtml(ctx.support)}
        ${ignoreNoteBlock(input.ignoreNote, "rgba(250,250,250,0.55)")}
        ${ctx.showBadge ? declineGuardNote(theme.linkColor, "rgba(250,250,250,0.55)") : ""}
      </td></tr>
    </table>
  </td></tr>
</table>`,
    ctx,
  );
}

function benchmarkHtml(
  input: BuildRecoveryLayoutHtmlInput,
  ctx: RenderCtx,
): string {
  const { theme, copy, storeName, storeLogoUrl } = input;
  const first = input.firstName?.trim() || "there";
  const card = (
    title: string,
    lines: readonly string[],
    icon: string,
  ) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;background:#f7f8f8;">
      <tr><td align="center" style="padding:24px 20px;">
        ${icon}
        <p style="margin:12px 0 0;font-size:15px;font-weight:600;color:${escapeAttr(theme.emailTextColor)};">${escapeHtml(title)}</p>
        ${lines
          .map(
            (line) =>
              `<p style="margin:8px 0 0;font-size:13px;line-height:20px;color:${escapeAttr(theme.mutedTextColor)};">${escapeHtml(line)}</p>`,
          )
          .join("")}
      </td></tr>
    </table>`;
  const cardIcon = `<div style="width:36px;height:24px;border:1.5px solid ${escapeAttr(theme.ctaBackgroundColor)};border-radius:3px;margin:0 auto;"></div>`;
  const noteIcon = `<div style="width:36px;height:24px;border:1.5px solid ${escapeAttr(theme.ctaBackgroundColor)};border-radius:2px;margin:0 auto;"></div>`;
  const howTo = copy.support?.length
    ? copy.support
    : [
        "1. Open billing from the button above",
        "2. Enter the new card and save",
        "3. We’ll retry the payment for you",
      ];
  return wrapDocument(
    theme,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${ctx.cardStyle}">
  <tr><td align="center" style="${ctx.pagePad || "padding:40px 32px;"}">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:480px;">
      <tr><td align="center" style="padding-bottom:32px;">${wordmarkRow(storeName, storeLogoUrl, theme.emailTextColor, "0.24em", 22)}</td></tr>
      <tr><td style="font-size:16px;color:${escapeAttr(theme.emailTextColor)};">Hi ${escapeHtml(first)},</td></tr>
      <tr><td style="padding-top:16px;font-size:14px;line-height:22px;color:${escapeAttr(theme.mutedTextColor)};">${bodyInner(copy, ctx.bodyHtml)}</td></tr>
      <tr><td style="padding-top:24px;">${ctaButton(theme, copy.cta, ctx.ctaUrl)}</td></tr>
      <tr><td>${card("How to update a card", howTo, cardIcon)}</td></tr>
      <tr><td>${card("Other payment methods", [`Contact ${storeName} support and they’ll help get the account current.`], noteIcon)}</td></tr>
      <tr><td style="padding-top:32px;font-size:14px;line-height:22px;color:${escapeAttr(theme.emailTextColor)};">All the best,<br />Your friends at ${escapeHtml(storeName)}</td></tr>
      <tr><td style="padding-top:24px;font-size:13px;line-height:20px;color:${escapeAttr(theme.mutedTextColor)};">P.S. Questions?<br />Please give us the opportunity to help. <a href="mailto:${escapeAttr(ctx.support)}" style="color:${escapeAttr(theme.linkColor)};">Contact our support team →</a></td></tr>
      <tr><td align="center" style="padding-top:40px;">
        <p style="margin:0 0 12px;font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:rgba(12,12,12,0.4);">Find us on social</p>
        ${socialRow(theme.mutedTextColor, input.socials)}
        ${ignoreNoteBlock(input.ignoreNote, "rgba(12,12,12,0.4)")}
        ${ctx.showBadge ? declineGuardNote(theme.linkColor, "rgba(12,12,12,0.4)") : ""}
      </td></tr>
    </table>
  </td></tr>
</table>`,
    ctx,
  );
}

type RenderCtx = {
  layoutPresetId: RecoveryLayoutId;
  compose: "blocks" | "copy";
  bodyHtml: string | undefined;
  cardStyle: string;
  pagePad: string;
  day: 0 | 2 | 5;
  stepLabel: string;
  ctaUrl: string;
  support: string;
  product: string;
  amount: string;
  year: number;
  showBadge: boolean;
};

/**
 * Build a full HTML document for one recovery-layout × Day 0/2/5 send.
 * Safe for Resend and for an FE preview iframe (`srcDoc`).
 */
export function buildRecoveryLayoutHtml(
  input: BuildRecoveryLayoutHtmlInput,
): BuiltRecoveryLayoutHtml {
  const layoutPresetId = normalizeRecoveryLayoutId(input.layoutPresetId);
  const step = normalizeRecoveryStep(input.step);
  const shell = resolveShellChrome(input.theme, input.shell);
  const bodyHtml = input.bodyHtml?.trim() || undefined;
  const ctx: RenderCtx = {
    layoutPresetId,
    compose: bodyHtml ? "blocks" : "copy",
    bodyHtml,
    cardStyle: shell.cardStyle,
    pagePad: shell.pagePad,
    day: recoveryStepDayNumber(step),
    stepLabel: recoveryStepLabel(step),
    ctaUrl: allowHttpsUrl(input.ctaUrl ?? null) ?? "#",
    support: input.supportEmail?.trim() || "support@yourstore.com",
    product: input.productName?.trim() || "your subscription",
    amount: input.amountLabel?.trim() || "your plan",
    year: input.copyrightYear ?? 2026,
    showBadge: Boolean(input.showDeclineGuardBadge),
  };

  let html: string;
  switch (layoutPresetId) {
    case "sonos":
      html = sonosHtml(input, ctx);
      break;
    case "avocode":
      html = avocodeHtml(input, ctx);
      break;
    case "benchmark":
      html = benchmarkHtml(input, ctx);
      break;
    case "fontbase":
      html = fontbaseHtml(input, ctx);
      break;
    case "nordvpn-structure":
      html = nordvpnHtml(input, ctx);
      break;
    default: {
      const _exhaustive: never = layoutPresetId;
      html = _exhaustive;
    }
  }

  return { layoutPresetId, step, html };
}
