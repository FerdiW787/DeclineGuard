import type { MouseEvent } from "react";
import {
  imageCropPreviewStyles,
  markersToHtml,
  styleEmailAnchors,
  textBlockFaceStyle,
  type EmailBlock,
} from "@/lib/emailBuilder";
import { applyCopyVars } from "@/lib/recoveryEmailCopy";
import { ensureCtaLabelContrast } from "../../../../convex/lib/brandImport/colors";

type Vars = { product: string; amount: string; firstName?: string };

type Props = {
  blocks: EmailBlock[];
  primary: string;
  linkColor: string;
  mutedColor: string;
  /** Greeting / primary body color — never hardcode black (breaks dark shells). */
  bodyTextColor?: string | null;
  ctaBackgroundColor?: string | null;
  ctaTextColor?: string | null;
  ctaBorderRadiusPx?: number | null;
  vars?: Vars;
  /** When true, don't apply token substitution (edit mode). */
  showTokens?: boolean;
  className?: string;
};

function resolveText(text: string, vars: Vars | undefined, showTokens: boolean) {
  if (showTokens || !vars) return text;
  return applyCopyVars(text, vars);
}

export default function EmailBlocksView({
  blocks,
  primary,
  linkColor,
  mutedColor,
  bodyTextColor,
  ctaBackgroundColor,
  ctaTextColor,
  ctaBorderRadiusPx,
  vars,
  showTokens = false,
  className,
}: Props) {
  const preventNav = (e: MouseEvent) => {
    e.preventDefault();
  };
  const body = bodyTextColor?.trim() || "#0c0c0c";

  return (
    <div className={className}>
      {blocks.map((block) => (
        <BlockView
          key={block.id}
          block={block}
          primary={primary}
          linkColor={linkColor}
          mutedColor={mutedColor}
          bodyTextColor={body}
          ctaBackgroundColor={ctaBackgroundColor}
          ctaTextColor={ctaTextColor}
          ctaBorderRadiusPx={ctaBorderRadiusPx}
          vars={vars}
          showTokens={showTokens}
          onPreventNav={preventNav}
        />
      ))}
    </div>
  );
}

function BlockView({
  block,
  primary,
  linkColor,
  mutedColor,
  bodyTextColor,
  ctaBackgroundColor,
  ctaTextColor,
  ctaBorderRadiusPx,
  vars,
  showTokens,
  onPreventNav,
}: {
  block: EmailBlock;
  primary: string;
  linkColor: string;
  mutedColor: string;
  bodyTextColor: string;
  ctaBackgroundColor?: string | null;
  ctaTextColor?: string | null;
  ctaBorderRadiusPx?: number | null;
  vars?: Vars;
  showTokens: boolean;
  onPreventNav: (e: MouseEvent) => void;
}) {
  const style = {
    marginTop: block.marginTop,
    marginBottom: block.marginBottom,
  };

  switch (block.type) {
    case "text": {
      const face = textBlockFaceStyle(block, {
        body: bodyTextColor,
        muted: mutedColor,
        link: linkColor,
      });
      const html = styleEmailAnchors(
        markersToHtml(resolveText(block.html, vars, showTokens)),
        linkColor,
      );
      return (
        <p
          style={{
            ...style,
            ...face,
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }
    case "image": {
      if (!block.src.trim()) {
        return (
          <div
            style={{ ...style, textAlign: block.align }}
            className="rounded-md border border-dashed border-black/15 bg-black/[0.02] px-4 py-8 text-center text-[12px] text-black/40"
          >
            Image — add an HTTPS URL
          </div>
        );
      }
      const crop = imageCropPreviewStyles(block);
      return (
        <div style={{ ...style, textAlign: "left" }}>
          <div
            style={{
              ...crop.wrap,
              display: "inline-block",
              maxWidth: "100%",
            }}
          >
            <img
              src={block.src}
              alt={block.alt || ""}
              style={crop.img}
            />
          </div>
        </div>
      );
    }
    case "button": {
      const hex = (c: string | null | undefined) =>
        typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c) ? c : null;
      const bg =
        hex(block.backgroundColor) ??
        hex(ctaBackgroundColor) ??
        primary;
      const text = ensureCtaLabelContrast(
        bg,
        hex(ctaTextColor) ?? "#ffffff",
      );
      const radius =
        typeof ctaBorderRadiusPx === "number" &&
        Number.isFinite(ctaBorderRadiusPx)
          ? Math.max(0, Math.min(9999, Math.round(ctaBorderRadiusPx)))
          : 12;
      return (
        <div style={{ ...style, textAlign: block.align }}>
          <a
            href="#update-payment"
            onClick={onPreventNav}
            className="inline-flex cursor-pointer px-4 py-2.5 text-xs font-semibold transition-opacity hover:opacity-90"
            style={{
              background: bg,
              color: text,
              borderRadius: radius,
            }}
          >
            {resolveText(block.label, vars, showTokens)}
          </a>
        </div>
      );
    }
    case "spacer":
      return <div style={{ height: block.height }} aria-hidden />;
    case "divider":
      return <hr style={style} className="border-black/8" />;
    case "linkRow":
      return (
        <p
          className="text-[13px] leading-relaxed"
          style={{ ...style, color: mutedColor }}
        >
          {resolveText(block.prefix, vars, showTokens)}
          <a
            href="#billing"
            onClick={onPreventNav}
            className="cursor-pointer underline transition-opacity hover:opacity-70"
            style={{ color: linkColor }}
          >
            {resolveText(block.linkLabel, vars, showTokens)}
          </a>
          {resolveText(block.suffix, vars, showTokens)}
        </p>
      );
    default: {
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}
