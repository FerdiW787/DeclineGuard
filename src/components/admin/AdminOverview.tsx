import { useState } from "react";
import { Mail, RotateCcw, Sparkles, UserPlus, Wallet } from "lucide-react";
import {
  ADMIN_OVERVIEW_METRIC_IDS,
  ADMIN_OVERVIEW_METRIC_META,
  ADMIN_PERIOD_META,
  chartPointsFromPeriods,
  formatAdminMetricValue,
  periodDelta,
  selectPeriodPair,
  useAdminAnalyticsNowMs,
  useAdminOverview,
  type AdminMetricsPeriod,
  type AdminOverviewMetricId,
} from "@/lib/adminMetrics";
import AdminMetricChart from "./AdminMetricChart";
import { AdminCard, AdminPageHeader, AdminPeriodToggle } from "./adminUi";

const METRIC_ICONS: Record<AdminOverviewMetricId, typeof Mail> = {
  emailsSent: Mail,
  recoveries: RotateCcw,
  recoveredCents: Wallet,
  signups: UserPlus,
  proUpgrades: Sparkles,
};

export default function AdminOverview() {
  const nowMs = useAdminAnalyticsNowMs();
  const [period, setPeriod] = useState<AdminMetricsPeriod>("all-time");
  const data = useAdminOverview(nowMs);
  const loading = data === undefined;

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl min-h-0 flex-1 flex-col overflow-y-auto px-5 py-6 md:px-8 md:py-8">
      <AdminPageHeader
        eyebrow="Platform"
        title="Overview"
        description="Emails, recoveries, signups, and Pro — UTC totals for the last 5 years, YoY, and MoM."
        actions={
          <AdminPeriodToggle
            value={period}
            onChange={setPeriod}
            ariaLabel="Overview period"
          />
        }
      />

      {data?.truncated || data?.recoveredCurrencyMixed ? (
        <div className="mb-4 flex flex-wrap gap-2" data-enter>
          {data.truncated ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
              Scan truncated
            </span>
          ) : null}
          {data.recoveredCurrencyMixed ? (
            <span className="rounded-full border border-black/8 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#6b6f76]">
              Recovered $ mixed currencies
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-enter>
        {ADMIN_OVERVIEW_METRIC_IDS.map((id) => {
          const meta = ADMIN_OVERVIEW_METRIC_META[id];
          const Icon = METRIC_ICONS[id];
          const pair = data ? selectPeriodPair(data[id], period) : null;
          const delta = pair
            ? periodDelta(pair.current.total, pair.prior?.total ?? null)
            : null;
          const points = pair
            ? chartPointsFromPeriods(pair.current, pair.prior)
            : [];
          return (
            <AdminCard key={id} className="flex flex-col p-5 md:p-6">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a8f98]">
                <Icon className="size-3.5" />
                {meta.label}
              </div>
              <p className="font-display mt-4 text-4xl tracking-tight tabular-nums text-[#08090a] md:text-5xl">
                {pair
                  ? formatAdminMetricValue(pair.current.total, meta.format)
                  : "—"}
              </p>
              {delta ? (
                <p
                  className={`mt-1.5 text-[12px] font-semibold ${
                    delta.tone === "good"
                      ? "text-emerald-700"
                      : delta.tone === "warn"
                        ? "text-amber-800"
                        : "text-[#8a8f98]"
                  }`}
                >
                  {delta.label}
                </p>
              ) : (
                <p className="mt-1.5 text-[12px] text-[#8a8f98]">
                  {ADMIN_PERIOD_META[period].hint}
                </p>
              )}
              <div className="mt-5">
                <AdminMetricChart
                  points={points}
                  compare={Boolean(pair?.prior)}
                  status={loading ? "loading" : "ready"}
                />
              </div>
            </AdminCard>
          );
        })}
      </div>
    </div>
  );
}
