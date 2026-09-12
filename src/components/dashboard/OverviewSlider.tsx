import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import gsap from "gsap";
import { curveMonotoneX } from "@visx/curve";
import {
  Area,
  AreaChart,
  ChartBrush,
  ChartBrushLayout,
  ChartTooltip,
  ComposedChart,
  Grid,
  Line,
  SegmentBackground,
  SegmentLineFrom,
  SegmentLineTo,
  SeriesBar,
  XAxis,
  YAxis,
} from "@/charts";
import { formatMoneyMajor } from "./dashboardUi";
import SegmentedControl from "./SegmentedControl";
import { useMarketingDesktop } from "@/components/homepage/marketing/MarketingDesktopContext";

export type DayRow = {
  date: string;
  moneyRecovered: number;
  moneyAtRisk?: number;
  clientsRecovered: number;
  clientsNew?: number;
  clientsLost?: number;
  emailsSent: number;
  emailsBounced?: number;
};

type OverviewId = "revenue" | "clients" | "email";

const OVERVIEW_ORDER: OverviewId[] = ["revenue", "clients", "email"];

const CHART_PRIMARY = "#0d9488";
const CHART_SECONDARY = "#a1a1aa";
const CHART_WARN = "#d97706";
const CHART_LOST = "#e11d48";

/**
 * Revenue enter animation plays once after the boot screen.
 * Survives Overview unmount so returning to the tab does not replay it.
 */
let overviewRevenueEnterPlayed = false;

type OverviewChartPoint = {
  date: Date;
  moneyRecovered: number;
  moneyAtRisk: number;
  clientsRecovered: number;
  clientsNew: number;
  clientsLost: number;
  emailsSent: number;
  emailsBounced: number;
};

const OVERVIEWS = [
  {
    id: "revenue" as const,
    label: "Revenue",
    title: "Revenue overview",
  },
  {
    id: "clients" as const,
    label: "Clients",
    title: "Clients overview",
  },
  {
    id: "email" as const,
    label: "Emails",
    title: "Email overview",
  },
] as const;

type Trend = {
  label: string;
  tone: "good" | "warn" | "neutral";
};

