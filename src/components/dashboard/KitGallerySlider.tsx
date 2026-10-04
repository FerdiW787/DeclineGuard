import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { LAYOUT_PRESET_IDS, type LayoutPresetId } from "@/lib/emailTheme";
import { TEMPLATE_META, type RecoveryTemplateId } from "@/lib/recoveryEmailCopy";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

const KITS: readonly LayoutPresetId[] = LAYOUT_PRESET_IDS;
const KIT_COUNT = KITS.length;
const SLOT_COUNT = KIT_COUNT * 3;
const MIDDLE_COPY = KIT_COUNT;
const PREVIEW_DAY: RecoveryTemplateId = "direct";
const SNAP_EASE = "power3.out";
const OPEN_DURATION = 0.38;
const CLOSE_DURATION = 0.28;
const DRAG_THRESHOLD = 8;
const FADE_Y = 52;
const CLOSE_Y = 40;

type Phase = "browse" | "opening" | "focused" | "closing";

type DragState = {
  pointerId: number;
  startX: number;
  startTrackX: number;
  moved: boolean;
};

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function layoutForStage(stageW: number): { cardW: number; gap: number } {
  const pad = 56;
  const usable = Math.max(0, stageW - pad);
  const minGap = 16;
  const maxCard = 340;
  const minCard = 168;
  const cardW = Math.max(
    minCard,
    Math.min(maxCard, Math.floor((usable - minGap * 2) / 3)),
  );
  const leftover = Math.max(0, usable - cardW * 3);
  const gap = Math.max(minGap, Math.min(36, Math.round(leftover / 2)));
  return { cardW, gap };
}

function xForSlot(
  slot: number,
  stageW: number,
  cardW: number,
  gap: number,
): number {
  const stride = cardW + gap;
  return stageW / 2 - slot * stride - cardW / 2;
}

function wrapToMiddle(slot: number): number {
  const kit = ((slot % KIT_COUNT) + KIT_COUNT) % KIT_COUNT;
  return MIDDLE_COPY + kit;
}

function slotFromTrackX(
  trackX: number,
  stageW: number,
  cardW: number,
  gap: number,
): number {
  const stride = cardW + gap;
  if (stride <= 0) return MIDDLE_COPY;
  const raw = (stageW / 2 - cardW / 2 - trackX) / stride;
  return Math.max(0, Math.min(SLOT_COUNT - 1, Math.round(raw)));
}

/** End styles for the open/focused kit. Re-apply after useGSAP reverts. */
function applyFocusedEndStyles(
  track: HTMLElement,
  closeBtn: HTMLElement | null,
  kitEls: Array<HTMLDivElement | null>,
  day0: HTMLElement | null,
  day5: HTMLElement | null,
  focusedSlot: number,
  stageW: number,
  cardW: number,
  gap: number,
): number {
  const focusX = xForSlot(focusedSlot, stageW, cardW, gap);
  gsap.set(track, { x: focusX });
  if (day0) gsap.set(day0, { autoAlpha: 1, x: 0 });
  if (day5) gsap.set(day5, { autoAlpha: 1, x: 0 });
  if (closeBtn) gsap.set(closeBtn, { y: 0, autoAlpha: 1 });
  kitEls.forEach((el, i) => {
    if (!el) return;
    if (i === focusedSlot) {
      gsap.set(el, { y: 0, autoAlpha: 1, pointerEvents: "auto" });
      return;
    }
    gsap.set(el, {
      y: FADE_Y,
      autoAlpha: 0,
      pointerEvents: "none",
    });
  });
  return focusX;
}

export type KitGallerySliderProps = {
  kitLabel: (kitId: LayoutPresetId) => string;
  renderEmail: (kitId: LayoutPresetId, day: RecoveryTemplateId) => ReactNode;
};

