import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import "./DriftWall.css";

export type DriftWallItem = {
  image: string;
  title?: string;
  href?: string;
};

type DriftDirection = "up" | "down";

type DriftWallProps = {
  items?: DriftWallItem[];
  columns?: number;
  tileWidth?: number;
  tileHeight?: number;
  gap?: number;
  radius?: number;
  tilt?: number;
  turn?: number;
  roll?: number;
  perspective?: number;
  depth?: number;
  speed?: number;
  direction?: DriftDirection;
  variance?: number;
  parallax?: number;
  pauseOnHover?: boolean;
  /** Only drift while the wall is hovered. Eases in/out. */
  playOnHover?: boolean;
  /** When set, overrides pointer-enter hover for playOnHover. */
  hovered?: boolean;
  /** Highlight / lift an individual tile on hover. */
  tileHover?: boolean;
  lift?: number;
  fade?: number;
  dim?: number;
  grayscale?: boolean;
  overlayColor?: string;
  playing?: boolean;
  className?: string;
  style?: CSSProperties;
};

const DEFAULT_ITEMS: DriftWallItem[] = Array.from({ length: 15 }, (_, i) => {
  const ids = [
    1015, 1025, 1039, 1043, 1044, 1050, 1062, 1069, 1074, 1080, 1084, 106,
    110, 133, 164,
  ];
  return {
    image: `https://picsum.photos/id/${ids[i % ids.length]}/600/400`,
    title: `Tile ${i + 1}`,
  };
});

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const columnFactor = (index: number, variance: number) => {
  const pseudo = ((index * 0.6180339887 + 0.35) % 1) * 2 - 1;
  return 1 + variance * pseudo;
};

