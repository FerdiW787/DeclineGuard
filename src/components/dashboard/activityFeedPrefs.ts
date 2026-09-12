import { useEffect, useState } from "react";

export type ActivityRange = "24h" | "week" | "month";
export type ActivityKind = "recovered" | "failed" | "email";
export type ActivitySort = "newest" | "oldest";

const RANGE_KEY = "dg-activity-range";

type FilterPrefs = {
  filtersOpen: boolean;
  kind: ActivityKind | null;
  sort: ActivitySort;
};

function readStoredRange(): ActivityRange {
  if (typeof window === "undefined") return "week";
  try {
    const raw = localStorage.getItem(RANGE_KEY);
    if (raw === "24h" || raw === "week" || raw === "month") return raw;
  } catch {
    /* private mode / blocked storage */
  }
  return "week";
}

function writeStoredRange(range: ActivityRange) {
  try {
    localStorage.setItem(RANGE_KEY, range);
  } catch {
    /* ignore */
  }
}

let range: ActivityRange =
  typeof window === "undefined" ? "week" : readStoredRange();
let filters: FilterPrefs = {
  filtersOpen: false,
  kind: null,
  sort: "newest",
};

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function useActivityFeedPrefs() {
  const [, tick] = useState(0);

  useEffect(() => {
    const listener = () => tick((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    range,
    filtersOpen: filters.filtersOpen,
    kind: filters.kind,
    sort: filters.sort,
    setRange: (next: ActivityRange) => {
      range = next;
      writeStoredRange(next);
      emit();
    },
    setFiltersOpen: (next: boolean) => {
      filters = { ...filters, filtersOpen: next };
      emit();
    },
    setKind: (next: ActivityKind | null) => {
      filters = { ...filters, kind: next };
      emit();
    },
    setSort: (next: ActivitySort) => {
      filters = { ...filters, sort: next };
      emit();
    },
  };
}
