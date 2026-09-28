/** Read / write short-copy fields against a block document. */

import {
  deriveLegacyFromBlocks,
  escapeHtml,
  markersToPlain,
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

function copyTextBlocks(blocks: EmailBlock[]): TextBlock[] {
  return blocks.filter(
    (block): block is TextBlock =>
      block.type === "text" && !isBillingLinkText(block),
  );
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

export function shortCopyFromDocument(doc: EmailDocument): ShortCopyValues {
  const legacy = deriveLegacyFromBlocks(doc.subject, doc.blocks, doc);
  const linkRow = doc.blocks.find(
    (block): block is LinkRowBlock => block.type === "linkRow",
  );
  const billingText = doc.blocks.find(isBillingLinkText);
  return {
    subject: legacy.subject,
    headline: legacy.headline,
    body: legacy.body,
    cta: legacy.cta,
    link: linkRow?.linkLabel.trim() ||
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
  const texts = copyTextBlocks(blocks);
  const button = blocks.find((block) => block.type === "button");
  const linkRow = blocks.find(
    (block): block is LinkRowBlock => block.type === "linkRow",
  );
  const billingText = blocks.find(isBillingLinkText);

  switch (field) {
    case "headline": {
      const target = texts[0];
      if (target) target.html = value;
      break;
    }
    case "body": {
      const target = texts[1] ?? texts[0];
      if (target) target.html = value;
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

  const legacy = deriveLegacyFromBlocks(doc.subject, blocks, doc);
  return { ...doc, ...legacy, blocks };
}
