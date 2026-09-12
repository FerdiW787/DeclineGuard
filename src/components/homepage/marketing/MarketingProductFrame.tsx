import type { ReactNode } from "react";

type Props = {
  title?: string;
  children: ReactNode;
  className?: string;
  /** Taller frame for hero / spotlight sections */
  size?: "default" | "hero";
  /** Light (default) or Linear-style dark chrome */
  theme?: "light" | "dark";
};

export function MarketingProductFrame({
  title = "DeclineGuard",
  children,
  className = "",
  size = "default",
  theme = "light",
}: Props) {
  const frameH =
    size === "hero"
      ? "h-[14rem] sm:h-[17rem] md:h-[20rem]"
      : "h-[11rem] md:h-[14rem]";

  if (theme === "dark") {
    return (
      <div
        className={`overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e0f11] shadow-[0_40px_80px_-48px_rgba(0,0,0,0.8)] ${className}`}
      >
        <div className="flex items-center gap-2 border-b border-white/[0.06] bg-[#0c0d0f] px-4 py-3">
          <span className="size-2.5 rounded-full bg-white/15" aria-hidden />
          <span className="size-2.5 rounded-full bg-white/15" aria-hidden />
          <span className="size-2.5 rounded-full bg-white/15" aria-hidden />
          <span className="ml-2 truncate text-[12px] font-medium text-white/40">
            {title}
          </span>
        </div>
        <div
          className={`dg-marketing-preview dg-shell dark ${frameH} overflow-hidden bg-[#0b0c0e] p-3 sm:p-4 md:p-5`}
        >
          <div className="pointer-events-none h-full w-full select-none overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-black/10 bg-[#f5f5f6] shadow-[0_40px_80px_-48px_rgba(0,0,0,0.45)] ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-black/8 bg-white px-4 py-3">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" aria-hidden />
        <span className="size-2.5 rounded-full bg-[#febc2e]" aria-hidden />
        <span className="size-2.5 rounded-full bg-[#28c840]" aria-hidden />
        <span className="ml-2 truncate text-[12px] font-medium text-black/45">
          {title}
        </span>
      </div>
      <div
        className={`dg-marketing-preview ${frameH} overflow-hidden bg-[#fafafa] p-3 sm:p-4 md:p-5`}
      >
        <div className="pointer-events-none h-full w-full select-none overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
