import { formatMoneyAmount } from "../dashboardUi";
import { ProCheckoutButton } from "@/components/billing/ProCheckoutButton";
import { PLANS } from "@/lib/pricing";
import {
  SettingsCard,
  SettingsRow,
  SettingsSection,
} from "./SettingsFields";
import type { SettingsFeesSummary } from "./settingsTypes";

export function BillingTab({
  feesSummary,
  planName = "Free",
  recoveryFeePercent = 10,
  planId = "free",
  lsSubscriptionStatus = null,
}: {
  feesSummary: SettingsFeesSummary | undefined;
  planName?: string;
  recoveryFeePercent?: number;
  planId?: "free" | "pro";
  lsSubscriptionStatus?: string | null;
}) {
  const isPro = planId === "pro";
  const pro = PLANS.pro;

  return (
    <SettingsSection
      title="Billing"
      description={
        isPro
          ? `${planName} plan: ${recoveryFeePercent}% of recovered revenue. Pro is $29.99/mo via Lemon Squeezy.`
          : `${planName} plan: ${recoveryFeePercent}% of recovered revenue. Upgrade to Pro for ${pro.recoveryFeePercent}% fees.`
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
          <p className="text-[15px] font-semibold text-[#08090a]">{planName}</p>
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
                  : `${recoveryFeePercent}% of recovered revenue this calendar month.`
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
        <SettingsRow
          title="You only pay after we recover"
          description="No recovery sequence start, no fee. If Lemon Squeezy retries before our first email, you owe nothing."
        />
        <SettingsRow
          title="Pro is a Lemon Squeezy subscription"
          description="Choosing Pro opens checkout. Cancel or past_due returns you to Free automatically."
        />
      </SettingsCard>
    </SettingsSection>
  );
}
