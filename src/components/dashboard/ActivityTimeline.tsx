import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import {
  ActivityIcon,
  activityUiType,
  formatActivityTitle,
  formatMoneyAmount,
  formatRelativeTime,
  Panel,
} from "./dashboardUi";

type ActivityType =
  | "payment_failed"
  | "recovered"
  | "email_sent"
  | "email_bounced"
  | "email_delivered"
  | "sequence_stopped";
type TypeFilter = "all" | ActivityType;

type ActivityItem = {
  _id: string;
  type: ActivityType;
  title: string;
  detail: string | null;
  customerEmail: string | null;
  amountCents: number | null;
  currency: string | null;
  occurredAt: number;
};

type HistoryResult = {
  page: ActivityItem[];
  pageIndex: number;
  pageCount: number;
  totalCount: number;
  pageSize: number;
};

/** Staff dashboard simulation — feed merchant events without querying “me”. */
export type ActivityTimelineSimulation = {
  emails: string[];
  events: ActivityItem[];
};

const TYPE_FILTERS: Array<{ id: TypeFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "payment_failed", label: "Recovery failed" },
  { id: "recovered", label: "Recovered" },
  { id: "sequence_stopped", label: "Stopped" },
  { id: "email_sent", label: "Emails" },
  { id: "email_bounced", label: "Bounces" },
  { id: "email_delivered", label: "Delivered" },
];

const HISTORY_PAGE_SIZE = 10;

