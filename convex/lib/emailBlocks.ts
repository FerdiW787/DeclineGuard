import { allowHttpsUrl } from "./safeUrl";

export type BlockAlign = "left" | "center" | "right";

export type EmailBlock =
  | {
      id: string;
      type: "text";
      html: string;
      fontSize: number;
      color: "default" | "muted" | "link";
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

/** Convert **bold** markers + newlines to HTML (placeholders kept). */
export function markersToHtml(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br />");
}

function markersToPlain(text: string): string {
  return text.replace(/\*\*/g, "");
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
      const color =
        block.color === "muted"
          ? opts.mutedColor
          : block.color === "link"
            ? opts.linkColor
            : bodyText;
      return `<p style="margin:${mt}px 0 ${mb}px;font-size:${block.fontSize}px;line-height:1.6;color:${escapeAttr(color)};text-align:${alignCss(block.align)};">${markersToHtml(block.html)}</p>`;
    }
    case "image": {
      const src = allowHttpsUrl(block.src);
      if (!src) {
        return `<p style="margin:${mt}px 0 ${mb}px;font-size:12px;color:#a1a1a6;text-align:${alignCss(block.align)};">[Image]</p>`;
      }
      const widthPct = Math.min(100, Math.max(20, block.width));
      const heightPx = Math.min(320, Math.max(80, block.heightPx ?? 180));
      const zoom = Math.min(2.4, Math.max(1, block.zoom ?? 1));
      const imgWidthPct = widthPct * zoom;
      const imgHeightPx = Math.round(heightPx * zoom);
      const shiftPct = zoom > 1 ? -((zoom - 1) / 2) * 100 : 0;
      const shiftTop = zoom > 1 ? -Math.round(((zoom - 1) / 2) * heightPx) : 0;
      return `<div style="margin:${mt}px 0 ${mb}px;text-align:${alignCss(block.align)};"><div style="display:inline-block;width:${widthPct}%;max-width:100%;height:${heightPx}px;overflow:hidden;border-radius:8px;line-height:0;"><img src="${escapeAttr(src)}" alt="${escapeAttr(block.alt || "")}" width="${Math.round((480 * imgWidthPct) / 100)}" style="display:block;width:${imgWidthPct}%;max-width:none;height:${imgHeightPx}px;object-fit:cover;object-position:center;margin:${shiftTop}px 0 0 ${shiftPct}%;border:0;" /></div></div>`;
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
    case "linkRow":
      return `<p style="margin:${mt}px 0 ${mb}px;font-size:14px;line-height:1.5;color:#6b6b70;">${escapeHtml(block.prefix)}<a href="${escapeAttr(opts.ctaUrl)}" style="color:${escapeAttr(opts.linkColor)};text-decoration:underline;">${escapeHtml(block.linkLabel)}</a>${escapeHtml(block.suffix)}</p>`;
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
