import {
  ArrowUpRight,
  Mail,
  Percent,
  Radio,
  Sparkles,
  TriangleAlert,
  Wallet,
  Workflow,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";
import {
  formatNextEmailAt,
  formatRelativeTime,
  PageHeader,
  Panel,
  sequenceStageForFailure,
  type OpenFailureRow,
  type SequenceStage,
} from "./dashboardUi";
import OverviewSlider, { type DayRow } from "./OverviewSlider";
import BorderGlow from "./border-glow/BorderGlow";
import CRTWarp from "@/components/homepage/crt-warp/CRTWarp";
import { useMarketingDesktop } from "@/components/homepage/marketing/MarketingDesktopContext";

type WebhookHealth = {
  connected: boolean;
  verified: boolean;
  lastReceivedAt: number | null;
  lastEventName: string | null;
};

type EmailHealth = {
  fromAddress: string;
  isProduction: boolean;
  hasApiKey: boolean;
};

type Props = {
  userFullName: string;
  storeName: string;
  recoveredLabel: string;
  openCount: number;
  openAtRiskLabel: string;
  emailsSentLabel: string;
  emailsIncludedThisMonth?: number;
  recoveryRateLabel: string;
  feesOwedLabel: string;
  youKeepLabel: string;
  recoveryFeePercent?: number;
  openFailures: OpenFailureRow[] | undefined;
  recentActivity?: unknown;
  brandColor: string;
  emailIsProduction: boolean | null;
  chartRows: DayRow[];
  hasActivity: boolean;
  displayCurrency: string;
  openAtRiskCents: number;
  recoveryRatePercent: number | null;
  recoveredThisMonthCents: number;
  recoveredPriorMonthCents: number;
  webhookStatus?: WebhookHealth | null;
  emailSetup?: EmailHealth | null;
  chartsReady?: boolean;
  onNavigate: (
    nav: "recoveries" | "sequences" | "customizations" | "settings",
  ) => void;
  onOpenSettings?: (tab?: "webhooks" | "email" | "general") => void;
  kpiLive?: boolean;
};

type MonthTrend = {
  label: string;
  tone: "good" | "warn" | "neutral";
};

type StatusTone = "good" | "warn" | "neutral";

function monthOverMonthTrend(
  currentCents: number,
  priorCents: number,
): MonthTrend {
  if (priorCents <= 0 && currentCents <= 0) {
    return { label: "No recoveries last month", tone: "neutral" };
  }
  if (priorCents <= 0) {
    return { label: "Up from $0 last month", tone: "good" };
  }
  const pct = Math.round(((currentCents - priorCents) / priorCents) * 100);
  if (pct === 0) {
    return { label: "Flat vs last month", tone: "neutral" };
  }
  if (pct > 0) {
    return { label: `+${pct}% vs last month`, tone: "good" };
  }
  return { label: `${pct}% vs last month`, tone: "warn" };
}

export default function OverviewHub({
  userFullName,
  storeName,
  recoveredLabel,
  openCount,
  openAtRiskLabel,
  emailsSentLabel,
  emailsIncludedThisMonth,
  recoveryRateLabel,
  feesOwedLabel,
  youKeepLabel,
  recoveryFeePercent = 10,
  openFailures,
  emailIsProduction,
  chartRows,
  hasActivity,
  displayCurrency,
  openAtRiskCents,
  recoveryRatePercent,
  recoveredThisMonthCents,
  recoveredPriorMonthCents,
  webhookStatus,
  emailSetup,
  chartsReady = true,
  onNavigate,
  onOpenSettings,
  kpiLive = false,
}: Props) {
  const compact = useMarketingDesktop();
  const sequenceStats = useMemo(() => {
    const nowMs = Date.now();
    const rows = openFailures ?? [];
    const counts: Record<SequenceStage, number> = {
      queued: 0,
      day0: 0,
      day2: 0,
      day5: 0,
    };
    let nextDueAt: number | null = null;
    let overdueCount = 0;

    for (const row of rows) {
      counts[sequenceStageForFailure(row)] += 1;
      if (row.nextEmailAt != null) {
        if (row.nextEmailAt < nowMs) overdueCount += 1;
        if (nextDueAt == null || row.nextEmailAt < nextDueAt) {
          nextDueAt = row.nextEmailAt;
        }
      }
    }

    const inFlight = counts.queued + counts.day0 + counts.day2;
    return { nextDueAt, overdueCount, inFlight };
  }, [openFailures]);

  const webhookHealth = useMemo(() => {
    const nowMs = Date.now();
    if (webhookStatus === undefined) {
      return {
        label: "…",
        detail: "Checking webhook",
        tone: "neutral" as const,
      };
    }
    if (!webhookStatus || !webhookStatus.connected) {
      return {
        label: "Not connected",
        detail: "No active store webhook",
        tone: "warn" as const,
      };
    }
    if (!webhookStatus.verified) {
      return {
        label: "Unverified",
        detail: "Signing secret not confirmed",
        tone: "warn" as const,
      };
    }
    if (webhookStatus.lastReceivedAt == null) {
      return {
        label: "Ready",
        detail: "Waiting for first event",
        tone: "neutral" as const,
      };
    }
    const stale =
      nowMs - webhookStatus.lastReceivedAt > 7 * 24 * 60 * 60 * 1000;
    return {
      label: stale ? "Quiet" : "Live",
      detail: `Last ${formatRelativeTime(webhookStatus.lastReceivedAt, nowMs)}`,
      tone: stale ? ("warn" as const) : ("good" as const),
    };
  }, [webhookStatus]);

  const emailHealth = useMemo(() => {
    if (emailSetup === undefined && emailIsProduction === null) {
      return {
        label: "…",
        detail: "Checking sender",
        tone: "neutral" as const,
      };
    }
    const setup = emailSetup;
    const isProd = setup?.isProduction ?? emailIsProduction;
    if (setup && !setup.hasApiKey) {
      return {
        label: "No API key",
        detail: "Resend key missing",
        tone: "warn" as const,
      };
    }
    if (isProd === false) {
      return {
        label: "Test mode",
        detail: setup?.fromAddress ?? "Test sender",
        tone: "warn" as const,
      };
    }
    if (isProd === true) {
      return {
        label: "Production",
        detail: setup?.fromAddress ?? "Live From address",
        tone: "good" as const,
      };
    }
    return {
      label: "Unknown",
      detail: "Sender not loaded",
      tone: "neutral" as const,
    };
  }, [emailSetup, emailIsProduction]);

  const monthTrend = useMemo(
    () =>
      monthOverMonthTrend(recoveredThisMonthCents, recoveredPriorMonthCents),
    [recoveredThisMonthCents, recoveredPriorMonthCents],
  );

  if (compact) {
    return (
      <div className="relative z-10 flex h-full flex-col pt-1 pb-0">
        <section data-enter className="flex min-h-0 flex-1 flex-col">
          <div className="relative min-h-0 w-full flex-1 overflow-hidden rounded-md border border-black/8">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-10 h-40 bg-linear-to-b from-[#08090a] from-35% via-[#08090a]/80 to-transparent"
              aria-hidden
            />
            <div className="pointer-events-none relative z-20 flex items-end justify-between gap-4 px-6 pt-6">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-black/45">
                  Recovered this month
                </p>
                <div className="mt-1 flex flex-wrap items-end gap-3">
                  <p
                    className={`font-display text-5xl tracking-tight tabular-nums md:text-6xl ${
                      kpiLive ? "ln-hero-kpi-pop text-teal-300" : ""
                    }`}
                  >
                    {recoveredLabel}
                  </p>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        monthTrend.tone === "good"
                          ? "bg-teal-50 text-teal-800"
                          : monthTrend.tone === "warn"
                            ? "bg-amber-50 text-amber-900"
                            : "bg-black/5 text-black/55"
                      }`}
                    >
                      {monthTrend.label}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800">
                      {recoveryRateLabel} recovery rate
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute inset-0 z-0">
              <OverviewSlider
                rows={chartRows}
                hasActivity={hasActivity}
                currency={displayCurrency}
                openCount={openCount}
                openAtRiskCents={openAtRiskCents}
                recoveryRatePercent={recoveryRatePercent}
                chartsReady={chartsReady}
              />
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="relative z-10 flex w-full flex-col pt-4 pb-8 md:pt-6 lg:h-full lg:min-h-0 lg:pb-0">
      <section
        data-enter
        className="flex flex-col gap-5 lg:min-h-0 lg:flex-1"
      >
        <div className="mx-auto w-full max-w-6xl">
        <PageHeader
          eyebrow="Overview"
          title={`Your ${storeName} store`}
          description={`Good to see you, ${userFullName}. Scoreboard is this calendar month. Chart is the last 30 days.`}
          wide
        />
        </div>

        <Panel className="relative mx-auto flex w-full max-w-6xl shrink-0 flex-col overflow-visible bg-white">
          <div className="relative z-10 flex items-end justify-between gap-4 px-5 pt-5 pb-4 md:px-6 md:pt-6">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8a8f98]">
                This calendar month
              </p>
              <p
                className={`font-display mt-1 text-4xl tracking-tight tabular-nums text-[#08090a] md:text-5xl ${
                  kpiLive ? "ln-hero-kpi-pop text-teal-700" : ""
                }`}
              >
                {recoveredLabel}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-[#6b6f76]">
                  Recovered this month
                </p>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    monthTrend.tone === "good"
                      ? "bg-teal-50 text-teal-800"
                      : monthTrend.tone === "warn"
                        ? "bg-amber-50 text-amber-900"
                        : "bg-black/5 text-[#6b6f76]"
                  }`}
                >
                  {monthTrend.tone === "good" ? (
                    <Sparkles className="size-3" />
                  ) : null}
                  {monthTrend.label}
                </span>
              </div>
            </div>
            <MonthSpark rows={chartRows} />
          </div>
          <div className="relative z-10 mx-4 mt-2 grid grid-cols-2 gap-5 sm:mx-5 sm:grid-cols-4 sm:gap-6 md:mx-6">
            <ScoreStat
              icon={Percent}
              tone="teal"
              label="Recovery rate"
              value={recoveryRateLabel}
              hint="This month cohort"
            />
            <ScoreStat
              icon={TriangleAlert}
              tone="amber"
              label="At risk"
              value={openAtRiskLabel}
              hint={`${openCount} open failure${openCount === 1 ? "" : "s"}`}
            />
            <ScoreStat
              icon={Wallet}
              tone="emerald"
              label="You keep"
              value={
                recoveredThisMonthCents > 0 ? youKeepLabel : "—"
              }
              hint={
                recoveredThisMonthCents > 0
                  ? `${recoveryFeePercent}% fee · ${feesOwedLabel}`
                  : `${recoveryFeePercent}% fee after we recover`
              }
            />
            <ScoreStat
              icon={Mail}
              tone="sky"
              label="Emails sent"
              value={emailsSentLabel}
              hint={
                emailsIncludedThisMonth != null
                  ? `${emailsSentLabel} / ${emailsIncludedThisMonth}`
                  : monthTrend.label
              }
            />
          </div>
        </Panel>

        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-stretch">
        <Panel className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-visible p-5 md:p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 rounded-md shadow-[inset_0_18px_24px_-16px_rgba(8,9,10,0.18),inset_0_-18px_24px_-16px_rgba(8,9,10,0.18)]"
          />
          <div className="relative z-10 min-h-[280px] lg:min-h-0 lg:flex-1">
            <OverviewSlider
              rows={chartRows}
              hasActivity={hasActivity}
              currency={displayCurrency}
              openCount={openCount}
              openAtRiskCents={openAtRiskCents}
              recoveryRatePercent={recoveryRatePercent}
              chartsReady={chartsReady}
            />
          </div>
        </Panel>

        <div className="grid shrink-0 grid-cols-1 gap-3 overflow-visible sm:grid-cols-2 lg:flex lg:w-[16.5rem] lg:flex-col xl:w-[17.5rem]">
          <HealthCard
            icon={TriangleAlert}
            label="Open failures"
            value={String(openCount)}
            hint={
              openCount > 0 ? `${openAtRiskLabel} at risk` : "Queue clear"
            }
            tone={
              sequenceStats.overdueCount > 0 || openCount > 0
                ? "warn"
                : "good"
            }
            action="Open queue"
            onClick={() => onNavigate("recoveries")}
          >
            {sequenceStats.overdueCount > 0 ? (
              <p className="mt-1 text-[11px] font-semibold text-amber-800">
                {sequenceStats.overdueCount} overdue
              </p>
            ) : null}
          </HealthCard>
          <HealthCard
            icon={Workflow}
            label="In sequence"
            value={String(sequenceStats.inFlight)}
            hint={
              sequenceStats.nextDueAt != null
                ? `Next ${formatNextEmailAt(sequenceStats.nextDueAt)}`
                : openCount > 0
                  ? "No sends scheduled"
                  : "Nothing in flight"
            }
            tone={
              sequenceStats.overdueCount > 0
                ? "warn"
                : sequenceStats.inFlight > 0
                  ? "good"
                  : "neutral"
            }
            onClick={() => onNavigate("sequences")}
          />
          <HealthCard
            icon={Radio}
            label="Webhook"
            value={webhookHealth.label}
            hint={webhookHealth.detail}
            tone={webhookHealth.tone}
            live={webhookHealth.tone === "good"}
            onClick={() =>
              onOpenSettings
                ? onOpenSettings("webhooks")
                : onNavigate("settings")
            }
          />
          <HealthCard
            icon={Mail}
            label="Sender"
            value={emailHealth.label}
            hint={emailHealth.detail}
            tone={emailHealth.tone}
            onClick={() =>
              onOpenSettings
                ? onOpenSettings("email")
                : onNavigate("settings")
            }
          />
        </div>
        </div>
      </section>
    </div>
  );
}

const HALO_CRT = {
  color: "#14b8a6",
  backgroundColor: "#14b8a6",
  speed: 0,
  curvature: 0.22,
  scanlineStrength: 0.22,
  scanlineFrequency: 180,
  waveAmplitude: 0.28,
  waveFrequency: 2.4,
  bloom: 1.45,
  bloomRadius: 1,
  noise: 0.08,
  vignette: 0.18,
  brightness: 1.2,
  pixelation: 1,
  rgbShift: 0.012,
  mouseReact: false,
  mouseStrength: 0,
  dpr: 1,
  fps: 24,
} as const;

function HaloCrt({
  color,
  vignette = HALO_CRT.vignette,
}: {
  color: string;
  vignette?: number;
}) {
  return (
    <CRTWarp
      className="h-full w-full"
      {...HALO_CRT}
      color={color}
      backgroundColor={color}
      vignette={vignette}
    />
  );
}

type ScoreTone = "teal" | "amber" | "emerald" | "sky";

const SCORE_TONE: Record<
  ScoreTone,
  { chip: string; icon: string; crt: string }
> = {
  teal: {
    chip: "bg-teal-100 text-teal-800",
    icon: "text-teal-800",
    crt: "#14b8a6",
  },
  amber: {
    chip: "bg-amber-100 text-amber-900",
    icon: "text-amber-900",
    crt: "#f59e0b",
  },
  emerald: {
    chip: "bg-emerald-100 text-emerald-800",
    icon: "text-emerald-800",
    crt: "#10b981",
  },
  sky: {
    chip: "bg-sky-100 text-sky-800",
    icon: "text-sky-800",
    crt: "#38bdf8",
  },
};

function ScoreStat({
  icon: Icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: typeof Wallet;
  tone: ScoreTone;
  label: string;
  value: string;
  hint: string;
}) {
  const t = SCORE_TONE[tone];
  return (
    <div className="relative min-w-0">
      <div
        className="pointer-events-none absolute -inset-x-[0.4rem] -top-[0.4rem] bottom-0 overflow-hidden rounded-t-[16px]"
        aria-hidden
      >
        <HaloCrt color={t.crt} />
      </div>
      <div className="relative z-10 rounded-t-[12px] border border-b-0 border-black/8 bg-white px-3.5 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#8a8f98]">
            {label}
          </p>
          <span
            className={`inline-flex size-6 items-center justify-center rounded-md ${t.chip}`}
          >
            <Icon className={`size-3.5 ${t.icon}`} />
          </span>
        </div>
        <p className="font-display mt-1.5 text-lg leading-[1.2] tracking-tight tabular-nums text-[#08090a]">
          {value}
        </p>
        <p className="mt-1 text-[11px] text-[#6b6f76]">{hint}</p>
      </div>
    </div>
  );
}

const HEALTH_GLOW: Record<
  StatusTone,
  { glow: string; colors: [string, string, string] }
> = {
  good: {
    glow: "160 84 42",
    colors: ["#34d399", "#10b981", "#059669"],
  },
  warn: {
    glow: "38 92 50",
    colors: ["#fbbf24", "#f59e0b", "#d97706"],
  },
  neutral: {
    glow: "199 89 60",
    colors: ["#7dd3fc", "#38bdf8", "#0ea5e9"],
  },
};

function HealthCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "neutral",
  live = false,
  action = "Open",
  onClick,
  children,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  hint: string;
  tone?: StatusTone;
  live?: boolean;
  action?: string;
  onClick: () => void;
  children?: ReactNode;
}) {
  const valueTone =
    tone === "good"
      ? "text-teal-800"
      : tone === "warn"
        ? "text-amber-900"
        : "text-[#08090a]";
  const iconTone =
    tone === "good"
      ? "text-teal-700"
      : tone === "warn"
        ? "text-amber-700"
        : "text-sky-700";
  const glow = HEALTH_GLOW[tone];
  return (
    <BorderGlow
      className="dg-health-card group relative lg:min-h-0 lg:flex-1"
      variant="v1"
      edgeSensitivity={30}
      glowColor={glow.glow}
      backgroundColor="#ffffff"
      borderRadius={6}
      glowRadius={40}
      glowIntensity={1}
      coneSpread={25}
      animated={false}
      colors={[...glow.colors]}
      fillOpacity={0.5}
    >
      <button
        type="button"
        onClick={onClick}
        className="relative flex h-full w-full cursor-pointer flex-col bg-transparent p-4 text-left"
      >
        <div className="relative z-10 flex shrink-0 items-start justify-between gap-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#8a8f98]">
            {label}
          </p>
          <Icon className={`size-4 shrink-0 ${iconTone}`} strokeWidth={1.75} />
        </div>
        <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-center">
          <p
            className={`font-display flex items-center gap-2 text-2xl leading-[1.2] tracking-tight ${valueTone}`}
          >
            {live ? (
              <span className="relative flex size-2 shrink-0">
                <span className="absolute inset-0 animate-ping rounded-full bg-teal-400/70" />
                <span className="relative size-2 rounded-full bg-teal-500" />
              </span>
            ) : null}
            {value}
          </p>
          <p className="mt-1 text-[12px] text-[#6b6f76]">{hint}</p>
          {children}
        </div>
        <span className="relative z-10 mt-auto inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#6b6f76] transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:text-[#08090a]">
          {action}
          <ArrowUpRight className="size-3.5 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </span>
      </button>
    </BorderGlow>
  );
}

function MonthSpark({ rows }: { rows: DayRow[] }) {
  const path = useMemo(() => {
    if (rows.length < 2) return null;
    const w = 132;
    const h = 40;
    const vals = rows.map((row) => row.moneyRecovered);
    const max = Math.max(...vals, 1);
    return vals
      .map((value, i) => {
        const x = (i / (vals.length - 1)) * w;
        const y = h - 3 - (value / max) * (h - 8);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [rows]);

  if (!path) return null;

  return (
    <div className="mb-1 hidden shrink-0 sm:block">
      <svg
        viewBox="0 0 132 40"
        className="h-10 w-[8.25rem] text-emerald-600"
        aria-hidden
      >
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className="text-right text-[10px] font-medium tracking-[0.06em] text-[#8a8f98] uppercase">
        Last 30 days
      </p>
    </div>
  );
}
