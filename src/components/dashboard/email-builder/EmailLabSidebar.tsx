import {
  BLOCK_KIT_SPEC,
  kitLogoAlign,
  kitShowsStoreName,
  type KitCopy,
} from "@/lib/emailBlockKits";
import { type LayoutPresetId, type StylingMode } from "@/lib/emailLayoutPresets";
import { LAYOUT_PRESET_CATALOG } from "@/lib/emailTheme";
import type { EmailThemeTokens } from "@/lib/emailTheme";
import { cn } from "@/lib/utils";
import EmailStoreHeader from "../EmailStoreHeader";
import { Panel } from "../dashboardUi";

type Props = {
  layoutPresetId: LayoutPresetId;
  stylingMode: StylingMode;
  theme: EmailThemeTokens;
  storeName: string;
  storeLogoUrl: string | null;
  previewCopy: KitCopy;
  onStylingModeChange: (mode: StylingMode) => void;
};

export default function EmailLabSidebar({
  layoutPresetId,
  stylingMode,
  theme,
  storeName,
  storeLogoUrl,
  previewCopy,
  onStylingModeChange,
}: Props) {
  return (
    <div className="space-y-4">
      <Panel className="p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8a8f98]">
          Lab
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-[#6b6f76]">
          We A/B five recovery layouts. Day 0, Day 2, and Day 5 share the same
          kit — only the copy changes. Merchants set brand colors and the CTA.
          Assignment stays on the backend.
        </p>
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
        <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-snug tracking-tight">
          {copy.headline}
        </p>
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
      </div>
    </div>
  );
}
