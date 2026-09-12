import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import Mascot from "./Mascot";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function clearWelcomeParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("welcome")) return;
  url.searchParams.delete("welcome");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", next || "/");
}

type WelcomeIntroProps = {
  active: boolean;
  onComplete: () => void;
};

/** Light splash: mascot + Welcome To DeclineGuard → fade into open homepage. */
export default function WelcomeIntro({ active, onComplete }: WelcomeIntroProps) {
  const veilRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const ranRef = useRef(false);

  useLayoutEffect(() => {
    if (!active || ranRef.current) return;
    ranRef.current = true;

    const veil = veilRef.current;
    const content = contentRef.current;
    if (!veil || !content) {
      clearWelcomeParam();
      onComplete();
      return;
    }

    const finish = () => {
      clearWelcomeParam();
      onComplete();
    };

    if (prefersReducedMotion()) {
      gsap.set(veil, { autoAlpha: 0 });
      finish();
      return;
    }

    const tl = gsap.timeline({
      onComplete: finish,
    });

    gsap.set(veil, { autoAlpha: 1 });
    gsap.set(content, { autoAlpha: 0, y: 16, scale: 0.96 });

    tl.to(content, {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      duration: 0.7,
      ease: "power3.out",
    })
      .to({}, { duration: 0.55 })
      .to(content, {
        autoAlpha: 0,
        y: -12,
        duration: 0.45,
        ease: "power2.in",
      })
      .to(
        veil,
        {
          autoAlpha: 0,
          duration: 0.5,
          ease: "power2.inOut",
        },
        "-=0.15",
      );

    return () => {
      tl.kill();
    };
  }, [active, onComplete]);

  if (!active) return null;

  return (
    <div
      ref={veilRef}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-white"
      aria-hidden
    >
      <div
        ref={contentRef}
        className="flex flex-col items-center gap-5 px-6 text-center"
      >
        <Mascot size="lg" ring />
        <p className="font-display text-[clamp(1rem,2.5vw,1.35rem)] font-medium tracking-[0.04em] text-black/45">
          Welcome To
        </p>
        <p className="font-display text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-[-0.03em] text-black">
          DeclineGuard
        </p>
      </div>
    </div>
  );
}