export default function KitGallerySlider({
  kitLabel,
  renderEmail,
}: KitGallerySliderProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const closeWrapRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const kitEls = useRef<Array<HTMLDivElement | null>>([]);
  const day0Ref = useRef<HTMLDivElement | null>(null);
  const day5Ref = useRef<HTMLDivElement | null>(null);
  const trackXRef = useRef(0);
  const browseTrackXRef = useRef(0);
  const currentSlotRef = useRef(MIDDLE_COPY);
  const dragRef = useRef<DragState | null>(null);
  const ignoreClickRef = useRef(false);
  const phaseRef = useRef<Phase>("browse");
  const wrapTimerRef = useRef<number | null>(null);
  const openTlRef = useRef<gsap.core.Timeline | null>(null);

  const [stageWidth, setStageWidth] = useState(0);
  const [phase, setPhase] = useState<Phase>("browse");
  const [focusedSlot, setFocusedSlot] = useState<number | null>(null);
  const [currentSlot, setCurrentSlot] = useState(MIDDLE_COPY);
  const [dragging, setDragging] = useState(false);

  phaseRef.current = phase;
  currentSlotRef.current = currentSlot;

  const { cardW, gap } = layoutForStage(stageWidth);
  const browsing = phase === "browse";

  const applyTrackX = (x: number, animate: boolean, duration = 0.34) => {
    const track = trackRef.current;
    if (!track) return;
    trackXRef.current = x;
    gsap.killTweensOf(track);
    if (!animate || prefersReducedMotion()) {
      gsap.set(track, { x });
      return;
    }
    gsap.to(track, {
      x,
      duration,
      ease: SNAP_EASE,
      overwrite: "auto",
      onUpdate: () => {
        trackXRef.current = Number(gsap.getProperty(track, "x"));
      },
      onComplete: () => {
        trackXRef.current = x;
      },
    });
  };

  const snapToSlot = useCallback(
    (slot: number, animate: boolean) => {
      const stageW = stageRef.current?.clientWidth ?? stageWidth;
      if (stageW <= 0) return;
      const wrapped = wrapToMiddle(slot);
      const target = xForSlot(slot, stageW, cardW, gap);
      applyTrackX(target, animate);
      if (wrapped !== slot) {
        const jump = () => {
          wrapTimerRef.current = null;
          const wrappedX = xForSlot(wrapped, stageW, cardW, gap);
          applyTrackX(wrappedX, false);
          setCurrentSlot(wrapped);
          currentSlotRef.current = wrapped;
        };
        if (!animate || prefersReducedMotion()) {
          jump();
          return;
        }
        if (wrapTimerRef.current != null) {
          window.clearTimeout(wrapTimerRef.current);
        }
        wrapTimerRef.current = window.setTimeout(jump, 360);
      } else {
        setCurrentSlot(slot);
        currentSlotRef.current = slot;
      }
    },
    [cardW, gap, stageWidth],
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
    return () => {
      ro.disconnect();
      if (wrapTimerRef.current != null) {
        window.clearTimeout(wrapTimerRef.current);
      }
    };
  }, []);

  useGSAP(
    () => {
      const track = trackRef.current;
      const closeBtn = closeBtnRef.current;
      if (!track) return;
      const stageW = stageRef.current?.clientWidth ?? stageWidth;
      if (stageW <= 0) return;
      const reduced = prefersReducedMotion();
      const duration = reduced ? 0.01 : OPEN_DURATION;

      if (phase === "browse") {
        const x = xForSlot(currentSlotRef.current, stageW, cardW, gap);
        trackXRef.current = x;
        gsap.set(track, { x });
        if (closeBtn) gsap.set(closeBtn, { y: CLOSE_Y, autoAlpha: 0 });
        kitEls.current.forEach((el) => {
          if (el) gsap.set(el, { y: 0, autoAlpha: 1, pointerEvents: "auto" });
        });
        return;
      }

      if (phase === "focused" && focusedSlot != null) {
        trackXRef.current = applyFocusedEndStyles(
          track,
          closeBtn,
          kitEls.current,
          day0Ref.current,
          day5Ref.current,
          focusedSlot,
          stageW,
          cardW,
          gap,
        );
        return;
      }

      if (phase === "opening" && focusedSlot != null) {
        const others = kitEls.current.filter(
          (el, i) => el && i !== focusedSlot,
        );
        const day0 = day0Ref.current;
        const day5 = day5Ref.current;
        const focusX = xForSlot(focusedSlot, stageW, cardW, gap);
        if (day0) gsap.set(day0, { autoAlpha: 0, x: 18 });
        if (day5) gsap.set(day5, { autoAlpha: 0, x: -18 });
        if (closeBtn) gsap.set(closeBtn, { y: CLOSE_Y, autoAlpha: 0 });

        openTlRef.current?.kill();
        const tl = gsap.timeline({
          defaults: { duration, ease: SNAP_EASE, overwrite: "auto" },
          onComplete: () => {
            if (phaseRef.current !== "opening") return;
            trackXRef.current = focusX;
            setPhase("focused");
          },
        });
        openTlRef.current = tl;
        tl.to(track, { x: focusX }, 0);
        if (others.length > 0) {
          tl.to(
            others,
            {
              y: FADE_Y,
              autoAlpha: 0,
              pointerEvents: "none",
              stagger: reduced ? 0 : 0.018,
            },
            0,
          );
        }
        if (day0) {
          tl.to(day0, { autoAlpha: 1, x: 0, duration: reduced ? 0.01 : 0.32 }, 0.06);
        }
        if (day5) {
          tl.to(day5, { autoAlpha: 1, x: 0, duration: reduced ? 0.01 : 0.32 }, 0.06);
        }
        if (closeBtn) {
          tl.to(
            closeBtn,
            { y: 0, autoAlpha: 1, duration: reduced ? 0.01 : 0.3 },
            0.04,
          );
        }
        return;
      }

      if (phase === "closing" && focusedSlot != null) {
        openTlRef.current?.kill();
        openTlRef.current = null;
        const others = kitEls.current.filter(
          (el, i) => el && i !== focusedSlot,
        );
        const day0 = day0Ref.current;
        const day5 = day5Ref.current;
        applyFocusedEndStyles(
          track,
          closeBtn,
          kitEls.current,
          day0,
          day5,
          focusedSlot,
          stageW,
          cardW,
          gap,
        );
        const backX = browseTrackXRef.current;
        const closeDur = reduced ? 0.01 : CLOSE_DURATION;
        const tl = gsap.timeline({
          defaults: { ease: "power2.in", overwrite: "auto" },
          onComplete: () => {
            trackXRef.current = backX;
            setFocusedSlot(null);
            setPhase("browse");
            const snapped = slotFromTrackX(backX, stageW, cardW, gap);
            const wrapped = wrapToMiddle(snapped);
            if (wrapped !== snapped) {
              const wrappedX = xForSlot(wrapped, stageW, cardW, gap);
              applyTrackX(wrappedX, false);
              setCurrentSlot(wrapped);
              currentSlotRef.current = wrapped;
            } else {
              setCurrentSlot(snapped);
              currentSlotRef.current = snapped;
            }
          },
        });
        if (day0) tl.to(day0, { autoAlpha: 0, duration: closeDur }, 0);
        if (day5) tl.to(day5, { autoAlpha: 0, duration: closeDur }, 0);
        if (closeBtn) {
          tl.to(closeBtn, { y: CLOSE_Y, autoAlpha: 0, duration: closeDur }, 0);
        }
        tl.to(
          track,
          { x: backX, duration: reduced ? 0.01 : 0.36, ease: SNAP_EASE },
          0.04,
        );
        if (others.length > 0) {
          tl.to(
            others,
            {
              y: 0,
              autoAlpha: 1,
              pointerEvents: "auto",
              duration: reduced ? 0.01 : 0.36,
              ease: SNAP_EASE,
              stagger: reduced ? 0 : 0.016,
            },
            0.04,
          );
        }
      }
    },
    {
      scope: stageRef,
      dependencies: [phase, focusedSlot, cardW, gap, stageWidth],
      revertOnUpdate: false,
    },
  );

  const closeFocus = useCallback(() => {
    if (phaseRef.current !== "focused" && phaseRef.current !== "opening") {
      return;
    }
    phaseRef.current = "closing";
    openTlRef.current?.kill();
    openTlRef.current = null;
    setPhase("closing");
  }, []);

  const openSlot = useCallback((slot: number) => {
    if (phaseRef.current !== "browse") return;
    browseTrackXRef.current = trackXRef.current;
    setFocusedSlot(slot);
    setCurrentSlot(slot);
    currentSlotRef.current = slot;
    setPhase("opening");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (phaseRef.current === "focused" || phaseRef.current === "opening") {
          e.preventDefault();
          closeFocus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeFocus]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      if (phaseRef.current !== "browse") return;
      const dx = e.deltaX !== 0 ? e.deltaX : e.shiftKey ? e.deltaY : 0;
      if (dx === 0) return;
      e.preventDefault();
      const track = trackRef.current;
      if (!track) return;
      const next = trackXRef.current - dx;
      trackXRef.current = next;
      gsap.set(track, { x: next });
      if (wrapTimerRef.current != null) {
        window.clearTimeout(wrapTimerRef.current);
      }
      wrapTimerRef.current = window.setTimeout(() => {
        wrapTimerRef.current = null;
        const stageW = stageRef.current?.clientWidth ?? stageWidth;
        const nearest = slotFromTrackX(trackXRef.current, stageW, cardW, gap);
        snapToSlot(nearest, true);
      }, 80);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [cardW, gap, snapToSlot, stageWidth]);

  const onStagePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!browsing || e.button !== 0) return;
    const stage = stageRef.current;
    if (!stage) return;
    stage.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startTrackX: trackXRef.current,
      moved: false,
    };
    ignoreClickRef.current = false;
    setDragging(false);
  };

  const onStagePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const track = trackRef.current;
    if (!drag || drag.pointerId !== e.pointerId || !track || !browsing) return;
    const dx = e.clientX - drag.startX;
    if (Math.abs(dx) > DRAG_THRESHOLD) {
      drag.moved = true;
      ignoreClickRef.current = true;
      if (!dragging) setDragging(true);
    }
    if (!drag.moved) return;
    const next = drag.startTrackX + dx;
    trackXRef.current = next;
    gsap.set(track, { x: next });
  };

  const finishDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (!drag.moved || !browsing) return;
    const stageW = stageRef.current?.clientWidth ?? stageWidth;
    const nearest = slotFromTrackX(trackXRef.current, stageW, cardW, gap);
    snapToSlot(nearest, true);
  };

  return (
    <div
      ref={stageRef}
      className={cn(
        "relative flex min-h-0 flex-1 touch-pan-y overflow-hidden bg-white",
        browsing && !dragging ? "cursor-grab" : "cursor-default",
        dragging && "cursor-grabbing",
      )}
      onPointerDown={onStagePointerDown}
      onPointerMove={onStagePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      <div
        ref={trackRef}
        className="absolute inset-y-0 left-0 flex items-center will-change-transform"
      >
        {Array.from({ length: SLOT_COUNT }, (_, slot) => {
          const kitId = KITS[slot % KIT_COUNT]!;
          const focused = focusedSlot === slot;
          const showWings = focused && (phase === "opening" || phase === "focused" || phase === "closing");
          return (
            <div
              key={slot}
              ref={(node) => {
                kitEls.current[slot] = node;
              }}
              className="relative shrink-0"
              style={{ width: cardW, marginRight: gap }}
            >
              {showWings ? (
                <div
                  className="absolute top-0 right-full z-[2]"
                  style={{ width: cardW, marginRight: gap }}
                  aria-hidden={phase !== "focused"}
                >
                  <div ref={day0Ref}>
                    <DayLabel day="gentle" kitName={kitLabel(kitId)} />
                    <div className="pointer-events-none">
                      {renderEmail(kitId, "gentle")}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="relative z-[3]">
                <DayLabel
                  day={PREVIEW_DAY}
                  kitName={kitLabel(kitId)}
                  emphasize={focused || browsing}
                />
                <button
                  type="button"
                  disabled={!browsing}
                  aria-label={`Open ${kitLabel(kitId)} recovery kit`}
                  aria-expanded={focused}
                  className={cn(
                    "block w-full appearance-none border-0 bg-transparent p-0 text-left",
                    browsing ? "cursor-pointer" : "cursor-default",
                  )}
                  onClick={() => {
                    if (ignoreClickRef.current) {
                      ignoreClickRef.current = false;
                      return;
                    }
                    if (!browsing) return;
                    openSlot(slot);
                  }}
                >
                  {renderEmail(kitId, PREVIEW_DAY)}
                </button>
              </div>

              {showWings ? (
                <div
                  className="absolute top-0 left-full z-[2]"
                  style={{ width: cardW, marginLeft: gap }}
                  aria-hidden={phase !== "focused"}
                >
                  <div ref={day5Ref}>
                    <DayLabel day="urgent" kitName={kitLabel(kitId)} />
                    <div className="pointer-events-none">
                      {renderEmail(kitId, "urgent")}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div
        ref={closeWrapRef}
        className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center"
      >
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
  );
}

function DayLabel({
  day,
  kitName,
  emphasize = true,
}: {
  day: RecoveryTemplateId;
  kitName: string;
  emphasize?: boolean;
}) {
  const meta = TEMPLATE_META[day];
  return (
    <div className="mb-2.5 min-w-0 text-center">
      <p
        className={cn(
          "text-[11px] font-medium tracking-[-0.01em]",
          emphasize ? "text-[#08090a]" : "text-[#8a8f98]",
        )}
      >
        <span className="uppercase tracking-[0.08em]">{meta.day}</span>
        <span className="mx-1.5 text-[#8a8f98]/50">·</span>
        {meta.label}
      </p>
      <p
        className={cn(
          "mt-1 truncate text-[13px] font-medium tracking-[-0.015em]",
          emphasize ? "text-[#08090a]" : "text-[#6b6f76]",
        )}
      >
        {kitName}
      </p>
    </div>
  );
}

export { KITS, PREVIEW_DAY };
