import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { formatMoneyAmount } from "../dashboardUi";
import { BillingPortalButton } from "@/components/billing/BillingPortalButton";
import { PackCheckoutButton } from "@/components/billing/PackCheckoutButton";
import { ProCheckoutButton } from "@/components/billing/ProCheckoutButton";
import { ATTRIBUTION_WINDOW_DAYS, DECLINE_ADDON, PLANS } from "@/lib/pricing";
import {
  SettingsCard,
  SettingsRow,
  SettingsSection,
} from "./SettingsFields";
import type {
  SettingsEmailQuota,
  SettingsFeesSummary,
} from "./settingsTypes";

type BillingSnapshot = {
  plan: "free" | "pro";
  billingProvider: "lemon" | "dodo";
  hasActivePro: boolean;
  portalAvailable: boolean;
  lsSubscriptionStatus: string | null;
  dodoSubscriptionStatus: string | null;
};

export function BillingTab({
  feesSummary,
  emailQuota,
  planTier = "Free",
  recoveryFeePercent = 10,
  planId = "free",
  lsSubscriptionStatus = null,
  readOnly = false,
}: {
  feesSummary: SettingsFeesSummary | undefined;
  emailQuota?: SettingsEmailQuota | undefined;
  planTier?: string;
  recoveryFeePercent?: number;
  planId?: "free" | "pro";
  lsSubscriptionStatus?: string | null;
  readOnly?: boolean;
}) {
  const hasConvex = Boolean(import.meta.env.PUBLIC_CONVEX_URL);
  if (!readOnly && hasConvex) {
    return (
      <BillingTabConnected
        feesSummary={feesSummary}
        emailQuota={emailQuota}
        planTier={planTier}
        recoveryFeePercent={recoveryFeePercent}
        planId={planId}
        lsSubscriptionStatus={lsSubscriptionStatus}
      />
    );
  }

  return (
    <BillingTabView
      feesSummary={feesSummary}
      emailQuota={emailQuota}
      planTier={planTier}
      recoveryFeePercent={recoveryFeePercent}
      planId={planId}
      lsSubscriptionStatus={lsSubscriptionStatus}
      billing={null}
      showActions={false}
    />
  );
}

function BillingTabConnected({
  feesSummary,
  emailQuota,
  planTier,
  recoveryFeePercent,
  planId,
  lsSubscriptionStatus,
}: {
  feesSummary: SettingsFeesSummary | undefined;
  emailQuota?: SettingsEmailQuota | undefined;
  planTier: string;
  recoveryFeePercent: number;
  planId: "free" | "pro";
  lsSubscriptionStatus: string | null;
}) {
  const billing = useQuery(api.functions.billing.getMyBilling, {});
  return (
    <BillingTabView
      feesSummary={feesSummary}
      emailQuota={emailQuota}
      planTier={planTier}
      recoveryFeePercent={recoveryFeePercent}
      planId={billing?.plan ?? planId}
      lsSubscriptionStatus={
        billing?.lsSubscriptionStatus ?? lsSubscriptionStatus
      }
      billing={billing ?? null}
      showActions
    />
  );
}

