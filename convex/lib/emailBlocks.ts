import { allowHttpsUrl } from "./safeUrl";

export type BlockAlign = "left" | "center" | "right";

export type EmailBlock =
  | {
      id: string;
      type: "text";
      html: string;
      fontSize: number;
      color: "default" | "muted" | "link";
      hexColor?: string;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      align: BlockAlign;
      marginTop: number;
      marginBottom: number;
    }
  | {
      id: string;
      type: "image";
      src: string;
      alt: string;
      width: number;
      align: BlockAlign;
      heightPx?: number;
      zoom?: number;
      radius?: number;
      cropTop?: number;
      cropBottom?: number;
      cropLeft?: number;
      cropRight?: number;
      shadow?: boolean;
      shadowColor?: string;
      border?: boolean;
      borderColor?: string;
      borderWidth?: number;
      shape?: "square" | "circle" | "pill" | "star" | "triangle";
      fit?: "adjust" | "stretch";
      panX?: number;
      offsetX?: number;
      marginTop: number;
      marginBottom: number;
    }
  | {
      id: string;
      type: "button";
      label: string;
      backgroundColor: string;
      align: BlockAlign;
      marginTop: number;
      marginBottom: number;
    }
  | {
      id: string;
      type: "spacer";
      height: number;
      marginTop: number;
      marginBottom: number;
    }
  | {
      id: string;
      type: "divider";
      marginTop: number;
      marginBottom: number;
    }
  | {
      id: string;
      type: "linkRow";
      prefix: string;
      linkLabel: string;
      suffix: string;
      marginTop: number;
      marginBottom: number;
    };

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

function hexOr(value: string | undefined, fallback: string): string {
  const hex = value?.trim() ?? "";
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex) ? hex : fallback;
}

function imageShadowCss(color: string): string {
  const raw = color.slice(1);
  const full =
    raw.length === 3 && raw[0] && raw[1] && raw[2]
      ? `${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`
      : raw;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return `0 8px 24px rgba(${r},${g},${b},0.28)`;
}

function looksLikeHtml(text: string): boolean {
  return /<\/?(?:strong|b|em|i|u|span|br|a)\b/i.test(text);
}

function sanitizeStoredHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "<br />")
    .replace(/<\/?(?:b|strong)>/gi, (m) =>
      m.startsWith("</") ? "</strong>" : "<strong>",
    )
    .replace(/<\/?(?:i|em)>/gi, (m) => (m.startsWith("</") ? "</em>" : "<em>"))
    .replace(/<span\b([^>]*)>([\s\S]*?)<\/span>/gi, (_, attrs: string, inner: string) => {
      const style = attrs.match(/style\s*=\s*"([^"]*)"/i)?.[1] ?? "";
      let out = inner;
      if (/font-style:\s*italic/i.test(style)) out = `<em>${out}</em>`;
      if (/text-decoration(?:-line)?:\s*[^;]*underline/i.test(style)) {
        out = `<u>${out}</u>`;
      }
      if (/font-weight:\s*(bold|bolder|[6-9]00)/i.test(style)) {
        out = `<strong>${out}</strong>`;
      }
      const color = style.match(/(?:^|;)\s*color:\s*(#[0-9a-fA-F]{3,6})/i)?.[1];
      if (color) out = `<span style="color:${color}">${out}</span>`;
      return out;
    })
    .replace(
      /<a\s+[^>]*href="((?:https:[^"]+)|#update-payment|#billing)"[^>]*>/gi,
      '<a href="$1">',
    )
    .replace(/<(?!\/?(?:strong|em|u|span|br|a)\b)[^>]+>/gi, "");
}

function ensurePaymentLinkSpacing(html: string): string {
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

function styleEmailAnchors(
  html: string,
  linkColor: string,
  ctaUrl?: string,
): string {
  const color = linkColor.trim() || "#2563eb";
  return ensurePaymentLinkSpacing(html).replace(/<a\b([^>]*)>/gi, (full, attrs: string) => {
    const hrefMatch = attrs.match(/\bhref\s*=\s*"([^"]*)"/i);
    const raw = hrefMatch?.[1] ?? "";
    const href =
      raw === "#update-payment" || raw === "#billing"
        ? ctaUrl || raw
        : allowHttpsUrl(raw);
    if (!href) return full;
    return `<a href="${escapeAttr(href)}" style="color:${escapeAttr(color)};text-decoration:underline">`;
  });
}

