import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type FunctionComponent,
} from "react";
import {
  ChevronsUpDown,
  LayoutDashboard,
  Palette,
  Settings,
  Store,
  Wallet,
  Workflow,
} from "lucide-react";
import { withConvexClerkProvider } from "@/lib/withConvexClerkProvider";
import { type MarketingProductTab } from "./marketing/MarketingProductPreview";
import { marketingStore } from "./marketing/demoData";
import { useHeroStoryBeat } from "./HeroStoryContext";

/** Desktop canvas — same 16:10 landscape as linear.app’s hero product mock. */
const DESIGN_W = 1600;
const DESIGN_H = 1000;

const NAV = [
  { id: "dashboard" as const, label: "Overview", icon: LayoutDashboard },
  { id: "recoveries" as const, label: "Recoveries", icon: Wallet },
  {
    id: "sequences" as const,
    label: "Sequences",
    icon: Workflow,
    disabled: true,
  },
  { id: "customizations" as const, label: "Customizations", icon: Palette },
  { id: "settings" as const, label: "Settings", icon: Settings, disabled: true },
];

const DISABLED_TABS = new Set<MarketingProductTab>(["sequences", "settings"]);

type PreviewInnerProps = {
  tab: MarketingProductTab;
  onNavigate?: (tab: MarketingProductTab) => void;
};

type NavIndicator = {
  top: number;
  left: number;
  width: number;
  height: number;
};

/**
 * Interactive hero dashboard — real product pages + demo data.
 * Renders at a desktop design size and scales into the frame so layouts
 * don’t collapse into cramped / truncated mobile stacks.
 */
