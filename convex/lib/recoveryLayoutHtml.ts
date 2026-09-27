import {
  normalizeLayoutPresetId,
  type LayoutPresetId,
} from "./emailTheme";
import type { RecoveryTemplateId } from "./recoveryEmailTemplate";

/**
 * Structural HTML for recovery send + preview.
 * `layoutPresetId` selects DOM structure; tokens and day-step copy are applied on top.
 * These are not token-only skins — each id has a distinct header/hero/CTA/footer pattern.
 */

export type RecoveryLayoutModel = {
  layoutPresetId: string;
  templateId: RecoveryTemplateId;
  subject: string;
  headline: string;
  bodyHtml: string;
  greeting: string;
  ctaLabel: string;
  ctaUrl: string;
  ignoreNote: string;
  storeName: string;
  productName: string;
  amountLabel: string;
  logoMark: string;
  year: number;
  fontFamily: string;
  fontHeadLinks: string;
  shellBg: string;
  shellText: string;
  secondary: string;
  primary: string;
  ctaBg: string;
  ctaText: string;
  ctaRadiusCss: string;
  linkColor: string;
  mutedFooter: string;
  faintFooter: string;
  ruleColor: string;
  supportBlock: string;
  helpHref: string;
  socialHtml: string;
  badgeHtml: string;
  useBlocks: boolean;
  blocksHtml: string;
};

const STEP_LABEL: Record<RecoveryTemplateId, string> = {
  gentle: "Day 0",
  direct: "Day 2",
  urgent: "Day 5",
};

export function renderRecoveryLayoutHtml(model: RecoveryLayoutModel): string {
  const layoutId = normalizeLayoutPresetId(model.layoutPresetId);
  switch (layoutId) {
    case "sonos":
      return wrapDocument(model, renderSonos(model));
    case "avocode":
      return wrapDocument(model, renderAvocode(model));
    case "benchmark":
      return wrapDocument(model, renderBenchmark(model));
    case "fontbase":
      return wrapDocument(model, renderFontbase(model));
    case "nordvpn-structure":
      return wrapDocument(model, renderNordvpn(model));
    default: {
      const _exhaustive: never = layoutId;
      return _exhaustive;
    }
  }
}

function wrapDocument(model: RecoveryLayoutModel, inner: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(model.subject)}</title>
    ${model.fontHeadLinks}
  </head>
  <body style="margin:0;padding:0;background:${escapeAttr(model.shellBg)};font-family:${escapeAttr(model.fontFamily)};color:${escapeAttr(model.shellText)};-webkit-font-smoothing:antialiased;">
    ${inner}
  </body>
</html>`;
}

/** Sonos — centered editorial paper, no card chrome. */
function renderSonos(model: RecoveryLayoutModel): string {
  const step = STEP_LABEL[model.templateId];
  return `<table role="presentation" data-layout="sonos" data-structure="centered-editorial" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${escapeAttr(model.shellBg)};">
  <tr>
    <td align="center" style="padding:48px 24px 56px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;">
        <tr>
          <td align="center" data-region="sonos-mark" style="padding:0 0 28px;">
            ${model.logoMark}
            <p style="margin:14px 0 0;font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:${escapeAttr(model.secondary)};">${escapeHtml(model.storeName)}</p>
          </td>
        </tr>
        <tr>
          <td align="center">
            <p data-kicker="sonos" style="margin:0 0 18px;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:${escapeAttr(model.secondary)};">${escapeHtml(step)}</p>
            ${contentStack(model, {
              align: "center",
              greetingSize: "16px",
              headlineSize: "28px",
              headlineWeight: "500",
              headlineTracking: "-0.03em",
              ctaDisplay: "inline-block",
            })}
          </td>
        </tr>
        <tr>
          <td align="center" data-region="sonos-colophon" style="padding:40px 0 0;">
            <p style="margin:0;font-size:12px;letter-spacing:0.04em;color:${escapeAttr(model.faintFooter)};">${escapeHtml(model.storeName)} · ${model.year}</p>
            <p style="margin:12px 0 0;font-size:12px;line-height:1.5;color:${escapeAttr(model.mutedFooter)};">${model.supportBlock}</p>
            ${model.socialHtml}
            ${model.badgeHtml}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

