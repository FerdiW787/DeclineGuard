import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  Circle,
  ImageIcon,
  Minus,
  Plus,
  Square,
  Star,
  Trash2,
  Triangle,
  Upload,
} from "lucide-react";
import {
  IMAGE_BORDER_WIDTH_MAX,
  IMAGE_RADIUS_DEFAULT,
  IMAGE_SHAPE_OPTIONS,
  resolveImageBorder,
  resolveImageBorderColor,
  resolveImageBorderWidth,
  resolveImageShadow,
  resolveImageShadowColor,
  resolveImageShape,
  type ImageBlock,
  type ImageShape,
} from "@/lib/emailBuilder";
import {
  assertEmailImageFile,
  EMAIL_IMAGE_ACCEPT,
  readFileAsDataUrl,
} from "@/lib/uploadEmailHeaderImage";
import { cn } from "@/lib/utils";
import ColorPalette from "./ColorPalette";
import { TEXT_SWATCHES } from "./SelectionFormatMenu";

type ColorOpen = "shadow" | "border";
type Open = "image" | "shape" | ColorOpen | null;

const beforeShapeById = new Map<string, Partial<ImageBlock>>();

type Props = {
  block: ImageBlock;
  brandColor?: string;
  emailColors?: string[];
  anchorRef: RefObject<HTMLElement | null>;
  onPatch: (patch: Partial<ImageBlock>) => void;
  onRemove: () => void;
  onUploadImage?: (file: File) => Promise<string>;
};

