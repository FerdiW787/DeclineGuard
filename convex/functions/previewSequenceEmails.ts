"use node";

import { v } from "convex/values";
import { internalAction, type ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  buildRecoveryEmail,
  type RecoveryTemplateId,
} from "../lib/recoveryEmailTemplate";
import { resolveFromAddress } from "../lib/recoveryEmailFrom";

const previewStepValidator = v.union(
  v.literal("step1"),
  v.literal("step2"),
  v.literal("step3"),
);

type PreviewStep = "step1" | "step2" | "step3";

const STEP_TEMPLATE: Record<PreviewStep, RecoveryTemplateId> = {
  step1: "gentle",
  step2: "direct",
  step3: "urgent",
};

/** Sample customer matching the Sequences UI mock — never a real customer. */
const PREVIEW_SAMPLE = {
  customerName: "Maya",
  productName: "Pro Monthly",
  amountCents: 2900,
  currency: "EUR",
  updatePaymentUrl: "https://app.lemonsqueezy.com/my-orders",
} as const;

/**
 * Sends one preview email. Chained at +30s via previewSequence.recordStepSent.
 * Recipient is always the merchant account email stored on the preview row.
 */
export const sendStep = internalAction({
  args: {
    previewId: v.id("previewSequences"),
    step: previewStepValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runPreviewStep(ctx, args.previewId, args.step);
    return null;
  },
});

async function runPreviewStep(
  ctx: ActionCtx,
  previewId: Id<"previewSequences">,
  step: PreviewStep,
) {
  const claim = await ctx.runMutation(
    internal.functions.previewSequence.claimStep,
    { previewId, step },
  );
  if (claim === "abort" || claim === "skip") return;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    await ctx.runMutation(internal.functions.previewSequence.markFailed, {
      previewId,
      error: "RESEND_API_KEY is not configured",
    });
    return;
  }

  const payload = await ctx.runQuery(
    internal.functions.previewSequence.getPayload,
    { previewId },
  );
  if (!payload || payload.status !== "running" || !payload.accountActive) {
    if (payload?.status === "running") {
      await ctx.runMutation(internal.functions.previewSequence.markFailed, {
        previewId,
        error: "Account no longer active",
      });
    }
    return;
  }

  const settings = await ctx.runQuery(
    internal.functions.recoverySettings.getSettingsForUser,
    { userId: payload.userId },
  );

  const templateId = STEP_TEMPLATE[step];
  const primaryColor = settings?.brandColor ?? "#0c0c0c";
  const secondaryColor = settings?.secondaryColor ?? "#6b6b70";
  const amountLabel = formatMoney(
    PREVIEW_SAMPLE.amountCents,
    PREVIEW_SAMPLE.currency,
  );

  const supportEmail =
    settings?.supportEmail?.trim() ||
    settings?.replyToEmail?.trim() ||
    undefined;

  const email = buildRecoveryEmail({
    templateId,
    primaryColor,
    secondaryColor,
    storeName: payload.storeName,
    storeLogoUrl: payload.storeAvatarUrl,
    customerName: PREVIEW_SAMPLE.customerName,
    customerEmail: payload.toEmail,
    productName: PREVIEW_SAMPLE.productName,
    amountLabel,
    updatePaymentUrl: PREVIEW_SAMPLE.updatePaymentUrl,
    supportEmail: supportEmail ?? null,
    socials: {
      x: settings?.socialX,
      linkedin: settings?.socialLinkedin,
      youtube: settings?.socialYoutube,
      instagram: settings?.socialInstagram,
    },
    showDeclineGuardBadge: true,
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

  // Idempotency key + claim-before-send: retries reuse the same Resend send.
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `dg-preview-${previewId}-${step}`,
    },
    body: JSON.stringify({
      from,
      to: [payload.toEmail],
      // No reply_to on previews — avoids merchant reply-to phishing via this path.
      subject: `[Preview] ${email.subject}`,
      html: email.html,
      text: `[This is a DeclineGuard preview — sample customer data only.]\n\n${email.text}`,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Preview Resend error", res.status, errText);
    await ctx.runMutation(internal.functions.previewSequence.markFailed, {
      previewId,
      error: `Email send failed (${res.status}). If you use the Resend test sender, deliver only to your Resend account email.`,
    });
    return;
  }

  // Re-check cancel race after network I/O.
  const still = await ctx.runQuery(
    internal.functions.previewSequence.getPayload,
    { previewId },
  );
  if (!still || still.status !== "running") return;

  await ctx.runMutation(internal.functions.previewSequence.recordStepSent, {
    previewId,
    step,
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
