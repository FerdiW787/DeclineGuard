import type { ReactNode } from "react";
import { ImageIcon } from "lucide-react";

type Props = {
  /** Short label for the asset role */
  label: string;
  /** What should be photographed / designed here */
  brief: string;
  /** Optional aspect / size hint shown under the brief */
  hint?: string;
  className?: string;
  children?: ReactNode;
};

/** Dashed image placeholder — center brief until real art ships. */
export default function ImageSlot({
  label,
  brief,
  hint,
  className = "",
  children,
}: Props) {
  return (
    <div
      className={`relative flex min-h-[14rem] w-full flex-col items-center justify-center overflow-hidden rounded-[1.35rem] border border-dashed border-black/20 bg-[linear-gradient(135deg,#fafafa_0%,#f3f3f5_50%,#fafafa_100%)] px-6 py-10 text-center ${className}`}
      role="img"
      aria-label={`${label}: ${brief}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.06) 1px, transparent 0)",
          backgroundSize: "18px 18px",
        }}
        aria-hidden
      />
      <div className="relative z-10 flex max-w-sm flex-col items-center gap-3">
        <span className="inline-flex size-11 items-center justify-center rounded-2xl border border-black/10 bg-white shadow-sm">
          <ImageIcon className="size-5 text-black/40" strokeWidth={1.5} />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-700">
          {label}
        </p>
        <p className="text-sm font-medium leading-snug text-black/75">{brief}</p>
        {hint ? (
          <p className="text-[12px] leading-relaxed text-black/40">{hint}</p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
