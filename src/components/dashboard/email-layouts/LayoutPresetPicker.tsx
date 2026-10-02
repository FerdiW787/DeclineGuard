import {
  LAYOUT_PRESET_META,
  type LayoutPresetId,
} from "@/lib/emailLayoutPresets";
import { PRESET_THEMES, QUIET_VERIFY_TOKENS } from "@/lib/emailTheme";
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
        const theme = PRESET_THEMES[preset.id] ?? QUIET_VERIFY_TOKENS;
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
  const theme = PRESET_THEMES[id] ?? QUIET_VERIFY_TOKENS;
  switch (id) {
    case "poster-notice":
      return (
        <div
          className="flex h-16 flex-col items-center justify-center gap-1.5 rounded-lg px-3"
          style={{ background: theme.emailBackgroundColor }}
        >
          <span className="h-1.5 w-12 bg-black/20" />
          <span className="h-1 w-8 rounded-full bg-black/10" />
          <span
            className="mt-1 h-2 w-7 rounded-sm"
            style={{ background: theme.ctaBackgroundColor }}
          />
        </div>
      );
    case "amount-due":
      return (
        <div
          className="flex h-16 flex-col justify-center gap-1 rounded-lg px-2.5"
          style={{ background: theme.emailBackgroundColor }}
        >
          <span className="h-1 w-6 rounded-full bg-black/10" />
          <span className="h-4 w-10 bg-black/20" />
          <span className="h-1 w-8 rounded-full bg-black/10" />
          <span
            className="mt-0.5 h-2 w-7 rounded-sm"
            style={{ background: theme.ctaBackgroundColor }}
          />
        </div>
      );
    case "plain-letter":
      return (
        <div
          className="flex h-16 flex-col justify-center gap-1 rounded-lg px-2.5"
          style={{ background: theme.emailBackgroundColor }}
        >
          <span className="h-1 w-10 bg-black/18" />
          <span className="h-1 w-full rounded-full bg-black/8" />
          <span className="h-1 w-11/12 rounded-full bg-black/8" />
          <span
            className="mt-1 h-2 w-7 rounded-sm"
            style={{ background: theme.ctaBackgroundColor }}
          />
        </div>
      );
    case "what-happened":
      return (
        <div
          className="flex h-16 flex-col justify-center gap-1 rounded-lg px-2.5"
          style={{ background: theme.emailBackgroundColor }}
        >
          <span className="h-1 w-9 bg-black/18" />
          <span className="h-1 w-5 rounded-full bg-black/8" />
          <span className="h-1 w-11 rounded-full bg-black/12" />
          <span className="h-1 w-5 rounded-full bg-black/8" />
          <span
            className="mt-0.5 h-2 w-7 rounded-sm"
            style={{ background: theme.ctaBackgroundColor }}
          />
        </div>
      );
    case "quiet-column":
      return (
        <div
          className="flex h-16 flex-col justify-end gap-1.5 rounded-lg px-2.5 pb-2"
          style={{ background: theme.emailBackgroundColor }}
        >
          <span className="h-2 w-12 bg-black/18" />
          <span className="h-1 w-10 rounded-full bg-black/8" />
          <span
            className="h-2 w-6 rounded-sm"
            style={{ background: theme.ctaBackgroundColor }}
          />
        </div>
      );
    case "italic-lead":
      return (
        <div
          className="flex h-16 flex-col justify-center gap-1.5 rounded-lg px-2.5"
          style={{ background: theme.emailBackgroundColor }}
        >
          <span className="h-1.5 w-11 -skew-x-6 bg-black/18" />
          <span className="h-1 w-8 rounded-full bg-black/8" />
          <span
            className="h-2 w-6 rounded-sm"
            style={{ background: theme.ctaBackgroundColor }}
          />
        </div>
      );
    case "status-word":
      return (
        <div
          className="flex h-16 flex-col justify-center gap-1 rounded-lg px-2.5"
          style={{ background: theme.emailBackgroundColor }}
        >
          <span className="h-3.5 w-9 bg-black/22" />
          <span className="h-1 w-6 rounded-full bg-black/8" />
          <span
            className="mt-0.5 h-2 w-7 rounded-sm"
            style={{ background: theme.ctaBackgroundColor }}
          />
        </div>
      );
    case "deck-headline":
      return (
        <div
          className="flex h-16 flex-col justify-center gap-1 rounded-lg px-2.5"
          style={{ background: theme.emailBackgroundColor }}
        >
          <span className="h-1 w-5 rounded-full bg-black/10" />
          <span className="h-2.5 w-12 bg-black/20" />
          <span className="h-1 w-8 rounded-full bg-black/8" />
          <span
            className="h-2 w-6 rounded-sm"
            style={{ background: theme.ctaBackgroundColor }}
          />
        </div>
      );
    case "hold-open":
      return (
        <div
          className="flex h-16 flex-col justify-center gap-1 rounded-lg px-2.5"
          style={{ background: theme.emailBackgroundColor }}
        >
          <span className="h-1.5 w-10 bg-black/14" />
          <span className="h-1 w-9 bg-black/20" />
          <span className="h-1 w-8 rounded-full bg-black/8" />
          <span
            className="h-2 w-7 rounded-sm"
            style={{ background: theme.ctaBackgroundColor }}
          />
        </div>
      );
    case "folio-mark":
      return (
        <div
          className="flex h-16 flex-col justify-center gap-1 rounded-lg px-2.5"
          style={{ background: theme.emailBackgroundColor }}
        >
          <span className="ml-auto h-1 w-4 rounded-full bg-black/12" />
          <span className="h-1 w-10 bg-black/18" />
          <span className="h-1 w-8 rounded-full bg-black/8" />
          <span
            className="h-2 w-6 rounded-sm"
            style={{ background: theme.ctaBackgroundColor }}
          />
        </div>
      );
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}
