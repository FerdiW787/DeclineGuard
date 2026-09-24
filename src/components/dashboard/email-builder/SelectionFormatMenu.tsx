import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Bold, Italic, Link2, Underline } from "lucide-react";
import { cn } from "@/lib/utils";
import ColorPalette from "./ColorPalette";

export const TEXT_SWATCHES = [
  { id: "ink", label: "Ink", color: "#08090a" },
  { id: "muted", label: "Muted", color: "#6b6f76" },
  { id: "red", label: "Red", color: "#dc2626" },
  { id: "orange", label: "Orange", color: "#ea580c" },
  { id: "green", label: "Green", color: "#16a34a" },
  { id: "blue", label: "Blue", color: "#2563eb" },
  { id: "purple", label: "Purple", color: "#7c3aed" },
] as const;

type Props = {
  x: number;
  y: number;
  flip?: boolean;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  linked: boolean;
  colorOpen: boolean;
  linkOpen: boolean;
  linkValue: string;
  activeColor: string | null;
  brandColor?: string;
  emailColors?: string[];
  onToggle: (cmd: "bold" | "italic" | "underline") => void;
  onToggleColorOpen: () => void;
  onColor: (hex: string | null) => void;
  onToggleLinkOpen: () => void;
  onLinkValue: (next: string) => void;
  onApplyLink: () => void;
  onUnlink: () => void;
};

export default function SelectionFormatMenu({
  x,
  y,
  flip = false,
  bold,
  italic,
  underline,
  linked,
  colorOpen,
  linkOpen,
  linkValue,
  activeColor,
  brandColor,
  emailColors,
  onToggle,
  onToggleColorOpen,
  onColor,
  onToggleLinkOpen,
  onLinkValue,
  onApplyLink,
  onUnlink,
}: Props) {
  const swatches = [
    ...(brandColor &&
    !TEXT_SWATCHES.some(
      (s) => s.color.toLowerCase() === brandColor.toLowerCase(),
    )
      ? [{ id: "brand", label: "Brand", color: brandColor }]
      : []),
    ...TEXT_SWATCHES,
  ];

  return createPortal(
    <div
      className="pointer-events-auto fixed z-[80]"
      style={{
        left: x,
        top: y,
        transform: flip ? "translateX(-100%)" : undefined,
      }}
      onMouseDown={(e) => {
        if (e.target instanceof HTMLInputElement) return;
        e.preventDefault();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          "dg-island-in-side flex items-start gap-1.5",
          flip ? "flex-row-reverse origin-right" : "origin-left",
        )}
      >
        <div className="flex flex-col items-center gap-0.5 rounded border border-black/8 bg-white p-1 shadow-[0_10px_36px_-16px_rgba(8,9,10,0.35)]">
          <FormatBtn
            label="Bold"
            active={bold}
            onClick={() => onToggle("bold")}
          >
            <Bold className="size-3.5" />
          </FormatBtn>
          <FormatBtn
            label="Italic"
            active={italic}
            onClick={() => onToggle("italic")}
          >
            <Italic className="size-3.5" />
          </FormatBtn>
          <FormatBtn
            label="Underline"
            active={underline}
            onClick={() => onToggle("underline")}
          >
            <Underline className="size-3.5" />
          </FormatBtn>
          <button
            type="button"
            title="Color"
            aria-label="Color"
            aria-expanded={colorOpen}
            onClick={onToggleColorOpen}
            className={cn(
              "inline-flex size-8 flex-col items-center justify-center rounded-sm transition-colors",
              colorOpen
                ? "bg-black/[0.08] text-[#08090a]"
                : "text-[#6b6f76] hover:bg-black/5 hover:text-[#08090a]",
            )}
          >
            <span className="text-[13px] font-semibold leading-none">A</span>
            <span
              className="mt-0.5 block h-0.5 w-3"
              style={{ background: activeColor || "#08090a" }}
            />
          </button>
          <FormatBtn
            label="Link"
            active={linked || linkOpen}
            onClick={onToggleLinkOpen}
          >
            <Link2 className="size-3.5" />
          </FormatBtn>
        </div>

        {colorOpen ? (
          <div className="rounded border border-black/8 bg-white p-2 shadow-[0_10px_36px_-16px_rgba(8,9,10,0.35)]">
            <ColorPalette
              usedColors={emailColors}
              general={swatches}
              activeColor={activeColor}
              onPick={(hex) => onColor(hex)}
            />
          </div>
        ) : null}

        {linkOpen ? (
          <div className="w-[220px] rounded border border-black/8 bg-white p-2 shadow-[0_10px_36px_-16px_rgba(8,9,10,0.35)]">
            <p className="mb-1.5 px-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[#8a8f98]">
              Link
            </p>
            <input
              type="url"
              value={linkValue}
              placeholder="https://"
              aria-label="Link URL"
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => onLinkValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onApplyLink();
                }
              }}
              className="h-8 w-full rounded-sm border border-black/10 bg-white px-2 text-[12px] text-[#08090a] outline-none placeholder:text-[#8a8f98] focus:border-black/20"
            />
            <div className="mt-1.5 flex items-center justify-end gap-1">
              {linked ? (
                <button
                  type="button"
                  onClick={onUnlink}
                  className="h-7 rounded-sm px-2 text-[11px] font-medium text-[#6b6f76] hover:bg-black/5 hover:text-[#08090a]"
                >
                  Remove
                </button>
              ) : null}
              <button
                type="button"
                onClick={onApplyLink}
                className="h-7 rounded-sm bg-[#08090a] px-2.5 text-[11px] font-medium text-[#f7f8f8] hover:bg-[#2a2b2e]"
              >
                Apply
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

function FormatBtn({
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
