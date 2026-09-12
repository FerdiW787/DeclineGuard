import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "convex/react";
import gsap from "gsap";
import { curveMonotoneX } from "@visx/curve";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Download,
  Link2,
  Search,
} from "lucide-react";
import {
  useMarketingDesktop,
  whenDesktop,
} from "@/components/homepage/marketing/MarketingDesktopContext";
import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Area,
  ChartTooltip,
  ComposedChart,
  Grid,
  SeriesBar,
  XAxis,
} from "@/charts";
import {
  ActivityIcon,
  activityUiType,
  deliveryStatusClass,
  deliveryStatusLabel,
  formatActivityTitle,
  formatFailedAt,
  formatMoneyAmount,
  formatMoneyMajor,
  formatNextEmailAt,
  formatRelativeTime,
  openFailureStatusLine,
  Panel,
  sequenceStageForFailure,
  type ActivityRow,
  type OpenFailureRow,
  type RecoveredWinRow,
} from "./dashboardUi";
import { type DayRow } from "./OverviewSlider";
import SegmentedControl from "./SegmentedControl";
import BorderGlow from "./border-glow/BorderGlow";
import { type ActivityTimelineSimulation } from "./ActivityTimeline";
import RailActivityFeed from "./RailActivityFeed";

export type RecoveriesQueueFilter =
  | "all"
  | "overdue"
  | "delivery"
  | "queued"
  | "day0"
  | "day2"
  | "day5";

type QueueFilter = RecoveriesQueueFilter;

type FailureCase = {
  activity: Array<{
    _id: string;
    type:
      | "payment_failed"
      | "recovered"
      | "email_sent"
      | "email_bounced"
      | "email_delivered";
    title: string;
    detail: string | null;
    customerEmail: string | null;
    amountCents: number | null;
    currency: string | null;
    occurredAt: number;
  }>;
} | null;

/** Isolated so marketing/demo Recoveries can render without ConvexProvider. */
function RecoveriesLiveQueries({
  selectedId,
  children,
}: {
  selectedId: string | null;
  children: (data: {
    liveWins: RecoveredWinRow[] | undefined;
    liveCase: FailureCase | undefined;
  }) => ReactNode;
}) {
  const liveWins = useQuery(api.functions.recoveries.listRecentRecovered, {
    limit: 12,
  });
  const liveCase = useQuery(
    api.functions.recoveries.getFailureCase,
    selectedId
      ? { failureId: selectedId as Id<"failedPayments"> }
      : "skip",
  );
  return <>{children({ liveWins, liveCase })}</>;
}

type Props = {
  openFailures: OpenFailureRow[] | undefined;
  recentActivity?: ActivityRow[];
  chartRows: DayRow[];
  hasActivity: boolean;
  openCount: number;
  recoveryRatePercent: number | null;
  displayCurrency: string;
  activitySimulation?: ActivityTimelineSimulation;
  recentRecoveredSimulation?: RecoveredWinRow[];
  initialFilter?: RecoveriesQueueFilter;
  filterFocusKey?: number;
  onGoToCustomizations?: () => void;
};

const CHART_PRIMARY = "#0d9488";
const CHART_WARN = "#d97706";

/** Case slides over Activity; both motions start together. */
const RAIL_SLIDE_MS = 420;
const RAIL_ENTER_MS = 32;
const RAIL_EXIT_CLEAR_MS = RAIL_SLIDE_MS + 40;
/** Let the queue glow finish before swapping case data / rail content. */
const GLOW_SLIDE_MS = 320;

function isDeliveryIssue(row: OpenFailureRow) {
  const s = row.lastEmailDeliveryStatus;
  return s === "bounced" || s === "complained" || s === "failed";
}

function isOverdue(row: OpenFailureRow, nowMs: number) {
  return row.nextEmailAt != null && row.nextEmailAt < nowMs;
}

function urgencyScore(row: OpenFailureRow, nowMs: number) {
  let score = 0;
  if (isOverdue(row, nowMs)) score += 1000;
  if (isDeliveryIssue(row)) score += 500;
  if (row.emailsSentCount <= 0) score += 200;
  score += Math.min(row.amountCents / 100, 300);
  return score;
}

function sequenceSteps(row: OpenFailureRow) {
  return [
    {
      id: "day0",
      label: "Day 0",
      hint: "Gentle",
      sentAt: row.day0SentAt ?? null,
    },
    {
      id: "day2",
      label: "Day 2",
      hint: "Direct",
      sentAt: row.day2SentAt ?? null,
    },
    {
      id: "day5",
      label: "Day 5",
      hint: "Urgent",
      sentAt: row.day5SentAt ?? null,
    },
  ] as const;
}

