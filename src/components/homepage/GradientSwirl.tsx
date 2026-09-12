import { useEffect, useId } from "react";

export type SwirlTheme = {
  id: string;
  label: string;
  /** CSS color stops for the mesh */
  colors: [string, string, string, string, string];
  /** Accent used for buttons / sun glow */
  accent: string;
};

export const SWIRL_THEMES: SwirlTheme[] = [
  {
    id: "aurora",
    label: "Aurora",
    colors: ["#ff80ff", "#ff6600", "#ad00ff", "#00d4ff", "#635bff"],
    accent: "#635bff",
  },
  {
    id: "dawn",
    label: "Dawn",
    colors: ["#ffb347", "#ff6b6b", "#c44569", "#f8a5c2", "#ee5a24"],
    accent: "#ee5a24",
  },
  {
    id: "tide",
    label: "Tide",
    colors: ["#7bed9f", "#2ed573", "#1e90ff", "#70a1ff", "#5352ed"],
    accent: "#2ed573",
  },
  {
    id: "ember",
    label: "Ember",
    colors: ["#f6d365", "#fda085", "#f0932b", "#eb4d4b", "#6c5ce7"],
    accent: "#f0932b",
  },
];

type Props = {
  theme: SwirlTheme;
  className?: string;
};

/** Stripe-inspired mesh swirl — soft overlapping radial blooms */
export function GradientSwirl({ theme, className = "" }: Props) {
  const uid = useId().replace(/:/g, "");
  const [c1, c2, c3, c4, c5] = theme.colors;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--swirl-1", c1);
    root.style.setProperty("--swirl-2", c2);
    root.style.setProperty("--swirl-3", c3);
    root.style.setProperty("--swirl-4", c4);
    root.style.setProperty("--swirl-5", c5);
    root.style.setProperty("--color-accent", theme.accent);
    root.style.setProperty("--color-ring", theme.accent);
  }, [c1, c2, c3, c4, c5, theme.accent]);

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden
    >
      {/* Soft diagonal wash like Stripe's hero cut */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(115deg, ${c2}33 0%, ${c5}22 35%, transparent 58%)`,
        }}
      />

      <div className="dg-swirl-drift absolute -right-[15%] -top-[20%] h-[140%] w-[90%]">
        <svg
          className="h-full w-full"
          viewBox="0 0 800 900"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <filter id={`blur-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="48" />
            </filter>
            <radialGradient id={`g1-${uid}`} cx="30%" cy="25%" r="55%">
              <stop offset="0%" stopColor={c2} stopOpacity="0.95" />
              <stop offset="55%" stopColor={c1} stopOpacity="0.45" />
              <stop offset="100%" stopColor={c1} stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`g2-${uid}`} cx="70%" cy="40%" r="50%">
              <stop offset="0%" stopColor={c3} stopOpacity="0.9" />
              <stop offset="60%" stopColor={c5} stopOpacity="0.4" />
              <stop offset="100%" stopColor={c5} stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`g3-${uid}`} cx="55%" cy="75%" r="45%">
              <stop offset="0%" stopColor={c4} stopOpacity="0.85" />
              <stop offset="100%" stopColor={c4} stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`g4-${uid}`} cx="40%" cy="55%" r="40%">
              <stop offset="0%" stopColor={c5} stopOpacity="0.7" />
              <stop offset="100%" stopColor={c5} stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`ribbon-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={c2} stopOpacity="0.55" />
              <stop offset="40%" stopColor={c1} stopOpacity="0.4" />
              <stop offset="70%" stopColor={c5} stopOpacity="0.45" />
              <stop offset="100%" stopColor={c4} stopOpacity="0.2" />
            </linearGradient>
          </defs>

          <g filter={`url(#blur-${uid})`}>
            <ellipse cx="280" cy="220" rx="280" ry="260" fill={`url(#g1-${uid})`} />
            <ellipse cx="560" cy="320" rx="260" ry="240" fill={`url(#g2-${uid})`} />
            <ellipse cx="420" cy="620" rx="300" ry="220" fill={`url(#g3-${uid})`} />
            <ellipse cx="340" cy="420" rx="200" ry="180" fill={`url(#g4-${uid})`} />
          </g>

          {/* Ribbon swirl strokes */}
          <path
            d="M120 180 C 280 80, 520 120, 680 280 S 720 560, 480 720"
            fill="none"
            stroke={`url(#ribbon-${uid})`}
            strokeWidth="56"
            strokeLinecap="round"
            opacity="0.55"
          />
          <path
            d="M80 420 C 240 300, 400 260, 620 380 S 700 640, 400 780"
            fill="none"
            stroke={`url(#ribbon-${uid})`}
            strokeWidth="36"
            strokeLinecap="round"
            opacity="0.35"
          />
        </svg>
      </div>

      {/* Bright "sun" bloom */}
      <div
        className="absolute left-[8%] top-[12%] h-40 w-40 rounded-full blur-2xl md:h-56 md:w-56"
        style={{
          background: `radial-gradient(circle, ${c2}cc 0%, ${c2}00 70%)`,
        }}
      />
    </div>
  );
}
