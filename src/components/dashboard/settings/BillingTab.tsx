import { formatMoneyAmount } from "../dashboardUi";
import { ProCheckoutButton } from "@/components/billing/ProCheckoutButton";
import { PLANS } from "@/lib/pricing";
import {
  SettingsCard,
  SettingsRow,
  SettingsSection,
} from "./SettingsFields";
import type {
  SettingsEmailQuota,
  SettingsFeesSummary,
} from "./settingsTypes";
import { ATTRIBUTION_WINDOW_DAYS } from "@/lib/pricing";

export function BillingTab({
  feesSummary,
  emailQuota,
  planTier = "Free",
  recoveryFeePercent = 10,
  planId = "free",
  lsSubscriptionStatus = null,
}: {
  feesSummary: SettingsFeesSummary | undefined;
  emailQuota?: SettingsEmailQuota | undefined;
  planTier?: string;
  recoveryFeePercent?: number;
  planId?: "free" | "pro";
  lsSubscriptionStatus?: string | null;
}) {
  const isPro = planId === "pro";
  const pro = PLANS.pro;
  const feeLabel = `${recoveryFeePercent}%`;

  return (
    <SettingsSection
      title="Billing"
      description={
        isPro
          ? `${planTier} plan: ${feeLabel} of recovered revenue if payment returns within ${ATTRIBUTION_WINDOW_DAYS} days of our first recovery email. Pro is $29.99/mo via Lemon Squeezy.`
          : `${planTier} plan: ${feeLabel} of recovered revenue if payment returns within ${ATTRIBUTION_WINDOW_DAYS} days of our first recovery email. Upgrade to Pro for ${pro.recoveryFeePercent}% fees.`
      }
    >
      <SettingsCard>
        <SettingsRow
          title="Current plan"
          description={
            isPro
              ? lsSubscriptionStatus
                ? `Lemon Squeezy subscription ${lsSubscriptionStatus}.`
                : "Pro is active. Fee rate follows this plan."
              : "Free until a paid Pro subscription is active."
          }
        >
          <p className="text-[15px] font-semibold text-[#08090a]">{planTier}</p>
        </SettingsRow>
        {isPro ? null : (
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
          title="Pro is a Lemon Squeezy subscription"
          description="Choosing Pro opens checkout. Cancel or past_due returns you to Free automatically."
        />
        <SettingsRow
          title="Invoiced manually"
          description="Founding stores are invoiced by hand while we’re in beta. Recovery fees and email overage packs ($3) are not charged automatically yet. Sequences are never stopped mid-flight."
        />
      </SettingsCard>
    </SettingsSection>
  );
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
