import {
  BLOCK_KIT_SPEC,
  kitLogoAlign,
  kitShowsStoreName,
  type KitCopy,
} from "@/lib/emailBlockKits";
import {
  LAYOUT_PRESET_STRUCTURE_META,
  type LayoutPresetId,
  type StylingMode,
} from "@/lib/emailLayoutPresets";
import { LAYOUT_PRESET_CATALOG, LAYOUT_PRESET_IDS } from "@/lib/emailTheme";
import type { EmailThemeTokens } from "@/lib/emailTheme";
import { cn } from "@/lib/utils";
import EmailStoreHeader from "../EmailStoreHeader";
import { Panel } from "../dashboardUi";

const KIT_LABEL: Record<
  LayoutPresetId,
  { title: string; source: string }
> = {
  "poster-notice": {
    title: "Poster notice",
    source: "One announcement, then the button",
  },
  "amount-due": {
    title: "Amount due",
    source: "Money first, then the problem",
  },
  "plain-letter": {
    title: "Plain letter",
    source: "A short letter, then the ask",
  },
  "cta-lead": {
    title: "CTA lead",
    source: "Button first, explanation after",
  },
  "ruled-editorial": {
    title: "Ruled editorial",
    source: "Rules frame the notice",
  },
  "postscript-note": {
    title: "Postscript",
    source: "Ask, then a P.S. trust line",
  },
  "what-happened": {
    title: "What happened",
    source: "Two beats: happened, then do",
  },
  "quiet-column": {
    title: "Quiet column",
    source: "Wide type, almost nothing else",
  },
  "stub-header": {
    title: "Stub header",
    source: "Product and amount as a stub",
  },
  "end-action": {
    title: "End action",
    source: "Copy first, isolated CTA last",
  },
};

type Props = {
  layoutPresetId: LayoutPresetId;
  stylingMode: StylingMode;
  theme: EmailThemeTokens;
  storeName: string;
  storeLogoUrl: string | null;
  previewCopy: KitCopy;
  onSelectKit: (id: LayoutPresetId) => void;
  onStylingModeChange: (mode: StylingMode) => void;
};

