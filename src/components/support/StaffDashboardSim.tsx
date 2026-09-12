import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import BrandLogo from "@/components/BrandLogo";
import CustomizationsPage, {
  type EmailCustomizeHandle,
} from "@/components/dashboard/CustomizationsPage";
import { useEmailHeaderImageUpload } from "@/hooks/useEmailHeaderImageUpload";
import SettingsModule from "@/components/dashboard/settings/SettingsModule";
import OverviewHub from "@/components/dashboard/OverviewHub";
import RecoveriesPage, {
  type RecoveriesQueueFilter,
} from "@/components/dashboard/RecoveriesPage";
import SequencesPage from "@/components/dashboard/SequencesPage";
import SequencesWarrior from "@/components/dashboard/SequencesWarrior";
import {
  Check,
  ChevronsUpDown,
  LayoutDashboard,
  Palette,
  Plus,
  Settings,
  Store,
  Wallet,
  Workflow,
  X,
} from "lucide-react";

type Props = {
  merchantUserId: Id<"users">;
  onClose: () => void;
};

type NavId =
  | "overview"
  | "recoveries"
  | "sequences"
  | "customizations";

type DayRow = {
  date: string;
  moneyRecovered: number;
  moneyAtRisk: number;
  clientsRecovered: number;
  clientsNew: number;
  clientsLost: number;
  emailsSent: number;
  emailsBounced: number;
};

type ChartDayWindow = {
  date: string;
  startMs: number;
  endMs: number;
};

type SimStore = {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string;
  simulated?: boolean;
};

const NAV = [
  { id: "overview" as const, label: "Overview", icon: LayoutDashboard },
  { id: "recoveries" as const, label: "Recoveries", icon: Wallet },
  { id: "sequences" as const, label: "Sequences", icon: Workflow },
  { id: "customizations" as const, label: "Customizations", icon: Palette },
];

function buildChartDayWindows(dayCount = 30): ChartDayWindow[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const windows: ChartDayWindow[] = [];
  for (let i = dayCount - 1; i >= 0; i -= 1) {
    const start = new Date(today);
    start.setDate(today.getDate() - i);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    const y = start.getFullYear();
    const m = String(start.getMonth() + 1).padStart(2, "0");
    const d = String(start.getDate()).padStart(2, "0");
    windows.push({
      date: `${y}-${m}-${d}`,
      startMs: start.getTime(),
      endMs: end.getTime(),
    });
  }
  return windows;
}

function emptyDayRows(windows: ChartDayWindow[]): DayRow[] {
  return windows.map((w) => ({
    date: w.date,
    moneyRecovered: 0,
    moneyAtRisk: 0,
    clientsRecovered: 0,
    clientsNew: 0,
    clientsLost: 0,
    emailsSent: 0,
    emailsBounced: 0,
  }));
}

