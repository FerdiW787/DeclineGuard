import { useEffect, useRef, useState, type ReactNode } from "react";

/** Pill with a dashed border that marches around a true capsule shape. */
export default function DashedPill({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      setSize({ w: width, h: height });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = 0.75;
  const w = Math.max(0, size.w);
  const h = Math.max(0, size.h);
  const rw = Math.max(0, w - pad * 2);
  const rh = Math.max(0, h - pad * 2);
  const r = rh / 2;

  return (
    <span
      ref={ref}
      className={`relative inline-flex items-center rounded-full ${className}`}
    >
      {w > 0 && h > 0 ? (
        <svg
          className="pointer-events-none absolute left-0 top-0 overflow-visible"
          width={w}
          height={h}
          aria-hidden
        >
          <rect
            className="dg-eyebrow-dash"
            x={pad}
            y={pad}
            width={rw}
            height={rh}
            rx={r}
            ry={r}
            fill="none"
            stroke="rgb(202 138 4 / 0.9)"
            strokeWidth="1"
            pathLength={100}
          />
        </svg>
      ) : null}
      <span className="relative">{children}</span>
    </span>
  );
}
