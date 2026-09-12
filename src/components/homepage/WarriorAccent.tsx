import { WarriorIdle } from "./WarriorIdle";

type Side = "left" | "right" | "center";
type Size = "hero" | "section" | "compact";

type Props = {
  side?: Side;
  size?: Size;
  /** Fade the inner edge so copy stays readable */
  fade?: boolean;
  className?: string;
  alt?: string;
};

const height: Record<Size, string> = {
  hero: "h-[min(92vh,56rem)]",
  section: "h-[min(72vh,40rem)]",
  compact: "h-[min(50vh,28rem)]",
};

const position: Record<Side, string> = {
  left: "left-0 -translate-x-[28%] md:-translate-x-[22%]",
  right: "right-0 translate-x-[28%] md:translate-x-[22%]",
  center: "left-1/2 -translate-x-1/2",
};

const fadeMask: Record<Side, string> = {
  left: "[mask-image:linear-gradient(to_right,black_55%,transparent)]",
  right: "[mask-image:linear-gradient(to_left,black_55%,transparent)]",
  center:
    "[mask-image:linear-gradient(to_bottom,black_70%,transparent_95%)]",
};

/** Decorative warrior — same asset as the hero, cropped at the edge. */
export function WarriorAccent({
  side = "right",
  size = "section",
  fade = true,
  className = "",
  alt = "",
}: Props) {
  return (
    <div
      aria-hidden={alt === ""}
      className={`pointer-events-none absolute top-0 z-0 ${position[side]} ${height[size]} w-max ${className}`}
    >
      <WarriorIdle
        className={`h-full w-max overflow-hidden ${fade ? fadeMask[side] : ""}`}
        imgClassName="h-full w-auto max-w-none object-contain object-bottom"
        alt={alt}
      />
    </div>
  );
}
