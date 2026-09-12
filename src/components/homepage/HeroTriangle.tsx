import { DARK_NOISE_BG } from "./DarkSectionNoise";

type Corner = "tl" | "tr" | "br" | "bl";

type Props = {
  corner?: Corner;
  /** Triangle fill — dark matches hero; light for dark sections */
  fill?: "dark" | "light";
  className?: string;
};

const fillHex = {
  dark: "#2a2522",
  light: "#ffffff",
} as const;

/**
 * Flowy corner wedges — concave (inner-rounded) scoop on the diagonal.
 * Paths overshoot the viewBox so the fill sits flush against the box edge.
 */
const paths: Record<Corner, string> = {
  tl: "M-3 -3 L103 -3 L103 0 C90 0 0 90 0 103 L-3 103 Z",
  tr: "M103 -3 L-3 -3 L-3 0 C10 0 100 90 100 103 L103 103 Z",
  br: "M103 103 L103 -3 L100 -3 C100 10 10 100 -3 100 L-3 103 Z",
  bl: "M-3 103 L-3 -3 L0 -3 C0 10 90 100 103 100 L103 103 Z",
};

/** Nudge into the adjacent section so the seam can't show a hairline gap. */
const seamShift: Record<Corner, string> = {
  tl: "-translate-x-1 -translate-y-1",
  tr: "translate-x-1 -translate-y-1",
  br: "translate-x-1 translate-y-1",
  bl: "-translate-x-1 translate-y-1",
};

const origin: Record<Corner, string> = {
  tl: "origin-top-left",
  tr: "origin-top-right",
  br: "origin-bottom-right",
  bl: "origin-bottom-left",
};

function triangleMaskUrl(corner: Corner): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${paths[corner]}" fill="white"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * Corner accent — curved, flowy edge.
 * Outer node keeps position/seam; inner `.dg-triangle` is scrub-scaled on scroll.
 */
export function HeroTriangle({
  corner = "tl",
  fill = "dark",
  className = "",
}: Props) {
  const mask = fill === "dark" ? triangleMaskUrl(corner) : null;

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute ${seamShift[corner]} ${className}`}
    >
      <div
        data-corner={corner}
        className={`dg-triangle relative h-full w-full will-change-transform ${origin[corner]}`}
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          <path d={paths[corner]} fill={fillHex[fill]} />
        </svg>
        {mask ? (
          <div
            className="absolute inset-0 opacity-[0.4] mix-blend-overlay"
            style={{
              ...DARK_NOISE_BG,
              WebkitMaskImage: mask,
              maskImage: mask,
              WebkitMaskSize: "100% 100%",
              maskSize: "100% 100%",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
