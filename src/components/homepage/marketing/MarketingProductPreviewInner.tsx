import {
  Check,
  Mail,
  Radio,
  Shield,
  Webhook,
} from "lucide-react";
import { useMemo, useState } from "react";
import OverviewHub from "@/components/dashboard/OverviewHub";
import SequencesPage from "@/components/dashboard/SequencesPage";
import CustomizationsPage from "@/components/dashboard/CustomizationsPage";
import RecoveriesPage, {
  type RecoveriesQueueFilter,
} from "@/components/dashboard/RecoveriesPage";
import {
  marketingActivity,
  marketingActivitySimulation,
  marketingChartRows,
  marketingOpenFailures,
  marketingOverviewLabels,
  marketingRecoveredPriorMonthCents,
  marketingRecoveredThisMonthCents,
  marketingRecoveredWins,
  marketingStore,
} from "./demoData";
import type { MarketingProductTab } from "./MarketingProductPreview";
import { MarketingDesktopProvider } from "./MarketingDesktopContext";
import { useHeroStoryBeat } from "../HeroStoryContext";
import { formatStoryEuros, HERO_STORY } from "../heroStory";

type Props = {
  tab: MarketingProductTab;
  /** Sidebar / in-page nav — OverviewHub “Open failures” etc. */
  onNavigate?: (tab: MarketingProductTab) => void;
  /** Hero mock: force height-fill desktop chrome. */
  desktopPreview?: boolean;
};

function mapHubNav(
  target: string,
  onNavigate?: (tab: MarketingProductTab) => void,
) {
  if (!onNavigate) return;
  if (target === "recoveries") onNavigate("recoveries");
  else if (target === "sequences") onNavigate("sequences");
  else if (target === "customizations") onNavigate("customizations");
  else if (target === "settings") onNavigate("settings");
  else if (target === "overview") onNavigate("dashboard");
}