export default function DriftWall({
  items = DEFAULT_ITEMS,
  columns = 5,
  tileWidth = 200,
  tileHeight = 132,
  gap = 18,
  radius = 14,
  tilt = 16,
  turn = -14,
  roll = 0,
  perspective = 1200,
  depth = 120,
  speed = 42,
  direction = "up",
  variance = 0.45,
  parallax = 0.6,
  pauseOnHover = false,
  playOnHover = false,
  hovered,
  tileHover = true,
  lift = 64,
  fade = 0.6,
  dim = 0.55,
  grayscale = false,
  overlayColor = "#060010",
  playing = true,
  className = "",
  style,
}: DriftWallProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const trackRefs = useRef<Array<HTMLDivElement | null>>([]);
  const rafRef = useRef<number | null>(null);

  const offsetsRef = useRef<number[]>([]);
  const velocitiesRef = useRef<number[]>([]);
  const hoveredColRef = useRef(-1);
  const wallHoveredRef = useRef(false);
  const pointerRef = useRef({ x: 0, y: 0 });
  const pointerDampedRef = useRef({ x: 0, y: 0 });
  const lastTsRef = useRef<number | null>(null);

  const [containerHeight, setContainerHeight] = useState(600);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(prefersReducedMotion());
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const columnItems = useMemo(() => {
    const cols: DriftWallItem[][] = Array.from({ length: columns }, () => []);
    items.forEach((item, i) => {
      cols[i % columns]?.push(item);
    });
    const longest = Math.max(5, ...cols.map((col) => col.length));
    return cols.map((col) => {
      const source = col.length > 0 ? col : items;
      if (source.length === 0) return [];
      return Array.from(
        { length: longest },
        (_, i) => source[i % source.length] as DriftWallItem,
      );
    });
  }, [items, columns]);

  const columnMeta = useMemo(() => {
    const unit = tileHeight + gap;
    return columnItems.map((col) => {
      const copyHeight = Math.max(unit, col.length * unit);
      const copies = Math.max(
        4,
        Math.ceil((containerHeight * 3.2) / copyHeight) + 2,
      );
      return { copyHeight, copies };
    });
  }, [columnItems, tileHeight, gap, containerHeight]);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerHeight(entry?.contentRect.height || 600);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const baseVelocities = useMemo(() => {
    const dirSign = direction === "up" ? 1 : -1;
    return columnItems.map((_, c) => {
      const altSign = c % 2 === 0 ? 1 : -1;
      return speed * columnFactor(c, variance) * dirSign * altSign;
    });
  }, [columnItems, speed, direction, variance]);

  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current && offsetsRef.current.length === columnMeta.length) {
      return;
    }
    seededRef.current = true;
    offsetsRef.current = columnMeta.map(
      (meta, c) => meta.copyHeight * ((c * 0.37) % 1),
    );
    velocitiesRef.current = columnItems.map(() => 0);
  }, [columnMeta, columnItems]);

  const columnMetaRef = useRef(columnMeta);
  const baseVelocitiesRef = useRef(baseVelocities);
  const pauseOnHoverRef = useRef(pauseOnHover);
  const playOnHoverRef = useRef(playOnHover);
  const hoveredPropRef = useRef(hovered);
  const parallaxRef = useRef(parallax);
  const reducedRef = useRef(reduced);
  const playingRef = useRef(playing);
  columnMetaRef.current = columnMeta;
  baseVelocitiesRef.current = baseVelocities;
  pauseOnHoverRef.current = pauseOnHover;
  playOnHoverRef.current = playOnHover;
  hoveredPropRef.current = hovered;
  parallaxRef.current = parallax;
  reducedRef.current = reduced;
  playingRef.current = playing;

  const applyPlaneTransform = useCallback(
    (px: number, py: number) => {
      const plane = planeRef.current;
      if (!plane) return;
      plane.style.transform =
        `translate(-50%, -50%) scale(1.06) ` +
        `rotateX(${tilt + py}deg) rotateY(${turn + px}deg) rotateZ(${roll}deg) ` +
        `translateZ(${-depth}px)`;
    },
    [tilt, turn, roll, depth],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let intersecting = false;
    let running = false;

    const stop = () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
    };

    const animate = (ts: number) => {
      if (!running) return;
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const dt = Math.min(0.05, Math.max(0, ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;

      const maxTilt = parallaxRef.current * 8;
      const targetX = pointerRef.current.x * maxTilt;
      const targetY = -pointerRef.current.y * maxTilt;
      const damp = 1 - Math.exp(-dt / 0.12);
      pointerDampedRef.current.x +=
        (targetX - pointerDampedRef.current.x) * damp;
      pointerDampedRef.current.y +=
        (targetY - pointerDampedRef.current.y) * damp;
      applyPlaneTransform(
        pointerDampedRef.current.x,
        pointerDampedRef.current.y,
      );

      if (!reducedRef.current) {
        for (let c = 0; c < trackRefs.current.length; c++) {
          const meta = columnMetaRef.current[c];
          if (!meta) continue;
          const hovered = hoveredPropRef.current ?? wallHoveredRef.current;
          const paused = hovered && pauseOnHoverRef.current;
          const playHover = playOnHoverRef.current;
          const factor = playHover
            ? hovered
              ? 1
              : 0
            : paused || hoveredColRef.current === c
              ? 0
              : 1;
          const target = (baseVelocitiesRef.current[c] ?? 0) * factor;

          const tau = playHover
            ? target === 0
              ? 1.15
              : 0.85
            : target === 0
              ? 0.16
              : 0.28;
          const ease = 1 - Math.exp(-dt / tau);
          const current = velocitiesRef.current[c] ?? 0;
          velocitiesRef.current[c] = current + (target - current) * ease;
          let next =
            (offsetsRef.current[c] ?? 0) +
            (velocitiesRef.current[c] ?? 0) * dt;
          next = ((next % meta.copyHeight) + meta.copyHeight) % meta.copyHeight;
          offsetsRef.current[c] = next;

          const el = trackRefs.current[c];
          if (el) el.style.transform = `translate3d(0, ${-next}px, 0)`;
        }
      } else {
        for (let c = 0; c < trackRefs.current.length; c++) {
          const el = trackRefs.current[c];
          const meta = columnMetaRef.current[c];
          if (el && meta) {
            el.style.transform = `translate3d(0, ${-(offsetsRef.current[c] ?? 0)}px, 0)`;
          }
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    const start = () => {
      if (running || reducedRef.current) return;
      running = true;
      lastTsRef.current = null;
      rafRef.current = requestAnimationFrame(animate);
    };

    const sync = () => {
      const shouldRun =
        playingRef.current && intersecting && !reducedRef.current;
      if (shouldRun) start();
      else stop();
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        intersecting = Boolean(entry?.isIntersecting);
        sync();
      },
      { threshold: 0.08 },
    );
    io.observe(container);
    sync();

    return () => {
      io.disconnect();
      stop();
    };
  }, [applyPlaneTransform, playing, reduced]);

  const activate = useCallback((id: string, index: number) => {
    activeIdRef.current = id;
    hoveredColRef.current = index;
    setActiveId(id);
  }, []);

  const release = useCallback(() => {
    activeIdRef.current = null;
    hoveredColRef.current = -1;
    setActiveId(null);
  }, []);

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (parallax > 0 && !reduced) {
        pointerRef.current = {
          x: (e.clientX - rect.left) / rect.width - 0.5,
          y: (e.clientY - rect.top) / rect.height - 0.5,
        };
      }
      if (!tileHover) return;
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const tile =
        hit && "closest" in hit
          ? (hit as Element).closest("[data-tile-id]")
          : null;
      if (!tile || !(tile instanceof HTMLElement)) return;
      const id = tile.dataset.tileId;
      if (!id || id === activeIdRef.current) return;
      activeIdRef.current = id;
      hoveredColRef.current = Number(tile.dataset.col);
      setActiveId(id);
    },
    [parallax, reduced, tileHover],
  );

  const handlePointerLeaveWall = useCallback(() => {
    wallHoveredRef.current = false;
    pointerRef.current = { x: 0, y: 0 };
    release();
  }, [release]);

  const cssVars = useMemo(
    () =>
      ({
        "--dw-tile-w": `${tileWidth}px`,
        "--dw-tile-h": `${tileHeight}px`,
        "--dw-gap": `${gap}px`,
        "--dw-radius": `${radius}px`,
        "--dw-perspective": `${perspective}px`,
        "--dw-lift": `${lift}px`,
        "--dw-dim": dim,
        "--dw-gray": grayscale ? 1 : 0,
        "--dw-overlay": overlayColor,
        "--dw-edge": `${Math.max(0, (1 - fade) * 100)}%`,
        ...style,
      }) as CSSProperties,
    [
      tileWidth,
      tileHeight,
      gap,
      radius,
      perspective,
      lift,
      dim,
      grayscale,
      overlayColor,
      fade,
      style,
    ],
  );

  const renderTile = (item: DriftWallItem, id: string, colIndex: number) => {
    const inner = (
      <span className="drift-wall__inner">
        <img
          src={item.image}
          alt={item.title ?? ""}
          loading="eager"
          decoding="sync"
          draggable={false}
        />
        <span className="drift-wall__overlay" aria-hidden="true" />
      </span>
    );
    const commonProps = {
      className: `drift-wall__tile${tileHover && activeId === id ? " is-active" : ""}`,
      "data-tile-id": id,
      "data-col": colIndex,
      onFocus: tileHover ? () => activate(id, colIndex) : undefined,
      onBlur: tileHover ? release : undefined,
    };
    if (item.href) {
      return (
        <a
          key={id}
          href={item.href}
          target="_blank"
          rel="noreferrer noopener"
          {...commonProps}
        >
          {inner}
        </a>
      );
    }
    return (
      <div
        key={id}
        tabIndex={tileHover ? 0 : -1}
        role={tileHover ? "button" : undefined}
        aria-label={item.title ?? "tile"}
        aria-hidden={tileHover ? undefined : true}
        {...commonProps}
      >
        {inner}
      </div>
    );
  };

  const rootClass = [
    "drift-wall",
    reduced ? "drift-wall--reduced" : "",
    tileHover ? "" : "drift-wall--no-tile-hover",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={containerRef}
      className={rootClass}
      style={cssVars}
      onPointerMove={handlePointerMove}
      onPointerEnter={() => {
        wallHoveredRef.current = true;
      }}
      onPointerLeave={handlePointerLeaveWall}
      role="group"
      aria-label="Drifting wall of tiles"
    >
      <div ref={planeRef} className="drift-wall__plane">
        {columnItems.map((col, c) => {
          const meta = columnMeta[c];
          if (!meta) return null;
          const copies = Array.from({ length: meta.copies });
          return (
            <div className="drift-wall__col" key={`col-${c}`}>
              <div
                className="drift-wall__track"
                ref={(el) => {
                  trackRefs.current[c] = el;
                }}
              >
                {copies.map((_, copyIndex) =>
                  col.map((item, itemIndex) =>
                    renderTile(item, `${c}-${copyIndex}-${itemIndex}`, c),
                  ),
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
