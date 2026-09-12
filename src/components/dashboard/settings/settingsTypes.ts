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
  webhookSetup: SettingsWebhookSetup | undefined;
  webhookStatus?: SettingsWebhookStatus | undefined;
  feesSummary?: SettingsFeesSummary | undefined;
  emailSetup: SettingsEmailSetup | undefined;
  brandColor?: string;
  onSaveSender: (fromName: string, replyToEmail: string) => Promise<void>;
  onDisconnect: (confirmStoreName: string) => Promise<void>;
  allowDisconnect?: boolean;
  readOnlyNotice?: string | null;
  showAccount?: boolean;
};
