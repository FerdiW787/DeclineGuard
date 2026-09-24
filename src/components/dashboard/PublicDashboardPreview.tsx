import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  ChevronsUpDown,
  Headphones,
  LayoutDashboard,
  Palette,
  Settings,
  Store,
  Wallet,
  Workflow,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import OverviewHub from "@/components/dashboard/OverviewHub";
import SettingsModule from "@/components/dashboard/settings/SettingsModule";
import type { DayRow } from "@/components/dashboard/OverviewSlider";
import {
  marketingActivity,
  marketingOpenFailures,
} from "@/components/homepage/marketing/demoData";

const NAV = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "recoveries", label: "Recoveries", icon: Wallet },
  { id: "sequences", label: "Sequences", icon: Workflow },
  { id: "customizations", label: "Customizations", icon: Palette },
] as const;

type NavId = (typeof NAV)[number]["id"];

type NavIndicator = {
  top: number;
  left: number;
  width: number;
  height: number;
};

/** Real-dashboard scale: ~€3,891 recovered / ~€130 a day. */
function buildPreviewChartRows(): DayRow[] {
  const recovered = [
    249, 0, 199, 149, 99, 149, 0, 199, 79, 149, 199, 0, 249, 129, 136, 79, 199,
    49, 149, 99, 99, 249, 79, 129, 0, 199, 99, 149, 79, 249,
  ];
  const atRisk = [
    0, 249, 0, 299, 79, 0, 349, 0, 199, 0, 249, 49, 0, 299, 0, 199, 0, 249, 0,
    349, 79, 0, 199, 0, 299, 0, 249, 49, 0, 199,
  ];
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return recovered.map((moneyRecovered, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (recovered.length - 1 - i));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const declined = atRisk[i] ?? 0;
    return {
      date: `${y}-${m}-${day}`,
      moneyRecovered,
      moneyAtRisk: declined,
      clientsRecovered: moneyRecovered > 0 ? 1 : 0,
      clientsNew: declined > 0 ? 1 : 0,
      clientsLost: i >= 24 && i % 5 === 0 ? 1 : 0,
      emailsSent: moneyRecovered > 0 ? 2 : declined > 0 ? 1 : 0,
      emailsBounced: i === 18 ? 1 : 0,
    };
  });
}

const previewChartRows = buildPreviewChartRows();
const previewOpenFailures = marketingOpenFailures.map((row) => ({
  ...row,
  nextEmailAt: null,
}));

export default function PublicDashboardPreview() {
  const nav: NavId = "overview";
  const navListRef = useRef<HTMLDivElement>(null);
  const navItemRefs = useRef<Partial<Record<NavId, HTMLButtonElement | null>>>(
    {},
  );
  const [navIndicator, setNavIndicator] = useState<NavIndicator | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  useLayoutEffect(() => {
    updateNavIndicator();
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
  }, [updateNavIndicator]);

  return (
    <div className="dg-shell light ln-surface relative flex h-dvh overflow-hidden bg-[#f7f8f8] text-[#08090a]">
      <aside className="relative z-20 flex w-[248px] shrink-0 flex-col overflow-hidden bg-[#f7f8f8] max-lg:hidden">
        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center px-5 py-5">
            <BrandLogo size="sm" href="/" />
          </div>

          <div className="relative z-30 mb-3 shrink-0 px-3">
            <div className="flex w-full items-center gap-2 rounded-lg p-2 text-left">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#08090a] text-[#f7f8f8]">
                <Store className="size-4" />
              </span>
              <span className="min-w-0 flex-1 grid text-left text-sm leading-tight">
                <span className="truncate font-semibold text-[#08090a]">
                  Amonen
                </span>
                <span className="truncate text-xs text-[#8a8f98]">
                  Test mode
                </span>
              </span>
              <ChevronsUpDown className="ml-auto size-4 shrink-0 text-[#8a8f98]" />
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            <nav className="h-full overflow-y-auto px-3 pb-3">
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
                      className={`group relative z-10 flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none ${
                        active
                          ? "font-semibold text-[#08090a]"
                          : "font-medium text-[#8a8f98]"
                      }`}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </nav>
          </div>

          <div className="mt-auto shrink-0 px-3 pb-4">
            <span className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[#8a8f98]">
              <Headphones className="size-4 shrink-0" />
              Support
            </span>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[#8a8f98] transition hover:bg-black/[0.04] hover:text-[#08090a]"
            >
              <Settings className="size-4 shrink-0" />
              Settings
            </button>
          </div>
        </div>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 overflow-hidden max-lg:p-0">
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 border-b border-black/6 bg-[#f7f8f8] px-4 py-3 lg:hidden">
          <BrandLogo size="sm" href="/" />
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-black/8 px-2.5 py-1.5 text-xs font-semibold text-[#6b6f76]"
          >
            <Settings className="size-3.5" />
            Settings
          </button>
        </div>

        <main className="dg-inset relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pt-16 lg:pt-0">
          <section className="relative flex min-h-0 flex-1 flex-col">
            <div className="relative z-10 h-full min-h-0 flex-1 overflow-y-auto overflow-x-visible px-5 pb-10 pt-1 lg:px-8 lg:pb-6 lg:pt-3">
              <OverviewHub
                userFullName="John Doe"
                storeName="Amonen"
                recoveredLabel="€3,891"
                openCount={6}
                openAtRiskLabel="€824"
                emailsSentLabel="53"
                recoveryRateLabel="81%"
                feesOwedLabel="€389"
                youKeepLabel="€3,502"
                openFailures={previewOpenFailures}
                recentActivity={marketingActivity}
                brandColor="#0c0c0c"
                emailIsProduction
                chartRows={previewChartRows}
                hasActivity
                displayCurrency="EUR"
                openAtRiskCents={82400}
                recoveryRatePercent={81}
                recoveredThisMonthCents={389100}
                recoveredPriorMonthCents={165500}
                webhookStatus={{
                  connected: true,
                  verified: true,
                  lastReceivedAt: Date.now() - 2 * 60 * 60 * 1000,
                  lastEventName: "subscription_payment_success",
                }}
                emailSetup={{
                  fromAddress: "Amonen <noreply@declineguard.com>",
                  isProduction: true,
                  hasApiKey: true,
                }}
                chartsReady
                onNavigate={() => undefined}
              />
            </div>
          </section>
        </main>
      </div>

      <SettingsModule
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        storeName="Amonen"
        storeSlug="amonen"
        apiKeyLast4="4242"
        testMode={false}
        webhookSetup={{
          callbackUrl: "https://api.declineguard.com/webhooks/lemon",
          serverConfigured: true,
        }}
        webhookStatus={{
          connected: true,
          storeId: "preview",
          verified: true,
          lastReceivedAt: Date.now() - 2 * 60 * 60 * 1000,
          lastEventName: "subscription_payment_success",
        }}
        feesSummary={{
          owedThisMonthCents: 38900,
          owedAllTimeCents: 38900,
          owedCount: 12,
          currency: "EUR",
          currencyMixed: false,
          plan: "free",
          recoveryFeePercent: 10,
        }}
        readOnlyNotice="Marketing preview — settings are read-only."
        emailSetup={{
          fromAddress: "Amonen <noreply@declineguard.com>",
          isProduction: true,
          replyToEmail: "hello@amonen.com",
          fromName: "Amonen",
          hasApiKey: true,
        }}
        brandColor="#c6fe1e"
        allowDisconnect={false}
        showAccount={false}
        onSaveSender={async () => undefined}
        onDisconnect={async () => undefined}
      />
    </div>
  );
}
