export type SettingsTabId =
  | "general"
  | "store"
  | "webhooks"
  | "email"
  | "billing"
  | "account";

export type SettingsWebhookSetup = {
  callbackUrl: string;
  serverConfigured: boolean;
} | null;

export type SettingsWebhookStatus = {
  connected: boolean;
  storeId: string | null;
  verified: boolean;
  lastReceivedAt: number | null;
  lastEventName: string | null;
} | null;

export type SettingsFeesSummary = {
  owedThisMonthCents: number;
  owedAllTimeCents: number;
  owedCount: number;
  currency: string | null;
  currencyMixed: boolean;
  plan: "free" | "pro";
  recoveryFeePercent: number;
} | null;

export type SettingsEmailQuota = {
  plan: "free" | "pro";
  sent: number;
  included: number;
  remaining: number;
  overageEmails: number;
  overagePacks: number;
  overageUsd: number;
} | null;

export type SettingsEmailSetup = {
  fromAddress: string;
  isProduction: boolean;
  replyToEmail: string | null;
  fromName: string | null;
  hasApiKey: boolean;
} | null;

export type SettingsModuleProps = {
  open: boolean;
  onClose: () => void;
  initialTab?: SettingsTabId;
  storeName: string;
  storeSlug: string;
  apiKeyLast4: string;
  testMode: boolean;
  planTier?: string;
  planId?: "free" | "pro";
  lsSubscriptionStatus?: string | null;
  recoveryFeePercent?: number;
  webhookSetup: SettingsWebhookSetup | undefined;
  webhookStatus?: SettingsWebhookStatus | undefined;
  feesSummary?: SettingsFeesSummary | undefined;
  emailQuota?: SettingsEmailQuota | undefined;
  emailSetup: SettingsEmailSetup | undefined;
  brandColor?: string;
  onSaveSender: (fromName: string, replyToEmail: string) => Promise<void>;
  onDisconnect: (confirmStoreName: string) => Promise<void>;
  allowDisconnect?: boolean;
  readOnlyNotice?: string | null;
  showAccount?: boolean;
};
