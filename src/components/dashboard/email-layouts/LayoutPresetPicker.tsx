import {
  LAYOUT_PRESET_META,
  type LayoutPresetId,
} from "@/lib/emailLayoutPresets";
import { PRESET_THEMES, SONOS_TOKENS } from "@/lib/emailTheme";
import { cn } from "@/lib/utils";

type Props = {
  value: LayoutPresetId;
  onChange: (id: LayoutPresetId) => void;
  className?: string;
};

export default function LayoutPresetPicker({
  value,
  onChange,
  className,
}: Props) {
  return (
    <div
      role="listbox"
      aria-label="Email layout"
      className={cn(
        "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5",
        className,
      )}
    >
      {LAYOUT_PRESET_META.map((preset) => {
        const active = preset.id === value;
        const theme = PRESET_THEMES[preset.id] ?? SONOS_TOKENS;
        return (
          <button
            key={preset.id}
            type="button"
            role="option"
            aria-selected={active}
            onClick={() => onChange(preset.id)}
            className={cn(
              "cursor-pointer rounded-xl border p-2.5 text-left transition",
              active
                ? "border-[#08090a] bg-white shadow-sm"
                : "border-black/8 bg-white/70 hover:border-black/16",
            )}
          >
            <LayoutThumb id={preset.id} />
            <p className="mt-2 text-[12px] font-semibold tracking-[-0.01em] text-[#08090a]">
              {preset.label}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-[#8a8f98]">
              {preset.structure}
            </p>
            <span className="sr-only" style={{ color: theme.brandColor }}>
              {preset.id}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function LayoutThumb({ id }: { id: LayoutPresetId }) {
  const theme = PRESET_THEMES[id] ?? SONOS_TOKENS;
  switch (id) {
    case "sonos":
      return (
        <div
          className="flex h-16 flex-col items-center justify-center gap-1.5 rounded-lg"
          style={{ background: theme.emailBackgroundColor }}
        >
          <span
            className="size-2 rounded-full"
            style={{ background: theme.brandColor }}
          />
          <span className="h-1 w-10 rounded-full bg-black/15" />
          <span className="h-1 w-7 rounded-full bg-black/10" />
          <span
            className="mt-0.5 h-2 w-8 rounded-full"
            style={{ background: theme.ctaBackgroundColor }}
          />
        </div>
      );
    case "avocode":
      return (
        <div
          className="flex h-16 overflow-hidden rounded-lg"
          style={{ background: theme.emailBackgroundColor }}
        >
          <span className="w-1.5 shrink-0" style={{ background: theme.brandColor }} />
          <div className="flex flex-1 flex-col justify-center gap-1 px-2">
            <span className="h-1 w-8 rounded-full bg-black/20" />
            <span className="h-4 rounded-sm bg-white/80" />
            <span
              className="h-2 w-7 rounded-sm"
              style={{ background: theme.ctaBackgroundColor }}
            />
          </div>
        </div>
      );
    case "benchmark":
      return (
        <div
          className="flex h-16 flex-col overflow-hidden rounded-lg"
          style={{ background: theme.emailBackgroundColor }}
        >
          <span className="h-4 w-full" style={{ background: theme.brandColor }} />
          <div className="flex flex-1 flex-col justify-center gap-1 px-2.5">
            <span className="h-1 w-10 rounded-full bg-black/20" />
            <span className="h-1 w-7 rounded-full bg-black/10" />
          </div>
        </div>
      );
    case "fontbase":
      return (
        <div
          className="flex h-16 flex-col justify-center gap-1 rounded-lg px-2.5"
          style={{ background: theme.emailBackgroundColor }}
        >
          <span className="h-px w-full" style={{ background: theme.brandColor }} />
          <span className="h-3 w-11 bg-black/20" />
          <span className="h-px w-full" style={{ background: theme.brandColor }} />
          <span className="h-1 w-8 bg-black/15" />
        </div>
      );
    case "nordvpn-structure":
      return (
        <div
          className="flex h-16 flex-col overflow-hidden rounded-lg"
          style={{ background: theme.emailBackgroundColor }}
        >
          <span className="h-3 w-full" style={{ background: theme.brandColor }} />
          <div className="flex flex-1 flex-col justify-center gap-1 px-2">
            <span className="h-3 rounded-sm border border-black/10 bg-white" />
            <span className="h-3 rounded-sm border border-black/10 bg-white" />
          </div>
        </div>
      );
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}