function formatChartDay(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function sumField(rows: DayRow[], key: keyof DayRow) {
  return rows.reduce((sum, row) => {
    const value = row[key];
    return sum + (typeof value === "number" ? value : 0);
  }, 0);
}

/** Compare recent half of the window vs the prior half. */
function periodTrend(values: number[]): Trend {
  if (values.length < 4) {
    return { label: "Need more data", tone: "neutral" };
  }
  const mid = Math.floor(values.length / 2);
  const prior = values.slice(0, mid).reduce((a, b) => a + b, 0);
  const recent = values.slice(mid).reduce((a, b) => a + b, 0);
  if (prior === 0 && recent === 0) {
    return { label: "Flat · 30d", tone: "neutral" };
  }
  if (prior === 0) {
    return { label: "Up vs prior half", tone: "good" };
  }
  const pct = Math.round(((recent - prior) / prior) * 100);
  if (pct === 0) return { label: "Flat vs prior half", tone: "neutral" };
  if (pct > 0) return { label: `+${pct}% vs prior half`, tone: "good" };
  return { label: `${pct}% vs prior half`, tone: "warn" };
}

function overviewHeadlineFor(
  overview: OverviewId,
  rows: DayRow[],
  hasActivity: boolean,
  currency: string,
  recoveryRatePercent: number | null,
) {
  switch (overview) {
    case "revenue": {
      const total = sumField(rows, "moneyRecovered");
      if (!hasActivity || total === 0) return "No recoveries yet";
      if (recoveryRatePercent != null) {
        return `${recoveryRatePercent}% recovery rate`;
      }
      return `+${formatMoneyMajor(Math.round(total), currency)} recovered`;
    }
    case "clients": {
      const recovered = sumField(rows, "clientsRecovered");
      const entered = sumField(rows, "clientsNew");
      const lost = sumField(rows, "clientsLost");
      if (!hasActivity || (recovered === 0 && entered === 0 && lost === 0)) {
        return "No clients yet";
      }
      if (entered > 0 && recovered > 0) {
        return `${entered} entered · ${recovered} recovered`;
      }
      if (entered > 0) return `+${entered} entered the loop`;
      if (lost > 0 && recovered === 0) {
        return `${lost} unresolved after Day 5`;
      }
      return `+${recovered} clients recovered`;
    }
    case "email": {
      const total = sumField(rows, "emailsSent");
      if (!hasActivity || total === 0) return "No emails yet";
      const money = sumField(rows, "moneyRecovered");
      if (money > 0 && total > 0) {
        return `${formatMoneyMajor(Math.round(money / total), currency)} / email`;
      }
      return `${total} emails sent`;
    }
    default: {
      const _exhaustive: never = overview;
      return _exhaustive;
    }
  }
}

function buildOverviewStats({
  overview,
  rows,
  currency,
  openCount,
  openAtRiskCents,
  recoveryRatePercent,
}: {
  overview: OverviewId;
  rows: DayRow[];
  currency: string;
  openCount: number;
  openAtRiskCents: number;
  recoveryRatePercent: number | null;
}) {
  const money = sumField(rows, "moneyRecovered");
  const atRiskSeries = sumField(rows, "moneyAtRisk");
  const clients = sumField(rows, "clientsRecovered");
  const clientsNew = sumField(rows, "clientsNew");
  const clientsLost = sumField(rows, "clientsLost");
  const emails = sumField(rows, "emailsSent");
  const bounced = sumField(rows, "emailsBounced");
  const days = Math.max(1, rows.length);
  const trendMoney = periodTrend(rows.map((r) => r.moneyRecovered));
  const trendClients = periodTrend(rows.map((r) => r.clientsRecovered));
  const trendNew = periodTrend(rows.map((r) => r.clientsNew ?? 0));
  const trendEmails = periodTrend(rows.map((r) => r.emailsSent));
  const openAtRiskMajor = openAtRiskCents / 100;
  const bounceRate =
    emails + bounced > 0 ? Math.round((bounced / (emails + bounced)) * 100) : 0;
  const moneyPerEmail = emails > 0 ? money / emails : 0;

  switch (overview) {
    case "revenue":
      return [
        {
          label: "Total recovered",
          value: formatMoneyMajor(Math.round(money), currency),
          hint: trendMoney.label,
          hintTone: trendMoney.tone,
        },
        {
          label: "Still at risk",
          value: formatMoneyMajor(Math.round(openAtRiskMajor), currency),
          hint:
            openAtRiskMajor > 0
              ? "Open failures now"
              : atRiskSeries > 0
                ? `${formatMoneyMajor(Math.round(atRiskSeries), currency)} new in 30d`
                : "Queue clear",
          hintTone: openAtRiskMajor > 0 ? ("warn" as const) : ("good" as const),
        },
        {
          label: "Recovery rate",
          value:
            recoveryRatePercent != null ? `${recoveryRatePercent}%` : "—",
          hint:
            recoveryRatePercent != null
              ? "This month cohort"
              : "No cohort yet",
          hintTone:
            recoveryRatePercent == null
              ? ("neutral" as const)
              : recoveryRatePercent >= 40
                ? ("good" as const)
                : recoveryRatePercent >= 20
                  ? ("neutral" as const)
                  : ("warn" as const),
        },
        {
          label: "Avg / day",
          value: formatMoneyMajor(Math.round(money / days), currency),
          hint: "Last 30 days",
          hintTone: "neutral" as const,
        },
      ];
    case "clients":
      return [
        {
          label: "Entered loop",
          value: clientsNew.toLocaleString(),
          hint: trendNew.label,
          hintTone: trendNew.tone,
        },
        {
          label: "Recovered",
          value: clients.toLocaleString(),
          hint: trendClients.label,
          hintTone: trendClients.tone,
        },
        {
          label: "Unresolved",
          value: clientsLost.toLocaleString(),
          hint:
            clientsLost > 0
              ? "Day 5 sent · still open"
              : "No exhausted sequences",
          hintTone: clientsLost > 0 ? ("warn" as const) : ("good" as const),
        },
        {
          label: "Still open",
          value: openCount.toLocaleString(),
          hint: openCount > 0 ? "In recovery queue" : "Queue clear",
          hintTone: openCount > 0 ? ("warn" as const) : ("good" as const),
        },
      ];
    case "email":
      return [
        {
          label: "Emails sent",
          value: emails.toLocaleString(),
          hint: trendEmails.label,
          hintTone: trendEmails.tone,
        },
        {
          label: "Bounce rate",
          value: `${bounceRate}%`,
          hint:
            bounced > 0
              ? `${bounced} bounced · 30d`
              : "No bounces tracked",
          hintTone:
            bounceRate >= 5
              ? ("warn" as const)
              : bounced > 0
                ? ("neutral" as const)
                : ("good" as const),
        },
        {
          label: "$ / email",
          value: formatMoneyMajor(Math.round(moneyPerEmail), currency),
          hint: money > 0 ? "Recovered ÷ sent" : "No recoveries yet",
          hintTone: moneyPerEmail > 0 ? ("good" as const) : ("neutral" as const),
        },
        {
          label: "Avg / day",
          value: (emails / days).toFixed(1),
          hint: "Last 30 days",
          hintTone: "neutral" as const,
        },
      ];
    default: {
      const _exhaustive: never = overview;
      return _exhaustive;
    }
  }
}

function OverviewKpi({
  label,
  value,
  hint,
  hintTone,
}: {
  label: string;
  value: string;
  hint: string;
  hintTone: "good" | "warn" | "neutral";
}) {
  const hintClass =
    hintTone === "good"
      ? "text-teal-700 dark:text-teal-400"
      : hintTone === "warn"
        ? "text-amber-800 dark:text-amber-300"
        : "text-black/45";

  return (
    <div
      className="relative z-10 isolate rounded-md border border-black/8 px-3.5 py-3 md:px-4 md:py-3.5"
      style={{ backgroundColor: "#ffffff" }}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-black/45">
        {label}
      </p>
      <p className="font-display mt-1 text-[1.25rem] leading-none tracking-tight tabular-nums md:text-[1.35rem]">
        {value}
      </p>
      <p className={`mt-1 text-[11px] font-medium ${hintClass}`}>{hint}</p>
    </div>
  );
}

function BrushableShell({
  chartData,
  brushKey,
  children,
}: {
  chartData: Record<string, unknown>[];
  brushKey: string;
  children: (layout: {
    xDomain: [Date, Date] | undefined;
    xDomainSlotCount: number | undefined;
  }) => ReactNode;
}) {
  const compact = useMarketingDesktop();
  if (compact) {
    return (
      <div className="relative min-h-0 w-full flex-1">
        <div className="absolute inset-0">
          {children({ xDomain: undefined, xDomainSlotCount: undefined })}
        </div>
      </div>
    );
  }
  return (
    <div className="h-[300px] w-full md:h-[340px] lg:relative lg:min-h-[340px] lg:flex-1">
      <ChartBrushLayout
        className="h-full lg:absolute lg:inset-0"
        data={chartData}
        enabled={chartData.length > 1}
        height={64}
        brushStrip={(layout) => (
          <AreaChart
            animationDuration={0}
            data={chartData}
            margin={{ top: 4, right: 12, bottom: 4, left: 12 }}
            status="ready"
            style={{ aspectRatio: "unset", height: "100%" }}
          >
            <Area
              animate={false}
              curve={curveMonotoneX}
              dataKey={brushKey}
              fill={CHART_PRIMARY}
              fillOpacity={0.15}
              showHighlight={false}
              stroke={CHART_PRIMARY}
              strokeWidth={1.25}
            />
            <ChartBrush
              initialSelection={layout.brushSelection ?? undefined}
              onSelectionChange={layout.onBrushSelectionChange}
            />
          </AreaChart>
        )}
      >
        {(layout) =>
          children({
            xDomain: layout.xDomain,
            xDomainSlotCount: layout.xDomainSlotCount,
          })
        }
      </ChartBrushLayout>
    </div>
  );
}

function OverviewRevenueChart({
  chartData,
  currency,
  xDomain,
  xDomainSlotCount,
}: {
  chartData: OverviewChartPoint[];
  currency: string;
  xDomain: [Date, Date] | undefined;
  xDomainSlotCount: number | undefined;
}) {
  const compact = useMarketingDesktop();
  const [animationDuration] = useState(() => {
    if (overviewRevenueEnterPlayed) return 0;
    overviewRevenueEnterPlayed = true;
    return 1100;
  });
  const animateEnter = animationDuration > 0;

  return (
    <ComposedChart
      animationDuration={animationDuration}
      aspectRatio="unset"
      barGap={compact ? 3 : 2}
      data={chartData}
      margin={
        compact
          ? { top: 24, right: 16, bottom: 44, left: 16 }
          : { top: 16, right: 12, bottom: 28, left: 12 }
      }
      maxBarSize={compact ? 22 : 14}
      style={{ height: "100%" }}
      tweenYDomainOnXDomainChange
      xDomain={xDomain}
      xDomainSlotCount={xDomainSlotCount}
      yDomainTween
    >
      {compact ? null : <Grid horizontal />}
      <SeriesBar
        animate={animateEnter}
        dataKey="moneyAtRisk"
        fill={CHART_WARN}
        radius={compact ? 4 : 3}
      />
      <Area
        animate={animateEnter}
        curve={curveMonotoneX}
        dataKey="moneyRecovered"
        fill={compact ? "#2dd4bf" : CHART_PRIMARY}
        fillOpacity={compact ? 0.45 : 0.28}
        stroke={compact ? "#5eead4" : CHART_PRIMARY}
        strokeWidth={compact ? 2.75 : 2}
      />
      <SegmentBackground />
      <SegmentLineFrom />
      <SegmentLineTo />
      <XAxis numTicks={5} />
      <ChartTooltip
        showCrosshair={false}
        rows={(point) => {
          const recovered =
            typeof point.moneyRecovered === "number"
              ? point.moneyRecovered
              : 0;
          const atRisk =
            typeof point.moneyAtRisk === "number" ? point.moneyAtRisk : 0;
          return [
            {
              dataKey: "moneyRecovered",
              label: "Recovered",
              value: formatMoneyMajor(Math.round(recovered), currency),
              color: CHART_PRIMARY,
            },
            {
              dataKey: "moneyAtRisk",
              label: "New declines",
              value: formatMoneyMajor(Math.round(atRisk), currency),
              color: CHART_WARN,
            },
          ];
        }}
      />
    </ComposedChart>
  );
}

function OverviewPanels({
  overview,
  rows,
  hasActivity,
  currency,
  openCount,
  openAtRiskCents,
  recoveryRatePercent,
  chartsReady,
}: {
  overview: OverviewId;
  rows: DayRow[];
  hasActivity: boolean;
  currency: string;
  openCount: number;
  openAtRiskCents: number;
  recoveryRatePercent: number | null;
  chartsReady: boolean;
}) {
  const compact = useMarketingDesktop();
  const meta = OVERVIEWS.find((item) => item.id === overview) ?? OVERVIEWS[0];
  const stats = useMemo(
    () =>
      buildOverviewStats({
        overview,
        rows,
        currency,
        openCount,
        openAtRiskCents,
        recoveryRatePercent,
      }),
    [
      overview,
      rows,
      currency,
      openCount,
      openAtRiskCents,
      recoveryRatePercent,
    ],
  );
  const headline = useMemo(
    () =>
      overviewHeadlineFor(
        overview,
        rows,
        hasActivity,
        currency,
        recoveryRatePercent,
      ),
    [overview, rows, hasActivity, currency, recoveryRatePercent],
  );
  const chartData = useMemo(
    () =>
      rows.map((row) => ({
        date: new Date(`${row.date}T12:00:00`),
        moneyRecovered: row.moneyRecovered,
        moneyAtRisk: row.moneyAtRisk ?? 0,
        clientsRecovered: row.clientsRecovered,
        clientsNew: row.clientsNew ?? 0,
        clientsLost: row.clientsLost ?? 0,
        emailsSent: row.emailsSent,
        emailsBounced: row.emailsBounced ?? 0,
      })),
    [rows],
  );

  const showPositive =
    hasActivity &&
    (overview === "revenue"
      ? rows.some((r) => r.moneyRecovered > 0)
      : overview === "clients"
        ? rows.some(
            (r) =>
              r.clientsRecovered > 0 ||
              (r.clientsNew ?? 0) > 0 ||
              (r.clientsLost ?? 0) > 0,
          )
        : rows.some((r) => r.emailsSent > 0));

  const seriesCaption =
    overview === "revenue"
      ? "Recovered vs new declines"
      : overview === "clients"
        ? "Entered · recovered · unresolved"
        : "Emails sent vs money recovered";

  return (
    <div
      className={`lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:space-y-0 ${
        compact ? "flex h-full min-h-0 flex-col gap-3" : "space-y-4 lg:gap-4"
      }`}
    >
      {!compact ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((stat) => (
            <OverviewKpi
              key={stat.label}
              label={stat.label}
              value={stat.value}
              hint={stat.hint}
              hintTone={stat.hintTone}
            />
          ))}
        </div>
      ) : null}

      {!compact ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-black/45">
              {seriesCaption}
            </p>
            <p className="font-display mt-0.5 text-lg tracking-tight">
              Daily trend
            </p>
          </div>
          <span
            className={
              showPositive
                ? "rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800 dark:bg-teal-500/15 dark:text-teal-300"
                : "rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-black/55 dark:bg-white/8"
            }
          >
            {headline}
          </span>
        </div>
      ) : null}

      {overview === "revenue" ? (
        chartsReady ? (
          <BrushableShell brushKey="moneyRecovered" chartData={chartData}>
            {(layout) => (
              <OverviewRevenueChart
                chartData={chartData}
                currency={currency}
                xDomain={layout.xDomain}
                xDomainSlotCount={layout.xDomainSlotCount}
              />
            )}
          </BrushableShell>
        ) : (
          <div className="h-[300px] w-full md:h-[340px] lg:min-h-[340px] lg:flex-1" aria-hidden />
        )
      ) : null}

      {overview === "clients" ? (
        chartsReady ? (
          <BrushableShell brushKey="clientsMix" chartData={chartData}>
            {(layout) => (
              <ComposedChart
                animationDuration={0}
                aspectRatio="unset"
                data={chartData}
                margin={{ top: 16, right: 12, bottom: 28, left: 12 }}
                maxBarSize={16}
                stackGap={1}
                stacked
                style={{ height: "100%" }}
                tweenYDomainOnXDomainChange
                xDomain={layout.xDomain}
                xDomainSlotCount={layout.xDomainSlotCount}
                yDomainTween
              >
                <Grid horizontal />
                <SeriesBar
                  animate={false}
                  dataKey="clientsNew"
                  fill={CHART_SECONDARY}
                  radius={3}
                />
                <SeriesBar
                  animate={false}
                  dataKey="clientsRecovered"
                  fill={CHART_PRIMARY}
                  radius={3}
                />
                <SeriesBar
                  animate={false}
                  dataKey="clientsLost"
                  fill={CHART_LOST}
                  radius={3}
                />
                <SegmentBackground />
                <SegmentLineFrom />
                <SegmentLineTo />
                <XAxis numTicks={5} />
                <ChartTooltip
                  showCrosshair={false}
                  rows={(point) => {
                    const entered =
                      typeof point.clientsNew === "number"
                        ? point.clientsNew
                        : 0;
                    const recovered =
                      typeof point.clientsRecovered === "number"
                        ? point.clientsRecovered
                        : 0;
                    const lost =
                      typeof point.clientsLost === "number"
                        ? point.clientsLost
                        : 0;
                    return [
                      {
                        dataKey: "clientsNew",
                        label: "Entered loop",
                        value: entered.toLocaleString(),
                        color: CHART_SECONDARY,
                      },
                      {
                        dataKey: "clientsRecovered",
                        label: "Recovered",
                        value: recovered.toLocaleString(),
                        color: CHART_PRIMARY,
                      },
                      {
                        dataKey: "clientsLost",
                        label: "Unresolved",
                        value: lost.toLocaleString(),
                        color: CHART_LOST,
                      },
                    ];
                  }}
                />
              </ComposedChart>
            )}
          </BrushableShell>
        ) : (
          <div className="h-[300px] w-full md:h-[340px] lg:min-h-[340px] lg:flex-1" aria-hidden />
        )
      ) : null}

      {overview === "email" ? (
        chartsReady ? (
          <BrushableShell brushKey="emailsSent" chartData={chartData}>
            {(layout) => (
              <ComposedChart
                animationDuration={0}
                aspectRatio="unset"
                barGap={0}
                data={chartData}
                margin={{ top: 16, right: 44, bottom: 28, left: 36 }}
                maxBarSize={16}
                style={{ height: "100%" }}
                tweenYDomainOnXDomainChange
                xDomain={layout.xDomain}
                xDomainSlotCount={layout.xDomainSlotCount}
                yDomainTween
              >
                <Grid horizontal />
                <SeriesBar
                  animate={false}
                  dataKey="emailsSent"
                  fill={CHART_SECONDARY}
                  radius={3}
                />
                <Line
                  animate={false}
                  curve={curveMonotoneX}
                  dataKey="moneyRecovered"
                  showMarkers
                  stroke={CHART_PRIMARY}
                  strokeWidth={2}
                  yAxisId="right"
                />
                <YAxis numTicks={4} yAxisId="left" />
                <YAxis
                  formatValue={(value) =>
                    formatMoneyMajor(Math.round(value), currency)
                  }
                  numTicks={4}
                  orientation="right"
                  yAxisId="right"
                />
                <SegmentBackground />
                <SegmentLineFrom />
                <SegmentLineTo />
                <XAxis numTicks={5} />
                <ChartTooltip
                  showCrosshair={false}
                  rows={(point) => {
                    const sent =
                      typeof point.emailsSent === "number"
                        ? point.emailsSent
                        : 0;
                    const recovered =
                      typeof point.moneyRecovered === "number"
                        ? point.moneyRecovered
                        : 0;
                    const bounced =
                      typeof point.emailsBounced === "number"
                        ? point.emailsBounced
                        : 0;
                    return [
                      {
                        dataKey: "emailsSent",
                        label: "Emails sent",
                        value: sent.toLocaleString(),
                        color: CHART_SECONDARY,
                      },
                      {
                        dataKey: "moneyRecovered",
                        label: "Money recovered",
                        value: formatMoneyMajor(Math.round(recovered), currency),
                        color: CHART_PRIMARY,
                      },
                      ...(bounced > 0
                        ? [
                            {
                              dataKey: "emailsBounced",
                              label: "Bounced",
                              value: bounced.toLocaleString(),
                              color: CHART_WARN,
                            },
                          ]
                        : []),
                    ];
                  }}
                />
              </ComposedChart>
            )}
          </BrushableShell>
        ) : (
          <div className="h-[300px] w-full md:h-[340px] lg:min-h-[340px] lg:flex-1" aria-hidden />
        )
      ) : null}

      <div
        className={`flex flex-wrap items-center gap-4 text-[11px] font-medium text-black/45 ${
          compact
            ? "pointer-events-none absolute inset-x-0 bottom-0 z-10 shrink-0 px-6 pb-4"
            : ""
        }`}
      >
        {overview === "revenue" ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ background: compact ? "#5eead4" : CHART_PRIMARY }}
              />
              Recovered
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-2 rounded-sm"
                style={{ background: CHART_WARN }}
              />
              New declines
            </span>
          </>
        ) : null}
        {overview === "clients" ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-2 rounded-sm"
                style={{ background: CHART_SECONDARY }}
              />
              Entered loop
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-2 rounded-sm"
                style={{ background: CHART_PRIMARY }}
              />
              Recovered
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-2 rounded-sm"
                style={{ background: CHART_LOST }}
              />
              Unresolved
            </span>
          </>
        ) : null}
        {overview === "email" ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-2 rounded-sm"
                style={{ background: CHART_SECONDARY }}
              />
              Emails sent
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ background: CHART_PRIMARY }}
              />
              Money recovered
            </span>
          </>
        ) : null}
        {!compact ? (
          <span className="text-black/30">
            Drag chart to select · brush to zoom
          </span>
        ) : null}
      </div>
    </div>
  );
}

