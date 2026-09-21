import { formatMoneyAmount } from "../dashboardUi";
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
}: {
  feesSummary: SettingsFeesSummary | undefined;
  planName?: string;
  recoveryFeePercent?: number;
}) {
  return (
    <SettingsSection
      title="Billing"
      description={`${planName} plan: ${recoveryFeePercent}% of recovered revenue. Founding stores are invoiced manually — nothing is charged automatically yet.`}
    >
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
          title="No card on file"
          description="No monthly subscription. Founding stores are invoiced manually while we’re in beta."
        />
      </SettingsCard>
    </SettingsSection>
  );
}