export default function ActivityTimeline({
  simulation,
}: {
  simulation?: ActivityTimelineSimulation;
} = {}) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [emailMenuOpen, setEmailMenuOpen] = useState(false);
  const [emailQuery, setEmailQuery] = useState("");
  const emailMenuRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const cachedHistoryRef = useRef<HistoryResult | null>(null);

  const liveEmails = useQuery(
    api.functions.recoveries.listActivityCustomerEmails,
    simulation ? "skip" : {},
  );
  const liveHistory = useQuery(
    api.functions.recoveries.listActivityHistory,
    simulation
      ? "skip"
      : {
          page,
          type: typeFilter === "all" ? undefined : typeFilter,
          customerEmail: selectedEmail ?? undefined,
        },
  );

  const simHistory = useMemo((): HistoryResult | undefined => {
    if (!simulation) return undefined;
    const emailFilter = selectedEmail?.trim().toLowerCase() || null;
    const filtered = simulation.events.filter((row) => {
      if (typeFilter !== "all" && row.type !== typeFilter) return false;
      if (emailFilter && row.customerEmail !== emailFilter) return false;
      return true;
    });
    const pageCount = Math.max(1, Math.ceil(filtered.length / HISTORY_PAGE_SIZE));
    const pageIndex = Math.min(Math.max(page, 0), pageCount - 1);
    const start = pageIndex * HISTORY_PAGE_SIZE;
    return {
      page: filtered.slice(start, start + HISTORY_PAGE_SIZE),
      pageIndex,
      pageCount,
      totalCount: filtered.length,
      pageSize: HISTORY_PAGE_SIZE,
    };
  }, [simulation, page, typeFilter, selectedEmail]);

  const emails = simulation ? simulation.emails : liveEmails;
  const history = simulation ? simHistory : liveHistory;

  if (history !== undefined) {
    cachedHistoryRef.current = history;
  }
  const shown = history ?? cachedHistoryRef.current;
  const isRefreshing = history === undefined && shown != null;

  useEffect(() => {
    if (!emailMenuOpen) return;
    const onPointer = (e: PointerEvent) => {
      const el = emailMenuRef.current;
      if (el && !el.contains(e.target as Node)) {
        setEmailMenuOpen(false);
        setEmailQuery("");
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEmailMenuOpen(false);
        setEmailQuery("");
      }
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [emailMenuOpen]);

  useEffect(() => {
    if (emailMenuOpen) {
      emailInputRef.current?.focus();
    }
  }, [emailMenuOpen]);

  const filteredEmails = useMemo(() => {
    if (!emails) return [];
    const q = emailQuery.trim().toLowerCase();
    if (!q) return emails;
    return emails.filter((email) => email.includes(q));
  }, [emails, emailQuery]);

  const pageIndex = shown?.pageIndex ?? 0;
  const pageCount = shown?.pageCount ?? 1;
  const totalCount = shown?.totalCount ?? 0;
  const items = shown?.page;
  const pageSize = shown?.pageSize ?? 10;
  const rangeStart = totalCount === 0 ? 0 : pageIndex * pageSize + 1;
  const rangeEnd = Math.min(totalCount, (pageIndex + 1) * pageSize);

  const setType = (next: TypeFilter) => {
    setTypeFilter(next);
    setPage(0);
  };

  const selectEmail = (email: string) => {
    setSelectedEmail(email);
    setEmailQuery("");
    setEmailMenuOpen(false);
    setPage(0);
  };

  const clearEmail = () => {
    setSelectedEmail(null);
    setEmailQuery("");
    setEmailMenuOpen(false);
    setPage(0);
  };

  const openEmailMenu = () => {
    setEmailMenuOpen(true);
    setEmailQuery("");
  };

  return (
    <section data-enter className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl tracking-tight">Event logs</h2>
      </div>

      {/* Toolbar — type segments + add-filter, Stripe/Circle style */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label="Activity type"
          className="inline-flex w-fit flex-wrap items-center gap-0.5 rounded-full border border-black/8 bg-[#f0f0f2] p-1 dark:border-white/10 dark:bg-[#1a1a1d]"
        >
          {TYPE_FILTERS.map((item) => {
            const active = typeFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setType(item.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold outline-none transition focus:outline-none focus-visible:outline-none ${
                  active
                    ? "bg-white text-black shadow-sm dark:bg-[#2a2c31] dark:text-[#f7f8f8] dark:shadow-none"
                    : "text-black/45 hover:text-black/70 dark:text-white/45 dark:hover:text-white/75"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div ref={emailMenuRef} className="relative">
          {!selectedEmail ? (
            <button
              type="button"
              onClick={openEmailMenu}
              aria-expanded={emailMenuOpen}
              aria-haspopup="listbox"
              className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-black/15 bg-white px-3 py-1.5 text-xs font-semibold text-black/55 transition hover:border-black/25 hover:text-black/80 dark:border-white/20 dark:bg-[#161618] dark:text-zinc-100/55 dark:hover:border-white/30 dark:hover:text-zinc-100/80"
            >
              <Plus className="size-3.5" />
              By Customer
            </button>
          ) : null}

          {emailMenuOpen ? (
            <div className="absolute top-full left-0 z-30 mt-1.5 w-[min(100vw-2rem,20rem)] overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_12px_40px_-16px_rgba(0,0,0,0.35)] dark:border-white/10 dark:bg-[#1a1a1d]">
              <div className="relative border-b border-black/6 px-2.5 py-2 dark:border-white/8">
                <Search className="pointer-events-none absolute top-1/2 left-4 size-3.5 -translate-y-1/2 text-black/35" />
                <input
                  ref={emailInputRef}
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  placeholder="Find customer email…"
                  value={emailQuery}
                  onChange={(e) => setEmailQuery(e.target.value)}
                  className="w-full rounded-lg bg-transparent py-1.5 pr-2 pl-8 text-sm outline-none placeholder:text-black/35 dark:placeholder:text-white/35"
                />
              </div>
              <div
                role="listbox"
                aria-label="Customer emails"
                className="max-h-52 overflow-y-auto py-1"
              >
                {emails === undefined ? (
                  <p className="px-3 py-2.5 text-[12px] text-black/40">
                    Loading emails…
                  </p>
                ) : filteredEmails.length === 0 ? (
                  <p className="px-3 py-2.5 text-[12px] text-black/40">
                    {emails.length === 0
                      ? "No emails in history yet"
                      : "No matching emails"}
                  </p>
                ) : (
                  filteredEmails.map((email) => (
                    <button
                      key={email}
                      type="button"
                      role="option"
                      onClick={() => selectEmail(email)}
                      className="flex w-full items-center px-3 py-2 text-left text-sm transition hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
                    >
                      <span className="truncate">{email}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Active filters as chips — PayPal / Stripe pattern */}
      {selectedEmail ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-black/8 bg-black/[0.04] py-1 pr-1 pl-3 text-[12px] font-medium dark:border-white/10 dark:bg-white/[0.06]">
            <span className="truncate text-black/45 dark:text-zinc-100/45">
              Customer
            </span>
            <span className="truncate font-semibold">{selectedEmail}</span>
            <button
              type="button"
              aria-label="Remove customer filter"
              onClick={clearEmail}
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-black/40 transition hover:bg-black/8 hover:text-black/70 dark:hover:bg-white/10"
            >
              <X className="size-3.5" />
            </button>
          </span>
          <button
            type="button"
            onClick={clearEmail}
            className="text-[12px] font-medium text-black/40 underline-offset-2 hover:text-black/70 hover:underline dark:text-zinc-100/40 dark:hover:text-zinc-100/70"
          >
            Clear
          </button>
        </div>
      ) : null}

      <Panel
        className={`overflow-hidden transition-opacity duration-150 rounded-l-none ${
          isRefreshing ? "opacity-55" : "opacity-100"
        }`}
      >
        <div className="min-h-[22rem]">
          {items === undefined ? (
            <p className="px-5 py-10 text-sm text-black/40 md:px-6">
              Loading activity…
            </p>
          ) : items.length === 0 ? (
            <p className="px-5 py-10 text-sm leading-relaxed text-black/45 md:px-6">
              {selectedEmail || typeFilter !== "all"
                ? "No events match these filters."
                : "No activity yet. Recovery failures and recoveries will show up here."}
            </p>
          ) : (
            <ul className="divide-y divide-black/5">
              {items.map((item) => {
                const uiType = activityUiType(item.type);
                const amount =
                  item.amountCents != null && item.currency
                    ? `${uiType === "recovered" ? "+" : ""}${formatMoneyAmount(item.amountCents, item.currency)}`
                    : null;
                return (
                  <li
                    key={item._id}
                    className="dg-row flex items-center gap-3 px-5 py-3.5 md:px-6"
                  >
                    <ActivityIcon type={uiType} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        {formatActivityTitle(item.title, item.type)}
                      </p>
                      {item.detail ? (
                        <p className="truncate text-[12px] text-black/45">
                          {item.detail}
                        </p>
                      ) : null}
                    </div>
                    {amount ? (
                      <span
                        className={`shrink-0 text-sm font-semibold tabular-nums ${
                          uiType === "recovered"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-black/50"
                        }`}
                      >
                        {amount}
                      </span>
                    ) : null}
                    <span className="hidden shrink-0 text-[11px] text-black/35 sm:inline">
                      {formatRelativeTime(item.occurredAt, Date.now())}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {shown != null && totalCount > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/6 px-5 py-3 md:px-6">
            <p className="text-[12px] tabular-nums text-black/45">
              Showing {rangeStart}–{rangeEnd} of {totalCount}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={pageIndex <= 0 || isRefreshing}
                onClick={() => setPage(pageIndex - 1)}
                className="dg-interactive inline-flex items-center gap-1 rounded-full border border-black/8 bg-transparent px-3 py-1.5 text-xs font-semibold disabled:pointer-events-none disabled:opacity-35 dark:border-white/10"
              >
                <ChevronLeft className="size-3.5" />
                Previous
              </button>
              <button
                type="button"
                disabled={pageIndex >= pageCount - 1 || isRefreshing}
                onClick={() => setPage(pageIndex + 1)}
                className="dg-interactive inline-flex items-center gap-1 rounded-full border border-black/8 bg-transparent px-3 py-1.5 text-xs font-semibold disabled:pointer-events-none disabled:opacity-35 dark:border-white/10"
              >
                Next
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        ) : null}
      </Panel>
    </section>
  );
}
