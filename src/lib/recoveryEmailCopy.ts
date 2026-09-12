/** Editable recovery email copy — keep in sync with convex/lib/recoveryEmailTemplate.ts */

import {
  DEFAULT_EMAIL_PADDING,
  DEFAULT_LINK_COLOR,
  cloneBlocks,
  defaultEmailDocument,
  documentEquals,
  resolveEmailDocument,
  type EmailBlock,
  type EmailDocument,
} from "./emailBuilder";

export type RecoveryTemplateId = "gentle" | "direct" | "urgent";

export type EditableEmailCopy = {
  subject: string;
  headline: string;
  body: string;
  cta: string;
  blocks?: EmailBlock[];
  linkColor?: string;
  emailPadding?: number;
};

export type EmailCopyOverrides = Partial<
  Record<RecoveryTemplateId, Partial<EditableEmailCopy>>
>;

export type { EmailBlock, EmailDocument };

export const TEMPLATE_META: Record<
  RecoveryTemplateId,
  { label: string; day: string; when: string }
> = {
  gentle: {
    label: "Gentle",
    day: "Day 0",
    when: "After 2nd failed attempt",
  },
  direct: {
    label: "Direct",
    day: "Day 2",
    when: "2 days later",
  },
  urgent: {
    label: "Urgent",
    day: "Day 5",
    when: "5 days after failure",
  },
};

export const DEFAULT_EMAIL_COPY: Record<RecoveryTemplateId, EditableEmailCopy> =
  {
    gentle: {
      subject: "Your payment for {{product}} didn’t go through",
      headline: "Quick update on your subscription",
      body: "The payment of {{amount}} for {{product}} didn't go through. Update your card below — takes about a minute.",
      cta: "Update payment method",
    },
    direct: {
      subject: "2nd notice: payment still needed for {{product}}",
      headline: "Still need an updated card",
      body: "Your payment for {{product}} ({{amount}}) is still pending. Update billing so your access stays on.",
      cta: "Update billing",
    },
    urgent: {
      subject: "Final notice: need updated billing for {{product}}",
      headline: "Last chance to keep access",
      body: "Without an updated card, {{product}} ({{amount}}) may pause soon. Fix payment now to stay uninterrupted.",
      cta: "Fix payment now",
    },
  };

export const COPY_TOKENS = [
  { token: "{{product}}", label: "Product" },
  { token: "{{amount}}", label: "Amount" },
  { token: "{{first_name}}", label: "First name" },
] as const;

export function resolveEmailCopy(
  templateId: RecoveryTemplateId,
  overrides?: EmailCopyOverrides | null,
): EditableEmailCopy {
  const doc = resolveEmailDocument(templateId, overrides?.[templateId]);
  return {
    subject: doc.subject,
    headline: doc.headline,
    body: doc.body,
    cta: doc.cta,
    blocks: doc.blocks,
    linkColor: doc.linkColor,
    emailPadding: doc.emailPadding,
  };
}

export function resolveFullEmailDocument(
  templateId: RecoveryTemplateId,
  overrides?: EmailCopyOverrides | null,
): EmailDocument {
  return resolveEmailDocument(templateId, overrides?.[templateId]);
}

export function emailDocumentsFromSettings(
  overrides?: EmailCopyOverrides | null,
): Record<RecoveryTemplateId, EmailDocument> {
  return {
    gentle: resolveFullEmailDocument("gentle", overrides),
    direct: resolveFullEmailDocument("direct", overrides),
    urgent: resolveFullEmailDocument("urgent", overrides),
  };
}

export function applyCopyVars(
  text: string,
  vars: { product: string; amount: string; firstName?: string },
): string {
  return text
    .replace(/\{\{product\}\}/g, vars.product)
    .replace(/\{\{amount\}\}/g, vars.amount)
    .replace(/\{\{first_name\}\}/g, vars.firstName?.trim() || "there");
}

export function copyEquals(
  a: EditableEmailCopy,
  b: EditableEmailCopy,
): boolean {
  const docA = toComparableDoc(a);
  const docB = toComparableDoc(b);
  return documentEquals(docA, docB);
}

function toComparableDoc(copy: EditableEmailCopy): EmailDocument {
  return {
    subject: copy.subject,
    headline: copy.headline,
    body: copy.body,
    cta: copy.cta,
    blocks: copy.blocks ? cloneBlocks(copy.blocks) : [],
    linkColor: copy.linkColor ?? DEFAULT_LINK_COLOR,
    emailPadding: copy.emailPadding ?? DEFAULT_EMAIL_PADDING,
  };
}

export function defaultDocuments(): Record<RecoveryTemplateId, EmailDocument> {
  return {
    gentle: defaultEmailDocument("gentle"),
    direct: defaultEmailDocument("direct"),
    urgent: defaultEmailDocument("urgent"),
  };
}
