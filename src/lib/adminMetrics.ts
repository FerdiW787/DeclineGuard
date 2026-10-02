/**
 * Admin platform-metrics adapter.
 *
 * Bound queries (`convex/functions/adminAnalytics.ts`):
 *   api.functions.adminAnalytics.getOverview({ nowMs })
 *   api.functions.adminAnalytics.listTemplates({ nowMs })
 *   api.functions.adminAnalytics.getTemplateDetail({ kitId, nowMs })
 *
 * Pass a stable `nowMs` from the client (UTC). `allTime` is a trailing
 * 5-year UTC window through the current month — not epoch.
 */

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export const ADMIN_METRICS_PERIODS = ["all-time", "yoy", "mom"] as const;
export type AdminMetricsPeriod = (typeof ADMIN_METRICS_PERIODS)[number];

export const SET_A_KIT_IDS = [
  "poster-notice",
  "amount-due",
  "plain-letter",
  "what-happened",
  "quiet-column",
] as const;
export type AdminKitId = (typeof SET_A_KIT_IDS)[number];

export const ADMIN_OVERVIEW_METRIC_IDS = [
  "emailsSent",
  "recoveries",
  "recoveredCents",
  "signups",
  "proUpgrades",
] as const;
export type AdminOverviewMetricId = (typeof ADMIN_OVERVIEW_METRIC_IDS)[number];

export const ADMIN_KIT_STEPS = ["day0", "day2", "day5"] as const;
export type AdminKitStepId = (typeof ADMIN_KIT_STEPS)[number];

export type AdminSeriesPoint = {
  t: number;
  label: string;
  value: number;
};

export type AdminPeriodTotals = {
  total: number;
  series: AdminSeriesPoint[];
};

export type AdminMetricPeriods = {
  allTime: AdminPeriodTotals;
  thisYear: AdminPeriodTotals;
  lastYear: AdminPeriodTotals;
  thisMonth: AdminPeriodTotals;
  lastMonth: AdminPeriodTotals;
};

export type AdminOverviewResponse = {
  timezone: "UTC";
  asOfMs: number;
  truncated: boolean;
  recoveredCurrencyMixed: boolean;
  emailsSent: AdminMetricPeriods;
  recoveries: AdminMetricPeriods;
  recoveredCents: AdminMetricPeriods;
  signups: AdminMetricPeriods;
  proUpgrades: AdminMetricPeriods;
};

export type AdminKitRankRow = {
  kitId: AdminKitId;
  recoveries: number;
  recoveredCents: number;
  day0: number;
  day2: number;
  day5: number;
  unattributed: number;
};

export type AdminKitRankingResponse = {
  timezone: "UTC";
  asOfMs: number;
  truncated: boolean;
  kits: AdminKitRankRow[];
};

export type AdminKitDetailResponse = {
  timezone: "UTC";
  asOfMs: number;
  kitId: AdminKitId;
  truncated: boolean;
  recoveredCurrencyMixed: boolean;
  recoveries: AdminMetricPeriods;
  recoveredCents: AdminMetricPeriods;
  day0: AdminMetricPeriods;
  day2: AdminMetricPeriods;
  day5: AdminMetricPeriods;
  unattributed: number;
};

export type AdminChartPoint = {
  date: Date;
  value: number;
  prior?: number;
  label: string;
};

export const ADMIN_OVERVIEW_METRIC_META: Record<
  AdminOverviewMetricId,
  { label: string; format: "count" | "cents" }
> = {
  emailsSent: { label: "Emails sent", format: "count" },
  recoveries: { label: "Recoveries", format: "count" },
  recoveredCents: { label: "Recovered", format: "cents" },
  signups: { label: "Signups", format: "count" },
  proUpgrades: { label: "Pro upgrades", format: "count" },
};

export const SET_A_KIT_META: Record<AdminKitId, { label: string; blurb: string }> =
  {
    "poster-notice": {
      label: "Poster notice",
      blurb: "Bold notice with the amount due up front.",
    },
    "amount-due": {
      label: "Amount due",
      blurb: "Ledger-style amount and pay CTA.",
    },
    "plain-letter": {
      label: "Plain letter",
      blurb: "Quiet letter, one ask.",
    },
    "what-happened": {
      label: "What happened",
      blurb: "Explains the decline, then the next step.",
    },
    "quiet-column": {
      label: "Quiet column",
      blurb: "Narrow column, minimal chrome.",
    },
  };

