import { useState } from "react";
import { Layers } from "lucide-react";
import {
  ADMIN_KIT_STEP_META,
  ADMIN_KIT_STEPS,
  SET_A_KIT_IDS,
  SET_A_KIT_META,
  chartPointsFromPeriods,
  formatAdminMetricValue,
  periodDelta,
  selectPeriodPair,
  useAdminAnalyticsNowMs,
  useAdminKitDetail,
  useAdminKitRanking,
  type AdminKitId,
  type AdminMetricsPeriod,
} from "@/lib/adminMetrics";
import AdminMetricChart from "./AdminMetricChart";
import {
  AdminCard,
  AdminEmptyState,
  AdminPageHeader,
  AdminPeriodToggle,
} from "./adminUi";

export default function AdminTemplates() {
  const nowMs = useAdminAnalyticsNowMs();
  const [period, setPeriod] = useState<AdminMetricsPeriod>("all-time");
  const [kitId, setKitId] = useState<AdminKitId | null>(null);
  const ranking = useAdminKitRanking(nowMs);
  const detail = useAdminKitDetail(kitId, nowMs);

  const recoveriesByKit = new Map(
    ranking?.kits.map((row) => [row.kitId, row] as const),
  );
  const ranked = [...SET_A_KIT_IDS].sort((a, b) => {
    const av = recoveriesByKit.get(a)?.recoveries ?? -1;
    const bv = recoveriesByKit.get(b)?.recoveries ?? -1;
    return bv - av;
  });

  const selected = kitId ? SET_A_KIT_META[kitId] : null;
  const listRow = kitId ? recoveriesByKit.get(kitId) : undefined;
  const recoveriesPair = detail
    ? selectPeriodPair(detail.recoveries, period)
    : null;
  const recoveredPair = detail
    ? selectPeriodPair(detail.recoveredCents, period)
    : null;
  const recoveriesDelta = recoveriesPair
    ? periodDelta(
        recoveriesPair.current.total,
        recoveriesPair.prior?.total ?? null,
      )
    : null;

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl min-h-0 flex-1 flex-col overflow-y-auto px-5 py-6 md:px-8 md:py-8">
      <AdminPageHeader
        eyebrow="Set A"
        title="Templates"
        description="Kits ranked by recoveries in the last 5 years. Open one for Day 0 / 2 / 5 and period charts."
        actions={
          <AdminPeriodToggle
            value={period}
            onChange={setPeriod}
            ariaLabel="Template period"
          />
        }
      />

      {ranking?.truncated ? (
        <div className="mb-4" data-enter>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
            Scan truncated
          </span>
        </div>
      ) : null}

      <div
        className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]"
        data-enter
      >
        <AdminCard className="overflow-hidden self-start">
          <ul>
            {ranked.map((id, index) => {
              const meta = SET_A_KIT_META[id];
              const row = recoveriesByKit.get(id);
              const active = kitId === id;
              return (
                <li key={id} className="border-b border-black/6 last:border-0">
                  <button
                    type="button"
                    onClick={() => setKitId(id)}
                    className={`flex w-full items-start gap-3 px-5 py-4 text-left transition ${
                      active ? "bg-black/[0.04]" : "hover:bg-black/[0.02]"
                    }`}
                  >
                    <span className="mt-0.5 w-5 shrink-0 text-[12px] font-semibold tabular-nums text-[#8a8f98]">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[#08090a]">
                        {meta.label}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-[#8a8f98]">
                        {id}
                      </span>
                    </span>
                    <span className="font-display shrink-0 text-lg tabular-nums tracking-tight text-[#08090a]">
                      {row
                        ? formatAdminMetricValue(row.recoveries, "count")
                        : ranking === undefined
                          ? "—"
                          : "0"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </AdminCard>

        {!kitId || !selected ? (
          <AdminCard>
            <AdminEmptyState
              icon={<Layers className="size-8" />}
              title="Pick a kit"
              body="Ranked by recoveries in the last 5 years. Open a kit for D0 / D2 / D5 and the same period charts."
            />
          </AdminCard>
        ) : (
          <div className="min-w-0 space-y-4">
            <AdminCard className="p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a8f98]">
                    {kitId}
                  </p>
                  <h2 className="font-display mt-1 text-2xl tracking-tight text-[#08090a]">
                    {selected.label}
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#6b6f76]">
                    {selected.blurb}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {detail?.truncated ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                      Scan truncated
                    </span>
                  ) : null}
                  {detail?.recoveredCurrencyMixed ? (
                    <span className="rounded-full border border-black/8 bg-[#f7f8f8] px-2.5 py-1 text-[11px] font-semibold text-[#6b6f76]">
                      Mixed currencies
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="font-display mt-5 text-4xl tracking-tight tabular-nums text-[#08090a]">
                {recoveriesPair
                  ? formatAdminMetricValue(recoveriesPair.current.total, "count")
                  : "—"}
              </p>
              <p className="mt-1 text-[13px] text-[#8a8f98]">
                Recoveries
                {recoveriesDelta ? ` · ${recoveriesDelta.label}` : ""}
                {recoveredPair
                  ? ` · ${formatAdminMetricValue(recoveredPair.current.total, "cents")}`
                  : listRow
                    ? ` · ${formatAdminMetricValue(listRow.recoveredCents, "cents")} last 5y`
                    : ""}
              </p>
              {detail && detail.unattributed > 0 ? (
                <p className="mt-1 text-[12px] text-[#8a8f98]">
                  {formatAdminMetricValue(detail.unattributed, "count")}{" "}
                  unattributed
                </p>
              ) : null}
              <div className="mt-5">
                <AdminMetricChart
                  points={
                    recoveriesPair
                      ? chartPointsFromPeriods(
                          recoveriesPair.current,
                          recoveriesPair.prior,
                        )
                      : []
                  }
                  compare={Boolean(recoveriesPair?.prior)}
                  status={detail === undefined ? "loading" : "ready"}
                  tall
                />
              </div>
            </AdminCard>

            <div className="grid gap-3 sm:grid-cols-3">
              {ADMIN_KIT_STEPS.map((step) => {
                const meta = ADMIN_KIT_STEP_META[step];
                const pair = detail
                  ? selectPeriodPair(detail[step], period)
                  : null;
                return (
                  <AdminCard key={step} className="p-4 md:p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a8f98]">
                      {meta.day}
                    </p>
                    <p className="font-display mt-2 text-2xl tracking-tight tabular-nums text-[#08090a]">
                      {pair
                        ? formatAdminMetricValue(pair.current.total, "count")
                        : "—"}
                    </p>
                    <p className="mt-1 text-[12px] text-[#8a8f98]">
                      {meta.label}
                      {listRow
                        ? ` · ${formatAdminMetricValue(
                            step === "day0"
                              ? listRow.day0
                              : step === "day2"
                                ? listRow.day2
                                : listRow.day5,
                            "count",
                          )} last 5y`
                        : ""}
                    </p>
                    <div className="mt-4">
                      <AdminMetricChart
                        points={
                          pair
                            ? chartPointsFromPeriods(pair.current, pair.prior)
                            : []
                        }
                        compare={Boolean(pair?.prior)}
                        status={detail === undefined ? "loading" : "ready"}
                      />
                    </div>
                  </AdminCard>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
