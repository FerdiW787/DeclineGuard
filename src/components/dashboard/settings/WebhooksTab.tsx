import { CheckCircle2, ExternalLink } from "lucide-react";
import { formatRelativeTime } from "../dashboardUi";
import {
  CopyField,
  SettingsCard,
  SettingsRow,
  SettingsSection,
} from "./SettingsFields";
import type {
  SettingsWebhookSetup,
  SettingsWebhookStatus,
} from "./settingsTypes";

export function WebhooksTab({
  webhookSetup,
  webhookStatus,
}: {
  webhookSetup: SettingsWebhookSetup | undefined;
  webhookStatus: SettingsWebhookStatus | undefined;
}) {
  const resendUrl = webhookSetup?.callbackUrl
    ? webhookSetup.callbackUrl.replace(/\/lemonsqueezy\/?$/, "/resend")
    : null;

  return (
    <SettingsSection
      title="Webhooks"
      description="Lemon Squeezy and Resend endpoints. Signing secrets stay on the server."
    >
      {webhookSetup === undefined ? (
        <p className="text-sm text-[#8a8f98]">Loading webhook details…</p>
      ) : webhookSetup === null ? (
        <p className="text-sm text-[#8a8f98]">
          Webhook details unavailable. Confirm{" "}
          <code className="rounded bg-black/5 px-1.5 py-0.5 text-[12px]">
            CONVEX_SITE_URL
          </code>{" "}
          is set on Convex.
        </p>
      ) : (
        <SettingsCard>
          <CopyField label="Lemon Squeezy callback" value={webhookSetup.callbackUrl} />
          <SettingsRow
            title="Signing secret"
            description={
              webhookSetup.serverConfigured
                ? "Configured on the server and never shown here."
                : "Set LEMONSQUEEZY_WEBHOOK_SECRET on Convex before installing."
            }
          />
          <SettingsRow title="Health" description={healthDetail(webhookStatus)}>
            <HealthBadge status={webhookStatus} />
          </SettingsRow>
          <div className="space-y-2.5 px-4 py-3.5">
            <p className="text-[13px] font-medium text-[#08090a]">
              Subscribe to these events
            </p>
            <ul className="space-y-2 text-[13px] text-[#6b6f76]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                <code className="text-[12px]">subscription_payment_failed</code>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                <code className="text-[12px]">
                  subscription_payment_recovered
                </code>
              </li>
            </ul>
            <a
              href="https://app.lemonsqueezy.com/settings/webhooks"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#08090a] underline-offset-2 hover:underline"
            >
              Open Lemon Squeezy webhooks
              <ExternalLink className="size-3.5" />
            </a>
          </div>
          {resendUrl ? (
            <CopyField label="Resend callback" value={resendUrl} />
          ) : null}
        </SettingsCard>
      )}
    </SettingsSection>
  );
}

function HealthBadge({
  status,
}: {
  status: SettingsWebhookStatus | undefined;
}) {
  if (status === undefined) {
    return <span className="text-[12px] text-[#8a8f98]">Checking…</span>;
  }
  if (status?.verified && status.lastReceivedAt != null) {
    return (
      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-800">
        Healthy
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-semibold text-amber-800">
      Waiting
    </span>
  );
}

function healthDetail(status: SettingsWebhookStatus | undefined): string {
  if (status === undefined) return "Checking deliveries…";
  if (status?.verified && status.lastReceivedAt != null) {
    return `Last event ${status.lastEventName ?? "unknown"} ${formatRelativeTime(
      status.lastReceivedAt,
      Date.now(),
    )}`;
  }
  return "No events yet. Install the webhook or send a test ping.";
}
