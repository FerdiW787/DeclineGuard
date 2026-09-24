import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Minus, Plus } from "lucide-react";
import {
  SHELL_BORDER_WIDTH_MAX,
  SHELL_RADIUS_MAX,
  type EmailDocument,
} from "@/lib/emailBuilder";
import { cn } from "@/lib/utils";
import ColorPalette from "./ColorPalette";
import { TEXT_SWATCHES } from "./SelectionFormatMenu";

type Patch = Partial<
  Pick<
    EmailDocument,
    | "shellBackground"
    | "shellBorderColor"
    | "shellBorder"
    | "shellBorderWidth"
    | "shellRadius"
  >
>;

type Props = {
  background: string;
  borderColor: string;
  borderOn: boolean;
  borderWidth: number;
  radius: number;
  brandColor?: string;
  emailColors?: string[];
  anchorRef: RefObject<HTMLElement | null>;
  onPatch: (patch: Patch) => void;
};

export default function EmailShellEditBar({
  background,
  borderColor,
  borderOn,
  borderWidth,
  radius,
  brandColor,
  emailColors,
  anchorRef,
  onPatch,
}: Props) {
  const [open, setOpen] = useState<"bg" | "border" | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const swatches = [
    ...(brandColor &&
    !TEXT_SWATCHES.some(
      (s) => s.color.toLowerCase() === brandColor.toLowerCase(),
    )
      ? [{ id: "brand", label: "Brand", color: brandColor }]
      : []),
    { id: "white", label: "White", color: "#ffffff" },
    ...TEXT_SWATCHES,
  ];

  useLayoutEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setPos({ left: rect.left + rect.width / 2, top: rect.top });
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
  }, [anchorRef]);

  if (!pos) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed z-[70]"
      style={{
        left: pos.left,
        top: pos.top,
        transform: "translate(-50%, calc(-100% - 10px))",
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="dg-format-in pointer-events-auto origin-bottom">
        <div className="relative inline-flex items-center gap-0.5 rounded border border-black/8 bg-white p-1 shadow-[0_10px_36px_-16px_rgba(8,9,10,0.35)]">
          <ColorBtn
            label="Background color"
            color={background}
            open={open === "bg"}
            onToggle={() => setOpen((v) => (v === "bg" ? null : "bg"))}
          />
          <span className="mx-0.5 h-4 w-px bg-black/8" aria-hidden />
          <ColorBtn
            label="Border color"
            color={borderColor}
            open={open === "border"}
            onToggle={() => setOpen((v) => (v === "border" ? null : "border"))}
          />
          <span className="mx-0.5 h-4 w-px bg-black/8" aria-hidden />
          <div className="inline-flex h-8 items-center gap-1.5 px-1.5">
            <span className="text-[12px] font-medium tracking-tight text-[#3a3d42]">
              Border
            </span>
            <div
              role="group"
              aria-label="Border on or off"
              className="inline-flex h-6 rounded-sm border border-black/10 bg-black/[0.04] p-0.5"
            >
              <button
                type="button"
                aria-pressed={borderOn}
                onClick={() => onPatch({ shellBorder: true })}
                className={cn(
                  "h-full rounded-[3px] px-2 text-[11px] font-semibold tracking-tight transition-colors",
                  borderOn
                    ? "bg-[#08090a] text-white"
                    : "text-[#8a8f98] hover:text-[#08090a]",
                )}
              >
                On
              </button>
              <button
                type="button"
                aria-pressed={!borderOn}
                onClick={() => onPatch({ shellBorder: false })}
                className={cn(
                  "h-full rounded-[3px] px-2 text-[11px] font-semibold tracking-tight transition-colors",
                  !borderOn
                    ? "bg-[#08090a] text-white"
                    : "text-[#8a8f98] hover:text-[#08090a]",
                )}
              >
                Off
              </button>
            </div>
          </div>
          <span className="mx-0.5 h-4 w-px bg-black/8" aria-hidden />
          <StepperField
            label="Width"
            value={borderWidth}
            min={1}
            max={SHELL_BORDER_WIDTH_MAX}
            disabled={!borderOn}
            ariaLabel="Border width"
            onChange={(next) =>
              onPatch({ shellBorderWidth: next, shellBorder: true })
            }
          />
          <span className="mx-0.5 h-4 w-px bg-black/8" aria-hidden />
          <StepperField
            label="Radius"
            value={radius}
            min={0}
            max={SHELL_RADIUS_MAX}
            ariaLabel="Border radius"
            onChange={(next) => onPatch({ shellRadius: next })}
          />

          {open ? (
            <div className="absolute left-1/2 top-[calc(100%+6px)] z-30 -translate-x-1/2 rounded border border-black/8 bg-white p-2 shadow-[0_10px_36px_-16px_rgba(8,9,10,0.35)]">
              <ColorPalette
                usedColors={emailColors}
                general={swatches}
                activeColor={open === "bg" ? background : borderColor}
                mode="fill"
                onPick={(hex) => {
                  if (open === "bg") {
                    onPatch({ shellBackground: hex });
                  } else {
                    onPatch({
                      shellBorderColor: hex,
                      shellBorder: true,
                    });
                  }
                  setOpen(null);
                }}
                showCustom
                customValue={toHex6(open === "bg" ? background : borderColor)}
                onCustom={(hex) => {
                  if (open === "bg") {
                    onPatch({ shellBackground: hex });
                  } else {
                    onPatch({
                      shellBorderColor: hex,
                      shellBorder: true,
                    });
                  }
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function StepperField({
  label,
  value,
  min,
  max,
  disabled,
  ariaLabel,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  ariaLabel: string;
  onChange: (next: number) => void;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, Math.round(n)));
  const valueRef = useRef(value);
  valueRef.current = value;

  const stepBy = (delta: number) => {
    const next = clamp(valueRef.current + delta);
    if (next === valueRef.current) return false;
    valueRef.current = next;
    onChange(next);
    return true;
  };

  return (
    <div
      className={cn(
        "inline-flex h-8 items-center gap-1.5 px-1.5",
        disabled && "opacity-40",
      )}
    >
      <span className="text-[12px] font-medium tracking-tight text-[#3a3d42]">
        {label}
      </span>
      <div className="inline-flex h-6 items-stretch overflow-hidden rounded-sm border border-black/10 bg-black/[0.03]">
        <HoldStepButton
          label={`Decrease ${ariaLabel}`}
          disabled={disabled || value <= min}
          onStep={() => stepBy(-1)}
        >
          <Minus className="size-3" strokeWidth={2.25} />
        </HoldStepButton>
        <input
          type="text"
          inputMode="numeric"
          disabled={disabled}
          value={value}
          aria-label={ariaLabel}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d]/g, "");
            if (raw === "") {
              onChange(min);
              return;
            }
            const next = Number.parseInt(raw, 10);
            if (!Number.isFinite(next)) return;
            onChange(clamp(next));
          }}
          className="w-7 border-x border-black/8 bg-transparent text-center text-[12px] font-semibold tabular-nums text-[#08090a] outline-none"
        />
        <HoldStepButton
          label={`Increase ${ariaLabel}`}
          disabled={disabled || value >= max}
          onStep={() => stepBy(1)}
        >
          <Plus className="size-3" strokeWidth={2.25} />
        </HoldStepButton>
      </div>
    </div>
  );
}

function HoldStepButton({
  label,
  disabled,
  onStep,
  children,
}: {
  label: string;
  disabled?: boolean;
  onStep: () => boolean;
  children: ReactNode;
}) {
  const delayRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;

  const stop = () => {
    if (delayRef.current != null) window.clearTimeout(delayRef.current);
    if (intervalRef.current != null) window.clearInterval(intervalRef.current);
    delayRef.current = null;
    intervalRef.current = null;
  };

  useEffect(() => stop, []);
  useEffect(() => {
    if (disabled) stop();
  }, [disabled]);

  const start = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    onStepRef.current();
    delayRef.current = window.setTimeout(() => {
      intervalRef.current = window.setInterval(() => {
        if (!onStepRef.current()) stop();
      }, 55);
    }, 320);
  };

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerCancel={stop}
      className="flex w-6 cursor-pointer items-center justify-center text-[#6b6f76] transition-colors hover:bg-black/[0.06] hover:text-[#08090a] disabled:pointer-events-none disabled:cursor-default disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function ColorBtn({
  label,
  color,
  open,
  onToggle,
}: {
  label: string;
  color: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-expanded={open}
      onClick={onToggle}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-sm px-2 text-[12px] font-medium tracking-tight transition-colors",
        open
          ? "bg-black/[0.06] text-[#08090a]"
          : "text-[#3a3d42] hover:bg-black/5 hover:text-[#08090a]",
      )}
    >
      <span
        className="size-3.5 rounded-[3px] border border-black/10"
        style={{ background: color }}
      />
      {label}
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
  return /^#([0-9a-f]{6})$/i.test(raw) ? raw.toLowerCase() : "#ffffff";
}
