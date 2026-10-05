import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LAYOUT_PRESET_IDS, type LayoutPresetId } from "@/lib/emailTheme";
import { TEMPLATE_META, type RecoveryTemplateId } from "@/lib/recoveryEmailCopy";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

const KITS: readonly LayoutPresetId[] = LAYOUT_PRESET_IDS;
const KIT_COUNT = KITS.length;
const PREVIEW_DAY: RecoveryTemplateId = "direct";
const SNAP = 0.18;
const OPEN = 0.2;
const CLOSE = 0.16;
const EASE = "power3.out";
const FADE_Y = 24;
const CLOSE_Y = 12;
const SWIPE_PX = 40;

type Phase = "browse" | "opening" | "focused" | "closing";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function wrapIndex(index: number): number {
  return ((index % KIT_COUNT) + KIT_COUNT) % KIT_COUNT;
}

function wrappedOffset(index: number, active: number): number {
  let delta = index - active;
  if (delta > KIT_COUNT / 2) delta -= KIT_COUNT;
  if (delta < -KIT_COUNT / 2) delta += KIT_COUNT;
  return delta;
}

function railMetrics(stageW: number): { cardW: number; step: number } {
  if (stageW <= 0) return { cardW: 280, step: 308 };
  const compact = stageW < 760;
  const sidePad = compact ? 20 : 36;
  const gap = compact ? 14 : 24;
  const visible = compact ? 1.2 : 3;
  const cardW = Math.max(
    196,
    Math.min(
      compact ? 304 : 336,
      Math.round((stageW - sidePad * 2 - gap * (visible - 1)) / visible),
    ),
  );
  return { cardW, step: cardW + gap };
}

function browseVars(
  offset: number,
  step: number,
): {
  x: number;
  y: number;
  yPercent: number;
  autoAlpha: number;
  zIndex: number;
  pointerEvents: "auto" | "none";
} {
  const hidden = Math.abs(offset) > 1;
  return {
    x: offset * step,
    y: 0,
    yPercent: -50,
    autoAlpha: hidden ? 0 : 1,
    zIndex: 6 - Math.abs(offset),
    pointerEvents: hidden ? "none" : "auto",
  };
}

export type KitGallerySliderProps = {
  kitLabel: (kitId: LayoutPresetId) => string;
  renderEmail: (kitId: LayoutPresetId, day: RecoveryTemplateId) => ReactNode;
};