/** Avocode — left color rail + compact product chrome. */
function renderAvocode(model: RecoveryLayoutModel): string {
  const step = STEP_LABEL[model.templateId];
  return `<table role="presentation" data-layout="avocode" data-structure="left-rail" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${escapeAttr(model.shellBg)};">
  <tr>
    <td align="center" style="padding:32px 16px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:#ffffff;border:1px solid ${escapeAttr(model.ruleColor)};">
        <tr>
          <td data-rail="avocode" width="8" style="width:8px;background:${escapeAttr(model.primary)};font-size:0;line-height:0;">&nbsp;</td>
          <td style="padding:0;">
            <table role="presentation" data-region="avocode-chrome" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-bottom:1px solid ${escapeAttr(model.ruleColor)};">
              <tr>
                <td style="padding:16px 20px;vertical-align:middle;">${model.logoMark}</td>
                <td style="padding:16px 8px;vertical-align:middle;">
                  <p style="margin:0;font-size:14px;font-weight:600;color:${escapeAttr(model.shellText)};">${escapeHtml(model.storeName)}</p>
                  <p style="margin:2px 0 0;font-size:11px;color:${escapeAttr(model.secondary)};">${escapeHtml(step)} · Account</p>
                </td>
                <td align="right" style="padding:16px 20px;vertical-align:middle;">
                  <span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${escapeAttr(model.primary)};border:1px solid ${escapeAttr(model.primary)};padding:4px 8px;">Billing</span>
                </td>
              </tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="padding:24px 20px 8px;vertical-align:top;">
                  ${contentStack(model, {
                    align: "left",
                    greetingSize: "14px",
                    headlineSize: "20px",
                    headlineWeight: "600",
                    headlineTracking: "-0.02em",
                    ctaDisplay: "inline-block",
                    compactCta: true,
                  })}
                </td>
              </tr>
            </table>
            <table role="presentation" data-region="avocode-meta" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${escapeAttr(model.shellBg)};border-top:1px solid ${escapeAttr(model.ruleColor)};">
              <tr>
                <td style="padding:12px 20px;font-size:12px;color:${escapeAttr(model.secondary)};">${escapeHtml(model.productName)}</td>
                <td align="right" style="padding:12px 20px;font-size:13px;font-weight:600;color:${escapeAttr(model.shellText)};">${escapeHtml(model.amountLabel)}</td>
              </tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="padding:16px 20px 20px;">
                  <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:${escapeAttr(model.mutedFooter)};">${model.supportBlock}</p>
                  ${footerLinks(model)}
                  ${model.socialHtml}
                  ${model.badgeHtml}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

/** Benchmark — full-width colored masthead, newsletter article, footer band. */
function renderBenchmark(model: RecoveryLayoutModel): string {
  const step = STEP_LABEL[model.templateId];
  return `<table role="presentation" data-layout="benchmark" data-structure="header-band" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${escapeAttr(model.shellBg)};">
  <tr>
    <td align="center" style="padding:0 0 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;">
        <tr>
          <td data-masthead="benchmark" align="left" style="background:${escapeAttr(model.primary)};padding:22px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;padding:0 12px 0 0;">${model.logoMark}</td>
                <td style="vertical-align:middle;">
                  <p style="margin:0;font-size:18px;font-weight:700;color:${escapeAttr(model.ctaText)};">${escapeHtml(model.storeName)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td data-region="benchmark-issue" style="background:${escapeAttr(model.shellBg)};padding:10px 28px;border-bottom:1px solid ${escapeAttr(model.ruleColor)};">
            <p style="margin:0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${escapeAttr(model.secondary)};">Recovery · ${escapeHtml(step)}</p>
          </td>
        </tr>
        <tr>
          <td data-region="benchmark-article" style="background:#ffffff;padding:28px;">
            ${contentStack(model, {
              align: "left",
              greetingSize: "16px",
              headlineSize: "24px",
              headlineWeight: "700",
              headlineTracking: "-0.02em",
              ctaDisplay: "block",
            })}
          </td>
        </tr>
        <tr>
          <td data-mastfoot="benchmark" style="background:${escapeAttr(model.primary)};padding:20px 28px;">
            <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:${escapeAttr(model.ctaText)};">${model.supportBlock}</p>
            ${footerLinks(model, model.ctaText)}
            ${model.badgeHtml}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

/** FontBase — typographic wordmark, oversized display headline, hairline rules. */
function renderFontbase(model: RecoveryLayoutModel): string {
  const step = STEP_LABEL[model.templateId];
  return `<table role="presentation" data-layout="fontbase" data-structure="typographic" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${escapeAttr(model.shellBg)};">
  <tr>
    <td align="center" style="padding:56px 28px 64px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:540px;">
        <tr>
          <td data-region="fontbase-wordmark">
            <p style="margin:0;font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:${escapeAttr(model.shellText)};">${escapeHtml(model.storeName)}</p>
            <p style="margin:8px 0 0;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${escapeAttr(model.secondary)};">${escapeHtml(step)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 0 0;">
            <hr data-rule="fontbase" style="border:none;border-top:1px solid ${escapeAttr(model.shellText)};margin:0;" />
          </td>
        </tr>
        <tr>
          <td style="padding:28px 0;">
            ${
              model.useBlocks
                ? `<p style="margin:0 0 16px;font-size:16px;color:${escapeAttr(model.shellText)};">Hi ${escapeHtml(model.greeting)},</p>${model.blocksHtml}`
                : `<h1 data-display="fontbase" style="margin:0;font-size:40px;line-height:1.12;font-weight:400;letter-spacing:-0.04em;color:${escapeAttr(model.shellText)};">${escapeHtml(model.headline)}</h1>`
            }
          </td>
        </tr>
        <tr>
          <td>
            <hr style="border:none;border-top:1px solid ${escapeAttr(model.shellText)};margin:0;" />
          </td>
        </tr>
        ${
          model.useBlocks
            ? ""
            : `<tr>
          <td style="padding:24px 0 0;">
            <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:${escapeAttr(model.shellText)};">Hi ${escapeHtml(model.greeting)}, ${model.bodyHtml}</p>
            <p style="margin:0 0 28px;">
              <a href="${escapeAttr(model.ctaUrl)}" data-cta="fontbase" style="display:inline-block;border-bottom:1px solid ${escapeAttr(model.shellText)};color:${escapeAttr(model.shellText)};text-decoration:none;font-size:15px;font-weight:500;padding:0 0 4px;border-radius:0;">${escapeHtml(model.ctaLabel)} →</a>
            </p>
            <p style="margin:0;font-size:13px;color:${escapeAttr(model.faintFooter)};">${escapeHtml(model.ignoreNote)}</p>
          </td>
        </tr>`
        }
        <tr>
          <td style="padding:36px 0 0;">
            <p style="margin:0 0 10px;font-size:12px;line-height:1.5;color:${escapeAttr(model.mutedFooter)};">${model.supportBlock}</p>
            ${footerLinks(model)}
            ${model.socialHtml}
            <p style="margin:16px 0 0;font-size:11px;color:${escapeAttr(model.faintFooter)};">© ${model.year} ${escapeHtml(model.storeName)}</p>
            ${model.badgeHtml}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

/** NordVPN-structure — dark top bar + stacked cards. */
function renderNordvpn(model: RecoveryLayoutModel): string {
  const step = STEP_LABEL[model.templateId];
  return `<table role="presentation" data-layout="nordvpn-structure" data-structure="dark-bar-cards" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${escapeAttr(model.shellBg)};">
  <tr>
    <td align="center" style="padding:0 0 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;">
        <tr>
          <td data-topbar="nordvpn-structure" style="background:${escapeAttr(model.primary)};padding:18px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="vertical-align:middle;">${model.logoMark}</td>
                <td style="vertical-align:middle;padding-left:12px;">
                  <p style="margin:0;font-size:15px;font-weight:700;color:${escapeAttr(model.ctaText)};">${escapeHtml(model.storeName)}</p>
                  <p style="margin:2px 0 0;font-size:11px;color:${escapeAttr(model.ctaText)};opacity:0.72;">Secure billing · ${escapeHtml(step)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 16px 0;">
            <table role="presentation" data-card="product" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border:1px solid ${escapeAttr(model.ruleColor)};border-radius:10px;">
              <tr>
                <td style="padding:14px 16px;">
                  <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:${escapeAttr(model.secondary)};">Product</p>
                  <p style="margin:6px 0 0;font-size:16px;font-weight:600;color:${escapeAttr(model.shellText)};">${escapeHtml(model.productName)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 16px 0;">
            <table role="presentation" data-card="amount" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border:1px solid ${escapeAttr(model.ruleColor)};border-radius:10px;">
              <tr>
                <td style="padding:14px 16px;">
                  <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:${escapeAttr(model.secondary)};">Amount due</p>
                  <p style="margin:6px 0 0;font-size:16px;font-weight:600;color:${escapeAttr(model.shellText)};">${escapeHtml(model.amountLabel)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 16px 0;">
            <table role="presentation" data-card="message" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border:1px solid ${escapeAttr(model.ruleColor)};border-radius:10px;">
              <tr>
                <td style="padding:20px 16px 22px;">
                  ${contentStack(model, {
                    align: "left",
                    greetingSize: "15px",
                    headlineSize: "22px",
                    headlineWeight: "700",
                    headlineTracking: "-0.02em",
                    ctaDisplay: "block",
                  })}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 24px 8px;">
            <p style="margin:0 0 10px;font-size:12px;line-height:1.5;color:${escapeAttr(model.mutedFooter)};">${model.supportBlock}</p>
            ${footerLinks(model)}
            ${model.socialHtml}
            <p style="margin:16px 0 0;font-size:11px;color:${escapeAttr(model.faintFooter)};">© ${model.year} ${escapeHtml(model.storeName)}</p>
            ${model.badgeHtml}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

function contentStack(
  model: RecoveryLayoutModel,
  opts: {
    align: "left" | "center";
    greetingSize: string;
    headlineSize: string;
    headlineWeight: string;
    headlineTracking: string;
    ctaDisplay: "inline-block" | "block";
    compactCta?: boolean;
  },
): string {
  const align = opts.align;
  const ctaPad = opts.compactCta ? "10px 16px" : "12px 22px";
  const ctaWidth =
    opts.ctaDisplay === "block" ? "width:100%;text-align:center;" : "";
  if (model.useBlocks) {
    return `<p style="margin:0 0 16px;font-size:${opts.greetingSize};line-height:1.4;font-weight:600;color:${escapeAttr(model.shellText)};text-align:${align};">
        Hi ${escapeHtml(model.greeting)},
      </p>
      ${model.blocksHtml}
      <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:${escapeAttr(model.faintFooter)};text-align:${align};">
        ${escapeHtml(model.ignoreNote)}
      </p>`;
  }
  return `<p style="margin:0 0 8px;font-size:${opts.greetingSize};line-height:1.4;font-weight:600;color:${escapeAttr(model.shellText)};text-align:${align};">
        Hi ${escapeHtml(model.greeting)},
      </p>
      <p style="margin:0 0 20px;font-size:${opts.headlineSize};line-height:1.25;font-weight:${opts.headlineWeight};letter-spacing:${opts.headlineTracking};color:${escapeAttr(model.shellText)};text-align:${align};">
        ${escapeHtml(model.headline)}
      </p>
      <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:${escapeAttr(model.shellText)};text-align:${align};">
        ${model.bodyHtml}
      </p>
      <p style="margin:0 0 20px;text-align:${align};">
        <a href="${escapeAttr(model.ctaUrl)}"
           style="display:${opts.ctaDisplay};${ctaWidth}background:${escapeAttr(model.ctaBg)};color:${escapeAttr(model.ctaText)};text-decoration:none;font-size:14px;font-weight:600;padding:${ctaPad};border-radius:${escapeAttr(model.ctaRadiusCss)};">
          ${escapeHtml(model.ctaLabel)}
        </a>
      </p>
      <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:${escapeAttr(model.mutedFooter)};text-align:${align};">
        Or <a href="${escapeAttr(model.ctaUrl)}" style="color:${escapeAttr(model.linkColor)};text-decoration:underline;">open the billing page</a> to update your card.
      </p>
      <p style="margin:0;font-size:13px;line-height:1.5;color:${escapeAttr(model.faintFooter)};text-align:${align};">
        ${escapeHtml(model.ignoreNote)}
      </p>`;
}

function footerLinks(model: RecoveryLayoutModel, color?: string): string {
  const link = color ?? model.linkColor;
  return `<p style="margin:0 0 12px;font-size:13px;line-height:1.5;">
        <a href="${escapeAttr(model.ctaUrl)}" style="color:${escapeAttr(link)};text-decoration:underline;margin-right:16px;">Manage subscription</a>
        <a href="${escapeAttr(model.helpHref)}" style="color:${escapeAttr(link)};text-decoration:underline;">Help center</a>
      </p>`;
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

export function layoutStructureMarker(layoutPresetId: string): {
  layout: LayoutPresetId;
  structure: string;
} {
  const layout = normalizeLayoutPresetId(layoutPresetId);
  switch (layout) {
    case "sonos":
      return { layout, structure: "centered-editorial" };
    case "avocode":
      return { layout, structure: "left-rail" };
    case "benchmark":
      return { layout, structure: "header-band" };
    case "fontbase":
      return { layout, structure: "typographic" };
    case "nordvpn-structure":
      return { layout, structure: "dark-bar-cards" };
    default: {
      const _exhaustive: never = layout;
      return _exhaustive;
    }
  }
}
