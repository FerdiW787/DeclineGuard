import type { SectionArtId } from "./sectionArt";
import { sectionArt } from "./sectionArt";

type Side = "left" | "right" | "center";
type Size = "hero" | "section" | "compact" | "spot";

type Props = {
  id: SectionArtId;
  side?: Side;
  size?: Size;
  className?: string;
  alt?: string;
};

const height: Record<Size, string> = {
  hero: "h-[min(92vh,56rem)]",
  section: "h-[min(72vh,40rem)]",
  compact: "h-[min(50vh,28rem)]",
  spot: "h-[min(36vh,20rem)]",
};

const position: Record<Side, string> = {
  left: "left-0 -translate-x-[22%] md:-translate-x-[18%]",
  right: "right-0 translate-x-[22%] md:translate-x-[18%]",
  center: "left-1/2 -translate-x-1/2",
};

/** Section illustration — transparent-bg engraved Spartan art. */
export function SectionArt({
  id,
  side = "right",
  size = "section",
  className = "",
  alt = "",
}: Props) {
  return (
    <div
      aria-hidden={alt === ""}
      className={`pointer-events-none absolute top-0 z-0 ${position[side]} ${height[size]} w-max ${className}`}
    >
      <img
        src={sectionArt[id]}
        alt={alt}
        width={1024}
        height={1536}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="h-full w-auto max-w-none select-none object-contain object-bottom"
      />
    </div>
  );
}

/** Centered watermark (trust strip, etc.) */
export function SectionArtWatermark({
  id,
  className = "",
  opacity = 0.2,
}: {
  id: SectionArtId;
  className?: string;
  opacity?: number;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-0 flex justify-center overflow-hidden ${className}`}
      style={{ opacity }}
    >
      <img
        src={sectionArt[id]}
        alt=""
        width={1024}
        height={1024}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="h-[min(48vh,26rem)] w-auto max-w-none translate-y-[35%] object-contain object-bottom select-none"
      />
    </div>
  );
}

/** Inline spotlight above or beside copy */
export function SectionArtSpotlight({
  id,
  className = "",
}: {
  id: SectionArtId;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none mx-auto w-full max-w-[13rem] sm:max-w-[15rem] ${className}`}
    >
      <img
        src={sectionArt[id]}
        alt=""
        width={1024}
        height={1536}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="h-auto w-full select-none object-contain object-bottom"
      />
    </div>
  );
}