export default function ImageBlockEditBar({
  block,
  brandColor,
  emailColors,
  anchorRef,
  onPatch,
  onRemove,
  onUploadImage,
}: Props) {
  const [open, setOpen] = useState<Open>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const shadowOn = resolveImageShadow(block);
  const shadowColor = resolveImageShadowColor(block);
  const borderOn = resolveImageBorder(block);
  const borderColor = resolveImageBorderColor(block);
  const borderWidth = resolveImageBorderWidth(block);
  const shape = resolveImageShape(block);

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

  useLayoutPos(anchorRef, setPos);

  if (!pos) return null;

  return createPortal(
    <div
      data-image-handle=""
      className="pointer-events-none fixed z-[76]"
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
          <button
            type="button"
            title="Image"
            aria-label="Image"
            aria-expanded={open === "image"}
            onClick={() => setOpen((v) => (v === "image" ? null : "image"))}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-sm px-2 text-[12px] font-medium tracking-tight transition-colors",
              open === "image"
                ? "bg-black/[0.06] text-[#08090a]"
                : "text-[#3a3d42] hover:bg-black/5 hover:text-[#08090a]",
            )}
          >
            {block.src.trim() ? (
              <img
                src={block.src}
                alt=""
                className="size-3.5 rounded-[3px] object-cover"
              />
            ) : (
              <ImageIcon className="size-3.5" />
            )}
            Image
          </button>
          <button
            type="button"
            title="Shape"
            aria-label="Shape"
            aria-expanded={open === "shape"}
            onClick={() => setOpen((v) => (v === "shape" ? null : "shape"))}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-sm px-2 text-[12px] font-medium tracking-tight transition-colors",
              open === "shape"
                ? "bg-black/[0.06] text-[#08090a]"
                : "text-[#3a3d42] hover:bg-black/5 hover:text-[#08090a]",
            )}
          >
            <ShapeGlyph shape={shape} className="size-3.5" />
            Shape
          </button>
          <span className="mx-0.5 h-4 w-px bg-black/8" aria-hidden />
          <OnOff
            label="Shadow"
            groupLabel="Shadow on or off"
            on={shadowOn}
            onChange={(next) => onPatch({ shadow: next })}
          />
          <ColorBtn
            label="Shadow color"
            color={shadowColor}
            open={open === "shadow"}
            dimmed={!shadowOn}
            onToggle={() => setOpen((v) => (v === "shadow" ? null : "shadow"))}
          />
          <span className="mx-0.5 h-4 w-px bg-black/8" aria-hidden />
          <OnOff
            label="Border"
            groupLabel="Border on or off"
            on={borderOn}
            onChange={(next) => onPatch({ border: next })}
          />
          <ColorBtn
            label="Border color"
            color={borderColor}
            open={open === "border"}
            dimmed={!borderOn}
            onToggle={() => setOpen((v) => (v === "border" ? null : "border"))}
          />
          <StepperField
            label="Thickness"
            value={borderWidth}
            min={1}
            max={IMAGE_BORDER_WIDTH_MAX}
            disabled={!borderOn}
            ariaLabel="Border thickness"
            onChange={(next) => onPatch({ borderWidth: next, border: true })}
          />
          <span className="mx-0.5 h-4 w-px bg-black/8" aria-hidden />
          <button
            type="button"
            title="Delete"
            aria-label="Delete"
            onClick={onRemove}
            className="inline-flex size-8 items-center justify-center rounded-sm text-[#6b6f76] transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="size-3.5" />
          </button>

          {open === "image" ? (
            <ImagePopover
              src={block.src}
              onPatch={onPatch}
              onUploadImage={onUploadImage}
              onClose={() => setOpen(null)}
            />
          ) : null}

          {open === "shape" ? (
            <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-[252px] rounded border border-black/8 bg-white p-2 shadow-[0_10px_36px_-16px_rgba(8,9,10,0.35)]">
              <p className="mb-1.5 px-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[#8a8f98]">
                Shape
              </p>
              <div className="grid grid-cols-6 gap-1">
                <button
                  type="button"
                  title="Normal"
                  aria-label="Normal"
                  aria-pressed={shape == null}
                  onClick={() => {
                    onPatch(normalShapePatch(beforeShapeById.get(block.id) ?? null));
                    setOpen(null);
                  }}
                  className={cn(
                    "inline-flex h-9 items-center justify-center rounded-sm transition-colors",
                    shape == null
                      ? "bg-black/[0.08] text-[#08090a]"
                      : "text-[#6b6f76] hover:bg-black/[0.04] hover:text-[#08090a]",
                  )}
                >
                  <ShapeGlyph shape={null} className="size-4" />
                </button>
                {IMAGE_SHAPE_OPTIONS.map((option) => {
                  const active = shape === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      title={option.label}
                      aria-label={option.label}
                      aria-pressed={active}
                      onClick={() => {
                        if (shape == null) {
                          beforeShapeById.set(block.id, snapshotNormalFrame(block));
                        }
                        onPatch(shapePatch(option.id, anchorRef.current));
                        setOpen(null);
                      }}
                      className={cn(
                        "inline-flex h-9 items-center justify-center rounded-sm transition-colors",
                        active
                          ? "bg-black/[0.08] text-[#08090a]"
                          : "text-[#6b6f76] hover:bg-black/[0.04] hover:text-[#08090a]",
                      )}
                    >
                      <ShapeGlyph shape={option.id} className="size-4" />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {open === "shadow" || open === "border" ? (
            <div className="absolute left-1/2 top-[calc(100%+6px)] z-30 -translate-x-1/2 rounded border border-black/8 bg-white p-2 shadow-[0_10px_36px_-16px_rgba(8,9,10,0.35)]">
              <ColorPalette
                usedColors={emailColors}
                general={swatches}
                activeColor={open === "shadow" ? shadowColor : borderColor}
                mode="fill"
                onPick={(hex) => {
                  if (open === "shadow") {
                    onPatch({ shadowColor: hex, shadow: true });
                  } else {
                    onPatch({ borderColor: hex, border: true });
                  }
                  setOpen(null);
                }}
                showCustom
                customValue={toHex6(
                  open === "shadow" ? shadowColor : borderColor,
                )}
                onCustom={(hex) => {
                  if (open === "shadow") {
                    onPatch({ shadowColor: hex, shadow: true });
                  } else {
                    onPatch({ borderColor: hex, border: true });
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

function ImagePopover({
  src,
  onPatch,
  onUploadImage,
  onClose,
}: {
  src: string;
  onPatch: (patch: Partial<ImageBlock>) => void;
  onUploadImage?: (file: File) => Promise<string>;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      assertEmailImageFile(file);
      setUploading(true);
      const next = onUploadImage
        ? await onUploadImage(file)
        : await readFileAsDataUrl(file);
      onPatch({ src: next, align: "left" });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that image");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-[240px] rounded border border-black/8 bg-white p-2 shadow-[0_10px_36px_-16px_rgba(8,9,10,0.35)]">
      <p className="mb-1.5 px-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[#8a8f98]">
        Image
      </p>
      {src.trim() ? (
        <div className="mb-2 overflow-hidden rounded-sm border border-black/8">
          <img src={src} alt="" className="h-16 w-full object-cover" />
        </div>
      ) : null}
      <input
        ref={fileRef}
        type="file"
        accept={EMAIL_IMAGE_ACCEPT}
        className="hidden"
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          void applyFile(e.target.files?.[0])
        }
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        className="inline-flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-sm border border-black/10 bg-white px-2 text-[12px] font-semibold text-[#08090a] transition-colors hover:bg-black/[0.04] disabled:cursor-wait disabled:opacity-60"
      >
        <Upload className="size-3.5" />
        {uploading ? "Uploading…" : "Upload image"}
      </button>
      <label className="mt-2 block space-y-1 px-0.5">
        <span className="text-[11px] text-[#6b6f76]">Or paste a URL</span>
        <input
          type="url"
          value={src}
          onChange={(e) => {
            setError(null);
            onPatch({ src: e.target.value, align: "left" });
          }}
          placeholder="https://…"
          className="h-8 w-full rounded-sm border border-black/10 bg-white px-2 text-[12px] text-[#08090a] outline-none focus:border-black/25"
        />
      </label>
      {error ? (
        <p className="mt-1.5 px-0.5 text-[11px] leading-relaxed text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function OnOff({
  label,
  groupLabel,
  on,
  onChange,
}: {
  label: string;
  groupLabel: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="inline-flex h-8 items-center gap-1.5 px-1.5">
      <span className="text-[12px] font-medium tracking-tight text-[#3a3d42]">
        {label}
      </span>
      <div
        role="group"
        aria-label={groupLabel}
        className="inline-flex h-6 rounded-sm border border-black/10 bg-black/[0.04] p-0.5"
      >
        <button
          type="button"
          aria-pressed={on}
          onClick={() => onChange(true)}
          className={cn(
            "h-full rounded-[3px] px-2 text-[11px] font-semibold tracking-tight transition-colors",
            on
              ? "bg-[#08090a] text-white"
              : "text-[#8a8f98] hover:text-[#08090a]",
          )}
        >
          On
        </button>
        <button
          type="button"
          aria-pressed={!on}
          onClick={() => onChange(false)}
          className={cn(
            "h-full rounded-[3px] px-2 text-[11px] font-semibold tracking-tight transition-colors",
            !on
              ? "bg-[#08090a] text-white"
              : "text-[#8a8f98] hover:text-[#08090a]",
          )}
        >
          Off
        </button>
      </div>
    </div>
  );
}

function ColorBtn({
  label,
  color,
  open,
  dimmed,
  onToggle,
}: {
  label: string;
  color: string;
  open: boolean;
  dimmed?: boolean;
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
        dimmed && !open && "opacity-45",
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
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
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

function useLayoutPos(
  anchorRef: RefObject<HTMLElement | null>,
  setPos: (pos: { left: number; top: number }) => void,
) {
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
  }, [anchorRef, setPos]);
}

function snapshotNormalFrame(block: ImageBlock): Partial<ImageBlock> {
  return {
    width: block.width,
    heightPx: block.heightPx,
    cropTop: block.cropTop,
    cropBottom: block.cropBottom,
    cropLeft: block.cropLeft,
    cropRight: block.cropRight,
    offsetX: block.offsetX,
    radius: block.radius ?? IMAGE_RADIUS_DEFAULT,
  };
}

function normalShapePatch(prev: Partial<ImageBlock> | null): Partial<ImageBlock> {
  if (!prev) {
    return { shape: undefined, radius: IMAGE_RADIUS_DEFAULT };
  }
  return {
    shape: undefined,
    radius: prev.radius ?? IMAGE_RADIUS_DEFAULT,
    width: prev.width,
    heightPx: prev.heightPx,
    cropTop: prev.cropTop ?? 0,
    cropBottom: prev.cropBottom ?? 0,
    cropLeft: prev.cropLeft ?? 0,
    cropRight: prev.cropRight ?? 0,
    offsetX: prev.offsetX,
  };
}

function shapePatch(
  next: ImageShape,
  anchor: HTMLElement | null,
): Partial<ImageBlock> {
  const sized =
    next === "square" || next === "circle"
      ? squareSizeFromAnchor(anchor)
      : {};
  if (next === "circle" || next === "pill") {
    return { shape: next, radius: 9999, ...sized };
  }
  return { shape: next, radius: 0, ...sized };
}

function squareSizeFromAnchor(
  anchor: HTMLElement | null,
): Partial<ImageBlock> {
  const box = anchor?.getBoundingClientRect();
  const parent = anchor?.parentElement?.getBoundingClientRect();
  if (!box || !parent || parent.width < 1) return {};
  const side = Math.min(box.width, box.height);
  const width = Math.max(20, Math.min(100, (side / parent.width) * 100));
  return { width, cropLeft: 0, cropRight: 0 };
}

function ShapeGlyph({
  shape,
  className,
}: {
  shape: ImageShape | null;
  className?: string;
}) {
  if (shape === "circle") return <Circle className={className} />;
  if (shape === "star") return <Star className={className} />;
  if (shape === "triangle") return <Triangle className={className} />;
  if (shape === "pill") {
    return (
      <svg
        viewBox="0 0 16 16"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden
      >
        <rect x="2" y="4.5" width="12" height="7" rx="3.5" />
      </svg>
    );
  }
  if (shape === "square") return <Square className={className} />;
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <rect x="2.5" y="4" width="11" height="8" rx="2" />
    </svg>
  );
}

function toHex6(hex: string): string {
  const raw = hex.trim();
  const m = raw.match(/^#([0-9a-f]{3})$/i);
  if (m?.[1]) {
    const [a, b, c] = m[1];
    if (a && b && c) return `#${a}${a}${b}${b}${c}${c}`.toLowerCase();
  }
  return /^#([0-9a-f]{6})$/i.test(raw) ? raw.toLowerCase() : "#000000";
}
