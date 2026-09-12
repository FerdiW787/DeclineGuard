import { useMemo, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useActivityFeedPrefs,
  type ActivityKind,
  type ActivityRange,
} from "./activityFeedPrefs";
import {
  ActivityIcon,
  activityUiType,
  formatMoneyAmount,
  formatRelativeTime,
  type ActivityEventType,
  type ActivityRow,
} from "./dashboardUi";
import SegmentedControl from "./SegmentedControl";

gsap.registerPlugin(useGSAP);

const RANGE_MS: Record<ActivityRange, number> = {
  "24h": 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

const RANGE_OPTIONS = [
  { id: "24h" as const, label: "24 hours" },
  { id: "week" as const, label: "Week" },
  { id: "month" as const, label: "Month" },
] as const;

const RANGE_COPY: Record<ActivityRange, string> = {
  "24h": "Last 24 hours",
  week: "Last week",
  month: "Last month",
};

const KIND_CHIPS: Array<{
  id: ActivityKind;
  label: string;
}> = [
  { id: "recovered", label: "Recovered" },
  { id: "failed", label: "Failed" },
  { id: "email", label: "Emails" },
];

function isEmailKind(type: ActivityEventType): boolean {
  return (
    type === "email_sent" ||
    type === "email_bounced" ||
    type === "email_delivered"
  );
}

function matchesKind(type: ActivityEventType, kind: ActivityKind): boolean {
  switch (kind) {
    case "recovered":
      return type === "recovered";
    case "failed":
      return type === "payment_failed";
    case "email":
      return isEmailKind(type);
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function statusLabel(type: ActivityEventType): string {
  switch (type) {
    case "recovered":
      return "Recovered";
    case "payment_failed":
      return "Recovery failed";
    case "email_sent":
      return "Email sent";
    case "email_bounced":
      return "Bounced";
    case "email_delivered":
      return "Delivered";
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

function activityPrimary(item: ActivityRow): string {
  const email = item.customerEmail?.trim();
  if (email) return email;
  const head = item.title.split(/\s*[·/]\s*/)[0]?.trim();
  return head || item.title;
}

export default function RailActivityFeed({
  events,
  loading,
  nowMs,
  fill = false,
  idPrefix = "activity-range",
  inspectableEmails,
  inspectedEmail = null,
  onInspectCustomer,
}: {
  events: ActivityRow[];
  loading: boolean;
  nowMs: number;
  fill?: boolean;
  idPrefix?: string;
  inspectableEmails?: ReadonlySet<string>;
  inspectedEmail?: string | null;
  onInspectCustomer?: (email: string) => void;
}) {
  const {
    range,
    kind,
    sort,
    filtersOpen,
    setRange,
    setKind,
    setSort,
    setFiltersOpen,
  } = useActivityFeedPrefs();
  const foldRef = useRef<HTMLDivElement>(null);
  const foldReadyRef = useRef(false);
  const filtersId = `${idPrefix}-fold`;

  useGSAP(
    () => {
      const el = foldRef.current;
      if (!el) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches;
      if (!foldReadyRef.current) {
        gsap.set(el, {
          height: filtersOpen ? "auto" : 0,
          overflow: "hidden",
        });
        foldReadyRef.current = true;
        return;
      }
      gsap.killTweensOf(el);
      if (filtersOpen) {
        gsap.fromTo(
          el,
          { height: 0 },
          {
            height: "auto",
            duration: reduced ? 0.01 : 0.4,
            ease: reduced ? "none" : "power3.out",
            overflow: "hidden",
          },
        );
      } else {
        gsap.to(el, {
          height: 0,
          duration: reduced ? 0.01 : 0.32,
          ease: reduced ? "none" : "power3.inOut",
          overflow: "hidden",
        });
      }
    },
    { dependencies: [filtersOpen] },
  );

  const ranged = useMemo(() => {
    const since = nowMs - RANGE_MS[range];
    return events.filter((item) => item.occurredAt >= since);
  }, [events, nowMs, range]);

  const counts = useMemo(() => {
    let recovered = 0;
    let failed = 0;
    let email = 0;
    for (const item of ranged) {
      if (item.type === "recovered") recovered += 1;
      else if (item.type === "payment_failed") failed += 1;
      else if (isEmailKind(item.type)) email += 1;
    }
    return { recovered, failed, email };
  }, [ranged]);

  const countFor = (id: ActivityKind) => {
    switch (id) {
      case "recovered":
        return counts.recovered;
      case "failed":
        return counts.failed;
      case "email":
        return counts.email;
      default: {
        const _exhaustive: never = id;
        return _exhaustive;
      }
    }
  };

  const visible = useMemo(() => {
    const filtered = kind
      ? ranged.filter((item) => matchesKind(item.type, kind))
      : ranged;
    const next = [...filtered];
    next.sort((a, b) =>
      sort === "newest"
        ? b.occurredAt - a.occurredAt
        : a.occurredAt - b.occurredAt,
    );
    return next;
  }, [kind, ranged, sort]);

  return (
    <div
      className={cn("relative bg-white", fill && "flex min-h-0 flex-1 flex-col")}
    >
      <div className="relative z-10 shrink-0 rounded-b-2xl bg-white shadow-[0_10px_18px_-12px_rgba(0,0,0,0.28)]">
        <div className="px-3 pt-3">
          <SegmentedControl
            ariaLabel="Activity time range"
            idPrefix={idPrefix}
            equal
            className="w-full rounded-md bg-[#f7f8f8] shadow-none"
            value={range}
            onChange={setRange}
            options={RANGE_OPTIONS}
          />
        </div>
        <div ref={foldRef} id={filtersId} className="overflow-hidden">
          <div className="space-y-3 px-3 pt-3">
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-black/40">
                  Filter by type
                </p>
                <div
                  role="group"
                  aria-label="Sort activity"
                  className="inline-flex items-center gap-0.5 rounded-md border border-black/8 bg-[#f7f8f8] p-0.5"
                >
                  {(
                    [
                      { id: "newest" as const, label: "Newest" },
                      { id: "oldest" as const, label: "Oldest" },
                    ] as const
                  ).map((option) => {
                    const active = sort === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSort(option.id)}
                        className={cn(
                          "cursor-pointer rounded-[5px] px-2 py-1 text-[10px] font-semibold transition",
                          active
                            ? "bg-white text-[#08090a] shadow-sm"
                            : "text-black/40 hover:text-black/65",
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div
                role="group"
                aria-label="Filter activity by type"
                className="grid grid-cols-2 gap-1.5"
              >
                <button
                  type="button"
                  aria-pressed={kind === null}
                  onClick={() => setKind(null)}
                  className={cn(
                    "dg-interactive cursor-pointer rounded-md border px-2.5 py-2 text-left",
                    kind === null
                      ? "border-black/15 bg-white shadow-sm"
                      : "border-black/8 bg-[#f7f8f8] hover:border-black/20 hover:bg-white",
                  )}
                >
                  <span className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-medium leading-tight text-black/40">
                      All
                    </span>
                    {kind === null ? (
                      <Check className="size-3 shrink-0 text-black/45" />
                    ) : null}
                  </span>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums text-[#08090a]">
                    {loading
                      ? "—"
                      : counts.recovered + counts.failed + counts.email}
                  </p>
                </button>
                {KIND_CHIPS.map((chip) => {
                  const active = kind === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setKind(chip.id)}
                      className={cn(
                        "dg-interactive cursor-pointer rounded-md border px-2.5 py-2 text-left",
                        active
                          ? "border-black/15 bg-white shadow-sm"
                          : "border-black/8 bg-[#f7f8f8] hover:border-black/20 hover:bg-white",
                      )}
                    >
                      <span className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-medium leading-tight text-black/40">
                          {chip.label}
                        </span>
                        {active ? (
                          <Check className="size-3 shrink-0 text-black/45" />
                        ) : null}
                      </span>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums text-[#08090a]">
                        {loading ? "—" : countFor(chip.id)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <button
          type="button"
          aria-expanded={filtersOpen}
          aria-controls={filtersId}
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="dg-interactive flex w-full cursor-pointer items-center justify-between rounded-b-2xl px-3 py-2.5 text-left"
        >
          <span className="text-[11px] font-medium text-black/45">
            {filtersOpen ? "Hide Filters" : "Show Filters"}
          </span>
          {filtersOpen ? (
            <ChevronUp className="size-3.5 shrink-0 text-black/40" />
          ) : (
            <ChevronDown className="size-3.5 shrink-0 text-black/40" />
          )}
        </button>
      </div>

      <div
        className={cn(
          "-mt-4 bg-white px-2.5 pb-2.5 pt-7",
          "shadow-[inset_0_14px_22px_-16px_rgba(0,0,0,0.2)]",
          fill && "min-h-0 flex-1 overflow-y-auto",
        )}
      >
        {loading ? (
          <p className="px-2 py-8 text-sm text-black/40">Loading activity…</p>
        ) : events.length === 0 ? (
          <p className="px-2 py-8 text-sm leading-relaxed text-black/45">
            No activity yet. Recovery failures and recoveries will show up here
            as webhooks fire.
          </p>
        ) : visible.length === 0 ? (
          <p className="px-2 py-8 text-sm leading-relaxed text-black/45">
            {kind
              ? `No ${KIND_CHIPS.find((chip) => chip.id === kind)?.label.toLowerCase()} in ${RANGE_COPY[range].toLowerCase()}.`
              : `No events in ${RANGE_COPY[range].toLowerCase()}.`}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {visible.map((item) => {
              const uiType = activityUiType(item.type);
              const amount =
                item.amountCents != null && item.currency
                  ? `${uiType === "recovered" ? "+" : ""}${formatMoneyAmount(item.amountCents, item.currency)}`
                  : null;
              const email = item.customerEmail?.trim().toLowerCase() ?? "";
              const canInspect =
                Boolean(email) &&
                Boolean(onInspectCustomer) &&
                (inspectableEmails?.has(email) ?? true);
              const inspected =
                Boolean(email) &&
                inspectedEmail?.trim().toLowerCase() === email;
              const body = (
                <div className="flex items-start gap-2.5">
                  <ActivityIcon type={uiType} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-[13px] font-semibold leading-snug text-[#08090a]">
                        {activityPrimary(item)}
                      </p>
                      {amount ? (
                        <span
                          className={cn(
                            "shrink-0 text-[12px] font-semibold tabular-nums",
                            uiType === "recovered"
                              ? "text-emerald-600"
                              : "text-black/40",
                          )}
                        >
                          {amount}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[11px] font-medium text-black/50">
                      {statusLabel(item.type)}
                    </p>
                    {item.detail ? (
                      <p className="mt-0.5 truncate text-[11px] text-black/40">
                        {item.detail}
                      </p>
                    ) : null}
                    <p className="mt-1.5 text-[10px] text-black/35">
                      {formatRelativeTime(item.occurredAt, nowMs)}
                    </p>
                  </div>
                </div>
              );
              return (
                <li key={item._id}>
                  {canInspect ? (
                    <button
                      type="button"
                      onClick={() => onInspectCustomer?.(email)}
                      aria-pressed={inspected}
                      title="Open case"
                      className={cn(
                        "w-full rounded-xl border px-3.5 py-3.5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors",
                        inspected
                          ? "border-black/15 bg-white ring-1 ring-black/8"
                          : "dg-interactive cursor-pointer border-black/8 bg-white hover:border-black/15",
                      )}
                    >
                      {body}
                    </button>
                  ) : (
                    <div className="rounded-xl border border-black/8 bg-white px-3.5 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                      {body}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
