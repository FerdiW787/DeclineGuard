import { useEffect, useRef, useState } from "react";
import Noise from "./Noise";

/** Stepped cartoon playback — intentionally stuttery */
const FPS = 10;
const FRAME_MS = 1000 / FPS;

const FRAMES = [
  "/mascot/warrior/00.png",
  "/mascot/warrior/00a.png",
  "/mascot/warrior/01.png",
  "/mascot/warrior/01a.png",
  "/mascot/warrior/02.png",
  "/mascot/warrior/02a.png",
  "/mascot/warrior/03.png",
  "/mascot/warrior/03a.png",
  "/mascot/warrior/04.png",
] as const;

const IDLE = FRAMES[0];
const REST = FRAMES.slice(1);
const LAST = FRAMES.length - 1;

function preloadAndDecode(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      const decoded = img.decode?.();
      if (decoded) {
        void decoded.then(() => resolve()).catch(() => resolve());
      } else {
        resolve();
      }
    };
    img.onerror = () => resolve();
    img.src = src;
  });
}

function waitFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

type Props = {
  className?: string;
  imgClassName?: string;
  maskPosition?: string;
  alt?: string;
};

/**
 * Roman warrior — idle paints ASAP; bow frames load in the background.
 * Hover waits until frames are decoded + GPU-warmed (kills first-hover flicker).
 */
export function WarriorHover({
  className = "",
  imgClassName = "",
  maskPosition = "right center",
  alt = "",
}: Props) {
  const [frame, setFrame] = useState(0);
  const [idleReady, setIdleReady] = useState(false);
  /** REST imgs are in the DOM (still warming) */
  const [framesMounted, setFramesMounted] = useState(false);
  /** Safe to play look→bow */
  const [bowReady, setBowReady] = useState(false);
  /** Invisible warm-up pass through every frame + mask */
  const [warming, setWarming] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const dirRef = useRef<0 | 1 | -1>(0);
  const rafRef = useRef(0);
  const lastTickRef = useRef(0);

  // 1) Idle first
  useEffect(() => {
    let cancelled = false;
    void preloadAndDecode(IDLE).then(() => {
      if (!cancelled) setIdleReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 2) After idle, fetch + decode the rest, then mount them
  useEffect(() => {
    if (!idleReady) return;
    let cancelled = false;
    void Promise.all(REST.map(preloadAndDecode)).then(() => {
      if (!cancelled) setFramesMounted(true);
    });
    return () => {
      cancelled = true;
    };
  }, [idleReady]);

  // 3) Warm DOM imgs + masks before enabling hover (fixes first-hover flicker)
  useEffect(() => {
    if (!framesMounted) return;
    let cancelled = false;

    const warm = async () => {
      setWarming(true);

      const imgs = rootRef.current?.querySelectorAll("img") ?? [];
      await Promise.all(
        [...imgs].map((img) =>
          img.decode().catch(() => undefined),
        ),
      );
      if (cancelled) return;

      // Force paint/composite + mask cache for every frame (barely visible)
      for (let i = 0; i < FRAMES.length; i++) {
        if (cancelled) return;
        setFrame(i);
        await waitFrame();
        await waitFrame();
      }
      if (cancelled) return;

      setFrame(0);
      frameRef.current = 0;
      setWarming(false);
      setBowReady(true);
    };

    void warm();
    return () => {
      cancelled = true;
    };
  }, [framesMounted]);

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce || !bowReady) return;

    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick);
      if (dirRef.current === 0) return;
      if (now - lastTickRef.current < FRAME_MS) return;
      lastTickRef.current = now;

      let next = frameRef.current + dirRef.current;

      if (dirRef.current === 1) {
        if (next >= LAST) {
          next = LAST;
          dirRef.current = 0;
        }
      } else if (dirRef.current === -1) {
        if (next <= 0) {
          next = 0;
          dirRef.current = 0;
        }
      }

      frameRef.current = next;
      setFrame(next);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [bowReady]);

  const onEnter = () => {
    if (!bowReady || warming) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) {
      frameRef.current = LAST;
      setFrame(LAST);
      dirRef.current = 0;
      return;
    }
    dirRef.current = 1;
    lastTickRef.current = performance.now();
  };

  const onLeave = () => {
    if (!bowReady || warming) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) {
      frameRef.current = 0;
      setFrame(0);
      dirRef.current = 0;
      return;
    }
    dirRef.current = -1;
    lastTickRef.current = performance.now();
  };

  // During warm-up still cycle mask URLs (noise hidden) so first hover isn’t cold
  const maskSrc = FRAMES[frame] ?? IDLE;
  const showFrame = (i: number) => {
    if (warming) {
      // Keep idle fully visible; paint other frames at ~0 so GPU uploads them
      if (i === 0) return "opacity-100";
      return i === frame ? "opacity-[0.01]" : "opacity-0";
    }
    return i === frame ? "opacity-100" : "opacity-0";
  };

  return (
    <div ref={rootRef} className={`relative pointer-events-none ${className}`}>
      <img
        src={IDLE}
        alt={alt}
        width={1024}
        height={1536}
        fetchPriority="high"
        decoding="async"
        draggable={false}
        className={`pointer-events-none ${imgClassName} relative ${showFrame(0)}`}
      />

      {framesMounted
        ? REST.map((src, i) => {
            const index = i + 1;
            return (
              <img
                key={src}
                src={src}
                alt=""
                width={1024}
                height={1536}
                aria-hidden
                className={`pointer-events-none ${imgClassName} absolute inset-0 ${showFrame(index)}`}
                decoding="async"
                draggable={false}
              />
            );
          })
        : null}

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          WebkitMaskImage: `url(${maskSrc})`,
          maskImage: `url(${maskSrc})`,
          WebkitMaskSize: "contain",
          maskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: maskPosition,
          maskPosition,
          // Hide noise during warm-up so it doesn’t flash
          opacity: warming ? 0 : 1,
        }}
      >
        <Noise
          patternSize={250}
          patternScaleX={1}
          patternScaleY={1}
          patternRefreshInterval={2}
          patternAlpha={22}
        />
      </div>

      <div
        className="absolute cursor-default pointer-events-auto"
        style={{
          // Tight around spear + body; leave left empty space clear of hero copy
          top: "4%",
          right: "20%",
          bottom: "6%",
          left: "22%",
        }}
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
      />
    </div>
  );
}
