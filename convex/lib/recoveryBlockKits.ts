import type { EmailBlock } from "./emailBlocks";
import {
  normalizeLayoutPresetId,
  type LayoutPresetId,
} from "./emailTheme";

export type RecoveryKitTemplateId = "gentle" | "direct" | "urgent";

type KitCopy = {
  headline: string;
  body: string;
  cta: string;
};

const KIT_COPY: Record<RecoveryKitTemplateId, KitCopy> = {
  gentle: {
    headline: "Quick update on your subscription",
    body: "The payment of <strong>{{amount}}</strong> for <strong>{{product}}</strong> didn't go through. Update your card below — takes about a minute.",
    cta: "Update payment method",
  },
  direct: {
    headline: "Still need an updated card",
    body: "Your payment for <strong>{{product}}</strong> ({{amount}}) is still pending. Update billing so your access stays on.",
    cta: "Update billing",
  },
  urgent: {
    headline: "Last chance to keep access",
    body: "Without an updated card, <strong>{{product}}</strong> ({{amount}}) may pause soon. Fix payment now to stay uninterrupted.",
    cta: "Fix payment now",
  },
};

function textBlock(
  id: string,
  html: string,
  fontSize: number,
  opts?: {
    color?: "default" | "muted" | "link";
    align?: "left" | "center" | "right";
    bold?: boolean;
    marginTop?: number;
    marginBottom?: number;
  },
): EmailBlock {
  return {
    id,
    type: "text",
    html,
    fontSize,
    color: opts?.color ?? "default",
    align: opts?.align ?? "left",
    bold: opts?.bold,
    marginTop: opts?.marginTop ?? 0,
    marginBottom: opts?.marginBottom ?? 16,
  };
}

function buttonBlock(id: string, label: string, align: "left" | "center" = "left"): EmailBlock {
  return {
    id,
    type: "button",
    label,
    backgroundColor: "",
    align,
    marginTop: 8,
    marginBottom: 16,
  };
}

/**
 * Starter block kits for the five RGE templates.
 * Same block structure across Day 0 / 2 / 5; copy/step labels change.
 */
export function starterBlocksForKit(
  layoutPresetId: string | null | undefined,
  templateId: RecoveryKitTemplateId,
): EmailBlock[] {
  const kit = normalizeLayoutPresetId(layoutPresetId);
  const copy = KIT_COPY[templateId] ?? KIT_COPY.gentle;
  switch (kit) {
    case "sonos":
      return [
        textBlock("sonos-headline", copy.headline, 22, {
          bold: true,
          marginBottom: 12,
        }),
        textBlock("sonos-body", copy.body, 16, { color: "muted" }),
        buttonBlock("sonos-cta", copy.cta),
      ];
    case "avocode":
      return [
        textBlock("avocode-eyebrow", "Payment needs an update", 12, {
          color: "muted",
          marginBottom: 8,
        }),
        textBlock("avocode-headline", copy.headline, 20, { bold: true }),
        textBlock("avocode-body", copy.body, 15, { color: "muted" }),
        buttonBlock("avocode-cta", copy.cta),
      ];
    case "benchmark":
      return [
        textBlock("benchmark-body", copy.body, 16, { color: "muted" }),
        buttonBlock("benchmark-cta", copy.cta),
        textBlock("benchmark-howto", "How to update a card", 15, {
          bold: true,
          marginTop: 20,
        }),
        textBlock(
          "benchmark-steps",
          "1. Open billing from the button above<br />2. Enter the new card and save<br />3. We’ll retry the payment for you",
          14,
          { color: "muted" },
        ),
      ];
    case "fontbase":
      return [
        textBlock("fontbase-headline", copy.headline, 24, {
          bold: true,
          align: "center",
        }),
        textBlock("fontbase-body", copy.body, 15, {
          color: "muted",
          align: "center",
        }),
        textBlock(
          "fontbase-note",
          "You can always update billing from the dashboard.",
          14,
          { color: "muted", align: "center" },
        ),
        {
          id: "fontbase-rule",
          type: "divider",
          marginTop: 8,
          marginBottom: 16,
        },
        buttonBlock("fontbase-cta", copy.cta, "center"),
      ];
    case "nordvpn-structure":
      return [
        textBlock(
          "nordvpn-structure-status",
          templateId === "gentle"
            ? "Day 0"
            : templateId === "direct"
              ? "Day 2"
              : "Day 5",
          13,
          { color: "muted" },
        ),
        textBlock("nordvpn-structure-headline", copy.headline, 22, {
          bold: true,
        }),
        textBlock("nordvpn-structure-body", copy.body, 16),
        buttonBlock("nordvpn-structure-cta", copy.cta),
      ];
    default: {
      const _exhaustive: never = kit;
      return _exhaustive;
    }
  }
}

export function kitVisibleFingerprint(kit: LayoutPresetId): string {
  switch (kit) {
    case "sonos":
      return "Quick update on your subscription";
    case "avocode":
      return "Payment needs an update";
    case "benchmark":
      return "How to update a card";
    case "fontbase":
      return "You can always update billing from the dashboard.";
    case "nordvpn-structure":
      return "Day 0";
    default: {
      const _exhaustive: never = kit;
      return _exhaustive;
    }
  }
}
