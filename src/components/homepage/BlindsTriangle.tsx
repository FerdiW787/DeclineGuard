import { useEffect, useRef, useState, type ComponentProps } from "react";
import GradientBlinds from "./GradientBlinds";

type BlindsProps = Omit<ComponentProps<typeof GradientBlinds>, "onReady">;

type Props = {
  /** Homepage uses a narrower triangle; auth is a bit wider */
  variant?: "home" | "auth" | "dash" | "compact";
  /** Homepage/auth default top-left; dashboard tabs use top-right */
  corner?: "tl" | "tr";
  className?: string;
} & Partial<BlindsProps>;

const DEFAULTS: BlindsProps = {
  gradientColors: ["#000000", "#ffffff"],
  angle: 28,
  noise: 0.06,
  blindCount: 14,
  blindMinWidth: 60,
  spotlightRadius: 0.85,
  spotlightSoftness: 1,
  mouseDampening: 0,
  distortAmount: 0,
  shineDirection: "left",
  // Falsy → no mix-blend; white blinds glow on the black base
  mixBlendMode: "",
  followMouse: false,
};

const SIZE: Record<NonNullable<Props["variant"]>, string> = {
  home: "h-[min(40vh,42rem)] w-[min(25vw,46rem)]",
  auth: "h-[min(40vh,42rem)] w-[min(42vw,46rem)]",
  dash: "h-72 w-72 md:h-96 md:w-96 lg:h-[28rem] lg:w-[28rem]",
  compact: "h-28 w-28",
};

/**
 * Clipped corner triangle:
 * black paints instantly, then white blinds rise from the bottom with a soft mask
 * (no full-triangle white fade).
 */
export function BlindsTriangle({
  variant = "home",
  corner = "tl",
  className = "",
  ...blindsProps
}: Props) {
  const [lit, setLit] = useState(false);
  const [paused, setPaused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setPaused(!entry?.isIntersecting);
      },
      { rootMargin: "80px 0px", threshold: 0 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const place =
    corner === "tr"
      ? "top-0 right-0 left-auto [clip-path:polygon(0_0,100%_0,100%_100%)]"
      : "top-0 left-0 [clip-path:polygon(0_0,100%_0,0_100%)]";

  return (
    <div
      ref={rootRef}
      className={`pointer-events-none absolute z-0 overflow-hidden opacity-90 ${place} ${SIZE[variant]} ${className}`}
      aria-hidden
    >
      {/* Instant black base — stays; blinds glow on top */}
      <div className="absolute inset-0 bg-black" />

      <div
        className={`dg-blinds-rise absolute inset-0 ${lit ? "is-lit" : ""}`}
      >
        <GradientBlinds
          {...DEFAULTS}
          shineDirection={corner === "tr" ? "right" : "left"}
          angle={corner === "tr" ? -28 : 28}
          paused={paused}
          dpr={
            typeof window !== "undefined"
              ? Math.min(window.devicePixelRatio || 1, 1.5)
              : 1
          }
          {...blindsProps}
          onReady={() => setLit(true)}
        />
      </div>
    </div>
  );
}
