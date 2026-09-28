/** Read / write short-copy fields against a block document. */

import {
  escapeHtml,
  markersToPlain,
  resolveHeadlineBodyBlocks,
  type EmailBlock,
  type EmailDocument,
  type LinkRowBlock,
  type TextBlock,
} from "./emailBuilder";
import { PAYMENT_UPDATE_HREF } from "./emailRichText";

export type ShortCopyField =
  | "subject"
  | "headline"
  | "body"
  | "cta"
  | "link";

export type ShortCopyValues = {
  subject: string;
  headline: string;
  body: string;
  cta: string;
  link: string;
};

function isBillingLinkText(block: EmailBlock): block is TextBlock {
  return block.type === "text" && block.html.includes(PAYMENT_UPDATE_HREF);
}

function plainOf(block: TextBlock): string {
  return markersToPlain(block.html).trim();
}

function linkLabelFromHtml(html: string): string {
  const match = html.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i);
  return match?.[1] ? markersToPlain(match[1]).trim() : "";
}

function replaceAnchorLabel(html: string, label: string): string {
  const safe = escapeHtml(label.trim() || "open the billing page");
  return html.replace(/<a\b[^>]*>[\s\S]*?<\/a>/i, (anchor) =>
    anchor.replace(/>([\s\S]*?)<\/a>/i, `>${safe}</a>`),
  );
}

/**
 * Headline / body by copySlot, then by matching persisted legacy fields.
 * Never treat the first text block as headline when it is an eyebrow.
 */
export function resolveCopyTextSlots(doc: EmailDocument): {
  headline: TextBlock | undefined;
  body: TextBlock | undefined;
} {
  return resolveHeadlineBodyBlocks(doc.blocks, doc);
}

export function shortCopyFromDocument(doc: EmailDocument): ShortCopyValues {
  const slots = resolveCopyTextSlots(doc);
  const button = doc.blocks.find((block) => block.type === "button");
  const linkRow = doc.blocks.find(
    (block): block is LinkRowBlock => block.type === "linkRow",
  );
  const billingText = doc.blocks.find(isBillingLinkText);
  return {
    subject: doc.subject,
    headline: slots.headline ? plainOf(slots.headline) : doc.headline,
    body: slots.body ? plainOf(slots.body) : markersToPlain(doc.body),
    cta: button?.type === "button" ? button.label : doc.cta,
    link:
      linkRow?.linkLabel.trim() ||
      (billingText ? linkLabelFromHtml(billingText.html) : ""),
  };
}

export function applyShortCopyToDocument(
  doc: EmailDocument,
  field: ShortCopyField,
  value: string,
): EmailDocument {
  if (field === "subject") {
    return { ...doc, subject: value };
  }

  const blocks = doc.blocks.map((block) => ({ ...block })) as EmailBlock[];
  const slots = resolveCopyTextSlots({ ...doc, blocks });
  const button = blocks.find((block) => block.type === "button");
  const linkRow = blocks.find(
    (block): block is LinkRowBlock => block.type === "linkRow",
  );
  const billingText = blocks.find(isBillingLinkText);

  switch (field) {
    case "headline": {
      if (slots.headline) slots.headline.html = value;
      break;
    }
    case "body": {
      if (slots.body) slots.body.html = value;
      break;
    }
    case "cta": {
      if (button && button.type === "button") button.label = value;
      break;
    }
    case "link": {
      if (linkRow) linkRow.linkLabel = value;
      else if (billingText) {
        billingText.html = replaceAnchorLabel(billingText.html, value);
      }
      break;
    }
    default: {
      const _never: never = field;
      void _never;
    }
  }

  return {
    ...doc,
    blocks,
    headline: field === "headline" ? value : doc.headline,
    body: field === "body" ? value : doc.body,
    cta: field === "cta" ? value : doc.cta,
  };
}
