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
import { TEMPLATE_META, type RecoveryTemplateId } from "@/lib/recoveryEmailCopy";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

const SWIPE_PX = 56;
const STAGE_PAD = 0;
const MIN_CARD = 240;
const TARGET_CARD = 400;
const MIN_GAP = 36;
const TARGET_GAP = 56;

function layoutForStage(stageW: number): { cardW: number; gap: number } {
  const usable = Math.max(0, stageW - STAGE_PAD * 2);
  if (usable <= 0) return { cardW: MIN_CARD, gap: MIN_GAP };
  const targetTotal = TARGET_CARD * 3 + TARGET_GAP * 2;
  const scale = targetTotal > usable ? usable / targetTotal : 1;
  return {
    cardW: Math.max(MIN_CARD, Math.round(TARGET_CARD * scale)),
    gap: Math.max(MIN_GAP, Math.round(TARGET_GAP * scale)),
  };
}

type InboxMeta = {
  from: string;
  subject: string;
};

type Props = {
  templates: readonly RecoveryTemplateId[];
  selected: RecoveryTemplateId;
  onSelect: (id: RecoveryTemplateId) => void;
  inboxMeta: (id: RecoveryTemplateId) => InboxMeta;
  renderEmail: (id: RecoveryTemplateId, frameWidth: number) => ReactNode;
  focusMode: boolean;
  primaryColor: string;
  onEnterFocus: (id: RecoveryTemplateId) => void;
  onExitFocus: () => void;
};

export default function EmailCoverflow({
  templates,
  selected,
  onSelect,
  inboxMeta,
  renderEmail,
  focusMode,
  onEnterFocus,
  onExitFocus,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const pressRef = useRef<{
    id: RecoveryTemplateId;
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);
  const selectedIndex = templates.indexOf(selected);
  const [stageWidth, setStageWidth] = useState(0);
  const browse = layoutForStage(stageWidth);
  const focusCardW = Math.min(
    520,
    Math.max(browse.cardW, Math.round((stageWidth || browse.cardW) * 0.42)),
  );
  const cardW = focusMode ? focusCardW : browse.cardW;
  const gap = focusMode ? 0 : browse.gap;

  const stepBy = useCallback(
    (dir: -1 | 1) => {
      const next = selectedIndex + dir;
      if (next < 0 || next >= templates.length) return;
      const id = templates[next];
      if (id) onSelect(id);
    },
    [onSelect, selectedIndex, templates],
  );

  useGSAP(
    () => {
      const stage = stageRef.current;
      if (!stage) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches;
      templates.forEach((_, i) => {
        const el = cardRefs.current[i];
        if (!el) return;
        const offset = i - selectedIndex;
        const abs = Math.abs(offset);
        const focused = offset === 0;
        const hidden = focusMode && !focused;
        const vars = {
          rotateY: focusMode ? 0 : offset * -12,
          z: focused ? 48 : -16,
          opacity: hidden ? 0 : focused ? 1 : Math.max(0.7, 1 - abs * 0.12),
          transformPerspective: 1400,
          force3D: true,
        };
        if (reduced || stageWidth === 0) {
          gsap.set(el, vars);
          return;
        }
        gsap.to(el, {
          ...vars,
          duration: 0.55,
          ease: "power3.out",
          overwrite: "auto",
        });
      });
    },
    {
      dependencies: [selectedIndex, templates, cardW, gap, stageWidth, focusMode],
      scope: stageRef,
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

  const onCardPointerDown = (
    id: RecoveryTemplateId,
    e: ReactPointerEvent<HTMLElement>,
  ) => {
    if (e.button !== 0) return;
    pressRef.current = {
      id,
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
    };
  };

  const onCardPointerUp = (
    id: RecoveryTemplateId,
    e: ReactPointerEvent<HTMLElement>,
  ) => {
    const press = pressRef.current;
    pressRef.current = null;
    if (!press || press.pointerId !== e.pointerId || press.id !== id) return;
    const dx = e.clientX - press.x;
    const dy = e.clientY - press.y;
    if (focusMode) return;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) >= Math.abs(dy)) {
      stepBy(dx > 0 ? -1 : 1);
      return;
    }
    if (Math.hypot(dx, dy) > 18) return;
    onEnterFocus(id);
  };

  return (
    <div
      ref={stageRef}
      className={cn(
        "relative flex min-h-0 flex-1 touch-pan-y items-center justify-center overflow-hidden px-7 pb-24 [perspective:1400px]",
        focusMode && "cursor-default",
      )}
      style={{ gap }}
      onClick={(e) => {
        if (!focusMode) return;
        if (e.target === e.currentTarget) onExitFocus();
      }}
    >
      {focusMode ? (
        <button
          type="button"
          aria-label="Exit focus"
          onClick={onExitFocus}
          className="absolute inset-0 z-0 cursor-default bg-white"
        />
      ) : null}
      {templates.map((id, i) => {
        const focused = id === selected;
        const hidden = focusMode && !focused;
        const meta = TEMPLATE_META[id];
        const inbox = inboxMeta(id);
        return (
          <div
            key={id}
            ref={(node) => {
              cardRefs.current[i] = node;
            }}
            style={{
              width: hidden ? 0 : cardW,
              opacity: hidden ? 0 : undefined,
            }}
            className={cn(
              "relative z-10 shrink-0 overflow-hidden transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] [transform-style:preserve-3d]",
              focused ? "z-20" : "z-10",
              hidden && "pointer-events-none border-0",
            )}
          >
            <div
              className={cn(
                "mb-2.5 min-w-0 text-center transition-colors duration-300",
                hidden && "sr-only",
              )}
            >
              <p
                className={cn(
                  "text-[11px] font-medium tracking-[-0.01em] transition-colors",
                  focused ? "text-[#08090a]" : "text-[#8a8f98]",
                )}
              >
                <span className="uppercase tracking-[0.08em]">{meta.day}</span>
                <span className="mx-1.5 text-[#8a8f98]/50">·</span>
                {meta.label}
              </p>
              <p
                className={cn(
                  "mt-1 truncate text-[13px] font-medium tracking-[-0.015em]",
                  focused ? "text-[#08090a]" : "text-[#6b6f76]",
                )}
              >
                {inbox.subject}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-[#8a8f98]">
                {inbox.from}
              </p>
            </div>
            <div
              className={cn(
                "relative max-h-[min(34rem,calc(100%-5rem))] overflow-y-auto rounded-none transition-[border-color,box-shadow] duration-200",
                hidden && "hidden",
                focusMode && focused
                  ? "border-0 p-2"
                  : "border-4 border-transparent hover:border-[#2563eb]",
              )}
              onPointerDown={(e) => onCardPointerDown(id, e)}
              onPointerUp={(e) => onCardPointerUp(id, e)}
              onPointerCancel={() => {
                pressRef.current = null;
              }}
            >
              {renderEmail(id, cardW)}
              {focusMode ? null : (
                <button
                  type="button"
                  aria-label={`Focus ${meta.label} email`}
                  onClick={(e) => {
                    if (e.detail !== 0) return;
                    onEnterFocus(id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    onEnterFocus(id);
                  }}
                  className="absolute inset-0 z-10 cursor-pointer rounded-none"
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
