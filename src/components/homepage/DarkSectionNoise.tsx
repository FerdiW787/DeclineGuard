/** Static grain overlay for dark homepage sections (`bg-[#2a2522]`). */
const NOISE_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <filter id="n">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch"/>
    </filter>
    <rect width="100%" height="100%" filter="url(#n)"/>
  </svg>`.replace(/\s+/g, " "),
);

export const DARK_NOISE_BG = {
  backgroundImage: `url("data:image/svg+xml,${NOISE_SVG}")`,
  backgroundRepeat: "repeat",
  backgroundSize: "160px 160px",
} as const;

export function DarkSectionNoise() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <div
        className="absolute inset-0 opacity-[0.4] mix-blend-overlay"
        style={DARK_NOISE_BG}
      />
    </div>
  );
}
