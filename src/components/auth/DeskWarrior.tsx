import { useEffect, useRef, useState } from "react";
import Noise from "@/components/homepage/Noise";

/** Stepped cartoon playback — matches homepage warrior feel */
const FPS = 10;
const FRAME_MS = 1000 / FPS;

const IDLE = "/mascot/warrior/desk/00.png";
const LOOK = "/mascot/warrior/desk/look.png";
const THUMBS = "/mascot/warrior/desk/thumbs.png";

/** Hover sequence: idle → look → thumbs */
const HOVER_FRAMES = [IDLE, LOOK, THUMBS] as const;

type Props = {
  className?: string;
  imgClassName?: string;
  maskPosition?: string;
  alt?: string;
};

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

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Desk warrior for auth — idle at laptop; hover → looks at you + thumbs up.
 */
export function DeskWarrior({
  className = "",
  imgClassName = "",
  maskPosition = "right center",
  alt = "",
}: Props) {
  const [src, setSrc] = useState(IDLE);
  const [idleReady, setIdleReady] = useState(false);
  const [framesMounted, setFramesMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [warming, setWarming] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const hoverIdxRef = useRef(0);
  const dirRef = useRef<0 | 1 | -1>(0);
  const modeRef = useRef<"idle" | "hover">("idle");
  const rafRef = useRef(0);
  const lastTickRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void preloadAndDecode(IDLE).then(() => {
      if (!cancelled) setIdleReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!idleReady) return;
    let cancelled = false;
    void Promise.all([LOOK, THUMBS].map(preloadAndDecode)).then(() => {
      if (!cancelled) setFramesMounted(true);
    });
    return () => {
      cancelled = true;
    };
  }, [idleReady]);

  useEffect(() => {
    if (!framesMounted) return;
    let cancelled = false;

    const warm = async () => {
      setWarming(true);
      const imgs = rootRef.current?.querySelectorAll("img") ?? [];
      await Promise.all(
        [...imgs].map((img) => img.decode().catch(() => undefined)),
      );
      if (cancelled) return;

      for (const frame of HOVER_FRAMES) {
        if (cancelled) return;
        setSrc(frame);
        await waitFrame();
        await waitFrame();
      }
      if (cancelled) return;

      setSrc(IDLE);
      hoverIdxRef.current = 0;
      modeRef.current = "idle";
      setWarming(false);
      setReady(true);
    };

    void warm();
    return () => {
      cancelled = true;
    };
  }, [framesMounted]);

  useEffect(() => {
    if (!ready) return;

    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick);
      if (dirRef.current === 0 || modeRef.current !== "hover") return;
      if (now - lastTickRef.current < FRAME_MS) return;
      lastTickRef.current = now;

      const last = HOVER_FRAMES.length - 1;
      let next = hoverIdxRef.current + dirRef.current;

      if (dirRef.current === 1) {
        if (next >= last) {
          next = last;
          dirRef.current = 0;
        }
      } else if (dirRef.current === -1) {
        if (next <= 0) {
          next = 0;
          dirRef.current = 0;
          modeRef.current = "idle";
        }
      }

      hoverIdxRef.current = next;
      setSrc(HOVER_FRAMES[next] ?? IDLE);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [ready]);

  const onEnter = () => {
    if (!ready || warming) return;
    modeRef.current = "hover";
    if (prefersReducedMotion()) {
      hoverIdxRef.current = HOVER_FRAMES.length - 1;
      dirRef.current = 0;
      setSrc(THUMBS);
      return;
    }
    dirRef.current = 1;
    lastTickRef.current = performance.now();
  };

  const onLeave = () => {
    if (!ready || warming) return;
    modeRef.current = "hover";
    if (prefersReducedMotion()) {
      hoverIdxRef.current = 0;
      dirRef.current = 0;
      modeRef.current = "idle";
      setSrc(IDLE);
      return;
    }
    dirRef.current = -1;
    lastTickRef.current = performance.now();
  };

  const show = (frameSrc: string) => {
    if (warming) {
      if (frameSrc === IDLE) return "opacity-100";
      return frameSrc === src ? "opacity-[0.01]" : "opacity-0";
    }
    return frameSrc === src ? "opacity-100" : "opacity-0";
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
        className={`pointer-events-none ${imgClassName} relative ${show(IDLE)}`}
      />

      {framesMounted
        ? [LOOK, THUMBS].map((frameSrc) => (
            <img
              key={frameSrc}
              src={frameSrc}
              alt=""
              width={1024}
              height={1536}
              aria-hidden
              className={`pointer-events-none ${imgClassName} absolute inset-0 ${show(frameSrc)}`}
              decoding="async"
              draggable={false}
            />
          ))
        : null}

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          WebkitMaskImage: `url(${src})`,
          maskImage: `url(${src})`,
          WebkitMaskSize: "contain",
          maskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: maskPosition,
          maskPosition,
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
          top: "8%",
          right: "18%",
          bottom: "4%",
          left: "18%",
        }}
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
      />
    </div>
  );
}
