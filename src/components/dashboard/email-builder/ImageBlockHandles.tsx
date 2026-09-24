import {
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  IMAGE_CROP_HEIGHT_MAX,
  IMAGE_CROP_HEIGHT_MIN,
  IMAGE_CROP_PCT_MAX,
  IMAGE_VISIBLE_MIN,
  alignFromOffsetX,
  clamp,
  imageFitSwitchPatch,
  imageOffsetMarginPct,
  imageLocksAspect,
  imagePillRadius,
  imageShowsCornerHandles,
  resolveImageFit,
  resolveImageLayout,
  resolveImageOffsetX,
  resolveImagePanX,
  type ImageBlock,
  type ImageFit,
} from "@/lib/emailBuilder";
import { cn } from "@/lib/utils";

type Corner = "tl" | "tr" | "br" | "bl";
type Edge = "t" | "b" | "l" | "r";
type Handle = Corner | Edge | "pan";

const CORNERS: Corner[] = ["tl", "tr", "br", "bl"];
const EDGES: Edge[] = ["t", "b", "l", "r"];
const FRAME_PAD = 3;
const PAIR_HOLD_MS = 2000;
const PAIR_MOVE_SLACK = 6;
const FIT_TOGGLE_MIN_W = 140;
const CENTER_SNAP_IN_PX = 14;
const CENTER_SNAP_OUT_PX = 26;
const CENTER_GAP_PX = 2;
const MOVE_MIN_LEFTOVER = 8;

type Props = {
  block: ImageBlock;
  anchorRef: RefObject<HTMLElement | null>;
  onPatch: (patch: Partial<ImageBlock>) => void;
};

