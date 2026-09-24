import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { SHELL_RADIUS_MAX } from "@/lib/emailBuilder";

type Corner = "tl" | "tr" | "br" | "bl";

const CORNERS: Corner[] = ["tl", "tr", "br", "bl"];
/** Gap so the blue square sits around the template border. */
const FRAME_PAD = 3;

type Props = {
  radius: number;
  anchorRef: RefObject<HTMLElement | null>;
  onChange: (radius: number) => void;
};

export default function EmailShellRadiusHandles({
  radius,
  anchorRef,
  onChange,
}: Props) {
  const [box, setBox] = useState<DOMRect | null>(null);
  const [drag, setDrag] = useState<Corner | null>(null);
  const start = useRef({ radius: 0, x: 0, y: 0 });

  useLayoutEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const update = () => setBox(el.getBoundingClientRect());
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
  }, [anchorRef, radius, drag]);

  useLayoutEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const max = Math.min(
        SHELL_RADIUS_MAX,
        Math.floor(Math.min(rect.width, rect.height) / 2),
      );
      const dx = e.clientX - start.current.x;
      const dy = e.clientY - start.current.y;
      onChange(
        Math.max(
          0,
          Math.min(max, Math.round(start.current.radius + inwardDelta(drag, dx, dy))),
        ),
      );
    };
    const onUp = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [anchorRef, drag, onChange]);

  if (!box) return null;

  const frame = {
    left: box.left - FRAME_PAD,
    top: box.top - FRAME_PAD,
    width: box.width + FRAME_PAD * 2,
    height: box.height + FRAME_PAD * 2,
  };

  return createPortal(
    <>
      <div
        className="pointer-events-none fixed z-[74] border-2 border-[#2563eb]"
        style={{
          left: frame.left,
          top: frame.top,
          width: frame.width,
          height: frame.height,
          borderRadius: 0,
        }}
      />
      <svg
        className="pointer-events-none fixed inset-0 z-[74]"
        width="100%"
        height="100%"
      >
        {CORNERS.map((corner) => {
          const from = squareCorner(corner, frame);
          const to = arcPoint(corner, box, radius);
          if (radius < 1) return null;
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
      {CORNERS.map((corner) => {
        if (drag && drag !== corner) return null;
        const pos = arcPoint(corner, box, radius);
        const size = drag === corner ? 7 : 10;
        return (
          <button
            key={corner}
            type="button"
            aria-label={`Round corners from the ${cornerLabel(corner)}`}
            data-shell-handle=""
            className="pointer-events-auto fixed z-[75] rounded-full border-2 border-[#93c5fd] bg-[#2563eb] shadow-[0_4px_12px_-6px_rgba(37,99,235,0.45)]"
            style={{
              left: pos.x,
              top: pos.y,
              width: size,
              height: size,
              transform: "translate(-50%, -50%)",
              cursor: cornerCursor(corner),
              transition: drag
                ? "width 120ms ease, height 120ms ease"
                : "width 160ms ease, height 160ms ease",
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              start.current = { radius, x: e.clientX, y: e.clientY };
              setDrag(corner);
            }}
          />
        );
      })}
    </>,
    document.body,
  );
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

/** 45° point on the card's border-radius quarter-circle (on the curve, not inside). */
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
