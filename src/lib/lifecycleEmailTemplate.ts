import {
  buildRecoveryEmail,
  type RecoveryEmailVars,
  type RecoveryTemplateId,
} from "../../convex/lib/recoveryEmailTemplate";
import { recoveryColorsFromTheme } from "../../convex/lib/emailTheme";
import type { LifecycleEmailType } from "./emailTheme";
import type { ResolvedEmailTheme } from "./emailTheme";

export { buildRecoveryEmail, type RecoveryEmailVars, type RecoveryTemplateId };

const LIFECYCLE_TO_TEMPLATE: Record<LifecycleEmailType, RecoveryTemplateId> = {
  verify: "gentle",
  decline_pause: "direct",
  trial_ended: "direct",
  renewal: "gentle",
  expiry: "urgent",
};

/** Leftover Jules studio helper — maps lifecycle preview onto recovery send. */
export function buildLifecycleEmail(input: {
  emailType: LifecycleEmailType;
  storeName: string;
  productName: string;
  amountLabel: string;
  customerName: string | null;
  ctaUrl: string;
  supportEmail: string | null;
  theme: ResolvedEmailTheme;
}): { subject: string; html: string; text: string } {
  const colors = recoveryColorsFromTheme(input.theme.tokens);
  return buildRecoveryEmail({
    templateId: LIFECYCLE_TO_TEMPLATE[input.emailType] ?? "gentle",
    layoutPresetId: input.theme.layoutPresetId,
    primaryColor: colors.primaryColor,
    secondaryColor: colors.secondaryColor,
    storeName: input.storeName,
    customerName: input.customerName,
    customerEmail: "preview@merchant.test",
    productName: input.productName,
    amountLabel: input.amountLabel,
    updatePaymentUrl: input.ctaUrl,
    supportEmail: input.supportEmail,
    emailFont: colors.emailFont,
    ctaBackgroundColor: colors.ctaBackgroundColor,
    ctaTextColor: colors.ctaTextColor,
    ctaBorderRadiusPx: colors.ctaBorderRadiusPx,
    emailBackgroundColor: colors.emailBackgroundColor,
    emailTextColor: colors.emailTextColor,
    pageBackgroundColor: colors.pageBackgroundColor,
    pageTextColor: colors.pageTextColor,
    linkColor: colors.linkColor,
    fontFamilyRaw: colors.fontFamilyRaw,
  });
}