function BillingTabView({
  feesSummary,
  emailQuota,
  planTier,
  recoveryFeePercent,
  planId,
  lsSubscriptionStatus,
  billing,
  showActions,
}: {
  feesSummary: SettingsFeesSummary | undefined;
  emailQuota?: SettingsEmailQuota | undefined;
  planTier: string;
  recoveryFeePercent: number;
  planId: "free" | "pro";
  lsSubscriptionStatus: string | null;
  billing: BillingSnapshot | null;
  showActions: boolean;
}) {
  const isPro = (billing?.plan ?? planId) === "pro";
  const pro = PLANS.pro;
  const feeLabel = `${recoveryFeePercent}%`;
  const provider = billing?.billingProvider;
  const subscriptionStatus = subscriptionStatusFor(billing, lsSubscriptionStatus);
  // portalAvailable is true if a Dodo customer or an LS subscription exists.
  const showPortal = showActions && billing?.portalAvailable === true;
  const showPack = showActions && provider === "dodo";

  return (
    <SettingsSection
      title="Billing"
      description={
        isPro
          ? `${planTier} plan: ${feeLabel} of recovered revenue if payment returns within ${ATTRIBUTION_WINDOW_DAYS} days of our first recovery email. Pro is $29.99/mo.`
          : `${planTier} plan: ${feeLabel} of recovered revenue if payment returns within ${ATTRIBUTION_WINDOW_DAYS} days of our first recovery email. Upgrade to Pro for ${pro.recoveryFeePercent}% fees.`
      }
    >
      <SettingsCard>
        <SettingsRow
          title="Current plan"
          description={currentPlanDescription({
            isPro,
            provider,
            subscriptionStatus,
          })}
        >
          <p className="text-[15px] font-semibold text-[#08090a]">{planTier}</p>
        </SettingsRow>
        {isPro || !showActions ? null : (
          <SettingsRow
            title="DeclineGuard Pro"
            description={`$${pro.monthlyPriceUsd}/mo · ${pro.recoveryFeePercent}% recovery fee · unlimited stores.`}
          >
            <ProCheckoutButton
              className="dg-btn dg-btn-primary !px-4 !py-2 cursor-pointer text-xs"
              label="Upgrade to Pro"
            />
          </SettingsRow>
        )}
        {showPortal ? (
          <SettingsRow
            title="Manage subscription"
            description="Update payment method or cancel Pro in the billing portal."
          >
            <BillingPortalButton />
          </SettingsRow>
        ) : null}
        {showPack ? (
          <SettingsRow
            title="Decline pack"
            description={`+${DECLINE_ADDON.extraDeclines} declines · $${DECLINE_ADDON.monthlyPriceUsd}. Stacks on your monthly bucket.`}
          >
            <PackCheckoutButton />
          </SettingsRow>
        ) : null}
      </SettingsCard>

      <SettingsCard>
        {feesSummary === undefined ? (
          <SettingsRow title="This month" description="Loading fees…" />
        ) : feesSummary === null ? (
          <SettingsRow title="This month" description="Fees unavailable." />
        ) : (
          <>
            <SettingsRow
              title="This month"
              description={
                feesSummary.currencyMixed
                  ? "Mixed currencies across recoveries."
                  : `${feeLabel} of attributed recovered revenue this calendar month.`
              }
            >
              <p className="text-[15px] font-semibold tabular-nums text-[#08090a]">
                {formatMoneyAmount(
                  feesSummary.owedThisMonthCents,
                  feesSummary.currency ?? "USD",
                )}
              </p>
            </SettingsRow>
            <SettingsRow
              title="All time"
              description={`${feesSummary.owedCount} open fee${
                feesSummary.owedCount === 1 ? "" : "s"
              }`}
            >
              <p className="text-[13px] font-medium tabular-nums text-[#6b6f76]">
                {formatMoneyAmount(
                  feesSummary.owedAllTimeCents,
                  feesSummary.currency ?? "USD",
                )}
              </p>
            </SettingsRow>
          </>
        )}
      </SettingsCard>

      <SettingsCard>
        {emailQuota === undefined ? (
          <SettingsRow
            title="Recovery emails this month"
            description="Loading quota…"
          />
        ) : emailQuota === null ? (
          <SettingsRow
            title="Recovery emails this month"
            description="Quota unavailable."
          />
        ) : (
          <SettingsRow
            title="Recovery emails this month"
            description={emailQuotaHint(emailQuota)}
          >
            <div className="w-40">
              <p className="text-right text-[15px] font-semibold tabular-nums text-[#08090a]">
                {emailQuota.sent} / {emailQuota.included}
              </p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/8">
                <div
                  className="h-full rounded-full bg-[#08090a]"
                  style={{
                    width: `${emailQuotaBarPercent(emailQuota)}%`,
                  }}
                />
              </div>
            </div>
          </SettingsRow>
        )}
      </SettingsCard>

      <SettingsCard>
        <SettingsRow
          title="You only pay after we recover"
          description={`No Day-0 email, no fee. If Lemon Squeezy retries before our first email, or the customer pays after the ${ATTRIBUTION_WINDOW_DAYS}-day window, you owe nothing.`}
        />
        <SettingsRow
          title="Pro is a monthly subscription"
          description={
            showPortal
              ? "Choosing Pro opens checkout. Cancel or past_due returns you to Free automatically. Use the billing portal to manage payment."
              : "Choosing Pro opens checkout. Cancel or past_due returns you to Free automatically."
          }
        />
        <SettingsRow
          title="Invoiced manually"
          description="Founding stores are invoiced by hand while we’re in beta. Recovery fees and email overage packs ($3) are not charged automatically yet. Sequences are never stopped mid-flight."
        />
      </SettingsCard>
    </SettingsSection>
  );
}

function providerDisplayName(
  provider: BillingSnapshot["billingProvider"],
): string {
  switch (provider) {
    case "dodo":
      return "Dodo Payments";
    case "lemon":
      return "Lemon Squeezy";
    default: {
      const _never: never = provider;
      return _never;
    }
  }
}

function subscriptionStatusFor(
  billing: BillingSnapshot | null,
  fallbackStatus: string | null,
): string | null {
  if (!billing) return fallbackStatus;
  switch (billing.billingProvider) {
    case "dodo":
      return billing.dodoSubscriptionStatus;
    case "lemon":
      return billing.lsSubscriptionStatus ?? fallbackStatus;
    default: {
      const _never: never = billing.billingProvider;
      return _never;
    }
  }
}

function currentPlanDescription({
  isPro,
  provider,
  subscriptionStatus,
}: {
  isPro: boolean;
  provider: BillingSnapshot["billingProvider"] | undefined;
  subscriptionStatus: string | null;
}): string {
  if (!isPro) return "Free until a paid Pro subscription is active.";
  if (subscriptionStatus && provider) {
    return `${providerDisplayName(provider)} subscription ${subscriptionStatus}.`;
  }
  if (subscriptionStatus) {
    return `Subscription ${subscriptionStatus}.`;
  }
  return "Pro is active. Fee rate follows this plan.";
}

function emailQuotaBarPercent(quota: NonNullable<SettingsEmailQuota>): number {
  if (quota.included <= 0) return 0;
  return Math.min(100, Math.round((quota.sent / quota.included) * 100));
}

function emailQuotaHint(quota: NonNullable<SettingsEmailQuota>): string {
  if (quota.overageEmails > 0) {
    return `${quota.overageEmails} over · ${quota.overagePacks} pack${
      quota.overagePacks === 1 ? "" : "s"
    } · $${quota.overageUsd} (invoiced manually)`;
  }
  return `${quota.remaining} remaining this month. Sequences still send if you go over.`;
}
