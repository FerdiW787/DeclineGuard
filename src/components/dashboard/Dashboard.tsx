import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@clerk/astro/react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useClerkUser } from "@/components/auth/useClerkClient";
import BrandLogo from "@/components/BrandLogo";
import { withConvexClerkProvider } from "@/lib/withConvexClerkProvider";
import {
  ChevronsUpDown,
  Headphones,
  LayoutDashboard,
  Palette,
  Plus,
  Settings,
  Store,
  Wallet,
  Workflow,
} from "lucide-react";
import CustomizationsPage, {
  type EmailCustomizeHandle,
} from "./CustomizationsPage";
import { useEmailHeaderImageUpload } from "@/hooks/useEmailHeaderImageUpload";
import {
  toEmailCopyOverrides,
  type EmailCustomizationValues,
} from "./EmailCustomizePanel";
import AdminDestinationGate, {
  adminNeedsDestinationChoice,
  rememberMerchantDashboardChoice,
} from "./AdminDestinationGate";
import DashboardBoot from "./DashboardBoot";
import LsSetupFlow from "./LsSetupFlow";
import OverviewHub from "./OverviewHub";
import PageEnter, { type PageEnterHandle } from "./PageEnter";
import RecoveriesPage, {
  type RecoveriesQueueFilter,
} from "./RecoveriesPage";
import SequencesPage from "./SequencesPage";
import BrandImportGate from "./BrandImportGate";
import MerchantSupport, {
  type SupportLaunch,
} from "@/components/support/MerchantSupport";
import SettingsModule from "./settings/SettingsModule";
import type { SettingsTabId } from "./settings/settingsTypes";

type DayRow = {
  date: string;
  moneyRecovered: number;
  moneyAtRisk: number;
  clientsRecovered: number;
  /** New declines that entered the recovery email loop that day */
  clientsNew: number;
  /** Sequence finished (Day 5 sent) and still not recovered */
  clientsLost: number;
  emailsSent: number;
  emailsBounced: number;
};

type ChartDayWindow = {
  date: string;
  startMs: number;
  endMs: number;
};

/** Local calendar day windows for the last N days (timezone-correct). */
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

const NAV = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "recoveries", label: "Recoveries", icon: Wallet },
  { id: "sequences", label: "Sequences", icon: Workflow },
  { id: "customizations", label: "Customizations", icon: Palette },
] as const;

const FOOTER_TAB =
  "group relative z-10 flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none transition-[background-color,color] duration-200 ease-out focus:outline-none focus-visible:outline-none";

type NavId = (typeof NAV)[number]["id"];