function formatMoneyAmount(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(0)} ${currency.toUpperCase()}`;
  }
}

/**
 * Temporary full-page clone of the merchant dashboard.
 * Real snapshot data + local-only Add store. No disconnect / no writes.
 */
export default function StaffDashboardSim({
  merchantUserId,
  onClose,
}: Props) {
  const monthStartMs = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }, []);
  const priorMonthStartMs = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
  }, []);
  const chartDayWindows = useMemo(() => buildChartDayWindows(30), []);
  const chartSinceMs = chartDayWindows[0]?.startMs ?? monthStartMs;

  const uploadEmailImage = useEmailHeaderImageUpload();
  const data = useQuery(api.functions.supportAccess.getDashboardSimulation, {
    merchantUserId,
    monthStartMs,
    priorMonthStartMs,
    sinceMs: chartSinceMs,
  });

  const [nav, setNav] = useState<NavId>("overview");
  const [recoveriesFilter, setRecoveriesFilter] =
    useState<RecoveriesQueueFilter>("all");
  const [recoveriesFilterKey, setRecoveriesFilterKey] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sequenceFingers, setSequenceFingers] = useState<1 | 2 | 3>(1);
  const [storeMenuOpen, setStoreMenuOpen] = useState(false);
  const [simNotice, setSimNotice] = useState<string | null>(null);
  const [addStoreOpen, setAddStoreOpen] = useState(false);
  const [addStoreName, setAddStoreName] = useState("");
  const [dummyStores, setDummyStores] = useState<SimStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const customizationsRef = useRef<EmailCustomizeHandle>(null);
  const storeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (settingsOpen) return;
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, settingsOpen]);

  useEffect(() => {
    if (!storeMenuOpen) return;
    const onPointer = (e: PointerEvent) => {
      const el = storeMenuRef.current;
      if (el && !el.contains(e.target as Node)) setStoreMenuOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [storeMenuOpen]);

  const realStores: SimStore[] = useMemo(() => {
    if (!data?.connection) return [];
    const list =
      data.connection.stores.length > 0
        ? data.connection.stores
        : [
            {
              id: data.connection.storeId,
              name: data.connection.storeName,
              slug: data.connection.storeSlug,
            },
          ];
    return list.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      avatarUrl: s.avatarUrl,
    }));
  }, [data?.connection]);

  const allStores = useMemo(
    () => [...realStores, ...dummyStores],
    [realStores, dummyStores],
  );

  const activeStoreId =
    selectedStoreId ??
    data?.connection?.storeId ??
    allStores[0]?.id ??
    null;

  const activeStore =
    allStores.find((s) => s.id === activeStoreId) ?? allStores[0] ?? null;

  const viewingDummy = Boolean(activeStore?.simulated);

  const displayCurrency =
    data?.recoverySummary.displayCurrency ??
    data?.recoverySummary.recoveredCurrency ??
    data?.recoverySummary.openCurrency ??
    "USD";

  const lastMonthChartData = useMemo(() => {
    const rows = emptyDayRows(chartDayWindows);
    const byDate = new Map(rows.map((r) => [r.date, r]));
    const rangeStartMs = chartDayWindows[0]?.startMs ?? 0;
    const rangeEndMs =
      chartDayWindows[chartDayWindows.length - 1]?.endMs ?? 0;
    const currencyFilter = displayCurrency.toUpperCase();

    const dayFor = (ms: number): string | null => {
      for (const window of chartDayWindows) {
        if (ms >= window.startMs && ms < window.endMs) return window.date;
      }
      return null;
    };

    for (const failure of data?.openFailures ?? []) {
      const day5 = failure.day5SentAt;
      if (day5 == null || day5 < rangeStartMs || day5 >= rangeEndMs) {
        continue;
      }
      const key = dayFor(day5);
      if (!key) continue;
      const bucket = byDate.get(key);
      if (!bucket) continue;
      bucket.clientsLost += 1;
    }

    for (const ev of data?.recentActivity ?? []) {
      if (ev.occurredAt < rangeStartMs || ev.occurredAt >= rangeEndMs) continue;
      const key = dayFor(ev.occurredAt);
      if (!key) continue;
      const bucket = byDate.get(key);
      if (!bucket) continue;
      const sameCurrency =
        !ev.currency || ev.currency.toUpperCase() === currencyFilter;
      switch (ev.type) {
        case "recovered":
          if (sameCurrency) {
            bucket.moneyRecovered += (ev.amountCents ?? 0) / 100;
          }
          bucket.clientsRecovered += 1;
          break;
        case "email_sent":
          bucket.emailsSent += 1;
          break;
        case "payment_failed":
          if (sameCurrency) {
            bucket.moneyAtRisk += (ev.amountCents ?? 0) / 100;
          }
          bucket.clientsNew += 1;
          break;
        case "email_bounced":
          bucket.emailsBounced += 1;
          break;
        case "email_delivered":
          break;
        default: {
          const _exhaustive: never = ev.type;
          void _exhaustive;
        }
      }
    }

    return rows.map((r) => ({
      ...r,
      moneyRecovered: Math.round(r.moneyRecovered * 100) / 100,
      moneyAtRisk: Math.round(r.moneyAtRisk * 100) / 100,
    }));
  }, [
    data?.recentActivity,
    data?.openFailures,
    chartDayWindows,
    displayCurrency,
  ]);

  const overviewHasActivity = useMemo(
    () =>
      lastMonthChartData.some(
        (d) =>
          d.moneyRecovered > 0 ||
          d.moneyAtRisk > 0 ||
          d.clientsRecovered > 0 ||
          d.clientsNew > 0 ||
          d.clientsLost > 0 ||
          d.emailsSent > 0,
      ),
    [lastMonthChartData],
  );

  const flash = useCallback((msg: string) => {
    setSimNotice(msg);
    window.setTimeout(() => setSimNotice(null), 4200);
  }, []);

  const createDummyStore = () => {
    const name = addStoreName.trim() || "Demo Store";
    const id = `sim-${Date.now()}`;
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const store: SimStore = {
      id,
      name,
      slug: slug || "demo-store",
      simulated: true,
    };
    setDummyStores((prev) => [...prev, store]);
    setSelectedStoreId(id);
    setAddStoreOpen(false);
    setAddStoreName("");
    setStoreMenuOpen(false);
    flash(
      `Created temporary store “${name}” — local simulation only, not saved to their account.`,
    );
  };

  const summary = data?.recoverySummary;
  const openCount = summary?.openCount ?? data?.openFailures.length ?? 0;
  const openAtRiskLabel =
    summary && summary.openAtRiskCents > 0
      ? `${formatMoneyAmount(
          summary.openAtRiskCents,
          summary.openCurrency ?? displayCurrency,
        )}${summary.openCurrencyMixed ? " · mixed" : ""}`
      : "—";
  const recoveredLabel =
    summary && summary.recoveredThisMonthCents > 0
      ? `${formatMoneyAmount(
          summary.recoveredThisMonthCents,
          summary.recoveredCurrency ?? displayCurrency,
        )}${summary.recoveredCurrencyMixed ? " · mixed" : ""}`
      : formatMoneyAmount(0, displayCurrency);
  const recoveryRateLabel =
    summary?.recoveryRatePercent != null
      ? `${summary.recoveryRatePercent}%`
      : "—";
  const emailsSentLabel = summary
    ? String(summary.emailsSentThisMonth)
    : "—";

  const storeName =
    activeStore?.name ?? data?.connection?.storeName ?? "No store";
  const storeLogoUrl =
    activeStore?.avatarUrl ?? data?.connection?.storeAvatarUrl ?? null;
  const brandColor = data?.recoverySettings?.brandColor ?? "#0c0c0c";
  const secondaryColor = data?.recoverySettings?.secondaryColor ?? "#6b6b70";

  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-white text-foreground">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-amber-950">
            Simulation — temporary page · snapshot of{" "}
            {data?.merchantName ?? "merchant"}’s dashboard
          </p>
          <p className="truncate text-[11px] text-amber-900/70">
            Real data · Add store is dummy · Disconnect disabled · nothing
            writes to their account
            {data
              ? ` · access until ${new Date(data.grantExpiresAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}`
              : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#111] px-3 py-2 text-[12px] font-semibold text-white"
        >
          <X className="size-3.5" />
          Exit simulation
        </button>
      </div>

      {simNotice ? (
        <div className="shrink-0 border-b border-sky-200 bg-sky-50 px-4 py-2 text-[13px] text-sky-950">
          {simNotice}
        </div>
      ) : null}

      {data === undefined ? (
        <div className="flex flex-1 items-center justify-center text-sm text-black/40">
          Loading dashboard snapshot…
        </div>
      ) : data === null ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-sm font-medium text-black/70">
            No active access grant
          </p>
          <p className="max-w-sm text-[13px] text-black/45">
            Ask the merchant to click Give Access again, or open this from a
            chat where you are the grantee.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 rounded-xl bg-[#111] px-4 py-2 text-sm font-semibold text-white"
          >
            Close
          </button>
        </div>
      ) : (
        <div
          className="dg-shell light ln-surface relative flex min-h-0 flex-1 overflow-hidden bg-[#f7f8f8] text-[#08090a]"
        >
          <aside
            className={`relative z-20 flex w-[248px] shrink-0 flex-col bg-[#f7f8f8] max-lg:hidden ${
              storeMenuOpen ? "overflow-visible" : "overflow-hidden"
            }`}
          >
            <div
              className="pointer-events-none absolute inset-0 bg-[#f7f8f8]"
              aria-hidden
            />
            <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-visible">
              <div className="flex items-center px-5 py-5">
                <BrandLogo size="sm" />
              </div>

              <nav className="flex flex-1 flex-col px-3">
                <div ref={storeMenuRef} className="relative mb-3">
                  <button
                    type="button"
                    onClick={() => setStoreMenuOpen((o) => !o)}
                    aria-expanded={storeMenuOpen}
                    aria-haspopup="menu"
                    className="flex w-full items-center gap-2 rounded-lg p-2 text-left transition hover:bg-black/[0.04]"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#111] text-white">
                      <Store className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 grid text-left text-sm leading-tight">
                      <span className="truncate font-semibold text-black">
                        {storeName}
                      </span>
                      <span className="truncate text-xs text-black/45">
                        {viewingDummy
                          ? "Simulated store"
                          : data.connection?.testMode
                            ? "Test mode"
                            : data.connection
                              ? "Live"
                              : "No store linked"}
                      </span>
                    </span>
                    <ChevronsUpDown className="ml-auto size-4 shrink-0 text-black/35" />
                  </button>

                  {storeMenuOpen ? (
                    <div
                      role="menu"
                      className="absolute left-full top-0 z-50 ml-2 w-56 overflow-hidden rounded-lg border border-black/10 bg-white text-black shadow-[0_10px_40px_-12px_rgba(0,0,0,0.28)]"
                    >
                      <div className="px-2 py-1.5 text-xs font-medium text-black/45">
                        Stores
                      </div>
                      <ul className="max-h-56 overflow-y-auto px-1 pb-1">
                        {allStores.length === 0 ? (
                          <li className="px-2 py-2 text-[12px] text-black/40">
                            No stores on this account
                          </li>
                        ) : (
                          allStores.map((store) => {
                            const selected = store.id === activeStoreId;
                            return (
                              <li key={store.id}>
                                <button
                                  type="button"
                                  role="menuitemradio"
                                  aria-checked={selected}
                                  onClick={() => {
                                    setSelectedStoreId(store.id);
                                    setStoreMenuOpen(false);
                                    if (store.simulated) {
                                      flash(
                                        `Viewing temporary store “${store.name}” — dummy data only.`,
                                      );
                                    }
                                  }}
                                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition ${
                                    selected
                                      ? "bg-black/[0.06] font-medium text-black"
                                      : "text-black/80 hover:bg-black/[0.04]"
                                  }`}
                                >
                                  <span className="flex size-6 shrink-0 items-center justify-center rounded-sm border border-black/10 bg-black/[0.03]">
                                    {store.simulated ? (
                                      <Plus className="size-3.5 text-black/70" />
                                    ) : (
                                      <Store className="size-3.5 text-black/70" />
                                    )}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate text-left">
                                    {store.name}
                                    {store.simulated ? " · sim" : ""}
                                  </span>
                                  {selected ? (
                                    <Check className="size-3.5 text-black/50" />
                                  ) : null}
                                </button>
                              </li>
                            );
                          })
                        )}
                      </ul>
                      <div className="mx-1 h-px bg-black/8" />
                      <div className="p-1">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setStoreMenuOpen(false);
                            setAddStoreOpen(true);
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-black/80 outline-none transition hover:bg-black/[0.04]"
                        >
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-black/10 bg-transparent">
                            <Plus className="size-3.5" />
                          </span>
                          Add store
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="relative flex flex-col gap-0.5">
                  {NAV.map((item) => {
                    const Icon = item.icon;
                    const active = nav === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setNav(item.id)}
                        className={`relative z-10 flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
                          active
                            ? "font-semibold text-black"
                            : "font-medium text-black/55 hover:bg-black/[0.03] hover:text-black/80"
                        }`}
                      >
                        {active ? (
                          <span
                            className="pointer-events-none absolute inset-0 -z-10 rounded-lg border border-black/6 bg-white shadow-sm"
                            aria-hidden
                          />
                        ) : null}
                        <Icon className="size-4 shrink-0" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </nav>

              <div className="mt-auto px-3 pb-3">
                <p className="px-3 pb-2 text-[11px] font-medium text-black/45">
                  Simulation · {data.accountStatus}
                </p>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
                    settingsOpen
                      ? "bg-black/[0.06] font-semibold text-black"
                      : "font-medium text-black/55 hover:bg-black/[0.03] hover:text-black/80"
                  }`}
                >
                  <Settings className="size-4 shrink-0" />
                  Settings
                </button>
              </div>
            </div>
          </aside>

          {nav === "sequences" ? (
            <SequencesWarrior fingers={sequenceFingers} />
          ) : null}

          <main className="relative min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-white px-4 py-4 md:px-8 md:py-6 dark:bg-[#0c0c0e]">
            <div className="mb-4 flex gap-1 overflow-x-auto lg:hidden">
              {NAV.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setNav(item.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                    nav === item.id
                      ? "bg-[#111] text-white"
                      : "bg-black/[0.04] text-black/55"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {viewingDummy ? (
              <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-[13px] text-violet-950">
                Temporary simulated store — empty placeholder. Switch back to
                their real store to see live snapshot data.
              </div>
            ) : null}

            {!data.connection && !viewingDummy ? (
              <div className="mx-auto mt-16 max-w-md text-center">
                <p className="font-display text-2xl tracking-tight">
                  No store linked
                </p>
                <p className="mt-2 text-sm text-black/50">
                  This merchant hasn’t connected Lemon Squeezy. You can still
                  try Add store as a local dummy.
                </p>
                <button
                  type="button"
                  onClick={() => setAddStoreOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#111] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  <Plus className="size-4" />
                  Add store (simulation)
                </button>
              </div>
            ) : nav === "overview" ? (
              <OverviewHub
                userFullName={data.merchantName}
                storeName={storeName}
                recoveredLabel={viewingDummy ? "$0" : recoveredLabel}
                openCount={viewingDummy ? 0 : openCount}
                openAtRiskLabel={viewingDummy ? "—" : openAtRiskLabel}
                emailsSentLabel={viewingDummy ? "0" : emailsSentLabel}
                recoveryRateLabel={viewingDummy ? "—" : recoveryRateLabel}
                feesOwedLabel="$0"
                youKeepLabel={viewingDummy ? "$0" : recoveredLabel}
                openFailures={viewingDummy ? [] : data.openFailures}
                recentActivity={viewingDummy ? [] : data.recentActivity}
                brandColor={brandColor}
                emailIsProduction={data.emailSetup?.isProduction ?? null}
                chartRows={
                  viewingDummy ? emptyDayRows(chartDayWindows) : lastMonthChartData
                }
                hasActivity={viewingDummy ? false : overviewHasActivity}
                displayCurrency={displayCurrency}
                openAtRiskCents={
                  viewingDummy ? 0 : (summary?.openAtRiskCents ?? 0)
                }
                recoveryRatePercent={
                  viewingDummy ? null : (summary?.recoveryRatePercent ?? null)
                }
                recoveredThisMonthCents={
                  viewingDummy ? 0 : (summary?.recoveredThisMonthCents ?? 0)
                }
                recoveredPriorMonthCents={
                  viewingDummy ? 0 : (summary?.recoveredPriorMonthCents ?? 0)
                }
                webhookStatus={
                  viewingDummy
                    ? null
                    : data.webhookSetup
                      ? {
                          connected: true,
                          verified: data.webhookSetup.serverConfigured,
                          lastReceivedAt: null,
                          lastEventName: null,
                        }
                      : null
                }
                emailSetup={
                  viewingDummy
                    ? null
                    : data.emailSetup
                      ? {
                          fromAddress: data.emailSetup.fromAddress,
                          isProduction: data.emailSetup.isProduction,
                          hasApiKey: data.emailSetup.hasApiKey,
                        }
                      : data.emailSetup
                }
                onNavigate={(id) => {
                  if (id === "settings") {
                    setSettingsOpen(true);
                    return;
                  }
                  if (id === "recoveries") {
                    setRecoveriesFilter("all");
                    setRecoveriesFilterKey((n) => n + 1);
                    setNav("recoveries");
                    return;
                  }
                  setNav(id);
                }}
                onOpenSettings={() => setSettingsOpen(true)}
              />
            ) : nav === "recoveries" ? (
              <RecoveriesPage
                openFailures={viewingDummy ? [] : data.openFailures}
                openCount={viewingDummy ? 0 : openCount}
                displayCurrency={displayCurrency}
                chartRows={
                  viewingDummy ? emptyDayRows(chartDayWindows) : lastMonthChartData
                }
                hasActivity={viewingDummy ? false : overviewHasActivity}
                recoveryRatePercent={
                  viewingDummy ? null : (summary?.recoveryRatePercent ?? null)
                }
                initialFilter={recoveriesFilter}
                filterFocusKey={recoveriesFilterKey}
                onGoToCustomizations={() => setNav("customizations")}
                activitySimulation={{
                  emails: viewingDummy ? [] : data.activityEmails,
                  events: viewingDummy ? [] : data.activityHistory,
                }}
              />
            ) : nav === "sequences" ? (
              <SequencesPage
                storeName={storeName}
                storeLogoUrl={storeLogoUrl}
                brandColor={brandColor}
                secondaryColor={secondaryColor}
                templateId={data.recoverySettings?.templateId ?? "gentle"}
                openFailures={viewingDummy ? [] : data.openFailures}
                supportEmail={data.recoverySettings?.supportEmail ?? null}
                socialX={data.recoverySettings?.socialX ?? null}
                socialLinkedin={data.recoverySettings?.socialLinkedin ?? null}
                socialYoutube={data.recoverySettings?.socialYoutube ?? null}
                socialInstagram={
                  data.recoverySettings?.socialInstagram ?? null
                }
                emailCopy={data.recoverySettings?.emailCopy ?? null}
                showDeclineGuardBadge
                onGoToRecoveries={(filter) => {
                  setRecoveriesFilter(filter ?? "all");
                  setRecoveriesFilterKey((n) => n + 1);
                  setNav("recoveries");
                }}
                onGoToCustomizations={() => setNav("customizations")}
                onFingersChange={setSequenceFingers}
              />
            ) : nav === "customizations" ? (
              <CustomizationsPage
                ref={customizationsRef}
                storeName={storeName}
                storeLogoUrl={storeLogoUrl}
                brandColor={brandColor}
                secondaryColor={secondaryColor}
                fromName={data.recoverySettings?.fromName ?? null}
                replyToEmail={data.recoverySettings?.replyToEmail ?? null}
                supportEmail={data.recoverySettings?.supportEmail ?? null}
                socialX={data.recoverySettings?.socialX ?? null}
                socialLinkedin={data.recoverySettings?.socialLinkedin ?? null}
                socialYoutube={data.recoverySettings?.socialYoutube ?? null}
                socialInstagram={
                  data.recoverySettings?.socialInstagram ?? null
                }
                emailCopy={data.recoverySettings?.emailCopy ?? null}
                showDeclineGuardBadge
                openFailures={viewingDummy ? [] : data.openFailures}
                fromAddressHint={data.emailSetup?.fromAddress ?? null}
                onGoToSequences={() => setNav("sequences")}
                onUploadImage={uploadEmailImage}
                onSave={async () => {
                  flash(
                    "Simulated save — their real email customizations were not changed.",
                  );
                }}
              />
            ) : null}
          </main>
        </div>
      )}

      {data ? (
      <SettingsModule
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        storeName={
          viewingDummy
            ? storeName
            : (data.connection?.storeName ?? storeName)
        }
        storeSlug={
          viewingDummy
            ? (activeStore?.slug ?? "sim")
            : (data.connection?.storeSlug ?? "—")
        }
        apiKeyLast4={
          viewingDummy ? "sim" : (data.connection?.apiKeyLast4 ?? "————")
        }
        testMode={viewingDummy ? true : (data.connection?.testMode ?? false)}
        webhookSetup={viewingDummy ? null : data.webhookSetup}
        emailSetup={viewingDummy ? null : data.emailSetup}
        brandColor={brandColor}
        allowDisconnect={false}
        readOnlyNotice="Simulation mode — sender settings won’t save; Disconnect is disabled."
        showAccount={false}
        onSaveSender={async () => {
          flash(
            "Simulated sender save — their real settings were not changed.",
          );
        }}
        onDisconnect={async () => {
          /* never called — button hidden */
        }}
      />
      ) : null}

      {addStoreOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sim-add-store-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAddStoreOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-6 shadow-xl">
            <h2
              id="sim-add-store-title"
              className="font-display text-xl tracking-tight"
            >
              Add store (simulation)
            </h2>
            <p className="mt-2 text-sm text-black/55">
              Creates a temporary dummy store on this page only. It is not
              linked to Lemon Squeezy and vanishes when you exit.
            </p>
            <label className="mt-4 block">
              <span className="text-xs font-semibold text-black/70">
                Store name
              </span>
              <input
                type="text"
                value={addStoreName}
                onChange={(e) => setAddStoreName(e.target.value)}
                placeholder="Demo Store"
                className="mt-1.5 w-full rounded-xl border border-black/12 px-3.5 py-2.5 text-sm outline-none focus:border-black/30"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") createDummyStore();
                }}
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold text-black/65"
                onClick={() => setAddStoreOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-[#111] px-4 py-2 text-sm font-semibold text-white"
                onClick={createDummyStore}
              >
                Create temporary store
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
