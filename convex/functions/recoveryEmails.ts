"use node";

import { v } from "convex/values";
import { internalAction, type ActionCtx } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  buildRecoveryEmail,
  type RecoveryTemplateId,
} from "../lib/recoveryEmailTemplate";
import { resolveFromAddress } from "../lib/recoveryEmailFrom";
import { safePaymentUpdateUrl } from "../lib/safeUrl";

const sequenceStepValidator = v.union(
  v.literal("day0"),
  v.literal("day2"),
  v.literal("day5"),
);

type SequenceStep = "day0" | "day2" | "day5";

const STEP_TEMPLATE: Record<SequenceStep, RecoveryTemplateId> = {
  day0: "gentle",
  day2: "direct",
  day5: "urgent",
};

const STEP_LABEL: Record<SequenceStep, string> = {
  day0: "Email 1 · Day 0",
  day2: "Email 2 · Day 2",
  day5: "Email 3 · Day 5",
};

/**
 * Day-0 entry point (from webhook). Follow-ups scheduled in recordEmailSent.
 * Env:
 * - RESEND_API_KEY (required)
 * - RESEND_FROM_EMAIL (optional; verified domain for production)
 * - RECOVERY_SEQUENCE_FAST=1 → Email2 +60s, Email3 +60s after Email2 (dev only)
 */
