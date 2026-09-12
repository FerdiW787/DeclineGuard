type Size = "sm" | "md" | "lg";

const iconClass: Record<Size, string> = {
  sm: "h-7 w-7 sm:h-8 sm:w-8",
  md: "h-8 w-8 sm:h-9 sm:w-9",
  lg: "h-10 w-10",
};

const textClass: Record<Size, string> = {
  sm: "text-[1.2rem] sm:text-[1.35rem]",
  md: "text-[1.35rem] sm:text-[1.5rem]",
  lg: "text-[1.65rem]",
};

type Props = {
  size?: Size;
  className?: string;
  /** When true, wordmark + mark use light ink for dark backgrounds */
  onDark?: boolean;
  href?: string;
};

/**
 * Abstract geometric mark + DeclineGuard wordmark.
 * Mark asset: /brand/mark-on-dark.png | mark-on-light.png
 */
export default function BrandLogo({
  size = "md",
  className = "",
  onDark = false,
  href = "/",
}: Props) {
  const markSrc = onDark
    ? "/brand/mark-on-dark.png?v=white2"
    : "/brand/mark-on-light.png?v=white2";

  const inner = (
    <>
      <img
        src={markSrc}
        alt=""
        width={512}
        height={512}
        className={`${iconClass[size]} shrink-0 object-contain`}
        decoding="async"
        aria-hidden
      />
      <span
        className={`font-display font-bold leading-none tracking-[-0.04em] ${textClass[size]} ${
          onDark ? "text-white" : "text-[#0c0a09]"
        }`}
      >
        DeclineGuard
      </span>
    </>
  );

  const rowClass = `inline-flex items-center gap-2 sm:gap-2.5 ${className}`;

  if (href) {
    return (
      <a href={href} className={rowClass} aria-label="DeclineGuard home">
        {inner}
      </a>
    );
  }

  return (
    <span className={rowClass} role="img" aria-label="DeclineGuard">
      {inner}
    </span>
  );
}
