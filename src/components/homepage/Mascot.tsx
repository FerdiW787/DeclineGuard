type Size = "xs" | "sm" | "md" | "lg" | "hero";

const sizeClass: Record<Size, string> = {
  xs: "h-9 w-9",
  sm: "h-11 w-11",
  md: "h-16 w-16",
  lg: "h-28 w-28 md:h-36 md:w-36",
  hero: "h-40 w-40 md:h-52 md:w-52",
};

type Props = {
  size?: Size;
  className?: string;
  /** Decorative candy wash behind mascot */
  ring?: boolean;
};

/** Minimal B&W Roman guardian — full-body side profile (helmet + spear). */
export default function Mascot({
  size = "md",
  className = "",
  ring = false,
}: Props) {
  const isHero = size === "hero" || size === "lg";
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
    >
      {ring ? (
        <span
          className="pointer-events-none absolute inset-[-14%] rounded-full bg-[radial-gradient(circle,rgba(250,204,21,0.22)_0%,rgba(168,85,247,0.12)_45%,transparent_70%)]"
          aria-hidden
        />
      ) : null}
      <img
        src="/declineguard-mascot.png"
        alt="DeclineGuard guardian mascot"
        width={768}
        height={1024}
        className={`relative z-10 ${sizeClass[size]} drop-shadow-[0_12px_28px_rgba(0,0,0,0.12)] ${
          isHero
            ? "object-contain object-bottom"
            : "rounded-full object-cover object-[center_12%] ring-1 ring-black/10"
        }`}
        decoding="async"
      />
    </span>
  );
}
