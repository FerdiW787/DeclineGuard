import { BlindsTriangle } from "@/components/homepage/BlindsTriangle";

/**
 * Top-right blinds triangle accent on dashboard tabs.
 * (Same blinds language as the homepage, mirrored to the right.)
 */
export default function PageCornerShader({
  fixed = false,
  compact = false,
  className,
}: {
  /** Kept for call-site compat; blinds are light/dark-agnostic */
  dark?: boolean;
  /** Pin to the viewport (Overview / Recoveries) instead of scrolling with main */
  fixed?: boolean;
  /** Smaller triangle for cards */
  compact?: boolean;
  /** Override default size / placement */
  className?: string;
}) {
  return (
    <div
      className={`pointer-events-none inset-0 z-0 overflow-hidden ${
        fixed ? "fixed" : "absolute"
      }`}
      aria-hidden
    >
      <BlindsTriangle
        variant={compact ? "compact" : "dash"}
        corner="tr"
        className={className}
      />
    </div>
  );
}
