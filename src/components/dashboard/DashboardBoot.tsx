import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { BlindsTriangle } from "@/components/homepage/BlindsTriangle";

type Phase = "load" | "success" | "exit";

type Props = {
  /** Auth (and any other gate) is ready — progress can finish */
  ready: boolean;
  /** Mount the dashboard under the boot screen */
  onReveal: () => void;
  /** Splash started fading — safe to start overview chart enter */
  onExitStart?: () => void;
  /** Boot fully gone */
  onDone: () => void;
};

const RING_R = 18;
const RING_C = 2 * Math.PI * RING_R;
const SPIN_DASH = RING_C * 0.28;
const CHECK_LEN = 36;
const EXIT_MS = 320;

/**
 * Boot: brand + spinner. When ready, arc eases closed into a ring, check
 * draws inside it, then the splash fades out.
 */
export default function DashboardBoot({
  ready,
  onReveal,
  onExitStart,
  onDone,
}: Props) {
  const spinWrapRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const checkRef = useRef<SVGPathElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const spinTweenRef = useRef<gsap.core.Tween | null>(null);

  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<Phase>("load");
  const revealedRef = useRef(false);
  const readyRef = useRef(ready);
  readyRef.current = ready;

  // Continuous spin while loading
  useLayoutEffect(() => {
    const el = spinWrapRef.current;
    if (!el || phase !== "load") return;

    spinTweenRef.current?.kill();
    gsap.set(el, { rotation: 0, transformOrigin: "50% 50%" });
    spinTweenRef.current = gsap.to(el, {
      rotation: 360,
      duration: 0.9,
      ease: "none",
      repeat: -1,
    });

    return () => {
      spinTweenRef.current?.kill();
      spinTweenRef.current = null;
    };
  }, [phase]);

  // Smooth morph: ease out spin → close ring → draw check → soft settle
  useLayoutEffect(() => {
    if (phase !== "success") return;

    const wrap = spinWrapRef.current;
    const ring = ringRef.current;
    const check = checkRef.current;
    const icon = iconRef.current;
    if (!wrap || !ring || !check || !icon) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    spinTweenRef.current?.kill();
    spinTweenRef.current = null;

    if (reduced) {
      gsap.set(wrap, { rotation: 0 });
      gsap.set(ring, { attr: { "stroke-dasharray": `${RING_C} 0` } });
      gsap.set(check, { strokeDashoffset: 0, opacity: 1 });
      const t = window.setTimeout(() => setPhase("exit"), 200);
      return () => window.clearTimeout(t);
    }

    const currentRot = Number(gsap.getProperty(wrap, "rotation")) || 0;

    const tl = gsap.timeline({
      onComplete: () => setPhase("exit"),
    });

    // Ease the spin to a stop (continue a little so it doesn’t hard-cut)
    tl.fromTo(
      wrap,
      { rotation: currentRot },
      {
        rotation: currentRot + 120,
        duration: 0.5,
        ease: "power3.out",
      },
    );

    // Arc grows into a full ring while still settling — ring stays visible
    tl.to(
      ring,
      {
        attr: { "stroke-dasharray": `${RING_C} 0` },
        duration: 0.52,
        ease: "power2.inOut",
      },
      "-=0.38",
    );

    // Check draws through the settled ring (no ring fade — that’s the morph)
    tl.fromTo(
      check,
      { strokeDashoffset: CHECK_LEN, opacity: 0 },
      {
        strokeDashoffset: 0,
        opacity: 1,
        duration: 0.45,
        ease: "power2.out",
      },
      "-=0.18",
    );

    // Soft settle pulse on the whole glyph
    tl.fromTo(
      icon,
      { scale: 1 },
      {
        scale: 1.05,
        duration: 0.24,
        ease: "power2.out",
        yoyo: true,
        repeat: 1,
      },
      "-=0.3",
    );

    // Brief hold on the completed mark
    tl.to({}, { duration: 0.32 });

    return () => {
      tl.kill();
    };
  }, [phase]);

  // Timed progress — finishes when ready
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const MIN_MS = 1200;
    let lastReported = -1;

    const tick = (now: number) => {
      const elapsed = now - start;
      const natural = 1 - (1 - Math.min(1, elapsed / MIN_MS)) ** 2;
      const next = readyRef.current ? natural : Math.min(0.9, natural);

      const bucket = Math.floor(next * 10);
      if (bucket !== lastReported || next >= 0.995) {
        lastReported = bucket;
        setProgress(next);
      }

      if (next < 0.995) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (phase !== "load") return;
    if (!ready || progress < 0.995) return;

    if (!revealedRef.current) {
      revealedRef.current = true;
      onReveal();
    }

    setPhase("success");
  }, [ready, progress, phase, onReveal]);

  useEffect(() => {
    if (phase !== "exit") return;
    onExitStart?.();
    const doneId = window.setTimeout(() => onDone(), EXIT_MS);
    return () => window.clearTimeout(doneId);
  }, [phase, onExitStart, onDone]);

  const spinning = phase === "load";
  const exiting = phase === "exit";

  return (
    <div
      className="fixed inset-0 z-[100]"
      aria-busy={spinning}
      aria-label={spinning ? "Loading DeclineGuard" : "Ready"}
    >
      <div
        className={`absolute inset-0 bg-white transition-opacity ease-out ${
          exiting ? "opacity-0" : "opacity-100"
        }`}
        style={{ transitionDuration: `${EXIT_MS}ms` }}
      />

      <div
        className={`pointer-events-none absolute inset-0 z-[1] transition-opacity ease-out ${
          exiting ? "opacity-0" : "opacity-100"
        }`}
        style={{ transitionDuration: `${EXIT_MS}ms` }}
        aria-hidden
      >
        <BlindsTriangle variant="dash" className="opacity-50" />
      </div>

      <div
        className={`absolute inset-0 z-10 flex flex-col items-center justify-center px-6 transition-opacity ease-out ${
          exiting ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        style={{ transitionDuration: `${EXIT_MS}ms` }}
      >
        <div
          ref={iconRef}
          className="relative h-12 w-12 will-change-transform"
          role="status"
          aria-live="polite"
        >
          {/* Spinning arc — eases closed into a full ring (stays visible) */}
          <div
            ref={spinWrapRef}
            className="absolute inset-0 flex items-center justify-center"
          >
            <svg viewBox="0 0 48 48" className="h-11 w-11" aria-hidden>
              <circle
                ref={ringRef}
                cx="24"
                cy="24"
                r={RING_R}
                fill="none"
                stroke="#0c0c0c"
                strokeWidth="3.25"
                strokeLinecap="round"
                strokeDasharray={`${SPIN_DASH} ${RING_C - SPIN_DASH}`}
              />
            </svg>
          </div>

          {/* Check draws in place once the ring has closed */}
          <svg
            viewBox="0 0 48 48"
            className="pointer-events-none absolute inset-0 m-auto h-11 w-11"
            aria-hidden
          >
            <path
              ref={checkRef}
              d="M14.5 24.5 L21 31 L33.5 17.5"
              fill="none"
              stroke="#0c0c0c"
              strokeWidth="3.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={CHECK_LEN}
              strokeDashoffset={CHECK_LEN}
              opacity={0}
            />
          </svg>

          <span className="sr-only">{spinning ? "Loading" : "Loaded"}</span>
        </div>
      </div>
    </div>
  );
}
