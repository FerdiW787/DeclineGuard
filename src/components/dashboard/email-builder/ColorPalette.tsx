import { cn } from "@/lib/utils";

export type ColorSwatch = { id: string; label: string; color: string };

type Props = {
  usedColors?: string[];
  general: readonly ColorSwatch[];
  activeColor?: string | null;
  onPick: (hex: string) => void;
  mode?: "letter" | "fill";
  showCustom?: boolean;
  customValue?: string;
  onCustom?: (hex: string) => void;
};

export default function ColorPalette({
  usedColors = [],
  general,
  activeColor,
  onPick,
  mode = "letter",
  showCustom = false,
  customValue,
  onCustom,
}: Props) {
  return (
    <div className="w-[188px]">
      {usedColors.length > 0 ? (
        <section className="mb-2.5">
          <p className="mb-1.5 px-0.5 text-[10px] font-medium tracking-tight text-[#8a8f98]">
            Colors in the Email
          </p>
          <SwatchGrid
            swatches={usedColors.map((color) => ({
              id: color,
              label: color,
              color,
            }))}
            activeColor={activeColor}
            onPick={onPick}
            mode={mode}
          />
        </section>
      ) : null}
      <section>
        <p className="mb-1.5 px-0.5 text-[10px] font-medium tracking-tight text-[#8a8f98]">
          General
        </p>
        <SwatchGrid
          swatches={general}
          activeColor={activeColor}
          onPick={onPick}
          mode={mode}
        />
      </section>
      {showCustom && onCustom ? (
        <label className="mt-2 flex items-center gap-2 px-0.5 text-[11px] text-[#6b6f76]">
          Custom
          <input
            type="color"
            value={toHex6(customValue || activeColor || "#08090a")}
            onChange={(e) => onCustom(e.target.value)}
            className="h-6 w-8 cursor-pointer rounded-sm border border-black/10 bg-white p-0"
            title="Custom color"
          />
        </label>
      ) : null}
    </div>
  );
}

function SwatchGrid({
  swatches,
  activeColor,
  onPick,
  mode,
}: {
  swatches: readonly ColorSwatch[];
  activeColor?: string | null;
  onPick: (hex: string) => void;
  mode: "letter" | "fill";
}) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {swatches.map((swatch) => {
        const active =
          activeColor?.toLowerCase() === swatch.color.toLowerCase();
        return (
          <button
            key={swatch.id}
            type="button"
            title={swatch.label}
            aria-label={swatch.label}
            onClick={() => onPick(swatch.color)}
            className={cn(
              mode === "letter"
                ? "flex h-8 items-center justify-center rounded-sm border border-black/8 text-[13px] font-semibold transition-colors hover:bg-black/[0.04]"
                : "h-8 rounded-sm border border-black/8 transition-colors hover:bg-black/[0.04]",
              active
                ? mode === "letter"
                  ? "bg-black/[0.06] ring-1 ring-black/10"
                  : "ring-1 ring-black/15"
                : "",
            )}
            style={
              mode === "letter"
                ? { color: swatch.color }
                : { background: swatch.color }
            }
          >
            {mode === "letter" ? "A" : null}
          </button>
        );
      })}
    </div>
  );
}

function toHex6(hex: string): string {
  const raw = hex.trim();
  const m = raw.match(/^#([0-9a-f]{3})$/i);
  if (m?.[1]) {
    const [a, b, c] = m[1];
    if (a && b && c) return `#${a}${a}${b}${b}${c}${c}`.toLowerCase();
  }
  return /^#([0-9a-f]{6})$/i.test(raw) ? raw.toLowerCase() : "#08090a";
}
