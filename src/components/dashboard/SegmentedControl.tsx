import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import gsap from "gsap";
import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = {
  id: T;
  label: ReactNode;
};

type Props<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
  className?: string;
  /** Stretch options equally across the control width */
  equal?: boolean;
  idPrefix?: string;
  controlsId?: string;
};

/**
 * Shared segmented control — sliding solid indicator + equal button chrome.
 */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  equal = false,
  idPrefix = "segment",
  controlsId,
}: Props<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const tabRefs = useRef<Partial<Record<T, HTMLButtonElement | null>>>({});
  const readyRef = useRef(false);

  const updateIndicator = useCallback(() => {
    const list = listRef.current;
    const indicator = indicatorRef.current;
    const btn = tabRefs.current[value];
    if (!list || !indicator || !btn) return;
    const listBox = list.getBoundingClientRect();
    const btnBox = btn.getBoundingClientRect();
    if (btnBox.width < 1 || btnBox.height < 1) return;

    // Absolute coords are relative to the padding box; getBoundingClientRect is the
    // border box — subtract the border so top/bottom gaps stay even.
    const styles = getComputedStyle(list);
    const borderTop = Number.parseFloat(styles.borderTopWidth) || 0;
    const borderLeft = Number.parseFloat(styles.borderLeftWidth) || 0;

    const next = {
      top: btnBox.top - listBox.top - borderTop,
      left: btnBox.left - listBox.left - borderLeft,
      width: btnBox.width,
      height: btnBox.height,
    };

    gsap.killTweensOf(indicator);
    if (!readyRef.current) {
      gsap.set(indicator, { ...next, opacity: 1 });
      readyRef.current = true;
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    gsap.to(indicator, {
      ...next,
      duration: reduced ? 0.01 : 0.45,
      ease: reduced ? "none" : "power3.out",
      overwrite: "auto",
    });
  }, [value]);

  useLayoutEffect(() => {
    requestAnimationFrame(() => updateIndicator());
  }, [updateIndicator]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const ro = new ResizeObserver(() => updateIndicator());
    ro.observe(list);
    window.addEventListener("resize", updateIndicator);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [updateIndicator]);

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "relative inline-flex items-center gap-0.5 rounded-lg border border-black/8 bg-[#f0f0f2] p-1 dark:border-white/[0.08] dark:bg-white/[0.04]",
        equal && "w-full",
        className,
      )}
    >
      <span
        ref={indicatorRef}
        aria-hidden
        className="pointer-events-none absolute z-[1] rounded-md bg-white opacity-0 shadow-sm dark:bg-[#2a2c31] dark:shadow-none"
      />
      <div className="relative z-[2] flex w-full gap-0.5">
        {options.map((item) => {
          const active = value === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              id={`${idPrefix}-tab-${item.id}`}
              aria-controls={controlsId}
              tabIndex={active ? 0 : -1}
              ref={(el) => {
                tabRefs.current[item.id] = el;
              }}
              onClick={() => onChange(item.id)}
              className={cn(
                "relative cursor-pointer rounded-md px-3 py-1.5 text-[12px] font-semibold tracking-[-0.01em] outline-none transition-colors duration-300 ease-out focus:outline-none focus-visible:outline-none",
                equal && "flex-1",
                active
                  ? "text-black dark:text-[#f7f8f8]"
                  : "text-black/45 hover:text-black/70 dark:text-white/45 dark:hover:text-white/75",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