export default function KitGallerySlider({
  kitLabel,
  renderEmail,
}: KitGallerySliderProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const kitEls = useRef<Array<HTMLDivElement | null>>([]);
  const day0Ref = useRef<HTMLDivElement | null>(null);
  const day5Ref = useRef<HTMLDivElement | null>(null);
  const phaseRef = useRef<Phase>("browse");
  const activeRef = useRef(0);
  const openTlRef = useRef<gsap.core.Timeline | null>(null);
  const closeTlRef = useRef<gsap.core.Timeline | null>(null);
  const pendingOpenRef = useRef(false);
  const pendingCloseRef = useRef(false);
  const touchStartX = useRef<number | null>(null);

  const [stageWidth, setStageWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("browse");
  const [openedKit, setOpenedKit] = useState<LayoutPresetId | null>(null);

  phaseRef.current = phase;
  activeRef.current = activeIndex;

  const { cardW, step: railStep } = railMetrics(stageWidth);
  const browsing = phase === "browse";
  const opened = openedKit != null && phase !== "browse";
  const activeKit = KITS[activeIndex];

  const layoutBrowse = useCallback(
    (animate: boolean) => {
      const reduced = prefersReducedMotion();
      const duration = !animate || reduced ? 0 : SNAP;
      kitEls.current.forEach((el, i) => {
        if (!el) return;
        const vars = {
          ...browseVars(wrappedOffset(i, activeRef.current), railStep),
          scale: 1,
          duration,
          ease: EASE,
          overwrite: "auto" as const,
        };
        if (duration === 0) gsap.set(el, vars);
        else gsap.to(el, vars);
      });
      const closeBtn = closeBtnRef.current;
      if (closeBtn) gsap.set(closeBtn, { y: CLOSE_Y, autoAlpha: 0 });
    },
    [railStep],
  );

  useGSAP(
    () => {
      if (phaseRef.current !== "browse") return;
      layoutBrowse(stageWidth > 0);
    },
    {
      scope: stageRef,
      dependencies: [activeIndex, stageWidth, railStep, layoutBrowse],
      revertOnUpdate: false,
    },
  );

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? stage.clientWidth;
      setStageWidth(width);
    });
    ro.observe(stage);
    setStageWidth(stage.clientWidth);
    return () => ro.disconnect();
  }, []);

  const applyFocusedEndStyles = useCallback(() => {
    const selected = activeRef.current;
    const el = kitEls.current[selected];
    if (el) {
      gsap.set(el, {
        x: 0,
        y: 0,
        yPercent: -50,
        scale: 1,
        autoAlpha: 1,
        zIndex: 20,
        pointerEvents: "auto",
      });
    }
    if (day0Ref.current) {
      gsap.set(day0Ref.current, { autoAlpha: 1, x: -railStep, yPercent: -50 });
    }
    if (day5Ref.current) {
      gsap.set(day5Ref.current, { autoAlpha: 1, x: railStep, yPercent: -50 });
    }
    if (closeBtnRef.current) {
      gsap.set(closeBtnRef.current, { y: 0, autoAlpha: 1 });
    }
    kitEls.current.forEach((node, i) => {
      if (!node || i === selected) return;
      gsap.set(node, {
        y: FADE_Y,
        autoAlpha: 0,
        pointerEvents: "none",
        zIndex: 1,
      });
    });
  }, [railStep]);

  const runOpenTimeline = useCallback(() => {
    const reduced = prefersReducedMotion();
    const duration = reduced ? 0.01 : OPEN;
    const selected = activeRef.current;
    const closeBtn = closeBtnRef.current;
    const day0 = day0Ref.current;
    const day5 = day5Ref.current;

    openTlRef.current?.kill();
    if (day0) gsap.set(day0, { autoAlpha: 0, x: 10, yPercent: -50 });
    if (day5) gsap.set(day5, { autoAlpha: 0, x: -10, yPercent: -50 });
    if (closeBtn) gsap.set(closeBtn, { y: CLOSE_Y, autoAlpha: 0 });

    const tl = gsap.timeline({
      defaults: { duration, ease: EASE, overwrite: "auto" },
      onComplete: () => {
        if (phaseRef.current !== "opening") return;
        setPhase("focused");
      },
    });
    openTlRef.current = tl;

    kitEls.current.forEach((el, i) => {
      if (!el) return;
      if (i === selected) {
        tl.to(
          el,
          { x: 0, y: 0, yPercent: -50, scale: 1, autoAlpha: 1, zIndex: 20 },
          0,
        );
        return;
      }
      tl.to(
        el,
        {
          y: FADE_Y,
          autoAlpha: 0,
          pointerEvents: "none",
          zIndex: 1,
        },
        0,
      );
    });
    if (day0) tl.to(day0, { autoAlpha: 1, x: -railStep }, 0);
    if (day5) tl.to(day5, { autoAlpha: 1, x: railStep }, 0);
    if (closeBtn) tl.to(closeBtn, { y: 0, autoAlpha: 1 }, 0);
  }, [railStep]);

  const runCloseTimeline = useCallback(() => {
    const reduced = prefersReducedMotion();
    const duration = reduced ? 0.01 : CLOSE;
    const closeBtn = closeBtnRef.current;
    const day0 = day0Ref.current;
    const day5 = day5Ref.current;

    closeTlRef.current?.kill();
    const tl = gsap.timeline({
      defaults: { duration, ease: EASE, overwrite: "auto" },
      onComplete: () => {
        if (phaseRef.current !== "closing") return;
        setOpenedKit(null);
        setPhase("browse");
      },
    });
    closeTlRef.current = tl;

    if (day0) tl.to(day0, { autoAlpha: 0, x: 10 }, 0);
    if (day5) tl.to(day5, { autoAlpha: 0, x: -10 }, 0);
    if (closeBtn) tl.to(closeBtn, { y: CLOSE_Y, autoAlpha: 0 }, 0);
    kitEls.current.forEach((el, i) => {
      if (!el) return;
      tl.to(
        el,
        {
          ...browseVars(wrappedOffset(i, activeRef.current), railStep),
          scale: 1,
        },
        0,
      );
    });
  }, [railStep]);

  useLayoutEffect(() => {
    if (phase === "opening" && pendingOpenRef.current) {
      pendingOpenRef.current = false;
      runOpenTimeline();
    }
    if (phase === "closing" && pendingCloseRef.current) {
      pendingCloseRef.current = false;
      runCloseTimeline();
    }
  }, [phase, openedKit, runCloseTimeline, runOpenTimeline]);

  useLayoutEffect(() => {
    if (phase !== "focused" || openedKit == null) return;
    applyFocusedEndStyles();
  }, [applyFocusedEndStyles, openedKit, phase]);

  const closeFocus = useCallback(() => {
    if (phaseRef.current !== "focused" && phaseRef.current !== "opening") {
      return;
    }
    phaseRef.current = "closing";
    pendingOpenRef.current = false;
    openTlRef.current?.kill();
    openTlRef.current = null;
    pendingCloseRef.current = true;
    setPhase("closing");
  }, []);

  const openKit = useCallback((kitId: LayoutPresetId) => {
    if (phaseRef.current !== "browse") return;
    const next = KITS.indexOf(kitId);
    if (next < 0) return;
    phaseRef.current = "opening";
    pendingOpenRef.current = true;
    setActiveIndex(next);
    activeRef.current = next;
    setOpenedKit(kitId);
    setPhase("opening");
  }, []);

  const stepRail = useCallback((dir: -1 | 1) => {
    if (phaseRef.current !== "browse") return;
    setActiveIndex((current) => wrapIndex(current + dir));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "Escape") {
        if (phaseRef.current === "focused" || phaseRef.current === "opening") {
          e.preventDefault();
          closeFocus();
        }
        return;
      }
      if (phaseRef.current !== "browse") return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepRail(-1);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        stepRail(1);
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        const kitId = KITS[activeRef.current];
        if (!kitId) return;
        if (e.key === " " && target instanceof HTMLButtonElement) return;
        e.preventDefault();
        openKit(kitId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeFocus, openKit, stepRail]);

  const onTouchStart = (clientX: number) => {
    if (!browsing) return;
    touchStartX.current = clientX;
  };

  const onTouchEnd = (clientX: number) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null || !browsing) return;
    const dx = clientX - start;
    if (dx > SWIPE_PX) stepRail(-1);
    else if (dx < -SWIPE_PX) stepRail(1);
  };

  return (
    <div
      ref={rootRef}
      role="region"
      aria-roledescription="carousel"
      aria-label="Recovery email kits"
      className="relative flex min-h-0 flex-1 flex-col bg-white"
    >
      <div
        ref={stageRef}
        className="relative min-h-0 flex-1 overflow-hidden outline-none"
        tabIndex={0}
        onTouchStart={(e) => onTouchStart(e.changedTouches[0]?.clientX ?? 0)}
        onTouchEnd={(e) => onTouchEnd(e.changedTouches[0]?.clientX ?? 0)}
      >
        {KITS.map((kitId, index) => {
          const selected = openedKit === kitId;
          return (
            <div
              key={kitId}
              ref={(node) => {
                kitEls.current[index] = node;
              }}
              className="absolute top-1/2 left-1/2 will-change-transform"
              style={{ width: cardW, marginLeft: -cardW / 2 }}
            >
              <SlideCaption day={PREVIEW_DAY} kitName={kitLabel(kitId)} />
              <button
                type="button"
                disabled={!browsing}
                aria-label={`Open ${kitLabel(kitId)} recovery kit`}
                aria-expanded={selected && !browsing}
                className={cn(
                  "block w-full appearance-none border-0 bg-transparent p-0 text-left",
                  browsing ? "cursor-pointer" : "cursor-default",
                )}
                onClick={() => {
                  if (!browsing) return;
                  openKit(kitId);
                }}
              >
                <EmailFrame scrollable={opened && selected}>
                  {renderEmail(kitId, PREVIEW_DAY)}
                </EmailFrame>
              </button>
            </div>
          );
        })}

        {openedKit != null && opened ? (
          <>
            <div
              ref={day0Ref}
              className="absolute top-1/2 left-1/2 will-change-transform"
              style={{ width: cardW, marginLeft: -cardW / 2 }}
              aria-hidden={phase !== "focused"}
            >
              <SlideCaption day="gentle" kitName={kitLabel(openedKit)} />
              <EmailFrame scrollable>
                {renderEmail(openedKit, "gentle")}
              </EmailFrame>
            </div>
            <div
              ref={day5Ref}
              className="absolute top-1/2 left-1/2 will-change-transform"
              style={{ width: cardW, marginLeft: -cardW / 2 }}
              aria-hidden={phase !== "focused"}
            >
              <SlideCaption day="urgent" kitName={kitLabel(openedKit)} />
              <EmailFrame scrollable>
                {renderEmail(openedKit, "urgent")}
              </EmailFrame>
            </div>
          </>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center">
          <button
            ref={closeBtnRef}
            type="button"
            onClick={closeFocus}
            disabled={browsing}
            tabIndex={browsing ? -1 : 0}
            className={cn(
              "dg-btn cursor-pointer !px-5 !py-2 text-[13px] font-semibold opacity-0",
              browsing ? "pointer-events-none" : "pointer-events-auto",
            )}
          >
            Close
          </button>
        </div>
      </div>

      <div
        className={cn(
          "flex shrink-0 flex-col items-center gap-3 px-4 pb-5 pt-1",
          browsing ? "visible" : "invisible pointer-events-none",
        )}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Previous kit"
            onClick={() => stepRail(-1)}
            className="dg-interactive flex size-9 items-center justify-center rounded-full border border-black/8 bg-white text-[#08090a]"
          >
            <ChevronLeft className="size-4" />
          </button>
          <p className="min-w-[10rem] text-center text-[13px] font-semibold tracking-[-0.02em] text-[#08090a]">
            {activeKit ? kitLabel(activeKit) : ""}
          </p>
          <button
            type="button"
            aria-label="Next kit"
            onClick={() => stepRail(1)}
            className="dg-interactive flex size-9 items-center justify-center rounded-full border border-black/8 bg-white text-[#08090a]"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="flex gap-1.5" role="tablist" aria-label="Kits">
          {KITS.map((kitId, index) => {
            const selected = index === activeIndex;
            return (
              <button
                key={kitId}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-label={kitLabel(kitId)}
                onClick={() => {
                  if (phaseRef.current !== "browse") return;
                  setActiveIndex(index);
                }}
                className={cn(
                  "h-1.5 rounded-full",
                  selected ? "w-5 bg-[#08090a]" : "w-1.5 bg-black/20 hover:bg-black/35",
                )}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EmailFrame({
  children,
  scrollable,
}: {
  children: ReactNode;
  scrollable: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-black/10 bg-white shadow-[0_10px_24px_-18px_rgba(0,0,0,0.5)]",
        scrollable
          ? "max-h-[min(30rem,calc(100dvh-12rem))] overflow-y-auto"
          : "h-[min(24rem,calc(100dvh-14rem))]",
      )}
    >
      <div className={scrollable ? undefined : "pointer-events-none"}>
        {children}
      </div>
      {scrollable ? null : (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white to-transparent"
        />
      )}
    </div>
  );
}

function SlideCaption({
  day,
  kitName,
}: {
  day: RecoveryTemplateId;
  kitName: string;
}) {
  const meta = TEMPLATE_META[day];
  return (
    <div className="mb-2 min-w-0 text-center">
      <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#8a8f98]">
        {meta.day}
      </p>
      <p className="mt-0.5 truncate text-[13px] font-semibold tracking-[-0.02em] text-[#08090a]">
        {kitName}
      </p>
    </div>
  );
}

export { KITS, PREVIEW_DAY };