type NavIndicator = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function Dashboard() {
  const { isSignedIn, isLoaded } = useAuth();
  const user = useClerkUser();
  const displayName =
    user?.fullName?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.primaryEmailAddress?.emailAddress ||
    "Account";
  const planTier = "Free";
  const [nav, setNav] = useState<NavId>("overview");
  const customizationsRef = useRef<EmailCustomizeHandle>(null);
  const pageEnterRef = useRef<PageEnterHandle>(null);
  const navBusyRef = useRef(false);
  const [customizationsDirty, setCustomizationsDirty] = useState(false);
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [shellWiggle, setShellWiggle] = useState(false);
  const pendingNavRef = useRef<NavId | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpSubject, setHelpSubject] = useState<string | undefined>();
  const [helpLaunch, setHelpLaunch] = useState<SupportLaunch | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTabId>("general");
  const [recoveriesFilter, setRecoveriesFilter] =
    useState<RecoveriesQueueFilter>("all");
  const [recoveriesFilterKey, setRecoveriesFilterKey] = useState(0);
  const useChromeScroll = true;

  function openSettings(tab: SettingsTabId = "general") {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }
  const [, setSequenceFingers] = useState<1 | 2 | 3>(1);

  const connection = useQuery(api.functions.lemonSqueezy.getConnection);
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
  const openFailures = useQuery(
    api.functions.recoveries.listOpenFailures,
    connection ? { limit: 100 } : "skip",
  );
  const recentActivity = useQuery(
    api.functions.recoveries.listActivitySince,
    connection ? { sinceMs: chartSinceMs, limit: 500 } : "skip",
  );
  const recoveredSince = useQuery(
    api.functions.recoveries.listRecoveredSince,
    connection ? { sinceMs: chartSinceMs, limit: 500 } : "skip",
  );
  const recoverySummary = useQuery(
    api.functions.recoveries.getRecoverySummary,
    connection ? { monthStartMs, priorMonthStartMs } : "skip",
  );
  const feesSummary = useQuery(
    api.functions.recoveries.getFeesSummary,
    connection ? { monthStartMs } : "skip",
  );
  const webhookSetup = useQuery(
    api.functions.lemonSqueezy.getWebhookSetup,
    connection ? {} : "skip",
  );
  const webhookStatus = useQuery(
    api.functions.lemonSqueezy.getWebhookStatus,
    connection ? {} : "skip",
  );
  const emailSetup = useQuery(
    api.functions.recoverySettings.getEmailSetup,
    connection ? {} : "skip",
  );
  const recoverySettings = useQuery(
    api.functions.recoverySettings.getSettings,
    connection ? {} : "skip",
  );
  const ensureCurrentUser = useMutation(api.functions.user.ensureCurrentUser);
  const currentUser = useQuery(api.functions.user.getCurrentUser);
  const unreadHelpCount = useQuery(
    api.functions.support.countUnreadThreads,
    isSignedIn ? {} : "skip",
  );
  const activeTakeover = useQuery(
    api.functions.adminTakeover.getActiveTakeoverForMe,
    isSignedIn ? {} : "skip",
  );
  const endTakeover = useMutation(api.functions.adminTakeover.endTakeover);
  const disconnectStore = useMutation(
    api.functions.lemonSqueezy.disconnectStore,
  );
  const saveSenderSettings = useMutation(
    api.functions.recoverySettings.saveSenderSettings,
  );
  const saveEmailCustomizations = useMutation(
    api.functions.recoverySettings.saveEmailCustomizations,
  );
  const uploadEmailImage = useEmailHeaderImageUpload();

  const brandImportComplete =
    recoverySettings?.brandImportCompletedAt != null;
  const suggestedBrandDomain = useMemo(() => {
    if (recoverySettings?.brandDomain) return recoverySettings.brandDomain;
    const slug = connection?.storeSlug;
    if (slug && !slug.includes("lemonsqueezy")) return slug;
    return null;
  }, [recoverySettings?.brandDomain, connection?.storeSlug]);

  const goToNav = useCallback((id: NavId) => {
    if (navBusyRef.current) return;
    navBusyRef.current = true;
    const finish = () => {
      setNav(id);
      navBusyRef.current = false;
    };
    const handle = pageEnterRef.current;
    if (!handle) {
      finish();
      return;
    }
    handle.exit(finish);
  }, []);

  const requestNav = useCallback(
    (id: NavId) => {
      if (id === nav || navBusyRef.current) return;
      if (nav === "customizations" && customizationsDirty) {
        pendingNavRef.current = id;
        setUnsavedOpen(true);
        setShellWiggle(true);
        window.setTimeout(() => setShellWiggle(false), 480);
        return;
      }
      goToNav(id);
    },
    [nav, customizationsDirty, goToNav],
  );

  const goRecoveries = useCallback(
    (filter: RecoveriesQueueFilter = "all") => {
      setRecoveriesFilter(filter);
      setRecoveriesFilterKey((n) => n + 1);
      if (nav === "recoveries") return;
      requestNav("recoveries");
    },
    [nav, requestNav],
  );

  useEffect(() => {
    if (!customizationsDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [customizationsDirty]);
  const selectStore = useMutation(api.functions.lemonSqueezy.selectStore);
  const refreshStores = useAction(
    api.functions.lemonSqueezyActions.refreshStores,
  );
  /** undefined = still loading; null = not connected */
  const connectionLoading = connection === undefined;
  const lsConnected = connection != null;
  const [lsSetupOpen, setLsSetupOpen] = useState(false);
  const [onboardingPreview, setOnboardingPreview] = useState(() => {
    if (typeof window === "undefined") return false;
    const value = new URLSearchParams(window.location.search).get(
      "onboardingPreview",
    );
    return value === "1" || value === "true";
  });
  const [storeMenuOpen, setStoreMenuOpen] = useState(false);
  const [storesRefreshing, setStoresRefreshing] = useState(false);
  const storeMenuRef = useRef<HTMLDivElement>(null);
  const storesRefreshedRef = useRef(false);
  const navListRef = useRef<HTMLDivElement>(null);
  const navScrollRef = useRef<HTMLElement>(null);
  const navItemRefs = useRef<Partial<Record<NavId, HTMLButtonElement | null>>>(
    {},
  );
  const [navIndicator, setNavIndicator] = useState<NavIndicator | null>(null);
  const [sidebarScrollShadow, setSidebarScrollShadow] = useState({
    top: false,
    bottom: false,
  });
  const [bootDone, setBootDone] = useState(false);
  const [bootActive, setBootActive] = useState(false);
  /** Overview charts mount once the splash starts fading (not under the opaque boot). */
  const [chartsReady, setChartsReady] = useState(false);
  /** First visit with no store — never show the boot splash */
  const [skipBoot, setSkipBoot] = useState(false);
  const [showShell, setShowShell] = useState(false);
  /** Admin picked merchant dashboard for this browser session */
  const [adminMerchantChosen, setAdminMerchantChosen] = useState(false);
  const displayCurrency =
    recoverySummary?.displayCurrency ??
    recoverySummary?.recoveredCurrency ??
    recoverySummary?.openCurrency ??
    "USD";

  /** Chart money from failedPayments; emails / at-risk from activity. */
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

    for (const row of recoveredSince ?? []) {
      if (row.recoveredAt < rangeStartMs || row.recoveredAt >= rangeEndMs) {
        continue;
      }
      const key = dayFor(row.recoveredAt);
      if (!key) continue;
      const bucket = byDate.get(key);
      if (!bucket) continue;
      if (row.currency.toUpperCase() === currencyFilter) {
        bucket.moneyRecovered += row.amountCents / 100;
      }
      bucket.clientsRecovered += 1;
    }

    for (const failure of openFailures ?? []) {
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

    for (const ev of recentActivity ?? []) {
      if (ev.occurredAt < rangeStartMs || ev.occurredAt >= rangeEndMs) {
        continue;
      }
      const key = dayFor(ev.occurredAt);
      if (!key) continue;
      const bucket = byDate.get(key);
      if (!bucket) continue;

      const sameCurrency =
        !ev.currency || ev.currency.toUpperCase() === currencyFilter;

      switch (ev.type) {
        case "recovered":
          // Money / clients come from listRecoveredSince (failedPayments).
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
        case "retry_requested":
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
    recentActivity,
    recoveredSince,
    openFailures,
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
      ) || (recoveredSince?.length ?? 0) > 0,
    [lastMonthChartData, recoveredSince],
  );

  const onBootReveal = useCallback(() => setShowShell(true), []);
  const onBootExitStart = useCallback(() => setChartsReady(true), []);
  const onBootDone = useCallback(() => {
    setBootDone(true);
    setChartsReady(true);
    setBootActive(false);
  }, []);
  const onLsSetupReveal = useCallback(() => {
    // Mount dashboard under the overlay before it slides away
    setShowShell(true);
    setBootDone(true);
    setChartsReady(true);
    setBootActive(false);
  }, []);
  const onLsSetupComplete = useCallback(() => {
    setLsSetupOpen(false);
    setShowShell(true);
    setBootDone(true);
    setChartsReady(true);
    setBootActive(false);
    if (onboardingPreview) {
      setOnboardingPreview(false);
      const url = new URL(window.location.href);
      url.searchParams.delete("onboardingPreview");
      const next = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, "", next);
    }
  }, [onboardingPreview]);

  // No store → setup only (no splash). Already connected → splash, then dashboard.
  // ?onboardingPreview=1 forces the setup UI with mocked steps (no API writes).
  useEffect(() => {
    if (!isLoaded || !isSignedIn || connectionLoading) return;

    if (onboardingPreview) {
      setLsSetupOpen(true);
      setSkipBoot(true);
      setShowShell(true);
      return;
    }

    if (!lsConnected) {
      setLsSetupOpen(true);
      setSkipBoot(true);
      return;
    }

    if (!skipBoot && !bootDone && !bootActive) {
      setBootActive(true);
    }
  }, [
    isLoaded,
    isSignedIn,
    connectionLoading,
    lsConnected,
    onboardingPreview,
    skipBoot,
    bootDone,
    bootActive,
  ]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      window.location.href = "/a/sign-in";
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) return;
    void ensureCurrentUser().catch(() => {
      /* account sync may still be catching up */
    });
  }, [isSignedIn, ensureCurrentUser]);

  useEffect(() => {
    if (!storeMenuOpen || !connection) return;
    const stores =
      connection.stores.length > 0
        ? connection.stores
        : [
            {
              id: connection.storeId,
              name: connection.storeName,
              slug: connection.storeSlug,
            },
          ];

    const onPointerDown = (e: PointerEvent) => {
      const el = storeMenuRef.current;
      if (el && !el.contains(e.target as Node)) {
        setStoreMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setStoreMenuOpen(false);
        return;
      }
      if (!(e.metaKey || e.ctrlKey)) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > 9) return;
      const store = stores[n - 1];
      if (!store) return;
      e.preventDefault();
      void selectStore({ storeId: store.id }).finally(() =>
        setStoreMenuOpen(false),
      );
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [storeMenuOpen, connection, selectStore]);

  // Refresh store list once per connected session (sidebar picker)
  useEffect(() => {
    if (!lsConnected) {
      storesRefreshedRef.current = false;
      return;
    }
    if (storesRefreshedRef.current) return;
    storesRefreshedRef.current = true;
    setStoresRefreshing(true);
    void refreshStores()
      .catch(() => {
        /* keep cached / single-store fallback */
      })
      .finally(() => setStoresRefreshing(false));
  }, [lsConnected, refreshStores]);

  const updateNavIndicator = useCallback(() => {
    const list = navListRef.current;
    const btn = navItemRefs.current[nav];
    if (!list || !btn) return;
    const listBox = list.getBoundingClientRect();
    const btnBox = btn.getBoundingClientRect();
    if (btnBox.width < 1 || btnBox.height < 1) return;
    setNavIndicator({
      top: btnBox.top - listBox.top + list.scrollTop,
      left: btnBox.left - listBox.left + list.scrollLeft,
      width: btnBox.width,
      height: btnBox.height,
    });
  }, [nav]);

  // Remeasure when shell appears / splash ends (effects above miss that mount)
  useLayoutEffect(() => {
    if (!showShell) return;
    updateNavIndicator();
  }, [updateNavIndicator, showShell, bootDone]);

  useEffect(() => {
    if (!showShell) return;
    const list = navListRef.current;
    if (!list) return;
    const ro = new ResizeObserver(() => updateNavIndicator());
    ro.observe(list);
    window.addEventListener("resize", updateNavIndicator);
    const raf = window.requestAnimationFrame(() => updateNavIndicator());
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateNavIndicator);
      window.cancelAnimationFrame(raf);
    };
  }, [updateNavIndicator, showShell, bootDone]);

  const openCount = recoverySummary?.openCount ?? openFailures?.length ?? 0;
  const openAtRiskLabel =
    recoverySummary && recoverySummary.openAtRiskCents > 0
      ? `${formatMoneyAmount(
          recoverySummary.openAtRiskCents,
          recoverySummary.openCurrency ?? displayCurrency,
        )}${recoverySummary.openCurrencyMixed ? " · mixed" : ""}`
      : "—";
  const recoveredLabel =
    recoverySummary && recoverySummary.recoveredThisMonthCents > 0
      ? `${formatMoneyAmount(
          recoverySummary.recoveredThisMonthCents,
          recoverySummary.recoveredCurrency ?? displayCurrency,
        )}${recoverySummary.recoveredCurrencyMixed ? " · mixed" : ""}`
      : formatMoneyAmount(0, displayCurrency);
  const recoveryRateLabel =
    recoverySummary?.recoveryRatePercent != null
      ? `${recoverySummary.recoveryRatePercent}%`
      : "—";
  const emailsSentLabel = recoverySummary
    ? String(recoverySummary.emailsSentThisMonth)
    : "—";
  const feesOwedLabel =
    feesSummary && feesSummary.owedThisMonthCents > 0
      ? `${formatMoneyAmount(
          feesSummary.owedThisMonthCents,
          feesSummary.currency ?? displayCurrency,
        )}${feesSummary.currencyMixed ? " · mixed" : ""}`
      : formatMoneyAmount(0, displayCurrency);
  const youKeepLabel = (() => {
    const recoveredCents = recoverySummary?.recoveredThisMonthCents ?? 0;
    const feeCents = feesSummary?.owedThisMonthCents ?? 0;
    const keptCents = Math.max(0, recoveredCents - feeCents);
    const currency =
      recoverySummary?.recoveredCurrency ?? displayCurrency;
    const mixed =
      Boolean(recoverySummary?.recoveredCurrencyMixed) ||
      Boolean(feesSummary?.currencyMixed);
    return `${formatMoneyAmount(keptCents, currency)}${mixed ? " · mixed" : ""}`;
  })();

  if (isLoaded && !isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-muted-foreground">
        Redirecting…
      </div>
    );
  }

  // Admins get a destination chooser; wait for role + takeover before boot.
  if (isLoaded && isSignedIn && currentUser === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f7f8f8] text-sm text-[#8a8f98]">
        Loading…
      </div>
    );
  }

  if (
    currentUser?.role === "admin" &&
    !adminMerchantChosen &&
    activeTakeover === undefined
  ) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f7f8f8] text-sm text-[#8a8f98]">
        Loading…
      </div>
    );
  }

  if (
    !adminMerchantChosen &&
    adminNeedsDestinationChoice({
      role: currentUser?.role,
      activeTakeover,
      currentUserId: currentUser?._id,
    })
  ) {
    return (
      <AdminDestinationGate
        onChooseMerchant={() => {
          rememberMerchantDashboardChoice();
          setAdminMerchantChosen(true);
        }}
      />
    );
  }

  return (
    <>
      {showShell ? (
    <div
      className={`dg-shell light ln-surface relative flex h-dvh overflow-hidden bg-[#f7f8f8] text-[#08090a] ${
        shellWiggle ? "dg-shell-wiggle" : ""
      }`}
    >
      {/* ── Left sidebar — only after a store is connected ── */}
      {lsConnected ? (
      <aside
        className={`relative z-20 flex w-[248px] shrink-0 flex-col bg-[#f7f8f8] max-lg:hidden ${
          storeMenuOpen ? "overflow-visible" : "overflow-hidden"
        }`}
      >
        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center px-5 py-5">
            <BrandLogo size="sm" />
          </div>

          {lsConnected && connection ? (
            <div ref={storeMenuRef} className="relative z-30 mb-3 shrink-0 px-3">
              <button
                type="button"
                onClick={() => setStoreMenuOpen((o) => !o)}
                aria-expanded={storeMenuOpen}
                aria-haspopup="menu"
                className="flex w-full items-center gap-2 rounded-lg p-2 text-left transition hover:bg-black/[0.04] data-[state=open]:bg-black/[0.05]"
                data-state={storeMenuOpen ? "open" : "closed"}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#08090a] text-[#f7f8f8]">
                  <Store className="size-4" />
                </span>
                <span className="min-w-0 flex-1 grid text-left text-sm leading-tight">
                  <span className="truncate font-semibold text-[#08090a]">
                    {connection.storeName}
                  </span>
                  <span className="truncate text-xs text-[#8a8f98]">
                    {storesRefreshing
                      ? "Updating…"
                      : connection.testMode
                        ? "Test mode"
                        : "Live"}
                  </span>
                </span>
                <ChevronsUpDown className="ml-auto size-4 shrink-0 text-[#8a8f98]" />
              </button>

              {storeMenuOpen ? (
                <div
                  role="menu"
                  aria-label="Stores"
                  className="dg-menu-in absolute left-full top-0 z-50 ml-2 w-56 overflow-hidden rounded-lg border border-black/8 bg-white text-[#08090a] shadow-[0_18px_40px_-16px_rgba(0,0,0,0.16)]"
                >
                  <div className="px-2 py-1.5 text-xs font-medium text-[#8a8f98]">
                    Stores
                  </div>
                  <ul className="max-h-56 overflow-y-auto px-1 pb-1">
                    {(connection.stores.length > 0
                      ? connection.stores
                      : [
                          {
                            id: connection.storeId,
                            name: connection.storeName,
                            slug: connection.storeSlug,
                          },
                        ]
                    ).map((store, index) => {
                      const selected = store.id === connection.storeId;
                      const shortcut = index < 9 ? `⌘${index + 1}` : null;
                      return (
                        <li key={store.id}>
                          <button
                            type="button"
                            role="menuitemradio"
                            aria-checked={selected}
                            onClick={() => {
                              void selectStore({ storeId: store.id }).finally(
                                () => setStoreMenuOpen(false),
                              );
                            }}
                            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition ${
                              selected
                                ? "bg-black/[0.06] font-medium text-[#08090a]"
                                : "text-[#6b6f76] hover:bg-black/[0.04]"
                            }`}
                          >
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-sm border border-black/8 bg-black/[0.03]">
                              <Store className="size-3.5 text-[#6b6f76]" />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-left">
                              {store.name}
                            </span>
                            {shortcut ? (
                              <span className="ml-auto text-xs tracking-widest text-[#8a8f98]">
                                {shortcut}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mx-1 h-px bg-black/8" />
                  <div className="p-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setStoreMenuOpen(false);
                        setLsSetupOpen(true);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[#6b6f76] outline-none transition hover:bg-black/[0.04]"
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-black/8 bg-transparent">
                        <Plus className="size-3.5" />
                      </span>
                      Add store
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="relative min-h-0 flex-1">
            <nav
              ref={navScrollRef}
              className="h-full overflow-y-auto px-3 pb-3"
              onScroll={(e) => {
                const el = e.currentTarget;
                const canScroll = el.scrollHeight > el.clientHeight + 1;
                setSidebarScrollShadow({
                  top: canScroll && el.scrollTop > 2,
                  bottom:
                    canScroll &&
                    el.scrollTop + el.clientHeight < el.scrollHeight - 2,
                });
              }}
            >
              <div ref={navListRef} className="relative flex flex-col gap-0.5">
                {navIndicator ? (
                  <div
                    className="pointer-events-none absolute z-0 overflow-hidden rounded-lg bg-black/[0.06] transition-[top,height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{
                      top: navIndicator.top,
                      left: navIndicator.left,
                      width: navIndicator.width,
                      height: navIndicator.height,
                    }}
                    aria-hidden
                  />
                ) : null}
                {NAV.map((item) => {
                  const Icon = item.icon;
                  const active = nav === item.id;
                  return (
                    <button
                      key={item.id}
                      ref={(el) => {
                        navItemRefs.current[item.id] = el;
                      }}
                      type="button"
                      onClick={() => requestNav(item.id)}
                      className={`group relative z-10 flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none transition-[background-color,color,transform,box-shadow] duration-200 ease-out focus:outline-none focus-visible:outline-none ${
                        active
                          ? "font-semibold text-[#08090a]"
                          : "font-medium text-[#8a8f98] hover:bg-black/[0.04] hover:text-[#08090a]"
                      }`}
                    >
                      <Icon className="size-4 shrink-0 transition-transform duration-200 ease-out" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </nav>

            <div
              aria-hidden
              className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-7 bg-gradient-to-b from-[#f7f8f8] to-transparent transition-opacity duration-200 ${
                sidebarScrollShadow.top ? "opacity-100" : "opacity-0"
              }`}
            />
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-7 bg-gradient-to-t from-[#f7f8f8] to-transparent transition-opacity duration-200 ${
                sidebarScrollShadow.bottom ? "opacity-100" : "opacity-0"
              }`}
            />
          </div>

          <div className="mt-auto shrink-0 px-3 pb-4">
            <button
              type="button"
              onClick={() => {
                setHelpSubject(undefined);
                setHelpOpen(true);
              }}
              className={`${FOOTER_TAB} w-full ${
                helpOpen
                  ? "bg-black/[0.06] font-semibold text-[#08090a]"
                  : "font-medium text-[#8a8f98] hover:bg-black/[0.04] hover:text-[#08090a]"
              }`}
            >
              <Headphones className="size-4 shrink-0" />
              <span>Support</span>
              {typeof unreadHelpCount === "number" && unreadHelpCount > 0 ? (
                <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ffe566] px-1 text-[10px] font-bold text-[#0b0c0e]">
                  {unreadHelpCount > 9 ? "9+" : unreadHelpCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => openSettings()}
              className={`${FOOTER_TAB} w-full ${
                settingsOpen
                  ? "bg-black/[0.06] font-semibold text-[#08090a]"
                  : "font-medium text-[#8a8f98] hover:bg-black/[0.04] hover:text-[#08090a]"
              }`}
            >
              <Settings className="size-4 shrink-0" />
              <span>Settings</span>
            </button>
            <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 border-t border-black/6 pt-4 text-[11px] text-[#8a8f98]">
              <a
                href="/legal/impressum"
                className="transition-colors hover:text-[#08090a]"
              >
                Impressum
              </a>
              <a
                href="/legal/privacy"
                className="transition-colors hover:text-[#08090a]"
              >
                Privacy
              </a>
              <a
                href="/legal/terms"
                className="transition-colors hover:text-[#08090a]"
              >
                Terms
              </a>
              <a
                href="/legal/dpa"
                className="transition-colors hover:text-[#08090a]"
              >
                DPA
              </a>
            </div>
          </div>
        </div>
      </aside>
      ) : null}


      {/* ── Main content ── */}
      <div className="relative z-10 flex min-w-0 flex-1 overflow-hidden max-lg:p-0">
        {/* Mobile top bar */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 border-b border-black/6 bg-[#f7f8f8] px-4 py-3 lg:hidden">
          <BrandLogo size="sm" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setHelpSubject(undefined);
                setHelpOpen(true);
              }}
              className="relative inline-flex items-center gap-1 rounded-lg border border-black/8 px-2.5 py-1.5 text-xs font-semibold text-[#6b6f76]"
            >
              <Headphones className="size-3.5" />
              Support
              {typeof unreadHelpCount === "number" && unreadHelpCount > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#111] px-1 text-[10px] font-bold text-white">
                  {unreadHelpCount > 9 ? "9+" : unreadHelpCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => openSettings()}
              className="inline-flex items-center gap-1 rounded-lg border border-black/8 px-2.5 py-1.5 text-xs font-semibold text-[#6b6f76]"
            >
              <Settings className="size-3.5" />
              Settings
            </button>
          </div>
        </div>

        {/* Center main */}
        <main
          className={`relative flex min-h-0 min-w-0 flex-1 flex-col ${
            lsConnected ? "dg-inset" : ""
          } ${
            lsConnected && useChromeScroll
              ? "overflow-hidden"
              : "overflow-y-auto"
          } ${
            lsConnected
              ? useChromeScroll
                ? "pt-16 lg:pt-0"
                : "px-5 pb-10 pt-16 lg:px-8 lg:pt-1"
              : "p-0 max-lg:pt-14"
          }`}
        >
          {activeTakeover?.status === "active" ? (
            <div className="pointer-events-none fixed inset-x-0 top-0 z-[130] px-5 pt-3 lg:px-8">
              <div className="pointer-events-auto mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-300 bg-violet-50 px-4 py-3 text-sm text-violet-950 shadow-[0_8px_30px_-12px_rgba(76,29,149,0.35)]">
              <div className="min-w-0">
                <p className="font-semibold">
                  {activeTakeover.expiresAt != null &&
                  activeTakeover.expiresAt <= Date.now()
                    ? "Takeover expired — restore access"
                    : currentUser &&
                        activeTakeover.adminUserId === currentUser._id
                      ? `Working as ${activeTakeover.merchantName}`
                      : "An Admin is working on this account"}
                </p>
                <p className="mt-0.5 text-[12px] text-violet-900/70">
                  {activeTakeover.expiresAt != null &&
                  activeTakeover.expiresAt <= Date.now()
                    ? "Time is up, but unfreeze may still be pending — end now to restore the merchant."
                    : (
                        <>
                          Ends{" "}
                          {activeTakeover.expiresAt
                            ? new Date(activeTakeover.expiresAt).toLocaleString(
                                undefined,
                                { dateStyle: "short", timeStyle: "short" },
                              )
                            : "soon"}
                          {currentUser &&
                          activeTakeover.adminUserId === currentUser._id
                            ? " · You’re still signed in as Admin · product actions use their account"
                            : " · Dashboard locked for you until then · chat still works"}
                        </>
                      )}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 cursor-pointer rounded-xl bg-violet-900 px-3.5 py-2 text-[12px] font-semibold text-white"
                onClick={() => {
                  void (async () => {
                    try {
                      await endTakeover({
                        takeoverId: activeTakeover._id,
                        reason:
                          currentUser &&
                          activeTakeover.adminUserId === currentUser._id
                            ? "Admin ended takeover from dashboard"
                            : "Merchant ended Admin takeover from dashboard",
                      });
                    } catch {
                      /* ignore */
                    }
                    if (
                      currentUser &&
                      activeTakeover.adminUserId === currentUser._id
                    ) {
                      window.location.assign("/a/admin");
                    }
                  })();
                }}
              >
                {currentUser &&
                activeTakeover.adminUserId === currentUser._id
                  ? "End session"
                  : "End Admin session"}
              </button>
              </div>
            </div>
          ) : null}
          {activeTakeover?.status === "active" ? (
            <div className="h-[4.75rem] shrink-0" aria-hidden />
          ) : null}

          {currentUser &&
          !activeTakeover &&
          (currentUser.accountStatus === "frozen" ||
            currentUser.accountStatus === "disabled") ? (
            <div className="relative z-30 mx-5 mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 lg:mx-8">
              <p>
                This account is <strong>{currentUser.accountStatus}</strong>
                {currentUser.frozenReason
                  ? ` — ${currentUser.frozenReason}`
                  : ""}
                . Writes are blocked until staff restores access.
              </p>
              {currentUser.accountStatus === "frozen" ? (
                <button
                  type="button"
                  className="mt-2 text-sm font-semibold underline underline-offset-2"
                  onClick={() => {
                    setHelpSubject("My account is frozen");
                    setHelpOpen(true);
                  }}
                >
                  Open a support chat
                </button>
              ) : null}
            </div>
          ) : null}
          {connectionLoading ? (
            <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center rounded-md border border-black/6 bg-white/50 px-6 py-16 text-sm text-black/40">
              Checking Lemon Squeezy connection…
            </div>
          ) : !lsConnected ? (
            <div className="relative z-10 min-h-0 flex-1 bg-white" />
          ) : (
            <PageEnter ref={pageEnterRef} pageKey={nav}>
              {nav === "overview" ? (
                <section className="relative flex min-h-0 flex-1 flex-col">
                  <div className="relative z-10 h-full min-h-0 flex-1 overflow-y-auto overflow-x-visible px-5 pb-10 pt-1 lg:px-8 lg:pb-6 lg:pt-3">
                    <div className="relative z-10 mb-6 space-y-4 lg:hidden">
                      <nav className="flex gap-1 overflow-x-auto rounded-full border border-black/6 bg-white/80 p-1 text-sm font-medium">
                        {NAV.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => requestNav(item.id)}
                            className={`shrink-0 rounded-full px-3.5 py-1.5 transition ${
                              nav === item.id
                                ? "bg-[#111] text-white"
                                : "text-black/55 hover:bg-black/5"
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </nav>
                    </div>
                    <OverviewHub
                      userFullName={displayName}
                      storeName={connection.storeName}
                      recoveredLabel={recoveredLabel}
                      openCount={openCount}
                      openAtRiskLabel={openAtRiskLabel}
                      emailsSentLabel={emailsSentLabel}
                      recoveryRateLabel={recoveryRateLabel}
                      feesOwedLabel={feesOwedLabel}
                      youKeepLabel={youKeepLabel}
                      openFailures={openFailures}
                      recentActivity={recentActivity}
                      brandColor={recoverySettings?.brandColor ?? "#0c0c0c"}
                      emailIsProduction={emailSetup?.isProduction ?? null}
                      chartRows={lastMonthChartData}
                      hasActivity={overviewHasActivity}
                      displayCurrency={displayCurrency}
                      openAtRiskCents={
                        recoverySummary?.openAtRiskCents ?? 0
                      }
                      recoveryRatePercent={
                        recoverySummary?.recoveryRatePercent ?? null
                      }
                      recoveredThisMonthCents={
                        recoverySummary?.recoveredThisMonthCents ?? 0
                      }
                      recoveredPriorMonthCents={
                        recoverySummary?.recoveredPriorMonthCents ?? 0
                      }
                      webhookStatus={webhookStatus}
                      emailSetup={
                        emailSetup
                          ? {
                              fromAddress: emailSetup.fromAddress,
                              isProduction: emailSetup.isProduction,
                              hasApiKey: emailSetup.hasApiKey,
                            }
                          : emailSetup
                      }
                      chartsReady={chartsReady}
                      onNavigate={(id) => {
                        if (id === "settings") {
                          openSettings();
                          return;
                        }
                        if (id === "recoveries") {
                          goRecoveries("all");
                          return;
                        }
                        requestNav(id);
                      }}
                      onOpenSettings={openSettings}
                    />
                  </div>
                </section>
              ) : nav === "recoveries" ? (
                <section className="relative flex min-h-0 flex-1 flex-col">
                  <div className="relative z-10 shrink-0 px-5 pt-3 pb-1 lg:hidden">
                    <nav className="flex gap-1 overflow-x-auto rounded-full border border-black/6 bg-white/80 p-1 text-sm font-medium">
                      {NAV.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => requestNav(item.id)}
                          className={`shrink-0 rounded-full px-3.5 py-1.5 transition ${
                            nav === item.id
                              ? "bg-[#111] text-white"
                              : "text-black/55 hover:bg-black/5"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </nav>
                  </div>
                  <RecoveriesPage
                    openFailures={openFailures}
                    recentActivity={recentActivity}
                    chartRows={lastMonthChartData}
                    hasActivity={overviewHasActivity}
                    openCount={openCount}
                    recoveryRatePercent={
                      recoverySummary?.recoveryRatePercent ?? null
                    }
                    displayCurrency={displayCurrency}
                    initialFilter={recoveriesFilter}
                    filterFocusKey={recoveriesFilterKey}
                    onGoToCustomizations={() => requestNav("customizations")}
                  />
                </section>
              ) : nav === "sequences" ? (
                <section className="relative flex min-h-0 flex-1 flex-col">
                  <div className="relative z-10 shrink-0 px-5 pt-3 pb-1 lg:hidden">
                    <nav className="flex gap-1 overflow-x-auto rounded-full border border-black/6 bg-white/80 p-1 text-sm font-medium">
                      {NAV.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => requestNav(item.id)}
                          className={`shrink-0 rounded-full px-3.5 py-1.5 transition ${
                            nav === item.id
                              ? "bg-[#111] text-white"
                              : "text-black/55 hover:bg-black/5"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </nav>
                  </div>
                  {!brandImportComplete ? (
                    <BrandImportGate
                      storeName={connection.storeName}
                      storeLogoUrl={connection.storeAvatarUrl ?? null}
                      suggestedDomain={suggestedBrandDomain}
                      context="sequences"
                      showDeclineGuardBadge={planTier === "Free"}
                    />
                  ) : (
                  <SequencesPage
                      storeName={connection.storeName}
                      storeLogoUrl={connection.storeAvatarUrl ?? null}
                      brandColor={recoverySettings?.brandColor ?? "#0c0c0c"}
                      secondaryColor={
                        recoverySettings?.secondaryColor ?? "#6b6b70"
                      }
                      emailFont={recoverySettings?.emailFont ?? null}
                      ctaBackgroundColor={
                        recoverySettings?.ctaBackgroundColor ?? null
                      }
                      ctaTextColor={recoverySettings?.ctaTextColor ?? null}
                      ctaBorderRadiusPx={
                        recoverySettings?.ctaBorderRadiusPx ?? null
                      }
                      linkColor={recoverySettings?.linkColor ?? null}
                      emailBackgroundColor={
                        recoverySettings?.pageBackgroundColor ??
                        recoverySettings?.emailBackgroundColor ??
                        null
                      }
                      emailTextColor={
                        recoverySettings?.pageTextColor ??
                        recoverySettings?.emailTextColor ??
                        null
                      }
                      templateId={recoverySettings?.templateId ?? "gentle"}
                      openFailures={openFailures}
                      supportEmail={recoverySettings?.supportEmail ?? null}
                      socialX={recoverySettings?.socialX ?? null}
                      socialLinkedin={recoverySettings?.socialLinkedin ?? null}
                      socialYoutube={recoverySettings?.socialYoutube ?? null}
                      socialInstagram={
                        recoverySettings?.socialInstagram ?? null
                      }
                      emailCopy={recoverySettings?.emailCopy ?? null}
                      showDeclineGuardBadge={planTier === "Free"}
                      onGoToRecoveries={(filter) =>
                        goRecoveries(filter ?? "all")
                      }
                      onGoToCustomizations={() =>
                        requestNav("customizations")
                      }
                      onFingersChange={setSequenceFingers}
                      previewBlocked={
                        currentUser?.accountStatus === "frozen" ||
                        currentUser?.accountStatus === "disabled"
                      }
                      previewBlockedReason={
                        currentUser?.accountStatus === "disabled"
                          ? "This account is disabled — preview is unavailable."
                          : currentUser?.accountStatus === "frozen"
                            ? "This account is frozen — preview is unavailable."
                            : undefined
                      }
                      onContactSupport={() => {
                        setHelpSubject(undefined);
                        setHelpLaunch({
                          topic: "lemon_squeezy",
                          lsIssue: "emails_not_sending",
                          subject:
                            "Preview sequence — missing or wrong emails",
                          body: "I ran the recovery email preview sequence but did not receive all three emails, or something looked wrong / incorrect.",
                          autoCreate: true,
                        });
                        setHelpOpen(true);
                      }}
                  />
                  )}
                </section>
              ) : nav === "customizations" ? (
                <section className="relative flex min-h-0 flex-1 flex-col">
                  <div className="relative z-10 shrink-0 px-5 pt-3 pb-1 lg:hidden">
                    <nav className="flex gap-1 overflow-x-auto rounded-full border border-black/6 bg-white/80 p-1 text-sm font-medium">
                      {NAV.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => requestNav(item.id)}
                          className={`shrink-0 rounded-full px-3.5 py-1.5 transition ${
                            nav === item.id
                              ? "bg-[#111] text-white"
                              : "text-black/55 hover:bg-black/5"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </nav>
                  </div>
                  {!brandImportComplete ? (
                    <BrandImportGate
                      storeName={connection.storeName}
                      storeLogoUrl={connection.storeAvatarUrl ?? null}
                      suggestedDomain={suggestedBrandDomain}
                      context="customizations"
                      showDeclineGuardBadge={planTier === "Free"}
                    />
                  ) : (
                  <CustomizationsPage
                    ref={customizationsRef}
                    storeName={connection.storeName}
                    storeLogoUrl={connection.storeAvatarUrl ?? null}
                    brandColor={recoverySettings?.brandColor ?? "#0c0c0c"}
                    secondaryColor={
                      recoverySettings?.secondaryColor ?? "#6b6b70"
                    }
                    emailFont={recoverySettings?.emailFont ?? null}
                    ctaBackgroundColor={
                      recoverySettings?.ctaBackgroundColor ?? null
                    }
                    ctaTextColor={recoverySettings?.ctaTextColor ?? null}
                    ctaBorderRadiusPx={
                      recoverySettings?.ctaBorderRadiusPx ?? null
                    }
                    linkColor={recoverySettings?.linkColor ?? null}
                    emailBackgroundColor={
                      recoverySettings?.pageBackgroundColor ??
                      recoverySettings?.emailBackgroundColor ??
                      null
                    }
                    emailTextColor={
                      recoverySettings?.pageTextColor ??
                      recoverySettings?.emailTextColor ??
                      null
                    }
                    fromName={recoverySettings?.fromName ?? null}
                    replyToEmail={recoverySettings?.replyToEmail ?? null}
                    supportEmail={recoverySettings?.supportEmail ?? null}
                    socialX={recoverySettings?.socialX ?? null}
                    socialLinkedin={recoverySettings?.socialLinkedin ?? null}
                    socialYoutube={recoverySettings?.socialYoutube ?? null}
                    socialInstagram={recoverySettings?.socialInstagram ?? null}
                    emailCopy={recoverySettings?.emailCopy ?? null}
                    showDeclineGuardBadge={planTier === "Free"}
                    openFailures={openFailures}
                    fromAddressHint={emailSetup?.fromAddress ?? null}
                    brandDomain={recoverySettings?.brandDomain ?? null}
                    onGoToSequences={() => requestNav("sequences")}
                    onDirtyChange={setCustomizationsDirty}
                    onUploadImage={uploadEmailImage}
                    onSave={async (values: EmailCustomizationValues) => {
                      await saveEmailCustomizations({
                        brandColor: values.brandColor,
                        secondaryColor: values.secondaryColor,
                        ctaBackgroundColor: values.ctaBackgroundColor,
                        ctaTextColor: values.ctaTextColor,
                        linkColor: values.linkColor,
                        emailFont: values.emailFont,
                        fromName: values.fromName,
                        replyToEmail: values.replyToEmail,
                        supportEmail: values.supportEmail,
                        socialX: values.socialX,
                        socialLinkedin: values.socialLinkedin,
                        socialYoutube: values.socialYoutube,
                        socialInstagram: values.socialInstagram,
                        emailCopy: toEmailCopyOverrides(values.emailCopy),
                      });
                    }}
                  />
                  )}
                </section>
              ) : null}
            </PageEnter>
          )}
        </main>
      </div>
    </div>
      ) : null}

      {bootActive && !bootDone ? (
        <DashboardBoot
          ready={Boolean(isLoaded && isSignedIn && lsConnected)}
          onReveal={onBootReveal}
          onExitStart={onBootExitStart}
          onDone={onBootDone}
        />
      ) : null}

      <LsSetupFlow
        open={lsSetupOpen}
        preview={onboardingPreview}
        onReveal={onLsSetupReveal}
        onComplete={onLsSetupComplete}
      />

      <MerchantSupport
        open={helpOpen}
        onClose={() => {
          setHelpOpen(false);
          setHelpLaunch(null);
        }}
        initialSubject={helpSubject}
        launch={helpLaunch}
        onLaunchConsumed={() => setHelpLaunch(null)}
      />

      {lsConnected && connection ? (
        <SettingsModule
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          initialTab={settingsTab}
          storeName={connection.storeName}
          storeSlug={connection.storeSlug}
          apiKeyLast4={connection.apiKeyLast4}
          testMode={connection.testMode}
          planTier={planTier}
          webhookSetup={webhookSetup}
          webhookStatus={webhookStatus}
          feesSummary={feesSummary}
          emailSetup={emailSetup}
          brandColor={recoverySettings?.brandColor ?? "#0c0c0c"}
          onSaveSender={async (fromName, replyToEmail) => {
            await saveSenderSettings({ fromName, replyToEmail });
          }}
          onDisconnect={async (confirmStoreName) => {
            await disconnectStore({ confirmStoreName });
          }}
        />
      ) : null}

      {unsavedOpen ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="unsaved-title"
        >
          <div className="w-full max-w-md rounded-md border border-black/10 bg-white p-6 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.45)] dark:border-white/10 dark:bg-[#161618]">
            <h2
              id="unsaved-title"
              className="font-display text-xl tracking-tight text-black dark:text-zinc-100"
            >
              You have unsaved changes
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-black/55 dark:text-zinc-100/55">
              Do you want to save them or discard them?
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                className="dg-btn dg-btn-secondary !px-4 !py-2.5 cursor-pointer text-xs"
                onClick={() => {
                  customizationsRef.current?.discard();
                  setCustomizationsDirty(false);
                  setUnsavedOpen(false);
                  const next = pendingNavRef.current;
                  pendingNavRef.current = null;
                  if (next) goToNav(next);
                }}
              >
                Discard
              </button>
              <button
                type="button"
                className="dg-btn dg-btn-primary !px-4 !py-2.5 cursor-pointer text-xs"
                onClick={() => {
                  void (async () => {
                    const ok = await customizationsRef.current?.save();
                    if (!ok) {
                      setUnsavedOpen(false);
                      pendingNavRef.current = null;
                      return;
                    }
                    setCustomizationsDirty(false);
                    setUnsavedOpen(false);
                    const next = pendingNavRef.current;
                    pendingNavRef.current = null;
                    if (next) goToNav(next);
                  })();
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default withConvexClerkProvider(Dashboard);
