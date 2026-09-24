import {
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Bold, Italic, Underline } from "lucide-react";
import { TEXT_SIZE_OPTIONS, type TextBlock } from "@/lib/emailBuilder";
import { cn } from "@/lib/utils";
import ColorPalette from "./ColorPalette";
import { TEXT_SWATCHES } from "./SelectionFormatMenu";

type Props = {
  block: TextBlock;
  activeColor: string;
  brandColor?: string;
  emailColors?: string[];
  anchorRef: RefObject<HTMLElement | null>;
  onPatch: (patch: Partial<TextBlock>) => void;
};

export default function TextBlockEditBar({
  block,
  activeColor,
  brandColor,
  emailColors,
  anchorRef,
  onPatch,
}: Props) {
  const [colorOpen, setColorOpen] = useState(false);
  const sizes = useMemo(() => {
    if (
      (TEXT_SIZE_OPTIONS as readonly number[]).includes(block.fontSize)
    ) {
      return TEXT_SIZE_OPTIONS;
    }
    return [...TEXT_SIZE_OPTIONS, block.fontSize].sort((a, b) => a - b);
  }, [block.fontSize]);

  const swatches = [
    ...(brandColor &&
    !TEXT_SWATCHES.some(
      (s) => s.color.toLowerCase() === brandColor.toLowerCase(),
    )
      ? [{ id: "brand", label: "Brand", color: brandColor }]
      : []),
    ...TEXT_SWATCHES,
  ];

  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = anchorRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setPos({ left: rect.left, top: rect.top });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [anchorRef, block.id]);

  if (!pos) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed z-[70]"
      style={{
        left: pos.left,
        top: pos.top,
        transform: "translateY(calc(-100% - 8px))",
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="dg-format-in pointer-events-auto origin-bottom">
        <div className="relative inline-flex items-center gap-0.5 rounded border border-black/8 bg-white p-1 shadow-[0_10px_36px_-16px_rgba(8,9,10,0.35)]">
          <label className="sr-only" htmlFor={`text-size-${block.id}`}>
            Text size
          </label>
          <select
            id={`text-size-${block.id}`}
            value={block.fontSize}
            onChange={(e) =>
              onPatch({ fontSize: Number.parseInt(e.target.value, 10) })
            }
            className="h-8 cursor-pointer rounded-sm border-0 bg-white px-1.5 text-[12px] font-medium tracking-tight text-[#08090a] outline-none"
            title="Text size"
          >
            {sizes.map((size) => (
              <option key={size} value={size}>
                {size}px
              </option>
            ))}
          </select>
          <span className="mx-0.5 h-4 w-px bg-black/8" aria-hidden />
          <button
            type="button"
            title="Text color"
            aria-label="Text color"
            aria-expanded={colorOpen}
            onClick={() => setColorOpen((open) => !open)}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-sm px-1.5 text-[13px] font-semibold tracking-tight transition-colors",
              colorOpen
                ? "bg-black/[0.06] text-[#08090a]"
                : "text-[#3a3d42] hover:bg-black/5 hover:text-[#08090a]",
            )}
          >
            <span className="leading-none">A</span>
            <span
              className="block h-0.5 w-3"
              style={{ background: activeColor }}
            />
          </button>
          <span className="mx-0.5 h-4 w-px bg-black/8" aria-hidden />
          <ToggleBtn
            label="Bold"
            active={Boolean(block.bold)}
            onClick={() => onPatch({ bold: !block.bold })}
          >
            <Bold className="size-3.5" />
          </ToggleBtn>
          <ToggleBtn
            label="Italic"
            active={Boolean(block.italic)}
            onClick={() => onPatch({ italic: !block.italic })}
          >
            <Italic className="size-3.5" />
          </ToggleBtn>
          <ToggleBtn
            label="Underline"
            active={Boolean(block.underline)}
            onClick={() => onPatch({ underline: !block.underline })}
          >
            <Underline className="size-3.5" />
          </ToggleBtn>

          {colorOpen ? (
            <div className="absolute left-0 top-[calc(100%+6px)] z-30 rounded border border-black/8 bg-white p-2 shadow-[0_10px_36px_-16px_rgba(8,9,10,0.35)]">
              <ColorPalette
                usedColors={emailColors}
                general={swatches}
                activeColor={activeColor}
                onPick={(hex) => {
                  onPatch({ hexColor: hex, color: "default" });
                  setColorOpen(false);
                }}
                showCustom
                customValue={toHex6(activeColor)}
                onCustom={(hex) =>
                  onPatch({ hexColor: hex, color: "default" })
                }
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ToggleBtn({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-sm transition-colors",
        active
          ? "bg-black/[0.08] text-[#08090a]"
          : "text-[#6b6f76] hover:bg-black/5 hover:text-[#08090a]",
      )}
    >
      {children}
    </button>
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
