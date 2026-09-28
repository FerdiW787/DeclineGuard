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

const RGE_LABEL: Record<
  LayoutPresetId,
  { title: string; source: string }
> = {
  sonos: {
    title: "Sonos",
    source: "Verify your email",
  },
  avocode: {
    title: "Avocode",
    source: "Your trial ended",
  },
  benchmark: {
    title: "Benchmark",
    source: "Don’t worry, your data is safe",
  },
  fontbase: {
    title: "FontBase",
    source: "Upcoming renewal",
  },
  "nordvpn-structure": {
    title: "NordVPN",
    source: "Your account has expired",
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
          Starter kits copied 1:1 from the Really Good Emails refs. Same layout
          on Day 0, Day 2, and Day 5 — only the copy changes.
        </p>
        <div
          className="mt-3 space-y-1"
          role="listbox"
          aria-label="Email layout templates"
        >
          {LAYOUT_PRESET_IDS.map((id) => {
            const meta = LAYOUT_PRESET_STRUCTURE_META[id];
            const rge = RGE_LABEL[id];
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
          Template tokens come from the kit. Personal tokens are your store
          colors.
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
  const centered = spec.align === "center";
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
        <div className={cn("px-3 py-3", centered && "text-center")}>
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
        {kitId === "benchmark" ? (
          <p
            className="mb-1 text-[8px] font-semibold"
            style={{ color: theme.brandColor }}
          >
            {copy.eyebrow}
          </p>
        ) : (
          <p
            className="text-[8px] font-medium uppercase tracking-[0.14em]"
            style={{ color: theme.mutedTextColor }}
          >
            {copy.eyebrow}
          </p>
        )}
        <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-snug tracking-tight">
          {copy.headline}
        </p>
        {kitId === "avocode" ? (
          <div
            className="mt-1.5 rounded border px-1.5 py-1"
            style={{ borderColor: `${theme.brandColor}33` }}
          >
            <p className="text-[7px]" style={{ color: theme.mutedTextColor }}>
              What’s ending
            </p>
            <p className="text-[8px] font-semibold">Pro Monthly</p>
          </div>
        ) : null}
        {kitId === "fontbase" ? (
          <p
            className="mt-1 text-[8px]"
            style={{ color: theme.mutedTextColor }}
          >
            What’s included · plan · card
          </p>
        ) : null}
        {kitId === "nordvpn-structure" ? (
          <p
            className="mt-1 text-[8px] font-semibold"
            style={{ color: theme.brandColor }}
          >
            1 Update billing · 2 Keep access
          </p>
        ) : null}
        {kitId === "benchmark" ? (
          <p
            className="mt-1 text-[8px]"
            style={{ color: theme.mutedTextColor }}
          >
            Nothing here is gone
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
            spec.ctaAlign === "center" && "mx-auto",
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
