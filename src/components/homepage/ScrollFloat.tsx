import {
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./ScrollFloat.css";

gsap.registerPlugin(ScrollTrigger);

type ScrollFloatProps = {
  children: ReactNode;
  scrollContainerRef?: RefObject<HTMLElement | null>;
  containerClassName?: string;
  textClassName?: string;
  animationDuration?: number;
  ease?: string;
  scrollStart?: string;
  scrollEnd?: string;
  stagger?: number;
  /** 0–1 pin progress. When set, flies in then out instead of a window ScrollTrigger. */
  progressRef?: RefObject<number>;
};

const fromVars = {
  willChange: "opacity, transform",
  opacity: 0,
  yPercent: 120,
  scaleY: 2.3,
  scaleX: 0.7,
  transformOrigin: "50% 0%",
};

export default function ScrollFloat({
  children,
  scrollContainerRef,
  containerClassName = "",
  textClassName = "",
  animationDuration = 1,
  ease = "back.inOut(2)",
  scrollStart = "center bottom+=50%",
  scrollEnd = "bottom bottom-=40%",
  stagger = 0.03,
  progressRef,
}: ScrollFloatProps) {
  const containerRef = useRef<HTMLHeadingElement>(null);

  const splitText = useMemo(() => {
    const text = typeof children === "string" ? children : "";
    return text.split("\n").map((line, lineIndex) => (
      <span className="scroll-float-line" key={lineIndex}>
        {line.split(/(\s+)/).map((chunk, index) => {
          if (/^\s+$/.test(chunk)) {
            return (
              <span className="char-space" key={`${lineIndex}-${index}`}>
                {" "}
              </span>
            );
          }
          return (
            <span className="scroll-float-word" key={`${lineIndex}-${index}`}>
              {chunk.split("").map((char, charIndex) => (
                <span className="char" key={`${lineIndex}-${index}-${charIndex}`}>
                  {char}
                </span>
              ))}
            </span>
          );
        })}
      </span>
    ));
  }, [children]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const charElements = el.querySelectorAll(".char");
    if (charElements.length === 0) return;

    if (progressRef) {
      const tl = gsap.timeline({ paused: true });
      tl.fromTo(
        charElements,
        { ...fromVars },
        {
          duration: animationDuration,
          ease,
          opacity: 1,
          yPercent: 0,
          scaleY: 1,
          scaleX: 1,
          stagger,
        },
      );

      const tick = () => {
        const p = Math.min(1, Math.max(0, progressRef.current));
        const inBy = 0.42;
        tl.progress(p >= inBy ? 1 : p / inBy);
      };
      gsap.ticker.add(tick);
      tick();
      return () => {
        gsap.ticker.remove(tick);
        tl.kill();
      };
    }

    const scroller =
      scrollContainerRef?.current ? scrollContainerRef.current : window;

    const tween = gsap.fromTo(
      charElements,
      { ...fromVars },
      {
        duration: animationDuration,
        ease,
        opacity: 1,
        yPercent: 0,
        scaleY: 1,
        scaleX: 1,
        stagger,
        scrollTrigger: {
          trigger: el,
          scroller,
          start: scrollStart,
          end: scrollEnd,
          scrub: true,
        },
      },
    );

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [
    scrollContainerRef,
    animationDuration,
    ease,
    scrollStart,
    scrollEnd,
    stagger,
    progressRef,
  ]);

  return (
    <h2 ref={containerRef} className={`scroll-float ${containerClassName}`.trim()}>
      <span className={`scroll-float-text ${textClassName}`.trim()}>
        {splitText}
      </span>
    </h2>
  );
}
