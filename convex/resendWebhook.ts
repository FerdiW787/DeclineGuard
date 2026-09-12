import { httpAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { Webhook } from "svix";
import { internal } from "./_generated/api";

type ResendWebhookEvent = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    /** Some Resend payloads use `email_id`; older docs used nested ids. */
    id?: string;
  };
};

/**
 * Resend deliverability webhook.
 * URL: https://<deployment>.convex.site/resend
 *
 * Subscribe at least to:
 * - email.delivered
 * - email.bounced
 * - email.complained
 * - email.failed (if available)
 *
 * Env: RESEND_WEBHOOK_SECRET (Svix signing secret from Resend webhook details)
 */
export const handleResendWebhook = httpAction(
  async (ctx: ActionCtx, request: Request) => {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) {
      console.error("RESEND_WEBHOOK_SECRET is not set");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    const payload = await request.text();
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response("Missing Svix headers", { status: 400 });
    }

    const wh = new Webhook(secret);
    let event: ResendWebhookEvent;
    try {
      event = wh.verify(payload, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as ResendWebhookEvent;
    } catch {
      return new Response("Invalid signature", { status: 400 });
    }

    const type = event.type ?? "";
    const resendMessageId =
      (typeof event.data?.email_id === "string" && event.data.email_id.trim()) ||
      (typeof event.data?.id === "string" && event.data.id.trim()) ||
      "";

    if (!resendMessageId) {
      return new Response("Missing email id", { status: 200 });
    }

    const status = mapResendEventToStatus(type);
    if (!status) {
      return new Response("Ignored", { status: 200 });
    }

    const occurredAt = parseIsoMs(event.created_at ?? null);

    await ctx.runMutation(
      internal.functions.recoveries.updateEmailDeliveryStatus,
      {
        resendMessageId,
        status,
        occurredAt,
      },
    );

    return new Response("OK", { status: 200 });
  },
);

function mapResendEventToStatus(
  type: string,
): "delivered" | "bounced" | "complained" | "failed" | null {
  switch (type) {
    case "email.delivered":
      return "delivered";
    case "email.bounced":
      return "bounced";
    case "email.complained":
      return "complained";
    case "email.failed":
      return "failed";
    default:
      return null;
  }
}

function parseIsoMs(value: string | null): number {
  if (!value) return Date.now();
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : Date.now();
}