export default function ImageBlockHandles({
  block,
  anchorRef,
  onPatch,
}: Props) {
  const [box, setBox] = useState<DOMRect | null>(null);
  const [column, setColumn] = useState<DOMRect | null>(null);
  const [drag, setDrag] = useState<Handle | null>(null);
  const [linked, setLinked] = useState(false);
  const layout = resolveImageLayout(block);
  const onPatchRef = useRef(onPatch);
  onPatchRef.current = onPatch;
  const linkedRef = useRef(false);
  linkedRef.current = linked;
  const shapeRef = useRef(layout.shape);
  shapeRef.current = layout.shape;
  const fitRef = useRef(resolveImageFit(block));
  fitRef.current = resolveImageFit(block);
  const dragRef = useRef<Handle | null>(null);
  dragRef.current = drag;
  const pairArmedRef = useRef(false);
  const pairTimerRef = useRef<number | null>(null);
  const pendingPatch = useRef<Partial<ImageBlock> | null>(null);
  const centerLockedRef = useRef(false);
  const start = useRef({
    x: 0,
    y: 0,
    radius: layout.radius,
    cropTop: layout.cropTop,
    cropBottom: layout.cropBottom,
    cropLeft: layout.cropLeft,
    cropRight: layout.cropRight,
    widthPct: layout.widthPct,
    visibleWidthPct: layout.visibleWidthPct,
    visW: 0,
    visH: 0,
    parentW: 0,
    boxLeft: 0,
    boxTop: 0,
    panX: resolveImagePanX(block),
    offsetX: resolveImageOffsetX(block),
  });

  useLayoutEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const update = () => {
      if (dragRef.current) return;
      setBox(el.getBoundingClientRect());
      const col = el.closest("[data-email-column]");
      if (col instanceof HTMLElement) {
        setColumn(col.getBoundingClientRect());
      }
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
  }, [anchorRef, layout.radius, layout.shape, layout.visibleHeight, layout.visibleWidthPct]);

  useLayoutEffect(() => {
    return () => clearPairTimer(pairTimerRef);
  }, []);

  useLayoutEffect(() => {
    if (drag) return;
    const el = anchorRef.current;
    clearLiveStyles(el);
    if (el) setBox(el.getBoundingClientRect());
  }, [anchorRef, drag, block.offsetX]);

  useLayoutEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const dx = e.clientX - start.current.x;
      const dy = e.clientY - start.current.y;

      if (pairArmedRef.current) {
        if (Math.hypot(dx, dy) <= PAIR_MOVE_SLACK) return;
        pairArmedRef.current = false;
        clearPairTimer(pairTimerRef);
      }

      if (drag === "pan") {
        applyPanDrag(
          anchorRef.current,
          start.current,
          dx,
          fitRef.current,
          pendingPatch,
          centerLockedRef,
        );
        const el = anchorRef.current;
        if (el) {
          setBox(el.getBoundingClientRect());
          const col = el.closest("[data-email-column]");
          if (col instanceof HTMLElement) {
            setColumn(col.getBoundingClientRect());
          }
        }
        return;
      }

      if (isCorner(drag)) {
        const max = imagePillRadius(rect.width, rect.height);
        const next = Math.max(
          0,
          Math.min(
            max,
            Math.round(start.current.radius + inwardDelta(drag, dx, dy)),
          ),
        );
        onPatchRef.current({ radius: next, align: "left" });
        paintHandleBox(anchorRef.current, setBox, setColumn);
        return;
      }

      const uncroppedH = Math.max(
        IMAGE_VISIBLE_MIN,
        start.current.visH + start.current.cropTop + start.current.cropBottom,
      );
      const visibleFrac = Math.max(
        0.2,
        1 - start.current.cropLeft / 100 - start.current.cropRight / 100,
      );
      const uncroppedW = start.current.visW / visibleFrac;

      if (linkedRef.current) {
        if (drag === "t" || drag === "b") {
          const inward = drag === "t" ? dy : -dy;
          const next = pairedInsets(
            start.current.cropTop,
            start.current.cropBottom,
            inward,
            uncroppedH - IMAGE_VISIBLE_MIN,
          );
          onPatchRef.current({
            cropTop: next.leading,
            cropBottom: next.trailing,
            align: "left",
          });
          return;
        }
        const inwardPct = ((drag === "l" ? dx : -dx) / uncroppedW) * 100;
        const next = pairedInsets(
          start.current.cropLeft,
          start.current.cropRight,
          inwardPct,
          IMAGE_CROP_PCT_MAX,
        );
        onPatchRef.current({
          cropLeft: next.leading,
          cropRight: next.trailing,
          align: "left",
        });
        return;
      }

      if (
        imageLocksAspect(shapeRef.current) &&
        (drag === "t" || drag === "b")
      ) {
        const inward = drag === "t" ? dy : -dy;
        const parentW =
          start.current.visibleWidthPct > 0
            ? start.current.visW / (start.current.visibleWidthPct / 100)
            : start.current.visW;
        const nextVis = Math.max(
          IMAGE_VISIBLE_MIN,
          Math.min(parentW, start.current.visW - inward),
        );
        const nextPct = clampCrop((nextVis / parentW) * 100, 20, 100);
        onPatchRef.current({
          width: nextPct,
          cropLeft: 0,
          cropRight: 0,
          align: "left",
        });
        return;
      }

      // Adjust: edges resize the frame. Width and height stay independent.
      if (shapeRef.current == null && fitRef.current !== "stretch") {
        const parentW =
          start.current.parentW > 0
            ? start.current.parentW
            : start.current.visibleWidthPct > 0
              ? start.current.visW / (start.current.visibleWidthPct / 100)
              : start.current.visW;
        if (drag === "t" || drag === "b") {
          const inward = drag === "t" ? dy : -dy;
          const nextH = clamp(
            Math.round(start.current.visH - inward),
            IMAGE_CROP_HEIGHT_MIN,
            IMAGE_CROP_HEIGHT_MAX,
          );
          const elLive = anchorRef.current;
          if (elLive) elLive.style.height = `${nextH}px`;
          onPatchRef.current({
            heightPx: nextH,
            cropTop: 0,
            cropBottom: 0,
            align: "left",
          });
          setBox(
            new DOMRect(
              start.current.boxLeft,
              start.current.boxTop,
              start.current.visW,
              nextH,
            ),
          );
          return;
        }
        const sized = resizeWidthFromEdge(
          drag === "l" ? "l" : "r",
          dx,
          start.current.visW,
          parentW,
          start.current.offsetX,
        );
        const elLive = anchorRef.current;
        if (elLive) {
          elLive.style.width = `${sized.nextPct}%`;
          elLive.style.marginLeft = `${imageOffsetMarginPct(sized.nextPct, sized.offsetX)}%`;
        }
        onPatchRef.current({
          width: sized.nextPct,
          offsetX: sized.offsetX,
          cropLeft: 0,
          cropRight: 0,
          align: alignFromOffsetX(sized.offsetX),
        });
        setBox(
          new DOMRect(
            start.current.boxLeft + (sized.left - sized.startLeft),
            start.current.boxTop,
            sized.nextW,
            start.current.visH,
          ),
        );
        return;
      }

      if (drag === "t") {
        const cropTop = clampCrop(
          start.current.cropTop + dy,
          0,
          uncroppedH - IMAGE_VISIBLE_MIN - start.current.cropBottom,
        );
        onPatchRef.current({ cropTop: Math.round(cropTop), align: "left" });
        return;
      }
      if (drag === "b") {
        const cropBottom = clampCrop(
          start.current.cropBottom - dy,
          0,
          uncroppedH - IMAGE_VISIBLE_MIN - start.current.cropTop,
        );
        onPatchRef.current({ cropBottom: Math.round(cropBottom), align: "left" });
        return;
      }
      if (drag === "l") {
        const cropLeft = clampCrop(
          start.current.cropLeft + (dx / uncroppedW) * 100,
          0,
          IMAGE_CROP_PCT_MAX - start.current.cropRight,
        );
        onPatchRef.current({ cropLeft, align: "left" });
        return;
      }
      const cropRight = clampCrop(
        start.current.cropRight - (dx / uncroppedW) * 100,
        0,
        IMAGE_CROP_PCT_MAX - start.current.cropLeft,
      );
      onPatchRef.current({ cropRight, align: "left" });
    };
    const onUp = () => {
      clearPairTimer(pairTimerRef);
      pairArmedRef.current = false;
      if (pendingPatch.current) {
        onPatchRef.current(pendingPatch.current);
        pendingPatch.current = null;
      }
      setLinked(false);
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [anchorRef, drag]);

  if (!box) return null;

  const showCorners = imageShowsCornerHandles(layout.shape);
  const fit = resolveImageFit(block);
  const showFitToggle = !drag && box.width >= FIT_TOGGLE_MIN_W;
  const canAlign =
    column != null && box.width + MOVE_MIN_LEFTOVER < column.width;
  const centered = Boolean(
    column &&
      canAlign &&
      Math.abs(box.left - column.left - (column.right - box.right)) <=
        CENTER_GAP_PX,
  );

  const frame = {
    left: box.left - FRAME_PAD,
    top: box.top - FRAME_PAD,
    width: box.width + FRAME_PAD * 2,
    height: box.height + FRAME_PAD * 2,
  };

  const begin = (handle: Handle, e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const el = anchorRef.current;
    const rect = el?.getBoundingClientRect();
    start.current = {
      x: e.clientX,
      y: e.clientY,
      radius: layout.radius,
      cropTop: layout.cropTop,
      cropBottom: layout.cropBottom,
      cropLeft: layout.cropLeft,
      cropRight: layout.cropRight,
      widthPct: layout.widthPct,
      visibleWidthPct: layout.visibleWidthPct,
      visW: rect?.width ?? box.width,
      visH: rect?.height ?? box.height,
      parentW: el?.parentElement?.getBoundingClientRect().width ?? rect?.width ?? box.width,
      boxLeft: rect?.left ?? box.left,
      boxTop: rect?.top ?? box.top,
      panX: resolveImagePanX(block),
      offsetX: resolveImageOffsetX(block),
    };
    pendingPatch.current = null;
    centerLockedRef.current =
      Math.abs(resolveImageOffsetX(block) - 50) <= 2.5 ||
      Math.abs(layout.cropLeft - layout.cropRight) < 0.4;
    clearPairTimer(pairTimerRef);
    linkedRef.current = false;
    setLinked(false);
    pairArmedRef.current = isEdge(handle);
    if (isEdge(handle)) {
      pairTimerRef.current = window.setTimeout(() => {
        if (!pairArmedRef.current) return;
        pairArmedRef.current = false;
        linkedRef.current = true;
        setLinked(true);
      }, PAIR_HOLD_MS);
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
    setDrag(handle);
  };

  return createPortal(
    <>
      {drag == null || drag === "pan" ? (
        <div
          data-image-handle=""
          role="slider"
          aria-label="Move image left or right"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(resolveImagePanX(block))}
          className="pointer-events-auto fixed z-[73] cursor-ew-resize touch-none"
          style={{
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
            borderRadius: layout.radius,
            cursor: "ew-resize",
          }}
          onPointerDown={(e) => begin("pan", e)}
        />
      ) : null}
      <div
        className="pointer-events-none fixed z-[74] border-2 border-[#2563eb]"
        style={{
          left: frame.left,
          top: frame.top,
          width: frame.width,
          height: frame.height,
          borderRadius: Math.max(0, layout.radius + FRAME_PAD),
          willChange: drag ? "left, top, width, height" : undefined,
        }}
      />
      {drag === "pan" && column && box.width + MOVE_MIN_LEFTOVER < column.width ? (
        <AlignmentGuides box={box} column={column} />
      ) : null}
      <svg
        className="pointer-events-none fixed inset-0 z-[74]"
        width="100%"
        height="100%"
      >
        {CORNERS.map((corner) => {
          if (!showCorners || layout.radius < 1) return null;
          if (drag && drag !== corner) return null;
          const from = squareCorner(corner, frame);
          const to = arcPoint(corner, box, layout.radius);
          return (
            <line
              key={corner}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#2563eb"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      {showFitToggle ? (
        <FitToggle
          fit={fit}
          left={box.left + box.width / 2}
          top={box.top + box.height / 2}
          onChange={(next) => onPatch(imageFitSwitchPatch(block, next))}
        />
      ) : null}
      {CORNERS.map((corner) => {
        if (!showCorners) return null;
        if (drag && drag !== corner) return null;
        const pos = arcPoint(corner, box, layout.radius);
        return (
          <Dot
            key={corner}
            label={`Round image from the ${cornerLabel(corner)}`}
            pos={pos}
            active={drag === corner}
            cursor={cornerCursor(corner)}
            onPointerDown={(e) => begin(corner, e)}
          />
        );
      })}
      {EDGES.map((edge) => {
        if (drag && isCorner(drag)) return null;
        if (
          drag &&
          isEdge(drag) &&
          edge !== drag &&
          !(linked && edge === oppositeEdge(drag))
        ) {
          return null;
        }
        return (
          <Dot
            key={edge}
            label={edgeLabel(edge, layout.shape == null && fit !== "stretch")}
            pos={edgePoint(edge, box)}
            active={drag === edge || (linked && drag != null && isEdge(drag) && edge === oppositeEdge(drag))}
            cursor={edge === "t" || edge === "b" ? "ns-resize" : "ew-resize"}
            aligned={
              drag === "pan" && centered && (edge === "l" || edge === "r")
            }
            onPointerDown={(e) => begin(edge, e)}
          />
        );
      })}
    </>,
    document.body,
  );
}

function FitToggle({
  fit,
  left,
  top,
  onChange,
}: {
  fit: ImageFit;
  left: number;
  top: number;
  onChange: (next: ImageFit) => void;
}) {
  return (
    <div
      data-image-handle=""
      role="group"
      aria-label="Image fit"
      className="pointer-events-auto fixed z-[77] inline-flex h-7 rounded-sm border border-black/10 bg-white p-0.5 shadow-[0_10px_36px_-16px_rgba(8,9,10,0.35)]"
      style={{
        left,
        top,
        transform: "translate(-50%, -50%)",
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-pressed={fit === "adjust"}
        onClick={() => onChange("adjust")}
        className={cn(
          "h-full rounded-[3px] px-2.5 text-[11px] font-semibold tracking-tight transition-colors",
          fit === "adjust"
            ? "bg-[#08090a] text-white"
            : "text-[#8a8f98] hover:text-[#08090a]",
        )}
      >
        Adjust
      </button>
      <button
        type="button"
        aria-pressed={fit === "stretch"}
        onClick={() => onChange("stretch")}
        className={cn(
          "h-full rounded-[3px] px-2.5 text-[11px] font-semibold tracking-tight transition-colors",
          fit === "stretch"
            ? "bg-[#08090a] text-white"
            : "text-[#8a8f98] hover:text-[#08090a]",
        )}
      >
        Stretch
      </button>
    </div>
  );
}

function Dot({
  label,
  pos,
  active,
  cursor,
  aligned,
  onPointerDown,
}: {
  label: string;
  pos: { x: number; y: number };
  active: boolean;
  cursor: string;
  aligned?: boolean;
  onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  const size = active ? 7 : 10;
  return (
    <button
      type="button"
      aria-label={label}
      data-image-handle=""
      className={cn(
        "pointer-events-auto fixed z-[75] cursor-pointer rounded-full border-2",
        aligned
          ? "border-[#86efac] bg-[#16a34a] shadow-[0_4px_12px_-6px_rgba(22,163,74,0.45)]"
          : "border-[#93c5fd] bg-[#2563eb] shadow-[0_4px_12px_-6px_rgba(37,99,235,0.45)]",
      )}
      style={{
        left: pos.x,
        top: pos.y,
        width: size,
        height: size,
        transform: "translate(-50%, -50%)",
        cursor,
        transition: active
          ? "width 120ms ease, height 120ms ease, background-color 120ms ease, border-color 120ms ease"
          : "width 160ms ease, height 160ms ease, background-color 160ms ease, border-color 160ms ease",
      }}
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function clampCrop(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n * 10) / 10));
}

type PanStart = {
  cropLeft: number;
  cropRight: number;
  visW: number;
  parentW: number;
  boxLeft: number;
  boxTop: number;
  widthPct: number;
  panX: number;
  offsetX: number;
};

/** Keep the opposite edge fixed while the dragged edge changes width. */
function resizeWidthFromEdge(
  edge: "l" | "r",
  dx: number,
  visW: number,
  parentW: number,
  offsetX: number,
): {
  nextPct: number;
  nextW: number;
  offsetX: number;
  left: number;
  startLeft: number;
} {
  const minW = parentW * 0.2;
  const leftover0 = Math.max(0, parentW - visW);
  const startLeft = leftover0 * (clamp(offsetX, 0, 100) / 100);
  const startRight = startLeft + visW;
  let left = startLeft;
  let right = startRight;
  if (edge === "l") {
    left = startLeft + dx;
    if (right - left < minW) left = right - minW;
    if (left < 0) {
      right = Math.min(parentW, right - left);
      left = 0;
    }
  } else {
    right = startRight + dx;
    if (right - left < minW) right = left + minW;
    if (right > parentW) {
      left = Math.max(0, left - (right - parentW));
      right = parentW;
    }
  }
  if (left < 0) left = 0;
  if (right > parentW) right = parentW;
  const nextW = clamp(right - left, minW, parentW);
  left = clamp(left, 0, parentW - nextW);
  const leftover = Math.max(0, parentW - nextW);
  let nextOffset = leftover < 1 ? 0 : (left / leftover) * 100;
  if (leftover >= MOVE_MIN_LEFTOVER && Math.abs(nextOffset - 50) <= 2.5) {
    nextOffset = 50;
  }
  nextOffset = clamp(Math.round(nextOffset * 10) / 10, 0, 100);
  return {
    nextPct: clamp((nextW / parentW) * 100, 20, 100),
    nextW,
    offsetX: nextOffset,
    left,
    startLeft,
  };
}

function snapToCenter(
  raw: number,
  center: number,
  unitPx: number,
  locked: { current: boolean },
): number {
  const distPx = Math.abs(raw - center) * unitPx;
  if (locked.current) {
    if (distPx > CENTER_SNAP_OUT_PX) {
      locked.current = false;
      return raw;
    }
    return center;
  }
  if (distPx <= CENTER_SNAP_IN_PX) {
    locked.current = true;
    return center;
  }
  return raw;
}

function applyPanDrag(
  wrap: HTMLElement | null,
  start: PanStart,
  dx: number,
  fit: ImageFit,
  pending: { current: Partial<ImageBlock> | null },
  centerLocked: { current: boolean },
) {
  if (!wrap) return;
  const img = wrap.querySelector("img");

  if (fit === "stretch") {
    const slack = start.cropLeft + start.cropRight;
    const visibleFrac = Math.max(
      0.2,
      1 - start.cropLeft / 100 - start.cropRight / 100,
    );
    const uncroppedW = start.visW / visibleFrac;
    if (slack > 0.2) {
      const nextLeft = clampCrop(
        snapToCenter(
          start.cropLeft + (dx / Math.max(uncroppedW, 1)) * 100,
          slack / 2,
          uncroppedW / 100,
          centerLocked,
        ),
        0,
        slack,
      );
      const nextRight = slack - nextLeft;
      const nextFrac = Math.max(0.2, 1 - nextLeft / 100 - nextRight / 100);
      wrap.style.marginLeft = `${(nextLeft * start.widthPct) / 100}%`;
      wrap.style.width = `${start.widthPct * nextFrac}%`;
      if (img) {
        img.style.left = `${-(nextLeft / nextFrac)}%`;
        img.style.width = `${100 / nextFrac}%`;
      }
      pending.current = {
        cropLeft: nextLeft,
        cropRight: nextRight,
        align: "left",
      };
      return;
    }
  }

  const leftoverPx = Math.max(0, start.parentW - start.visW);
  if (leftoverPx >= MOVE_MIN_LEFTOVER) {
    let next = snapToCenter(
      start.offsetX + (dx / leftoverPx) * 100,
      50,
      leftoverPx / 100,
      centerLocked,
    );
    next = clamp(Math.round(next * 10) / 10, 0, 100);
    const applied = leftoverPx * ((next - start.offsetX) / 100);
    wrap.style.willChange = "transform";
    wrap.style.transform = `translate3d(${applied}px,0,0)`;
    pending.current = {
      offsetX: next,
      align: alignFromOffsetX(next),
    };
    return;
  }

  const nextPan = clamp(
    start.panX - (dx / Math.max(start.visW, 1)) * 100,
    0,
    100,
  );
  if (img) img.style.objectPosition = `${nextPan}% center`;
  pending.current = { panX: nextPan };
}

function clearLiveStyles(wrap: HTMLElement | null) {
  if (!wrap) return;
  wrap.style.transform = "";
  wrap.style.willChange = "";
}

function paintHandleBox(
  wrap: HTMLElement | null,
  setBox: (box: DOMRect) => void,
  setColumn: (box: DOMRect) => void,
) {
  if (!wrap) return;
  setBox(wrap.getBoundingClientRect());
  const col = wrap.closest("[data-email-column]");
  if (col instanceof HTMLElement) {
    setColumn(col.getBoundingClientRect());
  }
}

function AlignmentGuides({
  box,
  column,
}: {
  box: DOMRect;
  column: DOMRect;
}) {
  const leftGap = box.left - column.left;
  const rightGap = column.right - box.right;
  if (leftGap < 1 && rightGap < 1) return null;
  const centered = Math.abs(leftGap - rightGap) <= CENTER_GAP_PX;
  const stroke = centered ? "#16a34a" : "#2563eb";
  const midY = box.top + box.height / 2;
  return (
    <svg
      className="pointer-events-none fixed inset-0 z-[74]"
      width="100%"
      height="100%"
      aria-hidden
    >
      {leftGap > 1 ? (
        <line
          x1={column.left}
          y1={midY}
          x2={box.left}
          y2={midY}
          stroke={stroke}
          strokeWidth="1.25"
          strokeDasharray="5 4"
          strokeLinecap="round"
        />
      ) : null}
      {rightGap > 1 ? (
        <line
          x1={box.right}
          y1={midY}
          x2={column.right}
          y2={midY}
          stroke={stroke}
          strokeWidth="1.25"
          strokeDasharray="5 4"
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}

/** Move both opposite insets together. Positive delta crops inward on both sides. */
function pairedInsets(
  leading: number,
  trailing: number,
  delta: number,
  maxSum: number,
): { leading: number; trailing: number } {
  const maxIn = Math.max(0, maxSum - leading - trailing);
  const maxOut = Math.min(leading, trailing);
  const applied = Math.max(-maxOut, Math.min(maxIn, delta));
  return {
    leading: clampCrop(leading + applied, 0, maxSum),
    trailing: clampCrop(trailing + applied, 0, maxSum),
  };
}

function clearPairTimer(ref: { current: number | null }) {
  if (ref.current == null) return;
  window.clearTimeout(ref.current);
  ref.current = null;
}

function isCorner(handle: Handle): handle is Corner {
  return handle === "tl" || handle === "tr" || handle === "br" || handle === "bl";
}

function isEdge(handle: Handle): handle is Edge {
  return handle === "t" || handle === "b" || handle === "l" || handle === "r";
}

function oppositeEdge(edge: Edge): Edge {
  switch (edge) {
    case "t":
      return "b";
    case "b":
      return "t";
    case "l":
      return "r";
    case "r":
      return "l";
    default: {
      const _never: never = edge;
      return _never;
    }
  }
}

function squareCorner(
  corner: Corner,
  frame: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  switch (corner) {
    case "tl":
      return { x: frame.left, y: frame.top };
    case "tr":
      return { x: frame.left + frame.width, y: frame.top };
    case "br":
      return { x: frame.left + frame.width, y: frame.top + frame.height };
    case "bl":
      return { x: frame.left, y: frame.top + frame.height };
    default: {
      const _never: never = corner;
      return _never;
    }
  }
}

function arcPoint(corner: Corner, box: DOMRect, radius: number): { x: number; y: number } {
  const o = Math.max(0, radius) * (1 - Math.SQRT1_2);
  switch (corner) {
    case "tl":
      return { x: box.left + o, y: box.top + o };
    case "tr":
      return { x: box.right - o, y: box.top + o };
    case "br":
      return { x: box.right - o, y: box.bottom - o };
    case "bl":
      return { x: box.left + o, y: box.bottom - o };
    default: {
      const _never: never = corner;
      return _never;
    }
  }
}

function edgePoint(edge: Edge, box: DOMRect): { x: number; y: number } {
  switch (edge) {
    case "t":
      return { x: box.left + box.width / 2, y: box.top };
    case "b":
      return { x: box.left + box.width / 2, y: box.bottom };
    case "l":
      return { x: box.left, y: box.top + box.height / 2 };
    case "r":
      return { x: box.right, y: box.top + box.height / 2 };
    default: {
      const _never: never = edge;
      return _never;
    }
  }
}

function inwardDelta(corner: Corner, dx: number, dy: number): number {
  switch (corner) {
    case "tl":
      return (dx + dy) / 2;
    case "tr":
      return (-dx + dy) / 2;
    case "br":
      return (-dx - dy) / 2;
    case "bl":
      return (dx - dy) / 2;
    default: {
      const _never: never = corner;
      return _never;
    }
  }
}

function cornerCursor(corner: Corner): string {
  return corner === "tl" || corner === "br" ? "nwse-resize" : "nesw-resize";
}

function cornerLabel(corner: Corner): string {
  switch (corner) {
    case "tl":
      return "top left";
    case "tr":
      return "top right";
    case "br":
      return "bottom right";
    case "bl":
      return "bottom left";
    default: {
      const _never: never = corner;
      return _never;
    }
  }
}

function edgeLabel(edge: Edge, resize: boolean): string {
  const verb = resize ? "Resize" : "Crop";
  switch (edge) {
    case "t":
      return `${verb} image from the top`;
    case "b":
      return `${verb} image from the bottom`;
    case "l":
      return `${verb} image from the left`;
    case "r":
      return `${verb} image from the right`;
    default: {
      const _never: never = edge;
      return _never;
    }
  }
}