type Props = {
  rows: DayRow[];
  hasActivity: boolean;
  /** ISO currency for money labels (charts store major units). */
  currency?: string;
  openCount?: number;
  openAtRiskCents?: number;
  recoveryRatePercent?: number | null;
  /**
   * When false, charts stay unmounted (boot splash still covering).
   * Revenue enter animation starts on the first true after boot.
   */
  chartsReady?: boolean;
};

export default function OverviewSlider({
  rows,
  hasActivity,
  currency = "USD",
  openCount = 0,
  openAtRiskCents = 0,
  recoveryRatePercent = null,
  chartsReady = true,
}: Props) {
  const compact = useMarketingDesktop();
  const [overview, setOverview] = useState<OverviewId>("revenue");
  const [overviewSnapshot, setOverviewSnapshot] = useState<string | null>(null);

  const overviewIncomingRef = useRef<HTMLDivElement>(null);
  const overviewOutgoingRef = useRef<HTMLDivElement>(null);
  const overviewDirRef = useRef<1 | -1>(1);
  const overviewAnimatingRef = useRef(false);
  const overviewSlideGenRef = useRef(0);

  const activeOverview =
    OVERVIEWS.find((item) => item.id === overview) ?? OVERVIEWS[0];

  const selectOverview = useCallback(
    (next: OverviewId) => {
      if (next === overview || overviewAnimatingRef.current) return;
      const from = OVERVIEW_ORDER.indexOf(overview);
      const to = OVERVIEW_ORDER.indexOf(next);
      overviewDirRef.current = to > from ? 1 : -1;

      const current = overviewIncomingRef.current;
      setOverviewSnapshot(current ? current.innerHTML : null);
      overviewSlideGenRef.current += 1;
      setOverview(next);
    },
    [overview],
  );

  useLayoutEffect(() => {
    if (!overviewSnapshot) return;
    const outEl = overviewOutgoingRef.current;
    const inEl = overviewIncomingRef.current;
    if (!outEl || !inEl) {
      setOverviewSnapshot(null);
      return;
    }

    const gen = overviewSlideGenRef.current;
    overviewAnimatingRef.current = true;
    const dir = overviewDirRef.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    const duration = reduced ? 0.01 : 0.4;
    const ease = reduced ? "none" : "power3.out";

    gsap.killTweensOf([outEl, inEl]);
    gsap.set(outEl, {
      xPercent: 0,
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      force3D: true,
    });
    gsap.set(inEl, {
      xPercent: dir * 100,
      opacity: 0,
      scale: 0.96,
      filter: "blur(8px)",
      force3D: true,
    });

    const tl = gsap.timeline({
      onComplete: () => {
        if (overviewSlideGenRef.current !== gen) return;
        overviewAnimatingRef.current = false;
        setOverviewSnapshot(null);
        gsap.set(inEl, { clearProps: "transform,filter,opacity" });
      },
    });
    tl.to(
      outEl,
      {
        xPercent: dir * -100,
        opacity: 0,
        scale: 0.96,
        filter: "blur(8px)",
        duration,
        ease,
        force3D: true,
      },
      0,
    );
    tl.to(
      inEl,
      {
        xPercent: 0,
        opacity: 1,
        scale: 1,
        filter: "blur(0px)",
        duration,
        ease,
        force3D: true,
      },
      0,
    );

    return () => {
      tl.kill();
    };
  }, [overview, overviewSnapshot]);

  return (
    <section
      className={
        compact
          ? "flex h-full min-h-0 flex-1 flex-col"
          : "space-y-4"
      }
    >
      {!compact ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-lg tracking-tight md:text-xl">
            {activeOverview.title}
          </p>
          <SegmentedControl
            ariaLabel="Overview type"
            idPrefix="overview"
            controlsId={`overview-panel-${overview}`}
            equal
            className="relative z-20 w-full max-w-sm shadow-none transition-shadow duration-300 ease-out hover:shadow-[0_6px_14px_-8px_rgba(8,9,10,0.18)]"
            value={overview}
            onChange={selectOverview}
            options={OVERVIEWS.map((item) => ({
              id: item.id,
              label: item.label,
            }))}
          />
        </div>
      ) : null}

      <div
        id={`overview-panel-${overview}`}
        role="tabpanel"
        aria-labelledby={`overview-tab-${overview}`}
        className={`relative overflow-hidden ${compact ? "flex min-h-0 flex-1 flex-col" : ""}`}
      >
        {overviewSnapshot ? (
          <div
            ref={overviewOutgoingRef}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 w-full will-change-transform"
            dangerouslySetInnerHTML={{ __html: overviewSnapshot }}
          />
        ) : null}
        <div
          ref={overviewIncomingRef}
          className={compact ? "flex min-h-0 flex-1 flex-col" : undefined}
        >
          <OverviewPanels
            overview={overview}
            rows={rows}
            hasActivity={hasActivity}
            currency={currency}
            openCount={openCount}
            openAtRiskCents={openAtRiskCents}
            recoveryRatePercent={recoveryRatePercent}
            chartsReady={chartsReady}
          />
        </div>
      </div>
    </section>
  );
}