function HeroDashboardMockInner() {
  const storyBeat = useHeroStoryBeat();
  const [tab, setTab] = useState<MarketingProductTab>("dashboard");
  const [PreviewInner, setPreviewInner] = useState<ComponentType<PreviewInnerProps> | null>(
    null,
  );
  const viewportRef = useRef<HTMLDivElement>(null);
  const navListRef = useRef<HTMLDivElement>(null);
  const navItemRefs = useRef<
    Partial<Record<MarketingProductTab, HTMLButtonElement | null>>
  >({});
  const [navIndicator, setNavIndicator] = useState<NavIndicator | null>(null);
  const [fit, setFit] = useState({ scale: 1, x: 0, y: 0 });

  useEffect(() => {
    if (storyBeat > 0) setTab("dashboard");
  }, [storyBeat]);

  useEffect(() => {
    let cancelled = false;
    void import("./marketing/MarketingProductPreviewInner").then((mod) => {
      if (!cancelled) {
        setPreviewInner(() => mod.MarketingProductPreviewInner);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const measure = () => {
      const vw = el.clientWidth;
      const vh = el.clientHeight;
      if (vw < 1 || vh < 1) return;
      // Cover the 16:10 frame (same ratio as the design canvas)
      const scale = Math.max(vw / DESIGN_W, vh / DESIGN_H);
      setFit({
        scale,
        x: (vw - DESIGN_W * scale) / 2,
        y: (vh - DESIGN_H * scale) / 2,
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const updateNavIndicator = useCallback(() => {
    const list = navListRef.current;
    const btn = navItemRefs.current[tab];
    if (!list || !btn) return;
    const listBox = list.getBoundingClientRect();
    const btnBox = btn.getBoundingClientRect();
    if (btnBox.width < 1 || btnBox.height < 1) return;
    // Indicator is in unscaled layout space — use offsetTop/Left, not rect deltas
    setNavIndicator({
      top: btn.offsetTop,
      left: btn.offsetLeft,
      width: btn.offsetWidth,
      height: btn.offsetHeight,
    });
  }, [tab]);

  useLayoutEffect(() => {
    updateNavIndicator();
  }, [updateNavIndicator, PreviewInner, fit.scale]);

  useEffect(() => {
    const list = navListRef.current;
    if (!list) return;
    const ro = new ResizeObserver(() => updateNavIndicator());
    ro.observe(list);
    window.addEventListener("resize", updateNavIndicator);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateNavIndicator);
    };
  }, [updateNavIndicator]);

  return (
    <div ref={viewportRef} className="relative h-full w-full overflow-clip bg-[#0b0c0e]">
      <div
        className="ln-dash absolute top-0 left-0 flex flex-col overflow-hidden bg-[#0b0c0e] text-left text-[#e6e7ea]"
        style={{
          width: DESIGN_W,
          height: DESIGN_H,
          transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})`,
          transformOrigin: "top left",
        }}
      >
        <div className="dg-shell dark flex min-h-0 flex-1 overflow-hidden">
          <aside className="relative z-20 flex w-[220px] shrink-0 flex-col border-r border-white/[0.06] bg-[#0e0f11]">
            <div className="flex shrink-0 items-center gap-2 px-4 py-4">
              <img
                src="/brand/mark-on-dark.png?v=white2"
                alt=""
                width={18}
                height={18}
                className="size-[18px] shrink-0 object-contain"
                aria-hidden
              />
              <span className="truncate text-[13px] font-semibold tracking-[-0.02em] text-[#f7f8f8]">
                DeclineGuard
              </span>
            </div>

            <div className="mb-2 px-3">
              <div className="flex w-full items-center gap-2 rounded-lg p-2 text-left">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#f7f8f8] text-[#0c0c0c]">
                  <Store className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1 grid text-left text-[12px] leading-tight">
                  <span className="truncate font-semibold text-[#f7f8f8]">
                    {marketingStore.name}
                  </span>
                  <span className="truncate text-[10px] text-white/40">Live</span>
                </span>
                <ChevronsUpDown className="size-3.5 shrink-0 text-white/30" />
              </div>
            </div>

            <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3">
              <div ref={navListRef} className="relative flex flex-col gap-0.5">
                {navIndicator ? (
                  <div
                    className="pointer-events-none absolute z-0 rounded-lg bg-white/[0.07] transition-[top,height,width,left] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{
                      top: navIndicator.top,
                      left: navIndicator.left,
                      width: navIndicator.width,
                      height: navIndicator.height,
                    }}
                    aria-hidden
                  />
                ) : null}
                {NAV.map((item) => {
                  const Icon = item.icon;
                  const active = tab === item.id;
                  const disabled = Boolean(item.disabled);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={disabled}
                      aria-disabled={disabled}
                      ref={(el) => {
                        navItemRefs.current[item.id] = el;
                      }}
                      onClick={() => {
                        if (disabled) return;
                        setTab(item.id);
                      }}
                      className={`relative z-10 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] outline-none transition-colors duration-200 focus:outline-none focus-visible:outline-none ${
                        disabled
                          ? "cursor-not-allowed font-medium text-white/25"
                          : active
                            ? "font-semibold text-[#f7f8f8]"
                            : "font-medium text-white/50 hover:bg-white/[0.03] hover:text-[#f7f8f8]"
                      }`}
                    >
                      <Icon
                        className={`size-4 shrink-0 ${
                          disabled
                            ? "opacity-35"
                            : active
                              ? "opacity-90"
                              : "opacity-60"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </nav>

            <div className="mt-auto flex shrink-0 items-center gap-2.5 border-t border-white/[0.06] px-4 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-[11px] font-semibold text-teal-200">
                F
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[12px] font-semibold text-[#f7f8f8]">
                  Ferdi
                </p>
                <p className="truncate text-[10px] text-white/40">Free plan</p>
              </div>
            </div>
          </aside>

          {/* Height-bounded main — pages use flex fill + internal scroll */}
          <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f7f8f8] text-[#08090a]">
            {PreviewInner ? (
              <PreviewInner
                tab={tab}
                onNavigate={(next) => {
                  if (DISABLED_TABS.has(next)) return;
                  setTab(next);
                }}
                desktopPreview
              />
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-[#8a8f98]">
                Loading dashboard…
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const HeroDashboardMock = withConvexClerkProvider(
  HeroDashboardMockInner as FunctionComponent,
  { allowMissingConvex: true },
);