/** Convert **markers** or a safe HTML subset to email HTML. */
export function markersToHtml(text: string): string {
  if (looksLikeHtml(text)) return sanitizeStoredHtml(text);
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/__([^_]+)__/g, "<u>$1</u>")
    .replace(/\n/g, "<br />");
}

function markersToPlain(text: string): string {
  return markersToHtml(text)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\*\*/g, "");
}

function alignCss(align: BlockAlign): string {
  return align === "center"
    ? "center"
    : align === "right"
      ? "right"
      : "left";
}

type BlockRenderOpts = {
  primaryColor: string;
  linkColor: string;
  mutedColor: string;
  ctaUrl: string;
  ctaBackgroundColor?: string;
  ctaTextColor?: string;
  ctaBorderRadiusPx?: number;
  bodyTextColor?: string;
};

export function renderBlocksHtml(
  blocks: EmailBlock[],
  opts: BlockRenderOpts,
): string {
  return blocks
    .map((block) => renderBlockHtml(block, opts))
    .filter(Boolean)
    .join("\n");
}

function renderBlockHtml(block: EmailBlock, opts: BlockRenderOpts): string {
  const mt = Math.max(0, block.marginTop);
  const mb = Math.max(0, block.marginBottom);
  const bodyText = opts.bodyTextColor?.trim() || "#0c0c0c";
  const ctaRadius =
    typeof opts.ctaBorderRadiusPx === "number"
      ? Math.max(0, Math.min(9999, opts.ctaBorderRadiusPx))
      : 12;
  const ctaFill = opts.ctaBackgroundColor?.trim() || opts.primaryColor;
  const ctaTextRaw = opts.ctaTextColor?.trim() || "#ffffff";
  // Inline contrast (avoid circular import weight) — light fill → dark label
  const ctaLum = (() => {
    const m = ctaFill.match(/^#([0-9a-f]{6})$/i);
    if (!m?.[1]) return 0.2;
    const r = parseInt(m[1].slice(0, 2), 16) / 255;
    const g = parseInt(m[1].slice(2, 4), 16) / 255;
    const b = parseInt(m[1].slice(4, 6), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  })();
  const labelLum = (() => {
    const m = ctaTextRaw.match(/^#([0-9a-f]{6})$/i);
    if (!m?.[1]) return 1;
    const r = parseInt(m[1].slice(0, 2), 16) / 255;
    const g = parseInt(m[1].slice(2, 4), 16) / 255;
    const b = parseInt(m[1].slice(4, 6), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  })();
  const ctaText =
    Math.abs(ctaLum - labelLum) >= 0.35
      ? ctaTextRaw
      : ctaLum > 0.55
        ? "#0c0c0c"
        : "#ffffff";

  switch (block.type) {
    case "text": {
      const hex = block.hexColor?.trim() ?? "";
      const color = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)
        ? hex
        : block.color === "muted"
          ? opts.mutedColor
          : block.color === "link"
            ? opts.linkColor
            : bodyText;
      const weight = block.bold ? 700 : 400;
      const italic = block.italic ? "italic" : "normal";
      const underline = block.underline ? "underline" : "none";
      return `<p style="margin:${mt}px 0 ${mb}px;font-size:${block.fontSize}px;line-height:1.6;color:${escapeAttr(color)};text-align:${alignCss(block.align)};font-weight:${weight};font-style:${italic};text-decoration:${underline};">${styleEmailAnchors(markersToHtml(block.html), opts.linkColor, opts.ctaUrl)}</p>`;
    }
    case "image": {
      const src = allowHttpsUrl(block.src);
      if (!src) {
        return `<p style="margin:${mt}px 0 ${mb}px;font-size:12px;color:#a1a1a6;text-align:${alignCss(block.align)};">[Image]</p>`;
      }
      const widthPct = Math.min(100, Math.max(20, block.width));
      const heightPx = Math.min(560, Math.max(80, block.heightPx ?? 180));
      const zoom = Math.min(2.4, Math.max(1, block.zoom ?? 1));
      const cropTop = Math.min(288, Math.max(0, Math.round(block.cropTop ?? 0)));
      const cropBottom = Math.min(
        288,
        Math.max(0, Math.round(block.cropBottom ?? 0)),
      );
      const cropLeft = Math.min(80, Math.max(0, block.cropLeft ?? 0));
      const cropRight = Math.min(80, Math.max(0, block.cropRight ?? 0));
      const visibleFrac = Math.max(0.2, 1 - cropLeft / 100 - cropRight / 100);
      const visibleHeight = Math.max(32, heightPx - cropTop - cropBottom);
      const visibleWidthPct = widthPct * visibleFrac;
      const visibleWidthPx = Math.round((480 * visibleWidthPct) / 100);
      const shape = block.shape;
      const lockSquare = shape === "square" || shape === "circle";
      const boxHeight = lockSquare ? visibleWidthPx : visibleHeight;
      const userRadius = Math.max(0, Math.round(block.radius ?? 8));
      const radius =
        shape === "circle" || shape === "pill"
          ? Math.floor(Math.min(visibleWidthPx, boxHeight) / 2)
          : shape === "star" || shape === "triangle"
            ? 0
            : Math.min(
                Math.floor(Math.min(visibleWidthPx, boxHeight) / 2),
                userRadius,
              );
      const clip =
        shape === "star"
          ? "polygon(50% 0%, 61.8% 35.4%, 98.2% 35.4%, 68.2% 57.6%, 79.4% 91.2%, 50% 70%, 20.6% 91.2%, 31.8% 57.6%, 1.8% 35.4%, 38.2% 35.4%)"
          : shape === "triangle"
            ? "polygon(50% 0%, 0% 100%, 100% 100%)"
            : "";
      const borderOn = block.border === true;
      const borderWidth = Math.min(8, Math.max(1, Math.round(block.borderWidth ?? 1)));
      const borderColor = hexOr(block.borderColor, "#e5e5e5");
      const shadowOn = block.shadow === true;
      const shadowColor = hexOr(block.shadowColor, "#000000");
      const shadow = imageShadowCss(shadowColor);
      const chrome = [
        borderOn ? `border:${borderWidth}px solid ${escapeAttr(borderColor)}` : "border:0",
        clip
          ? shadowOn
            ? `filter:drop-shadow(${shadow})`
            : "filter:none"
          : shadowOn
            ? `box-shadow:${shadow}`
            : "box-shadow:none",
        clip ? `clip-path:${clip};-webkit-clip-path:${clip}` : "",
      ]
        .filter(Boolean)
        .join(";");
      const imgSize = zoom > 1 ? `${zoom * 100}%` : "100%";
      const imgPos =
        zoom > 1
          ? "left:50%;top:50%;transform:translate(-50%,-50%)"
          : "left:0;top:0;transform:none";
      const offsetX = Math.min(
        100,
        Math.max(
          0,
          typeof block.offsetX === "number" && Number.isFinite(block.offsetX)
            ? block.offsetX
            : block.align === "center"
              ? 50
              : block.align === "right"
                ? 100
                : 0,
        ),
      );
      const offsetMargin = ((100 - visibleWidthPct) * offsetX) / 100;
      if (block.fit === "stretch") {
        const imgWidthPct = 100 / visibleFrac;
        const shiftLeftPct = -(cropLeft / visibleFrac);
        const shiftTop = -cropTop;
        const cropSlack = cropLeft + cropRight;
        const marginLeft =
          cropSlack < 0.2 ? offsetMargin : (cropLeft * widthPct) / 100;
        return `<div style="margin:${mt}px 0 ${mb}px;text-align:left;"><div style="display:inline-block;position:relative;width:${visibleWidthPct}%;max-width:100%;height:${boxHeight}px;overflow:hidden;border-radius:${radius}px;line-height:0;box-sizing:border-box;margin-left:${marginLeft}%;${chrome};"><img src="${escapeAttr(src)}" alt="${escapeAttr(block.alt || "")}" width="480" style="display:block;position:absolute;left:${shiftLeftPct}%;top:${shiftTop}px;width:${imgWidthPct}%;height:auto;max-width:none;border:0;" /></div></div>`;
      }
      const panX = Math.min(100, Math.max(0, block.panX ?? 50));
      return `<div style="margin:${mt}px 0 ${mb}px;text-align:left;"><div style="display:inline-block;position:relative;width:${visibleWidthPct}%;max-width:100%;height:${boxHeight}px;overflow:hidden;border-radius:${radius}px;line-height:0;box-sizing:border-box;margin-left:${offsetMargin}%;${chrome};"><img src="${escapeAttr(src)}" alt="${escapeAttr(block.alt || "")}" width="${visibleWidthPx}" style="display:block;position:absolute;${imgPos};width:${imgSize};height:${imgSize};max-width:none;object-fit:cover;object-position:${panX}% center;border:0;" /></div></div>`;
    }
    case "button": {
      const customBg = block.backgroundColor.trim();
      const bg =
        /^#[0-9a-fA-F]{6}$/i.test(customBg)
          ? customBg
          : opts.ctaBackgroundColor?.trim() || opts.primaryColor;
      const bgLum = (() => {
        const m = bg.match(/^#([0-9a-f]{6})$/i);
        if (!m?.[1]) return 0.2;
        const r = parseInt(m[1].slice(0, 2), 16) / 255;
        const g = parseInt(m[1].slice(2, 4), 16) / 255;
        const b = parseInt(m[1].slice(4, 6), 16) / 255;
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      })();
      const label =
        Math.abs(bgLum - labelLum) >= 0.35
          ? ctaTextRaw
          : bgLum > 0.55
            ? "#0c0c0c"
            : "#ffffff";
      return `<p style="margin:${mt}px 0 ${mb}px;text-align:${alignCss(block.align)};"><a href="${escapeAttr(opts.ctaUrl)}" style="display:inline-block;background:${escapeAttr(bg)};color:${escapeAttr(label)};text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:${ctaRadius}px;">${escapeHtml(block.label)}</a></p>`;
    }
    case "spacer":
      return `<div style="height:${Math.max(4, block.height)}px;line-height:${Math.max(4, block.height)}px;font-size:1px;">&nbsp;</div>`;
    case "divider":
      return `<hr style="border:none;border-top:1px solid #e8e8ea;margin:${mt}px 0 ${mb}px;" />`;
    case "linkRow": {
      const prefix = block.prefix.replace(/\s+$/g, "");
      const suffix = block.suffix.replace(/^\s+/g, "");
      const before = prefix ? `${escapeHtml(prefix)} ` : "";
      const after = suffix ? ` ${escapeHtml(suffix)}` : "";
      return `<p style="margin:${mt}px 0 ${mb}px;font-size:14px;line-height:1.5;color:#6b6b70;">${before}<a href="${escapeAttr(opts.ctaUrl)}" style="color:${escapeAttr(opts.linkColor)};text-decoration:underline;">${escapeHtml(block.linkLabel.trim())}</a>${after}</p>`;
    }
    default: {
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}

export function renderBlocksText(
  blocks: EmailBlock[],
  ctaUrl: string,
): string {
  const lines: string[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case "text":
        lines.push(markersToPlain(block.html));
        lines.push("");
        break;
      case "image":
        if (block.src.trim()) {
          lines.push(block.alt.trim() || block.src.trim());
          lines.push("");
        }
        break;
      case "button":
        lines.push(`${block.label}: ${ctaUrl}`);
        lines.push("");
        break;
      case "spacer":
        lines.push("");
        break;
      case "divider":
        lines.push("---");
        lines.push("");
        break;
      case "linkRow":
        lines.push(
          `${block.prefix}${block.linkLabel}${block.suffix} ${ctaUrl}`,
        );
        lines.push("");
        break;
      default: {
        const _exhaustive: never = block;
        void _exhaustive;
      }
    }
  }
  return lines.join("\n").trim();
}