export function MarketingProductPreviewInner({
  tab,
  onNavigate,
  desktopPreview = false,
}: Props) {
  const beat = useHeroStoryBeat();
  const [recoveriesFilter, setRecoveriesFilter] =
    useState<RecoveriesQueueFilter>("all");
  const [recoveriesFilterKey, setRecoveriesFilterKey] = useState(0);
  const goRecoveries = (filter: RecoveriesQueueFilter = "all") => {
    setRecoveriesFilter(filter);
    setRecoveriesFilterKey((n) => n + 1);
    onNavigate?.("recoveries");
  };
  const live = useMemo(() => {
    const recoveredCents =
      beat >= 3
        ? marketingRecoveredThisMonthCents + HERO_STORY.amountCents
        : marketingRecoveredThisMonthCents;
    const openDelta = beat === 1 || beat === 2 ? 1 : 0;
    const keepCents = Math.max(0, recoveredCents - 8400);
    return {
      recoveredCents,
      recoveredLabel: formatStoryEuros(recoveredCents),
      openCount: marketingOverviewLabels.openCount + openDelta,
      youKeepLabel: formatStoryEuros(keepCents),
      kpiLive: beat >= 3,
    };
  }, [beat]);

  return (
    <MarketingDesktopProvider active={desktopPreview}>
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {tab === "dashboard" ? (
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-visible px-4 pb-4 pt-2 lg:px-5">
          <OverviewHub
            userFullName={marketingOverviewLabels.userFullName}
            storeName={marketingStore.name}
            recoveredLabel={live.recoveredLabel}
            openCount={live.openCount}
            openAtRiskLabel={marketingOverviewLabels.openAtRiskLabel}
            emailsSentLabel={marketingOverviewLabels.emailsSentLabel}
            recoveryRateLabel={marketingOverviewLabels.recoveryRateLabel}
            feesOwedLabel={marketingOverviewLabels.feesOwedLabel}
            youKeepLabel={live.youKeepLabel}
            openFailures={marketingOpenFailures}
            recentActivity={marketingActivity}
            brandColor={marketingStore.brandColor}
            emailIsProduction={true}
            chartRows={marketingChartRows}
            hasActivity
            displayCurrency={marketingStore.currency}
            openAtRiskCents={marketingOverviewLabels.openAtRiskCents}
            recoveryRatePercent={marketingOverviewLabels.recoveryRatePercent}
            recoveredThisMonthCents={live.recoveredCents}
            recoveredPriorMonthCents={marketingRecoveredPriorMonthCents}
            webhookStatus={{
              connected: true,
              verified: true,
              lastReceivedAt: Date.now() - 2 * 60 * 60 * 1000,
              lastEventName: "subscription_payment_failed",
            }}
            emailSetup={{
              fromAddress: marketingStore.fromAddressHint,
              isProduction: true,
              hasApiKey: true,
            }}
            chartsReady
            kpiLive={live.kpiLive}
            onNavigate={(target) => mapHubNav(target, onNavigate)}
          />
        </div>
      ) : null}

      {tab === "recoveries" ? (
        <RecoveriesPage
          openFailures={marketingOpenFailures}
          recentActivity={marketingActivity}
          chartRows={marketingChartRows}
          hasActivity
          openCount={marketingOverviewLabels.openCount}
          recoveryRatePercent={marketingOverviewLabels.recoveryRatePercent}
          displayCurrency={marketingStore.currency}
          activitySimulation={marketingActivitySimulation}
          recentRecoveredSimulation={marketingRecoveredWins}
          onGoToCustomizations={() => onNavigate?.("customizations")}
          initialFilter={recoveriesFilter}
          filterFocusKey={recoveriesFilterKey}
        />
      ) : null}

      {tab === "sequences" ? (
        <SequencesPage
          storeName={marketingStore.name}
          storeLogoUrl={marketingStore.logoUrl}
          brandColor={marketingStore.brandColor}
          secondaryColor={marketingStore.secondaryColor}
          templateId={marketingStore.templateId}
          emailsSentThisMonth={marketingStore.emailsSentThisMonth}
          openFailures={marketingOpenFailures}
          supportEmail={marketingStore.supportEmail}
          socialX={marketingStore.socialX}
          socialLinkedin={marketingStore.socialLinkedin}
          socialYoutube={marketingStore.socialYoutube}
          socialInstagram={marketingStore.socialInstagram}
          showDeclineGuardBadge={marketingStore.showDeclineGuardBadge}
          previewBlocked
          previewBlockedReason="Sign in to send a live preview to your inbox."
          onGoToRecoveries={(filter) => goRecoveries(filter ?? "all")}
          onGoToCustomizations={() => onNavigate?.("customizations")}
        />
      ) : null}

      {tab === "customizations" ? (
        <CustomizationsPage
          storeName={marketingStore.name}
          storeLogoUrl={marketingStore.logoUrl}
          brandColor={marketingStore.brandColor}
          secondaryColor={marketingStore.secondaryColor}
          fromName={marketingStore.fromName}
          replyToEmail={marketingStore.replyToEmail}
          supportEmail={marketingStore.supportEmail}
          socialX={marketingStore.socialX}
          socialLinkedin={marketingStore.socialLinkedin}
          socialYoutube={marketingStore.socialYoutube}
          socialInstagram={marketingStore.socialInstagram}
          emailCopy={null}
          showDeclineGuardBadge={marketingStore.showDeclineGuardBadge}
          openFailures={marketingOpenFailures}
          fromAddressHint={marketingStore.fromAddressHint}
          onGoToSequences={() => onNavigate?.("sequences")}
          onSave={async () => undefined}
        />
      ) : null}

      {tab === "settings" ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <DemoSettingsPanel />
        </div>
      ) : null}
      </div>
    </MarketingDesktopProvider>
  );
}

function DemoSettingsPanel() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pt-2">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/40">
          Settings
        </p>
        <h2 className="ln-h1 mt-2 text-3xl font-medium tracking-tight text-[#f7f8f8] md:text-4xl">
          Store & delivery
        </h2>
        <p className="mt-2 text-sm text-white/45">
          Demo preferences — sign in to change the real ones.
        </p>
      </div>

      <div className="rounded-md border border-white/10 bg-transparent">
        <DemoSettingRow
          icon={Webhook}
          label="Lemon Squeezy webhook"
          value="Connected · verified"
          ok
        />
        <DemoSettingRow
          icon={Mail}
          label="Sending domain"
          value={marketingStore.fromAddressHint}
          ok
        />
        <DemoSettingRow
          icon={Radio}
          label="Recovery sequence"
          value="3 emails · gentle → urgent"
          ok
        />
        <DemoSettingRow
          icon={Shield}
          label="Plan"
          value="Free · 10% on recoveries"
        />
      </div>

      <p className="text-[12px] text-white/35">
        This is a live preview of the product UI with sample data — not your
        store.
      </p>
    </div>
  );
}

function DemoSettingRow({
  icon: Icon,
  label,
  value,
  ok,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3.5 last:border-b-0">
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/60">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#f7f8f8]">{label}</p>
        <p className="truncate text-[12px] text-white/45">{value}</p>
      </div>
      {ok ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-semibold text-teal-300">
          <Check className="size-3" />
          OK
        </span>
      ) : null}
    </div>
  );
}