export default function RecoveriesPage({
  openFailures,
  recentActivity,
  chartRows,
  hasActivity,
  openCount,
  recoveryRatePercent,
  displayCurrency,
  activitySimulation,
  recentRecoveredSimulation,
  initialFilter = "all",
  filterFocusKey,
  onGoToCustomizations,
}: Props) {
  const desk = useMarketingDesktop();
  const [nowMs] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<QueueFilter>(initialFilter);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(25);

  useEffect(() => {
    setFilter(initialFilter);
    setVisibleCount(25);
  }, [initialFilter, filterFocusKey]);

  const selectedFailure = useMemo(() => {
    if (!openFailures || !selectedId) return null;
    return openFailures.find((row) => row._id === selectedId) ?? null;
  }, [openFailures, selectedId]);
  /** Keep case mounted through the exit slide so the swap isn’t abrupt. */
  const [railCase, setRailCase] = useState<OpenFailureRow | null>(null);
  const [caseQueryId, setCaseQueryId] = useState<string | null>(null);
  /** Activity scales back / dims. */
  const [railActivityBack, setRailActivityBack] = useState(false);
  /** Case covering the rail (slides from the right). */
  const [railCaseOver, setRailCaseOver] = useState(false);
  const railCaseOverRef = useRef(false);
  const railTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const activityRailRef = useRef<HTMLDivElement>(null);
  const activityTweenReady = useRef(false);
  const queueListWrapRef = useRef<HTMLDivElement>(null);
  const selectionGlowRef = useRef<HTMLDivElement>(null);
  const queueRowRefs = useRef(new Map<string, HTMLButtonElement>());
  const glowFromIdRef = useRef<string | null>(null);
  const glowXTo = useRef<ReturnType<typeof gsap.quickTo> | null>(null);
  const glowYTo = useRef<ReturnType<typeof gsap.quickTo> | null>(null);
  const glowTweenEl = useRef<HTMLDivElement | null>(null);

  const clearRailTimers = () => {
    for (const t of railTimers.current) clearTimeout(t);
    railTimers.current = [];
  };

  useEffect(() => {
    clearRailTimers();
    if (selectedFailure) {
      const showCase = () => {
        setRailCase(selectedFailure);
        setCaseQueryId(selectedFailure._id);
      };

      // Already on a case — wait for the queue glow to land, then swap.
      if (railCaseOverRef.current) {
        railTimers.current.push(
          setTimeout(() => {
            startTransition(showCase);
          }, GLOW_SLIDE_MS),
        );
        return clearRailTimers;
      }

      showCase();
      railTimers.current.push(
        setTimeout(() => {
          setRailActivityBack(true);
          setRailCaseOver(true);
          railCaseOverRef.current = true;
        }, RAIL_ENTER_MS),
      );
      return clearRailTimers;
    }
    railCaseOverRef.current = false;
    setRailCaseOver(false);
    setRailActivityBack(false);
    setCaseQueryId(null);
    railTimers.current.push(
      setTimeout(() => {
        setRailCase(null);
      }, RAIL_EXIT_CLEAR_MS),
    );
    return clearRailTimers;
  }, [selectedFailure]);

  useLayoutEffect(() => {
    const el = activityRailRef.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    gsap.killTweensOf(el);

    if (!activityTweenReady.current) {
      gsap.set(el, { scale: 1, opacity: 1, filter: "blur(0px)" });
      activityTweenReady.current = true;
      if (!railActivityBack) return;
    }

    gsap.to(el, {
      scale: railActivityBack ? 0.9 : 1,
      opacity: railActivityBack ? 0.4 : 1,
      filter: railActivityBack ? "blur(1px)" : "blur(0px)",
      duration: reduced ? 0.01 : 0.55,
      ease: reduced ? "none" : "sine.inOut",
      overwrite: true,
    });
  }, [railActivityBack]);

  const caseForRail = railCase;
  const simCaseActivity = useMemo(() => {
    if (!activitySimulation || !caseForRail) return [];
    const email = caseForRail.customerEmail.trim().toLowerCase();
    return activitySimulation.events
      .filter((e) => e.customerEmail?.toLowerCase() === email)
      .slice(0, 40);
  }, [activitySimulation, caseForRail]);

  // Deselect a case once its failure leaves the queue (recovered / removed).
  useEffect(() => {
    if (!selectedId) return;
    if (openFailures && !openFailures.some((r) => r._id === selectedId)) {
      setSelectedId(null);
    }
  }, [openFailures, selectedId]);

  const counts = useMemo(() => {
    const rows = openFailures ?? [];
    return {
      all: rows.length,
      overdue: rows.filter((r) => isOverdue(r, nowMs)).length,
      delivery: rows.filter(isDeliveryIssue).length,
      queued: rows.filter((r) => r.emailsSentCount <= 0).length,
    };
  }, [openFailures, nowMs]);

  const filteredQueue = useMemo(() => {
    const rows = openFailures ?? [];
    const q = query.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (filter === "overdue" && !isOverdue(row, nowMs)) return false;
        if (filter === "delivery" && !isDeliveryIssue(row)) return false;
        if (filter === "queued" && sequenceStageForFailure(row) !== "queued") {
          return false;
        }
        if (
          (filter === "day0" || filter === "day2" || filter === "day5") &&
          sequenceStageForFailure(row) !== filter
        ) {
          return false;
        }
        if (!q) return true;
        const hay = [
          row.customerEmail,
          row.customerName ?? "",
          row.productName ?? "",
          row.declineReason ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => urgencyScore(b, nowMs) - urgencyScore(a, nowMs));
  }, [openFailures, filter, query, nowMs]);

  const visibleQueue = filteredQueue.slice(0, visibleCount);

  const measureQueueRow = useCallback((id: string) => {
    const wrap = queueListWrapRef.current;
    const btn = queueRowRefs.current.get(id);
    if (!wrap || !btn) return null;
    const wrapBox = wrap.getBoundingClientRect();
    const btnBox = btn.getBoundingClientRect();
    return {
      x: btnBox.left - wrapBox.left,
      y: btnBox.top - wrapBox.top,
      width: btnBox.width,
      height: btnBox.height,
    };
  }, []);

  useLayoutEffect(() => {
    const glow = selectionGlowRef.current;
    if (!glow) return;

    if (glowTweenEl.current !== glow) {
      glowTweenEl.current = glow;
      const vars = { duration: 0.32, ease: "power3.out" as const };
      glowXTo.current = gsap.quickTo(glow, "x", vars);
      glowYTo.current = gsap.quickTo(glow, "y", vars);
    }

    if (!selectedId) {
      gsap.to(glow, {
        autoAlpha: 0,
        duration: 0.14,
        ease: "sine.out",
        overwrite: "auto",
      });
      glowFromIdRef.current = null;
      return;
    }

    queueRowRefs.current
      .get(selectedId)
      ?.scrollIntoView({ block: "nearest" });
    const dest = measureQueueRow(selectedId);
    if (!dest) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    const fromId = glowFromIdRef.current;
    const shouldSlide =
      Boolean(fromId) && fromId !== selectedId && !reduced && dest.width > 0;

    gsap.set(glow, {
      top: 0,
      left: 0,
      width: dest.width,
      height: dest.height,
      autoAlpha: 1,
    });

    if (shouldSlide && glowXTo.current && glowYTo.current) {
      glowXTo.current(dest.x);
      glowYTo.current(dest.y);
    } else {
      gsap.set(glow, { x: dest.x, y: dest.y });
    }
    glowFromIdRef.current = selectedId;
  }, [selectedId, measureQueueRow, filteredQueue.length]);

  useEffect(() => {
    const wrap = queueListWrapRef.current;
    const glow = selectionGlowRef.current;
    if (!wrap || !glow) return;
    const onResize = () => {
      if (!selectedId || gsap.isTweening(glow)) return;
      const dest = measureQueueRow(selectedId);
      if (!dest) return;
      gsap.set(glow, {
        top: 0,
        left: 0,
        x: dest.x,
        y: dest.y,
        width: dest.width,
        height: dest.height,
        autoAlpha: 1,
      });
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(wrap);
    window.addEventListener("resize", onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [selectedId, measureQueueRow, filteredQueue.length]);
  const inspectableEmails = useMemo(() => {
    const emails = new Set<string>();
    for (const row of openFailures ?? []) {
      const email = row.customerEmail.trim().toLowerCase();
      if (email) emails.add(email);
    }
    return emails;
  }, [openFailures]);

  const inspectActivityCustomer = useCallback(
    (email: string) => {
      const match = (openFailures ?? []).find(
        (row) => row.customerEmail.trim().toLowerCase() === email,
      );
      if (!match) return;
      if (filter !== "all") setFilter("all");
      if (query.trim()) setQuery("");
      if (match._id === selectedId) return;
      glowFromIdRef.current = selectedId;
      setSelectedId(match._id);
    },
    [filter, openFailures, query, selectedId],
  );

  const inspectedEmail =
    selectedFailure?.customerEmail ?? railCase?.customerEmail ?? null;

  const canLoadMore = visibleCount < filteredQueue.length;

  const totalRecovered = chartRows.reduce((s, r) => s + r.moneyRecovered, 0);
  const totalAtRisk = chartRows.reduce((s, r) => s + (r.moneyAtRisk ?? 0), 0);
  const chartData = useMemo(
    () =>
      chartRows.map((row) => ({
        date: new Date(`${row.date}T12:00:00`),
        moneyRecovered: row.moneyRecovered,
        moneyAtRisk: row.moneyAtRisk ?? 0,
      })),
    [chartRows],
  );

  const stageCounts = useMemo(() => {
    const rows = openFailures ?? [];
    return {
      day0: rows.filter((r) => sequenceStageForFailure(r) === "day0").length,
      day2: rows.filter((r) => sequenceStageForFailure(r) === "day2").length,
      day5: rows.filter((r) => sequenceStageForFailure(r) === "day5").length,
    };
  }, [openFailures]);

  const railEvents: ActivityRow[] = activitySimulation
    ? activitySimulation.events
    : (recentActivity ?? []);
  const railLoading = activitySimulation
    ? false
    : recentActivity === undefined;

  const mobileCase = Boolean(!desk && railCase);
  const stepFilterLabel =
    filter === "day0"
      ? "Email 1"
      : filter === "day2"
        ? "Email 2"
        : filter === "day5"
          ? "Email 3"
          : null;

  const chartBadge =
    hasActivity && (totalRecovered > 0 || totalAtRisk > 0)
      ? `+${formatMoneyMajor(Math.round(totalRecovered), displayCurrency)} / ${formatMoneyMajor(Math.round(totalAtRisk), displayCurrency)} at risk`
      : "No activity yet";

  const renderPage = (
    recentWins: RecoveredWinRow[] | undefined,
    liveCase: FailureCase | undefined,
  ) => {
    const caseActivity = activitySimulation
      ? simCaseActivity
      : (liveCase?.activity ?? []);
    return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col",
        "lg:flex-row lg:gap-5 lg:px-6 lg:py-5",
        whenDesktop(desk, "flex-row gap-5 px-6 py-5"),
      )}
    >
      {mobileCase && railCase ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-10 pt-3 lg:hidden">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="dg-interactive mb-4 inline-flex w-fit items-center gap-1.5 rounded-md border border-black/8 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#6b6f76]"
          >
            <ArrowLeft className="size-3.5" />
            Back to queue
          </button>
          <CasePanel
            row={railCase}
            nowMs={nowMs}
            activity={caseActivity}
            caseLoading={
              !activitySimulation &&
              caseQueryId != null &&
              liveCase === undefined
            }
            onGoToCustomizations={onGoToCustomizations}
          />
        </div>
      ) : null}

      <div
        className={cn(
          "min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pb-10 pt-3",
          "lg:px-0 lg:pb-2 lg:pt-0 xl:min-h-0 xl:overflow-hidden xl:pb-0",
          whenDesktop(desk, "px-0 pb-2 pt-0 min-h-0 overflow-hidden pb-0"),
          // Full-screen case is mobile-only (`lg:hidden` overlay). Keep the
          // workspace on desktop so the case can slide over the activity rail.
          mobileCase ? "hidden lg:flex" : "flex",
        )}
      >
        <div data-enter className="shrink-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/45">
            Recoveries
          </p>
          <h2 className="font-display mt-2 text-3xl tracking-tight md:text-4xl">
            {openCount > 0 ? "Recovery queue" : "Recovery workspace"}
          </h2>
          <p className="mt-2 max-w-xl text-sm text-black/45">
            Prioritize open declines, open a case, send the card-update link,
            and confirm wins.
          </p>
        </div>

        <div
          className={cn(
            "flex flex-col gap-5",
            "xl:min-h-0 xl:flex-1 xl:flex-row xl:items-stretch",
            whenDesktop(desk, "min-h-0 flex-1 flex-row items-stretch"),
          )}
        >
          <div
            data-enter
            className={cn(
              "flex min-w-0 flex-col gap-4",
              "xl:min-h-0 xl:flex-1 xl:basis-0",
              whenDesktop(desk, "min-h-0 flex-1 basis-0"),
            )}
          >
            <Panel
              className={cn(
                "p-5",
                "xl:shrink-0",
                whenDesktop(desk, "shrink-0"),
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-black/45">
                    Recovered vs new declines
                  </p>
                  <p className="font-display mt-1 text-xl tracking-tight">
                    Last 30 days
                  </p>
                </div>
                <span
                  className={
                    hasActivity && (totalRecovered > 0 || totalAtRisk > 0)
                      ? "rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800"
                      : "rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-black/55"
                  }
                >
                  {chartBadge}
                </span>
              </div>
              <div className="mt-4 h-[180px] w-full">
                <ComposedChart
                  aspectRatio="unset"
                  barGap={2}
                  data={chartData}
                  margin={{ top: 12, right: 8, bottom: 20, left: 8 }}
                  maxBarSize={12}
                  style={{ height: "100%" }}
                >
                  <Grid horizontal />
                  <SeriesBar
                    dataKey="moneyAtRisk"
                    fill={CHART_WARN}
                    radius={3}
                  />
                  <Area
                    curve={curveMonotoneX}
                    dataKey="moneyRecovered"
                    fill={CHART_PRIMARY}
                    fillOpacity={0.28}
                    stroke={CHART_PRIMARY}
                    strokeWidth={2}
                  />
                  <XAxis numTicks={4} />
                  <ChartTooltip
                    showCrosshair={false}
                    rows={(point) => {
                      const recovered =
                        typeof point.moneyRecovered === "number"
                          ? point.moneyRecovered
                          : 0;
                      const atRisk =
                        typeof point.moneyAtRisk === "number"
                          ? point.moneyAtRisk
                          : 0;
                      return [
                        {
                          dataKey: "moneyRecovered",
                          label: "Recovered",
                          value: formatMoneyMajor(
                            Math.round(recovered),
                            displayCurrency,
                          ),
                          color: CHART_PRIMARY,
                        },
                        {
                          dataKey: "moneyAtRisk",
                          label: "New declines",
                          value: formatMoneyMajor(
                            Math.round(atRisk),
                            displayCurrency,
                          ),
                          color: CHART_WARN,
                        },
                      ];
                    }}
                  />
                </ComposedChart>
              </div>
              {recoveryRatePercent != null ? (
                <p className="mt-2 text-[11px] text-black/40">
                  This month cohort recovery rate: {recoveryRatePercent}%
                </p>
              ) : null}
            </Panel>

            <Panel
              className={cn(
                "flex min-h-0 flex-col p-5",
                "xl:flex-1",
                whenDesktop(desk, "flex-1"),
              )}
            >
              <div className="shrink-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-black/45">
                  Recent wins
                </p>
                <p className="font-display mt-1 text-xl tracking-tight">
                  Money back
                </p>
              </div>
              {recentWins === undefined ? (
                <p className="mt-5 text-sm text-black/40">Loading wins…</p>
              ) : recentWins.length === 0 ? (
                <p className="mt-4 text-sm leading-relaxed text-black/40">
                  Recovered customers show up here as soon as Lemon Squeezy
                  confirms payment.
                </p>
              ) : (
                <ul
                  className={cn(
                    "mt-3 min-h-0 flex-1 space-y-0.5 overflow-y-auto",
                    "xl:pr-1",
                    whenDesktop(desk, "pr-1"),
                  )}
                >
                  {recentWins.map((win) => {
                    const name = win.customerName?.trim() || win.customerEmail;
                    return (
                      <li
                        key={win._id}
                        className="dg-row flex items-center justify-between gap-3 rounded-xl px-2 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {name}
                          </p>
                          <p className="truncate text-[11px] text-black/40">
                            {[
                              win.productName?.trim() || null,
                              formatRelativeTime(win.recoveredAt, nowMs),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-teal-700">
                          +{formatMoneyAmount(win.amountCents, win.currency)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>

          <Panel
            data-enter
            className={cn(
              "flex min-h-0 min-w-0 flex-1 flex-col p-5 md:p-6",
              "xl:min-h-0 xl:flex-1 xl:basis-0",
              whenDesktop(desk, "min-h-0 flex-1 basis-0"),
            )}
          >
            <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8a8f98]">
                  Open failures
                </p>
                <p className="font-display mt-1 text-2xl tracking-tight text-[#08090a]">
                  {openCount > 0 ? "Needs a nudge" : "All clear"}
                </p>
                {openCount > 0 ? (
                  <p className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-[#6b6f76]">
                    Click a customer to open their case
                    <ChevronRight className="size-3.5" />
                  </p>
                ) : null}
              </div>
              <ExportCsvButton enabled={!activitySimulation} />
            </div>

            <div className="mt-4 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
              <label className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-black/35" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setVisibleCount(25);
                  }}
                  placeholder="Search customer, product, reason…"
                  className="w-full rounded-md border border-black/8 bg-[#f7f8f8] py-2 pr-3 pl-9 text-sm outline-none placeholder:text-black/35 focus:border-black/20"
                />
              </label>
              <SegmentedControl
                ariaLabel="Queue filter"
                idPrefix="queue-filter"
                className="shrink-0 rounded-md bg-[#f7f8f8] shadow-none"
                value={filter}
                onChange={(next) => {
                  setFilter(next);
                  setVisibleCount(25);
                }}
                options={[
                  {
                    id: "all" as const,
                    label: (
                      <>
                        All
                        {counts.all > 0 ? (
                          <span className="ml-1 tabular-nums opacity-60">
                            {counts.all}
                          </span>
                        ) : null}
                      </>
                    ),
                  },
                  {
                    id: "overdue" as const,
                    label: (
                      <>
                        Overdue
                        {counts.overdue > 0 ? (
                          <span className="ml-1 tabular-nums opacity-60">
                            {counts.overdue}
                          </span>
                        ) : null}
                      </>
                    ),
                  },
                  {
                    id: "delivery" as const,
                    label: (
                      <>
                        Delivery
                        {counts.delivery > 0 ? (
                          <span className="ml-1 tabular-nums opacity-60">
                            {counts.delivery}
                          </span>
                        ) : null}
                      </>
                    ),
                  },
                  {
                    id: "queued" as const,
                    label: (
                      <>
                        Queued
                        {counts.queued > 0 ? (
                          <span className="ml-1 tabular-nums opacity-60">
                            {counts.queued}
                          </span>
                        ) : null}
                      </>
                    ),
                  },
                  ...(stepFilterLabel
                    ? [
                        {
                          id: filter,
                          label: (
                            <>
                              {stepFilterLabel}
                              {(filter === "day0" ||
                                filter === "day2" ||
                                filter === "day5") &&
                              stageCounts[filter] > 0 ? (
                                <span className="ml-1 tabular-nums opacity-60">
                                  {stageCounts[filter]}
                                </span>
                              ) : null}
                            </>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
            </div>

            <div
              className={cn(
                "mt-1 min-h-0",
                "xl:flex-1 xl:overflow-y-auto xl:px-1 xl:py-1",
                whenDesktop(desk, "flex-1 overflow-y-auto px-1 py-1"),
              )}
            >
            {openFailures === undefined ? (
              <p className="mt-8 text-sm text-black/40">Loading failures…</p>
            ) : openFailures.length === 0 ? (
              <div className="mt-8 flex flex-col items-center rounded-md bg-teal-50/60 px-4 py-10 text-center">
                <CheckCircle2 className="size-8 text-teal-600" />
                <p className="mt-3 text-sm font-semibold">No open failures</p>
                <p className="mt-1 max-w-sm text-[12px] text-black/45">
                  New declines from Lemon Squeezy land here automatically.
                </p>
              </div>
            ) : filteredQueue.length === 0 ? (
              <p className="mt-8 text-sm text-black/40">
                No failures match this search or filter.
              </p>
            ) : (
              <>
                <div ref={queueListWrapRef} className="relative mt-4">
                  <div
                    ref={selectionGlowRef}
                    aria-hidden
                    className="dg-queue-selection-glow pointer-events-none absolute top-0 left-0 z-0 h-0 w-0 opacity-0"
                  >
                    <BorderGlow
                      className="dg-queue-row-glow h-full w-full"
                      variant="v1"
                      alwaysOn
                      edgeSensitivity={30}
                      glowColor="220 5 62"
                      backgroundColor="#f5f5f5"
                      borderRadius={6}
                      glowRadius={40}
                      glowIntensity={1}
                      coneSpread={25}
                      animated={false}
                      colors={["#c5c8ce", "#8a8f98", "#6b6f76"]}
                      fillOpacity={0.5}
                    >
                      <span className="block h-full w-full" />
                    </BorderGlow>
                  </div>
                  <ul className="relative z-[1] space-y-1">
                  {visibleQueue.map((row) => {
                    const amount = formatMoneyAmount(
                      row.amountCents,
                      row.currency,
                    );
                    const displayName =
                      row.customerName?.trim() || row.customerEmail;
                    const overdue = isOverdue(row, nowMs);
                    const deliveryIssue = isDeliveryIssue(row);
                    const selected = row._id === selectedId;
                    const nextLabel = formatNextEmailAt(row.nextEmailAt);
                    return (
                      <li key={row._id}>
                        <button
                          type="button"
                          ref={(el) => {
                            if (el) queueRowRefs.current.set(row._id, el);
                            else queueRowRefs.current.delete(row._id);
                          }}
                          onClick={() => {
                            if (row._id === selectedId) return;
                            glowFromIdRef.current = selectedId;
                            setSelectedId(row._id);
                          }}
                          aria-pressed={selected}
                          title="Open case"
                          className="dg-queue-row group flex w-full items-start justify-between gap-2.5 rounded-md px-2.5 py-2.5 text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                              <p className="truncate text-sm font-semibold">
                                {displayName}
                              </p>
                              {overdue ? (
                                <Badge tone="warn">Overdue</Badge>
                              ) : null}
                              {deliveryIssue ? (
                                <Badge tone="danger">
                                  {deliveryStatusLabel(
                                    row.lastEmailDeliveryStatus,
                                  )}
                                </Badge>
                              ) : null}
                              {row.testMode ? (
                                <Badge tone="neutral">Test</Badge>
                              ) : null}
                            </div>
                            <p className="mt-0.5 truncate text-[11px] text-black/40">
                              {[
                                row.productName?.trim() || null,
                                openFailureStatusLine(row),
                                nextLabel
                                  ? overdue
                                    ? `Was due ${nextLabel}`
                                    : `Next ${nextLabel}`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            {row.customerName?.trim() ? (
                              <p className="truncate text-[11px] text-black/35">
                                {row.customerEmail}
                              </p>
                            ) : null}
                          </div>
                          <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
                            <span className="text-sm font-semibold tabular-nums text-black/70">
                              {amount}
                            </span>
                            <ChevronRight
                              className={`size-4 shrink-0 transition-all ${
                                selected
                                  ? "text-teal-600"
                                  : "text-black/25 group-hover:translate-x-0.5 group-hover:text-black/55"
                              }`}
                              aria-hidden
                            />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  </ul>
                </div>
                {canLoadMore ? (
                  <button
                    type="button"
                    onClick={() => setVisibleCount((n) => n + 25)}
                    className="mt-3 w-full rounded-xl border border-dashed border-black/12 py-2 text-xs font-semibold text-black/55 transition hover:border-black/25 hover:text-black/80"
                  >
                    Show more ({filteredQueue.length - visibleCount} left)
                  </button>
                ) : null}
              </>
            )}
            </div>
          </Panel>
        </div>

        <div
          data-enter
          className={desk ? "hidden" : "lg:hidden"}
        >
          <RailShell title="Activity" subtitle="Live events" icon="activity">
            <RailActivityFeed
              events={railEvents}
              loading={railLoading}
              nowMs={nowMs}
              idPrefix="activity-range-mobile"
              inspectableEmails={inspectableEmails}
              inspectedEmail={inspectedEmail}
              onInspectCustomer={inspectActivityCustomer}
            />
          </RailShell>
        </div>
      </div>

      {/* ── Section 3 — Floating right rail (activity log / case view) ── */}
      <aside
        data-enter
        className={cn(
          "relative w-[22rem] shrink-0 self-stretch overflow-hidden",
          desk
            ? "flex min-h-0 flex-col"
            : "hidden lg:flex lg:min-h-0 lg:w-[21rem] lg:flex-col xl:w-[22rem]",
        )}
      >
        {/* Activity eases back while the case slides over */}
        <div
          ref={activityRailRef}
          className={cn(
            "absolute inset-0 z-0 flex min-h-0 origin-center flex-col",
            railActivityBack && "pointer-events-none",
          )}
          aria-hidden={railCaseOver}
        >
          <RailShell fill title="Activity" subtitle="Live events" icon="activity">
            <RailActivityFeed
              events={railEvents}
              loading={railLoading}
              nowMs={nowMs}
              fill
              idPrefix="activity-range-desk"
              inspectableEmails={inspectableEmails}
              inspectedEmail={inspectedEmail}
              onInspectCustomer={inspectActivityCustomer}
            />
          </RailShell>
        </div>

        {/* Customer case slides in from the right over Activity */}
        <div
          className={cn(
            "absolute inset-0 z-10 flex min-h-0 flex-col will-change-transform",
            "transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
            railCaseOver && caseForRail
              ? "translate-x-0"
              : "pointer-events-none translate-x-full",
          )}
          aria-hidden={!railCaseOver}
        >
          {caseForRail ? (
            <div className="flex min-h-0 flex-1 flex-col shadow-[-12px_0_28px_-18px_rgba(0,0,0,0.35)]">
              <RailShell
                fill
                title="Case"
                onBack={() => setSelectedId(null)}
                backLabel="Back to activity"
              >
                <div className="p-5">
                  <CasePanel
                    row={caseForRail}
                    nowMs={nowMs}
                    activity={caseActivity}
                    caseLoading={
                      !activitySimulation &&
                      caseQueryId != null &&
                      liveCase === undefined
                    }
                    onGoToCustomizations={onGoToCustomizations}
                  />
                </div>
              </RailShell>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
    );
  };

  if (activitySimulation) {
    return renderPage(recentRecoveredSimulation ?? [], undefined);
  }
  return (
    <RecoveriesLiveQueries selectedId={caseQueryId}>
      {({ liveWins, liveCase }) => renderPage(liveWins, liveCase)}
    </RecoveriesLiveQueries>
  );
}

/** Floating Linear-style card used by the right rail (and mobile activity). */
function RailShell({
  title,
  subtitle,
  icon,
  onBack,
  backLabel,
  fill = false,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: "activity";
  onBack?: () => void;
  backLabel?: string;
  /** Fill available height with an internal scroll region (desktop rail). */
  fill?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex flex-col overflow-hidden rounded-md border border-black/8 bg-white ${
        fill ? "min-h-0 flex-1" : ""
      }`}
    >
      <header className="flex shrink-0 items-center gap-2.5 border-b border-black/6 px-4 py-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="dg-interactive inline-flex items-center gap-1.5 rounded-full border border-black/8 bg-transparent px-2.5 py-1 text-[11px] font-semibold text-black/60"
          >
            <ArrowLeft className="size-3.5" />
            {backLabel ?? "Back"}
          </button>
        ) : (
          <>
            {icon === "activity" ? (
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-black/[0.05] text-black/60">
                <Activity className="size-3.5" />
              </span>
            ) : null}
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">{title}</p>
              {subtitle ? (
                <p className="text-[11px] leading-tight text-black/40">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </>
        )}
      </header>
      <div
        className={
          fill ? "flex min-h-0 flex-1 flex-col overflow-hidden" : ""
        }
      >
        {children}
      </div>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "warn" | "danger" | "neutral" | "good";
}) {
  const cls =
    tone === "warn"
      ? "bg-amber-50 text-amber-900"
      : tone === "danger"
        ? "bg-rose-50 text-rose-800"
        : tone === "good"
          ? "bg-teal-50 text-teal-800"
          : "bg-black/5 text-black/55";
  return (
    <span
      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}
    >
      {children}
    </span>
  );
}

function CasePanel({
  row,
  nowMs,
  activity,
  caseLoading,
  onGoToCustomizations,
}: {
  row: OpenFailureRow;
  nowMs: number;
  onGoToCustomizations?: () => void;
  activity: Array<{
    _id: string;
    type:
      | "payment_failed"
      | "recovered"
      | "email_sent"
      | "email_bounced"
      | "email_delivered";
    title: string;
    detail: string | null;
    customerEmail: string | null;
    amountCents: number | null;
    currency: string | null;
    occurredAt: number;
  }>;
  caseLoading: boolean;
}) {
  const displayName = row.customerName?.trim() || row.customerEmail;
  const overdue = isOverdue(row, nowMs);
  const nextLabel = formatNextEmailAt(row.nextEmailAt);
  const steps = sequenceSteps(row);
  const delivery = deliveryStatusLabel(row.lastEmailDeliveryStatus);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-black/45">
            Customer
          </p>
          <p className="font-display mt-1 text-2xl leading-[1.2] tracking-tight">
            {displayName}
          </p>
          {row.customerName?.trim() ? (
            <p className="truncate text-sm text-black/45">{row.customerEmail}</p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full bg-black/5 px-3 py-1.5 text-sm font-semibold tabular-nums">
          {formatMoneyAmount(row.amountCents, row.currency)}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge tone={overdue ? "warn" : "neutral"}>
          {openFailureStatusLine(row)}
        </Badge>
        {overdue ? <Badge tone="warn">Overdue</Badge> : null}
        {delivery ? (
          <Badge tone={isDeliveryIssue(row) ? "danger" : "good"}>
            {delivery}
          </Badge>
        ) : null}
        {row.testMode ? <Badge tone="neutral">Test</Badge> : null}
      </div>

      <dl className="grid gap-2 text-[12px]">
        <div className="flex justify-between gap-3">
          <dt className="text-black/40">Product</dt>
          <dd className="truncate text-right font-medium">
            {row.productName?.trim() || "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-black/40">Failed</dt>
          <dd className="font-medium">{formatFailedAt(row.failedAt)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-black/40">Next email</dt>
          <dd className="font-medium">
            {nextLabel
              ? overdue
                ? `Was due ${nextLabel}`
                : nextLabel
              : "Sequence complete"}
          </dd>
        </div>
        {row.declineReason?.trim() ? (
          <div className="flex justify-between gap-3">
            <dt className="text-black/40">Reason</dt>
            <dd className="max-w-[60%] truncate text-right font-medium">
              {row.declineReason}
            </dd>
          </div>
        ) : null}
      </dl>

      {row.updatePaymentUrl?.startsWith("https://") ? (
        <a
          href={row.updatePaymentUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#111] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
        >
          <Link2 className="size-4" />
          Open card-fix link
        </a>
      ) : (
        <p className="rounded-xl bg-black/[0.03] px-3 py-2.5 text-[12px] text-black/45">
          No card-fix link on this failure yet — sequence is still running.
        </p>
      )}

      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-black/45">
          Sequence
        </p>
        <ol className="relative mt-3 space-y-0">
          {steps.map((step, i, arr) => {
            const done = step.sentAt != null;
            const pendingNext =
              !done &&
              (i === 0 || steps[i - 1]?.sentAt != null) &&
              row.nextEmailAt != null;
            return (
              <li key={step.id} className="relative flex gap-3 pb-4 last:pb-0">
                {i < arr.length - 1 ? (
                  <span
                    className="absolute top-6 left-[11px] h-[calc(100%-8px)] w-px bg-black/10"
                    aria-hidden
                  />
                ) : null}
                <span
                  className={`relative z-[1] mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    done
                      ? "bg-teal-600 text-white"
                      : pendingNext
                        ? "bg-amber-100 text-amber-900"
                        : "bg-black/8 text-black/40"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-sm font-semibold">
                    {step.label}{" "}
                    <span className="font-medium text-black/40">
                      · {step.hint}
                    </span>
                  </p>
                  <p className="text-[11px] text-black/40">
                    {done
                      ? `Sent ${formatFailedAt(step.sentAt!)}`
                      : pendingNext
                        ? overdue
                          ? "Send overdue"
                          : nextLabel
                            ? `Due ${nextLabel}`
                            : "Pending"
                        : "Waiting"}
                  </p>
                </div>
              </li>
            );
          })}
            </ol>
            {onGoToCustomizations ? (
              <button
                type="button"
                onClick={onGoToCustomizations}
                className="mt-3 text-xs font-semibold text-[#6b6f76] underline-offset-2 hover:text-[#08090a] hover:underline"
              >
                Edit emails
              </button>
            ) : null}
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-black/45">
                Timeline
              </p>
          {caseLoading ? (
            <span className="text-[11px] text-black/35">Loading…</span>
          ) : null}
        </div>
        {activity.length === 0 ? (
          <p className="mt-3 text-[12px] text-black/40">
            Events for this customer will appear as emails and webhooks fire.
          </p>
        ) : (
          <ul className="mt-3 space-y-0.5">
            {activity.map((item) => {
              const ui = activityUiType(item.type);
              return (
                <li
                  key={item._id}
                  className="flex items-center gap-2.5 rounded-lg px-1 py-1.5"
                >
                  <ActivityIcon type={ui} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold">
                      {formatActivityTitle(item.title, item.type)}
                    </p>
                    <p className="text-[10px] text-black/40">
                      {formatRelativeTime(item.occurredAt, nowMs)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {isDeliveryIssue(row) ? (
        <p
          className={`text-[12px] font-medium ${deliveryStatusClass(row.lastEmailDeliveryStatus)}`}
        >
          Latest email may never have been seen — consider reaching out another
          way or fixing the address.
        </p>
      ) : null}
    </div>
  );
}

function ExportCsvButton({ enabled }: { enabled: boolean }) {
  if (!enabled) {
    return (
      <button
        type="button"
        disabled
        className="dg-btn shrink-0 cursor-pointer !gap-1.5 !px-2.5 !py-1.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-45"
        title="Export is available in your live dashboard"
      >
        <Download className="size-3.5" />
        Export CSV
      </button>
    );
  }
  return <ExportCsvButtonLive />;
}

function ExportCsvButtonLive() {
  const rows = useQuery(api.functions.recoveries.exportRecoveriesCsvRows, {});

  return (
    <button
      type="button"
      disabled={rows === undefined || rows.length === 0}
      onClick={() => {
        if (!rows || rows.length === 0) return;
        downloadRecoveriesCsv(rows);
      }}
      className="dg-btn shrink-0 cursor-pointer !gap-1.5 !px-2.5 !py-1.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-45"
      title="Export open + recovered rows"
    >
      <Download className="size-3.5" />
      Export CSV
    </button>
  );
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadRecoveriesCsv(
  rows: Array<{
    customerEmail: string;
    customerName: string | null;
    productName: string | null;
    amountCents: number;
    currency: string;
    status: string;
    failedAt: number;
    recoveredAt: number | null;
    sequenceLabel: string;
    lastEmailDeliveryStatus: string | null;
    declineReason: string | null;
    feeCents: number | null;
    testMode: boolean;
  }>,
) {
  const header = [
    "customerEmail",
    "customerName",
    "productName",
    "amount",
    "currency",
    "status",
    "failedAt",
    "recoveredAt",
    "sequence",
    "deliveryStatus",
    "declineReason",
    "feeCents",
    "testMode",
  ];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        csvEscape(row.customerEmail),
        csvEscape(row.customerName ?? ""),
        csvEscape(row.productName ?? ""),
        (row.amountCents / 100).toFixed(2),
        csvEscape(row.currency),
        csvEscape(row.status),
        csvEscape(new Date(row.failedAt).toISOString()),
        csvEscape(
          row.recoveredAt != null
            ? new Date(row.recoveredAt).toISOString()
            : "",
        ),
        csvEscape(row.sequenceLabel),
        csvEscape(row.lastEmailDeliveryStatus ?? ""),
        csvEscape(row.declineReason ?? ""),
        row.feeCents != null ? String(row.feeCents) : "",
        row.testMode ? "true" : "false",
      ].join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `declineguard-recoveries-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
