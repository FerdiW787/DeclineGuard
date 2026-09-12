import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import gsap from "gsap";

export type PageEnterHandle = {
  /** Fade the page out, then run `onDone` (e.g. swap nav). */
  exit: (onDone: () => void) => void;
};

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Soft page entrance — stagger `[data-enter]` children once per `pageKey`.
 * Falls back to fading the root when no markers are present.
 * Skips when prefers-reduced-motion.
 */
const PageEnter = forwardRef<
  PageEnterHandle,
  {
    pageKey: string;
    children: ReactNode;
  }
>(function PageEnter({ pageKey, children }, ref) {
  const rootRef = useRef<HTMLDivElement>(null);
  const exitingRef = useRef(false);

  useImperativeHandle(ref, () => ({
    exit: (onDone) => {
      const root = rootRef.current;
      if (!root || prefersReducedMotion() || exitingRef.current) {
        onDone();
        return;
      }

      exitingRef.current = true;
      gsap.killTweensOf(root);
      gsap.to(root, {
        opacity: 0,
        y: 10,
        duration: 0.2,
        ease: "power2.in",
        onComplete: () => {
          exitingRef.current = false;
          onDone();
        },
      });
    },
  }));

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = prefersReducedMotion();
    const items = root.querySelectorAll<HTMLElement>("[data-enter]");
    const targets = items.length > 0 ? items : [root];

    gsap.killTweensOf(targets);
    gsap.set(root, { opacity: 1, y: 0 });

    if (reduced) {
      gsap.set(targets, { clearProps: "all", opacity: 1, y: 0 });
      return;
    }

    gsap.fromTo(
      targets,
      { opacity: 0, y: 14 },
      {
        opacity: 1,
        y: 0,
        duration: 0.42,
        stagger: items.length > 0 ? 0.055 : 0,
        ease: "power2.out",
        clearProps: "transform",
      },
    );
  }, [pageKey]);

  return (
    <div
      ref={rootRef}
      className="dg-page-enter flex h-full min-h-0 flex-1 flex-col"
    >
      {children}
    </div>
  );
});

export default PageEnter;
