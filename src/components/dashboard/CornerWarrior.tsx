import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";

/** Tuned placement — Overview wave + Sequences fingers share this spot */
export const CORNER_WARRIOR_IMG_CLASS =
  "absolute top-24 -right-20 h-full w-auto max-w-none origin-center translate-x-[35%] -translate-y-[20%] rotate-[-20deg] select-none object-contain drop-shadow-[0_18px_40px_-12px_rgba(0,0,0,0.14)]";

export const CORNER_WARRIOR_SHELL_CLASS =
  "pointer-events-none fixed top-0 right-0 z-50 h-[min(70vh,36rem)] w-[min(48vw,22rem)] overflow-visible";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type ShellProps = {
  className?: string;
  /** Slide in from the right on mount */
  slideIn?: boolean;
  children: ReactNode;
};

/**
 * Shared fixed top-right shell (optional slide-in).
 * Must sit outside the page’s overflow-y scroller (see Overview / Recoveries)
 * so the overhang does not widen the scrollport.
 */
export function CornerWarriorShell({
  className = "",
  slideIn = true,
  children,
}: ShellProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slideIn) return;
    const el = rootRef.current;
    if (!el) return;

    const reduced = prefersReducedMotion();
    gsap.killTweensOf(el);

    if (reduced) {
      gsap.set(el, { x: 0, opacity: 1 });
      return;
    }

    gsap.set(el, { x: "60%", opacity: 0 });
    const tween = gsap.to(el, {
      x: 0,
      opacity: 1,
      duration: 0.85,
      delay: 0.12,
      ease: "power3.out",
    });

    return () => {
      tween.kill();
    };
  }, [slideIn]);

  return (
    <div
      ref={rootRef}
      className={`${CORNER_WARRIOR_SHELL_CLASS} ${className}`}
      aria-hidden
    >
      {children}
    </div>
  );
}
