import { allowHttpsUrl } from "../../convex/lib/safeUrl";

/** Safe rich-text subset for recovery emails: bold, italic, underline, color, https links. */

/** Preview/sentinel href; swapped for the real payment-update URL when sending. */
export const PAYMENT_UPDATE_HREF = "#update-payment";

const COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isPaymentUpdateHref(href: string): boolean {
  const v = href.trim();
  return v === PAYMENT_UPDATE_HREF || v === "#billing";
}

/** Keep a word space on both sides of the payment-update link. */
export function ensurePaymentLinkSpacing(html: string): string {
  return html
    .replace(
      /(\S)(<a\b[^>]*href="(?:#update-payment|#billing)")/gi,
      "$1 $2",
    )
    .replace(
      /(<a\b[^>]*href="(?:#update-payment|#billing)"[^>]*>[\s\S]*?<\/a>)(\S)/gi,
      "$1 $2",
    );
}

export function isHexColor(value: string): boolean {
  return COLOR_RE.test(value.trim());
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function unescapeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function looksLikeHtml(text: string): boolean {
  return /<\/?(?:strong|b|em|i|u|span|br|a)\b/i.test(text);
}

export function normalizeLinkUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (isPaymentUpdateHref(trimmed)) return PAYMENT_UPDATE_HREF;
  const withProto = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  return allowHttpsUrl(withProto);
}

/** Inline link color + underline so email clients keep the style. */
export function styleEmailAnchors(html: string, linkColor: string): string {
  const color = linkColor.trim() || "#2563eb";
  return ensurePaymentLinkSpacing(html).replace(/<a\b([^>]*)>/gi, (full, attrs: string) => {
    const hrefMatch = attrs.match(/\bhref\s*=\s*"([^"]*)"/i);
    const raw = hrefMatch?.[1] ?? "";
    const href = isPaymentUpdateHref(raw)
      ? PAYMENT_UPDATE_HREF
      : allowHttpsUrl(raw);
    if (!href) return full;
    return `<a href="${escapeHtml(href)}" style="color:${color};text-decoration:underline">`;
  });
}

export function stripTrailingBreaks(html: string): string {
  return html.replace(/(?:<br\s*\/?>\s*)+$/gi, "");
}

/** Convert stored text (**markers** or HTML) to a safe HTML subset. */
export function richTextToHtml(text: string): string {
  if (!text) return "";
  if (looksLikeHtml(text)) return sanitizeEditorHtml(text);
  const escaped = escapeHtml(text);
  const bold = escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  const italic = bold.replace(
    /(^|[^*])\*([^*\n]+)\*(?!\*)/g,
    "$1<em>$2</em>",
  );
  const underline = italic.replace(/__([^_]+)__/g, "<u>$1</u>");
  return stripTrailingBreaks(underline.replace(/\n/g, "<br />"));
}

/** Strip formatting for plain-text / legacy fields. */
export function richTextToPlain(text: string): string {
  return unescapeHtml(
    richTextToHtml(text)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/\*/g, "");
}

/** Keep only email-safe tags from a contentEditable dump. */
export function sanitizeEditorHtml(html: string): string {
  if (typeof document === "undefined") {
    return stripTrailingBreaks(
      sanitizeEditorHtmlString(html).replace(/&nbsp;/g, " "),
    );
  }
  const host = document.createElement("div");
  host.innerHTML = html;
  return stripTrailingBreaks(
    serializeSafe(host, true).replace(/&nbsp;/g, " "),
  );
}

function sanitizeEditorHtmlString(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "<br />")
    .replace(/<\/?(?:b|strong)>/gi, (m) =>
      m.startsWith("</") ? "</strong>" : "<strong>",
    )
    .replace(/<\/?(?:i|em)>/gi, (m) => (m.startsWith("</") ? "</em>" : "<em>"))
    .replace(/<\/?u>/gi, (m) => m.toLowerCase())
    .replace(/<span\b([^>]*)>([\s\S]*?)<\/span>/gi, (_, attrs: string, inner: string) => {
      const style = attrs.match(/style\s*=\s*"([^"]*)"/i)?.[1] ?? "";
      return wrapWithFace(inner, faceFromStyleText(style));
    })
    .replace(
      /<a\s+[^>]*href="((?:https:[^"]+)|#update-payment|#billing)"[^>]*>/gi,
      '<a href="$1">',
    )
    .replace(/<(?!\/?(?:strong|em|u|span|br|a)\b)[^>]+>/gi, "");
}