export const sendForFailure = internalAction({
  args: { failureId: v.id("failedPayments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runSequenceStep(ctx, args.failureId, "day0");
    return null;
  },
});

/** Scheduled follow-ups (Day 2 / Day 5) */
export const sendSequenceStep = internalAction({
  args: {
    failureId: v.id("failedPayments"),
    step: sequenceStepValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runSequenceStep(ctx, args.failureId, args.step);
    return null;
  },
});

/**
 * Send push email for unpaid subscription (direct/urgent, NOT gentle).
 * Called when subscription_updated reports unpaid status.
 * Sends the next unsent push step: day2 (direct) or day5 (urgent).
 * Skips day0/gentle entirely — unpaid needs aggressive tone.
 */
export const sendPushForUnpaid = internalAction({
  args: { failureId: v.id("failedPayments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payload = await ctx.runQuery(
      internal.functions.recoveries.getFailureEmailPayload,
      { failureId: args.failureId },
    );
    if (!payload || payload.status !== "open") return null;

    // Determine which push step to send (skip gentle, go direct or urgent)
    // If day2 not sent → send day2 (direct)
    // If day2 sent but not day5 → send day5 (urgent)
    // If all sent → nothing to do
    let step: SequenceStep;
    if (payload.day2SentAt == null) {
      step = "day2";
    } else if (payload.day5SentAt == null) {
      step = "day5";
    } else {
      // All push steps already sent
      return null;
    }

    await runSequenceStep(ctx, args.failureId, step);

    // After sending day2 push, re-schedule day5 so Email 3 can fire
    // (unpaid cancelled day5JobId before calling us)
    if (step === "day2") {
      await ctx.runMutation(
        internal.functions.recoveries.scheduleDay5AfterPush,
        { failureId: args.failureId },
      );
    }

    return null;
  },
});

async function runSequenceStep(
  ctx: ActionCtx,
  failureId: Id<"failedPayments">,
  step: SequenceStep,
) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      "RESEND_API_KEY not set — skipping recovery email. Set with: npx convex env set RESEND_API_KEY re_...",
    );
    return;
  }

  const payload = await ctx.runQuery(
    internal.functions.recoveries.getFailureEmailPayload,
    { failureId },
  );
  if (!payload) {
    console.warn("Failure not found for email", failureId);
    return;
  }

  if (payload.status !== "open") {
    return;
  }

  // Check recovery action — stop means no more emails
  if (payload.recoveryAction === "stop") {
    return;
  }

  // wait action means don't send yet (attempt 1 — let LS handle initial notification)
  // IMPORTANT: null/undefined also treated as wait (fail closed, don't send)
  if (payload.recoveryAction === "wait" || payload.recoveryAction == null) {
    return;
  }

  // Per-step idempotency — don't restart Day 0 for same open failure
  // even if a new invoice arrives (Denis C: prevent restart on new invoice)
  if (step === "day0" && payload.day0SentAt != null) {
    await ctx.runMutation(
      internal.functions.recoveries.ensureSequenceScheduled,
      { failureId },
    );
    return;
  }
  if (step === "day2" && payload.day2SentAt != null) {
    await ctx.runMutation(
      internal.functions.recoveries.ensureSequenceScheduled,
      { failureId },
    );
    return;
  }
  if (step === "day5" && payload.day5SentAt != null) return;

  const settings = await ctx.runQuery(
    internal.functions.recoverySettings.getSettingsForUser,
    { userId: payload.userId },
  );

  if (!settings?.brandImportCompletedAt) {
    console.warn(
      "Skipping recovery email — brand import not completed for user",
      payload.userId,
    );
    return;
  }

  // Fetch fresh update-PM URL from Lemon Squeezy API
  // Also check subscription status — stop if cancelled/expired
  let updatePaymentUrl = payload.updatePaymentUrl;
  try {
    const freshData = await ctx.runAction(
      internal.functions.lemonSqueezyActions.fetchFreshSubscriptionUrl,
      {
        connectionId: payload.connectionId,
        subscriptionId: payload.subscriptionId,
      },
    );

    // Honor fresh subscription status — stop if cancelled/expired
    // Must patch recoveryAction to stop AND cancel scheduled jobs
    const freshStatus = freshData?.subscriptionStatus;
    if (freshStatus === "cancelled" || freshStatus === "expired") {
      console.log(
        `Stopping sequence — subscription ${payload.subscriptionId} is ${freshStatus}`,
      );
      // Patch to stop and cancel jobs (not just return)
      await ctx.runMutation(
        internal.functions.recoveries.stopSequenceOnLifecycleEnd,
        { failureId, status: freshStatus },
      );
      return;
    }

    if (freshData?.updatePaymentMethodUrl) {
      updatePaymentUrl = freshData.updatePaymentMethodUrl;
    } else if (freshData?.customerPortalUrl) {
      updatePaymentUrl = freshData.customerPortalUrl;
    }
  } catch (err) {
    console.warn("Failed to fetch fresh subscription URL, using cached:", err);
  }

  // Final fallback to safeUrl
  const finalUpdatePaymentUrl = safePaymentUpdateUrl(updatePaymentUrl);

  const templateId = STEP_TEMPLATE[step];
  const primaryColor = settings?.brandColor ?? "#0c0c0c";
  const secondaryColor = settings?.secondaryColor ?? "#6b6b70";
  const amountLabel = formatMoney(payload.amountCents, payload.currency);

  const replyTo = settings?.replyToEmail?.trim() || undefined;
  const supportEmail =
    settings?.supportEmail?.trim() || replyTo || undefined;

  const showDeclineGuardBadge = true;

  const email = buildRecoveryEmail({
    templateId,
    primaryColor,
    secondaryColor,
    storeName: payload.storeName,
    storeLogoUrl: payload.storeAvatarUrl,
    customerName: payload.customerName,
    customerEmail: payload.customerEmail,
    productName: payload.productName?.trim() || "your subscription",
    amountLabel,
    updatePaymentUrl: finalUpdatePaymentUrl,
    supportEmail: supportEmail ?? null,
    socials: {
      x: settings?.socialX,
      linkedin: settings?.socialLinkedin,
      youtube: settings?.socialYoutube,
      instagram: settings?.socialInstagram,
    },
    showDeclineGuardBadge,
    copyOverrides: settings?.emailCopy ?? null,
    emailFont: settings?.emailFont,
    ctaBackgroundColor: settings?.ctaBackgroundColor,
    ctaTextColor: settings?.ctaTextColor,
    ctaBorderRadiusPx: settings?.ctaBorderRadiusPx,
    emailBackgroundColor:
      settings?.pageBackgroundColor ?? settings?.emailBackgroundColor,
    emailTextColor: settings?.pageTextColor ?? settings?.emailTextColor,
    linkColor: settings?.linkColor,
    fontFamilyRaw: settings?.fontFamilyRaw,
  });

  const displayName =
    settings?.fromName?.trim() || payload.storeName || "DeclineGuard";
  const from = resolveFromAddress(displayName);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [payload.customerEmail],
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Resend error", res.status, errText);
    return;
  }

  let resendMessageId: string | undefined;
  try {
    const body = (await res.json()) as { id?: unknown };
    if (typeof body.id === "string" && body.id.trim()) {
      resendMessageId = body.id.trim();
    }
  } catch {
    console.warn("Resend response missing message id", failureId);
  }

  // Records send + schedules next step(s) atomically (see recoveries.recordEmailSent)
  await ctx.runMutation(internal.functions.recoveries.recordEmailSent, {
    failureId,
    invoiceId: payload.subscriptionInvoiceId,
    subject: email.subject,
    step,
    stepLabel: STEP_LABEL[step],
    resendMessageId,
  });
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}