export default function EmailLabSidebar({
  layoutPresetId,
  stylingMode,
  theme,
  storeName,
  storeLogoUrl,
  previewCopy,
  onSelectKit,
  onStylingModeChange,
}: Props) {
  return (
    <div className="space-y-4">
      <Panel className="p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8a8f98]">
          Lab
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-[#6b6f76]">
          Ten recovery layouts. Each kit is a different structure — alignment,
          density, hero, and CTA placement. Same layout on Day 0, Day 2, and
          Day 5 — only the copy changes.
        </p>
        <div
          className="mt-3 space-y-1"
          role="listbox"
          aria-label="Email layout templates"
        >
          {LAYOUT_PRESET_IDS.map((id) => {
            const meta = LAYOUT_PRESET_STRUCTURE_META[id];
            const rge = KIT_LABEL[id];
            const active = id === layoutPresetId;
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onSelectKit(id)}
                className={cn(
                  "dg-interactive flex w-full flex-col items-start rounded-md border px-2.5 py-2 text-left",
                  active
                    ? "border-black/12 bg-[#f7f8f8]"
                    : "border-transparent",
                )}
              >
                <span className="text-[13px] font-semibold text-[#08090a]">
                  {rge.title}
                </span>
                <span className="mt-0.5 text-[11px] leading-snug text-[#8a8f98]">
                  {rge.source}
                </span>
                <span className="sr-only">{meta.hint}</span>
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel className="p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8a8f98]">
          Preview
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-[#8a8f98]">
          {LAYOUT_PRESET_CATALOG[layoutPresetId]?.description}
        </p>
        <div className="mt-3">
          <EmailLabKitPreview
            kitId={layoutPresetId}
            theme={theme}
            storeName={storeName}
            storeLogoUrl={storeLogoUrl}
            copy={previewCopy}
          />
        </div>
      </Panel>

      <Panel className="p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8a8f98]">
          Colors
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-[#8a8f98]">
          Template applies kit structure. Personal uses your store scrape
          tokens. CTA and colors stay on BrandKit when configured — kits
          never invent a palette.
        </p>
        <div className="mt-3 grid gap-2">
          <ConfigButton
            active={stylingMode === "preset"}
            label="Use Template Configuration"
            onClick={() => onStylingModeChange("preset")}
          />
          <ConfigButton
            active={stylingMode === "configured"}
            label="Use Personal Configuration"
            onClick={() => onStylingModeChange("configured")}
          />
        </div>
      </Panel>
    </div>
  );
}

function ConfigButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "dg-interactive w-full rounded-md border px-2.5 py-2 text-left text-[12px] font-semibold",
        active
          ? "border-black/12 bg-[#f7f8f8] text-[#08090a]"
          : "border-transparent text-[#6b6f76]",
      )}
    >
      {label}
    </button>
  );
}

function EmailLabKitPreview({
  kitId,
  theme,
  storeName,
  storeLogoUrl,
  copy,
}: {
  kitId: LayoutPresetId;
  theme: EmailThemeTokens;
  storeName: string;
  storeLogoUrl: string | null;
  copy: KitCopy;
}) {
  const spec = BLOCK_KIT_SPEC[kitId];
  const alignClass =
    spec.align === "center"
      ? "text-center"
      : spec.align === "right"
        ? "text-right"
        : "text-left";
  const ctaClass =
    spec.ctaAlign === "center"
      ? "mx-auto"
      : spec.ctaAlign === "right"
        ? "ml-auto"
        : "";
  return (
    <div
      className="overflow-hidden border border-black/8"
      style={{
        background: theme.emailBackgroundColor,
        color: theme.emailTextColor,
        borderWidth: spec.shellBorder ? spec.shellBorderWidth : 1,
        borderColor: spec.shellBorder ? theme.brandColor : undefined,
        borderRadius: spec.shellRadius,
      }}
    >
        {spec.showAccentBar ? (
          <div className="h-1 w-full" style={{ background: theme.brandColor }} />
        ) : null}
        <div className={cn("px-3 py-3", alignClass)}>
        <EmailStoreHeader
          storeName={storeName}
          storeLogoUrl={storeLogoUrl}
          primary={theme.brandColor}
          emailFont={theme.emailFont}
          textColor={theme.emailTextColor}
          align={kitLogoAlign(kitId)}
          showName={kitShowsStoreName(kitId)}
          className="mb-3"
        />
        {kitId === "amount-due" ? (
          <p
            className="mb-1 text-[13px] font-semibold leading-none"
            style={{ color: theme.emailTextColor }}
          >
            €29
          </p>
        ) : null}
        {kitId === "stub-header" ? (
          <p
            className="mb-1 text-[7px]"
            style={{ color: theme.mutedTextColor }}
          >
            Pro Monthly · €29
          </p>
        ) : null}
        {kitId === "cta-lead" ? (
          <span
            className={cn(
              "mb-2 inline-block px-2.5 py-1 text-[8px] font-semibold",
              ctaClass,
            )}
            style={{
              background: theme.ctaBackgroundColor,
              color: theme.ctaTextColor,
              borderRadius: theme.ctaBorderRadiusPx,
            }}
          >
            {copy.cta}
          </span>
        ) : null}
        {kitId === "ruled-editorial" ? (
          <hr className="mb-1.5 border-0 border-t" style={{ borderColor: `${theme.emailTextColor}18` }} />
        ) : null}
        <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-snug tracking-tight">
          {copy.headline}
        </p>
        {kitId === "ruled-editorial" ? (
          <hr className="mt-1.5 border-0 border-t" style={{ borderColor: `${theme.emailTextColor}18` }} />
        ) : null}
        {kitId === "what-happened" ? (
          <p
            className="mt-1.5 text-[7px] uppercase tracking-[0.12em]"
            style={{ color: theme.mutedTextColor }}
          >
            What happened · What to do
          </p>
        ) : null}
        <p
          className="mt-1 line-clamp-2 text-[9px] leading-relaxed"
          style={{ color: theme.mutedTextColor }}
        >
          {copy.body}
        </p>
        {kitId === "cta-lead" ? null : (
          <span
            className={cn(
              "mt-2 inline-block px-2.5 py-1 text-[8px] font-semibold",
              ctaClass,
            )}
            style={{
              background: theme.ctaBackgroundColor,
              color: theme.ctaTextColor,
              borderRadius: theme.ctaBorderRadiusPx,
            }}
          >
            {copy.cta}
          </span>
        )}
        {kitId === "postscript-note" ? (
          <p
            className="mt-1.5 text-[7px] italic"
            style={{ color: theme.mutedTextColor }}
          >
            P.S. Access stays on
          </p>
        ) : null}
        {kitId === "end-action" ? (
          <p
            className="mt-1 text-[7px]"
            style={{ color: theme.mutedTextColor }}
          >
            Your workspace stays put.
          </p>
        ) : null}
        </div>
    </div>
  );
}
