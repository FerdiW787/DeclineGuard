import {
  LAYOUT_PRESET_META,
  type LayoutPresetId,
} from "@/lib/emailLayoutPresets";
import { CALM_VERIFY_TOKENS, PRESET_THEMES } from "@/lib/emailTheme";
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
      aria-label="Recovery layout"
      className={cn(
        "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5",
        className,
      )}
    >
      {LAYOUT_PRESET_META.map((preset) => {
        const active = preset.id === value;
        const theme = PRESET_THEMES[preset.id] ?? CALM_VERIFY_TOKENS;
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
  const theme = PRESET_THEMES[id] ?? CALM_VERIFY_TOKENS;
  switch (id) {
    case "calm-verify":
      return (
        <div
          className="flex h-16 flex-col overflow-hidden rounded-lg"
          style={{ background: theme.pageBackgroundColor }}
        >
          <div
            className="mx-2 mt-1.5 flex flex-1 flex-col items-center justify-center gap-1 rounded-sm"
            style={{ background: theme.emailBackgroundColor }}
          >
            <span className="h-1 w-8 rounded-full bg-black/20" />
            <span className="h-4 w-full bg-black/8" />
            <span
              className="h-1.5 w-10 rounded-full"
              style={{ background: theme.ctaBackgroundColor }}
            />
          </div>
        </div>
      );
    case "account-expired":
      return (
        <div
          className="flex h-16 flex-col justify-center gap-1 rounded-lg px-2"
          style={{ background: theme.pageBackgroundColor }}
        >
          <span className="h-1 w-8 rounded-full bg-black/20" />
          <span className="h-5 w-full rounded-sm" style={{ background: "#111" }} />
          <span
            className="h-2 w-8 rounded-full"
            style={{ background: theme.ctaBackgroundColor }}
          />
        </div>
      );
    case "trial-ended":
      return (
        <div
          className="flex h-16 flex-col items-center justify-center gap-1 rounded-lg"
          style={{ background: theme.pageBackgroundColor }}
        >
          <span
            className="h-5 w-6 rounded-sm border bg-white"
            style={{ borderColor: "rgba(0,0,0,0.1)" }}
          />
          <span
            className="h-1.5 w-9 rounded-full"
            style={{ background: theme.ctaBackgroundColor }}
          />
        </div>
      );
    case "upcoming-renewal":
      return (
        <div
          className="flex h-16 flex-col items-center justify-center rounded-lg px-2"
          style={{ background: theme.pageBackgroundColor }}
        >
          <div
            className="flex w-full flex-1 flex-col items-center justify-center gap-1 rounded-sm"
            style={{ background: theme.emailBackgroundColor }}
          >
            <span className="h-1 w-10 rounded-full bg-black/20" />
            <span className="h-2 w-8 rounded-sm bg-black/80" />
          </div>
        </div>
      );
    case "data-safe":
      return (
        <div
          className="flex h-16 flex-col justify-center gap-1 rounded-lg px-2.5"
          style={{ background: theme.emailBackgroundColor }}
        >
          <span className="h-1 w-10 rounded-full bg-black/18" />
          <span
            className="h-2 w-8 rounded-md"
            style={{ background: theme.ctaBackgroundColor }}
          />
          <span className="h-3 rounded-sm bg-black/6" />
        </div>
      );
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}
