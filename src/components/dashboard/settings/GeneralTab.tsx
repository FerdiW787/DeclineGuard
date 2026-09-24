import {
  SettingsCard,
  SettingsRow,
  SettingsSection,
} from "./SettingsFields";

export function GeneralTab({
  storeName,
  storeSlug,
  testMode,
  planTier,
}: {
  storeName: string;
  storeSlug: string;
  testMode: boolean;
  planTier: string;
}) {
  return (
    <SettingsSection
      title="General"
      description="Your connected store at a glance."
    >
      <SettingsCard>
        <SettingsRow title="Store" description={storeSlug}>
          <p className="text-[13px] font-medium text-[#08090a]">{storeName}</p>
        </SettingsRow>
        <SettingsRow
          title="Mode"
          description="Lemon Squeezy environment for this connection."
        >
          <span className="rounded-full bg-black/[0.04] px-2.5 py-1 text-[12px] font-semibold text-[#6b6f76]">
            {testMode ? "Test" : "Live"}
          </span>
        </SettingsRow>
        <SettingsRow
          title="Plan"
          description="Set by your Lemon Squeezy Pro subscription. Staff can override with audit."
        >
          <span className="text-[13px] font-medium text-[#08090a]">
            {planTier}
          </span>
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  );
}