export const ADMIN_KIT_STEP_META: Record<
  AdminKitStepId,
  { label: string; day: string }
> = {
  day0: { label: "Day 0", day: "D0" },
  day2: { label: "Day 2", day: "D2" },
  day5: { label: "Day 5", day: "D5" },
};

export const ADMIN_PERIOD_META: Record<
  AdminMetricsPeriod,
  { label: string; short: string; hint: string }
> = {
  "all-time": {
    label: "Last 5 years",
    short: "5y",
    hint: "Last 5 years · UTC",
  },
  yoy: {
    label: "Year over year",
    short: "YoY",
    hint: "This year vs last year",
  },
  mom: {
    label: "Month over month",
    short: "MoM",
    hint: "This month vs last month",
  },
};

export function formatAdminMetricValue(
  value: number,
  format: "count" | "cents",
): string {
  if (format === "cents") {
    // Always USD. Mixed currencies are badged in the UI, not formatted here.
    try {
      return new Intl.NumberFormat("en", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value / 100);
    } catch {
      return `$${Math.round(value / 100).toLocaleString()}`;
    }
  }
  return new Intl.NumberFormat("en").format(value);
}

export function selectPeriodPair(
  periods: AdminMetricPeriods,
  period: AdminMetricsPeriod,
): { current: AdminPeriodTotals; prior: AdminPeriodTotals | null } {
  switch (period) {
    case "all-time":
      return { current: periods.allTime, prior: null };
    case "yoy":
      return { current: periods.thisYear, prior: periods.lastYear };
    case "mom":
      return { current: periods.thisMonth, prior: periods.lastMonth };
    default: {
      const _exhaustive: never = period;
      return _exhaustive;
    }
  }
}

export function chartPointsFromPeriods(
  current: AdminPeriodTotals,
  prior: AdminPeriodTotals | null,
): AdminChartPoint[] {
  const priorByKey = new Map<string, number>();
  if (prior) {
    for (const point of prior.series) {
      priorByKey.set(alignKey(point), point.value);
    }
  }
  return current.series.map((point) => {
    const row: AdminChartPoint = {
      date: new Date(point.t),
      value: point.value,
      label: point.label,
    };
    if (prior) {
      row.prior = priorByKey.get(alignKey(point)) ?? 0;
    }
    return row;
  });
}

/**
 * Overlay key for prior vs current series.
 * BE labels are `YYYY-MM` (monthly YoY / 5y) or `YYYY-MM-DD` (daily MoM).
 * Last token is the shared ordinal: month (`10`) for YoY, day-of-month (`02`)
 * for MoM so `2026-10-02` meets `2026-09-02`.
 */
function alignKey(point: AdminSeriesPoint): string {
  const parts = point.label.split("-");
  return parts[parts.length - 1] ?? point.label;
}

export function periodDelta(
  current: number,
  prior: number | null,
): { label: string; tone: "good" | "warn" | "neutral" } | null {
  if (prior == null) return null;
  if (prior === 0 && current === 0) {
    return { label: "Flat vs prior", tone: "neutral" };
  }
  if (prior === 0) {
    return { label: "New vs prior", tone: "good" };
  }
  const pct = Math.round(((current - prior) / prior) * 100);
  if (pct === 0) return { label: "Flat vs prior", tone: "neutral" };
  const sign = pct > 0 ? "+" : "";
  return {
    label: `${sign}${pct}% vs prior`,
    tone: pct > 0 ? "good" : "warn",
  };
}

export function useAdminAnalyticsNowMs(): number {
  const [nowMs] = useState(() => Date.now());
  return nowMs;
}

export function useAdminOverview(nowMs: number) {
  return useQuery(api.functions.adminAnalytics.getOverview, { nowMs });
}

export function useAdminKitRanking(nowMs: number) {
  return useQuery(api.functions.adminAnalytics.listTemplates, { nowMs });
}

export function useAdminKitDetail(kitId: AdminKitId | null, nowMs: number) {
  return useQuery(
    api.functions.adminAnalytics.getTemplateDetail,
    kitId ? { kitId, nowMs } : "skip",
  );
}