function serializeSafe(node: Node, isRoot = false): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeHtml(node.textContent ?? "");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const inner = Array.from(el.childNodes)
    .map((child) => serializeSafe(child))
    .join("");
  const face = faceFromElement(el);

  if (isRoot) return inner;
  if (tag === "br") return "<br />";
  if (tag === "strong" || tag === "b") {
    return wrapWithFace(`<strong>${inner}</strong>`, face, { bold: true });
  }
  if (tag === "em" || tag === "i") {
    return wrapWithFace(`<em>${inner}</em>`, face, { italic: true });
  }
  if (tag === "u") {
    return wrapWithFace(`<u>${inner}</u>`, face, { underline: true });
  }
  if (tag === "a") {
    const href = normalizeLinkUrl(el.getAttribute("href") ?? "");
    if (!href) return wrapWithFace(inner, face);
    return wrapWithFace(`<a href="${escapeHtml(href)}">${inner}</a>`, face);
  }
  if (tag === "div" || tag === "p") {
    const body = wrapWithFace(inner, face);
    return body ? `${body}<br />` : "";
  }
  return wrapWithFace(inner, face);
}

type InlineFace = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string | null;
};

function faceFromStyleText(style: string): InlineFace {
  return {
    bold: /font-weight:\s*(bold|bolder|[6-9]00)/i.test(style),
    italic: /font-style:\s*italic/i.test(style),
    underline: /text-decoration(?:-line)?:\s*[^;]*underline/i.test(style),
    color: style.match(/(?:^|;)\s*color:\s*(#[0-9a-fA-F]{3,6})/i)?.[1] ?? null,
  };
}

function faceFromElement(el: HTMLElement): InlineFace {
  const css = el.getAttribute("style") ?? "";
  const fromCss = faceFromStyleText(css);
  const weight = el.style.fontWeight.trim();
  const numeric = Number.parseInt(weight, 10);
  return {
    bold:
      fromCss.bold ||
      /^(bold|bolder)$/i.test(weight) ||
      (Number.isFinite(numeric) && numeric >= 600),
    italic: fromCss.italic || /italic/i.test(el.style.fontStyle),
    underline:
      fromCss.underline ||
      /underline/i.test(
        `${el.style.textDecoration} ${el.style.textDecorationLine}`,
      ),
    color: parseColor(el) ?? (fromCss.color ? normalizeHex(fromCss.color) : null),
  };
}

function wrapWithFace(
  html: string,
  face: InlineFace,
  skip?: { bold?: boolean; italic?: boolean; underline?: boolean },
): string {
  let out = html;
  if (face.italic && !skip?.italic) out = `<em>${out}</em>`;
  if (face.underline && !skip?.underline) out = `<u>${out}</u>`;
  if (face.bold && !skip?.bold) out = `<strong>${out}</strong>`;
  if (face.color) out = `<span style="color:${face.color}">${out}</span>`;
  return out;
}

function parseColor(el: HTMLElement): string | null {
  const attr = el.getAttribute("color")?.trim();
  if (attr && isHexColor(attr)) return normalizeHex(attr);
  const style = el.style?.color?.trim();
  if (!style) return null;
  const hex = rgbToHex(style) ?? (isHexColor(style) ? style : null);
  return hex ? normalizeHex(hex) : null;
}

function normalizeHex(hex: string): string {
  const h = hex.trim();
  if (/^#[0-9a-f]{3}$/i.test(h)) {
    return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`.toLowerCase();
  }
  return h.toLowerCase();
}

function rgbToHex(value: string): string | null {
  const m = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return isHexColor(value) ? value : null;
  const r = Number(m[1]).toString(16).padStart(2, "0");
  const g = Number(m[2]).toString(16).padStart(2, "0");
  const b = Number(m[3]).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}
