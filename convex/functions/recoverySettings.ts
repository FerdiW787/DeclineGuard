import { v } from "convex/values";
import {
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import {
  isProductionFromAddress,
  resolveFromAddress,
} from "../lib/recoveryEmailFrom";
import {
  requireActiveUser,
  requireActiveUserForWrite,
  isSoftDeleted,
  resolveProductUserOrNull,
} from "../lib/accountGuard";
import { emailCopyValidator } from "../lib/emailBlockValidators";
import {
  DEFAULT_EMAIL_FONT,
  emailFontValidator,
  normalizeEmailFont,
} from "../lib/emailFonts";
import { validateDomainInput } from "../lib/brandImport/domain";
import {
  evaluateBrandImportQuota,
  type BrandImportQuota,
} from "../lib/brandImport/brandKit";
import { requireStaff } from "../lib/admin";
import { consumeRateLimit } from "../lib/rateLimit";
import { assertStorageOwnedByUser } from "../lib/storageOwnership";

const templateIdValidator = v.union(
  v.literal("gentle"),
  v.literal("direct"),
  v.literal("urgent"),
);

const brandCaptureMethodValidator = v.union(
  v.literal("browser"),
  v.literal("css"),
  v.literal("defaults"),
);

const settingsValidator = v.object({
  brandColor: v.string(),
  secondaryColor: v.string(),
  templateId: templateIdValidator,
  fromName: v.union(v.string(), v.null()),
  replyToEmail: v.union(v.string(), v.null()),
  supportEmail: v.union(v.string(), v.null()),
  socialX: v.union(v.string(), v.null()),
  socialLinkedin: v.union(v.string(), v.null()),
  socialYoutube: v.union(v.string(), v.null()),
  socialInstagram: v.union(v.string(), v.null()),
  emailCopy: v.union(emailCopyValidator, v.null()),
  emailFont: emailFontValidator,
  brandDomain: v.union(v.string(), v.null()),
  brandImportCompletedAt: v.union(v.number(), v.null()),
  ctaBackgroundColor: v.union(v.string(), v.null()),
  ctaTextColor: v.union(v.string(), v.null()),
  ctaBorderRadiusPx: v.union(v.number(), v.null()),
  emailBackgroundColor: v.union(v.string(), v.null()),
  emailTextColor: v.union(v.string(), v.null()),
  pageBackgroundColor: v.union(v.string(), v.null()),
  pageTextColor: v.union(v.string(), v.null()),
  mutedTextColor: v.union(v.string(), v.null()),
  linkColor: v.union(v.string(), v.null()),
  fontFamilyRaw: v.union(v.string(), v.null()),
  brandCaptureMethod: v.union(brandCaptureMethodValidator, v.null()),
  lastBrandImportAt: v.union(v.number(), v.null()),
  brandImportBonusCredits: v.number(),
  updatedAt: v.number(),
});

const brandImportQuotaValidator = v.object({
  canImport: v.boolean(),
  reason: v.union(
    v.literal("ok_first"),
    v.literal("ok_cooldown"),
    v.literal("ok_bonus"),
    v.literal("ok_unlimited"),
    v.literal("blocked_cooldown"),
  ),
  lastBrandImportAt: v.union(v.number(), v.null()),
  brandImportBonusCredits: v.number(),
  nextImportAt: v.union(v.number(), v.null()),
  brandImportCompletedAt: v.union(v.number(), v.null()),
});

async function requireUser(
  ctx: MutationCtx | QueryCtx,
): Promise<Doc<"users">> {
  return await requireActiveUser(ctx);
}

async function requireWriteUser(
  ctx: MutationCtx,
  writeKind: string,
): Promise<Doc<"users">> {
  return await requireActiveUserForWrite(ctx, writeKind);
}

function normalizeEmail(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new Error("Must be a valid email address");
  }
  return trimmed.toLowerCase();
}

function normalizeHexColor(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

function normalizeUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("invalid");
    }
    return url.toString();
  } catch {
    throw new Error("Social links must be valid http(s) URLs");
  }
}

type EmailBlockInput = {
  id: string;
  type: string;
  marginTop: number;
  marginBottom: number;
  html?: string;
  fontSize?: number;
  color?: string;
  hexColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: string;
  src?: string;
  alt?: string;
  width?: number;
  heightPx?: number;
  zoom?: number;
  radius?: number;
  cropTop?: number;
  cropBottom?: number;
  cropLeft?: number;
  cropRight?: number;
  shadow?: boolean;
  shadowColor?: string;
  border?: boolean;
  borderColor?: string;
  borderWidth?: number;
  shape?: string;
  fit?: string;
  panX?: number;
  offsetX?: number;
  label?: string;
  backgroundColor?: string;
  height?: number;
  prefix?: string;
  linkLabel?: string;
  suffix?: string;
};

type EditableCopyInput = {
  subject?: string;
  headline?: string;
  body?: string;
  cta?: string;
  blocks?: EmailBlockInput[];
  linkColor?: string;
  emailPadding?: number;
  shellBackground?: string;
  shellBorderColor?: string;
  shellBorder?: boolean;
  shellBorderWidth?: number;
  shellRadius?: number;
};

type EmailCopyInput = {
  gentle?: EditableCopyInput;
  direct?: EditableCopyInput;
  urgent?: EditableCopyInput;
};

function clampText(value: string | undefined, max: number): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function normalizeHttpsUrl(value: string | undefined, max = 2000): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  if (trimmed.length > max) return "";
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function normalizeBlock(block: EmailBlockInput): EmailBlockInput | null {
  const id = clampText(block.id, 80);
  if (!id) return null;
  const marginTop = clampNumber(block.marginTop ?? 0, 0, 120);
  const marginBottom = clampNumber(block.marginBottom ?? 0, 0, 120);
  const align =
    block.align === "center" || block.align === "right" ? block.align : "left";

  switch (block.type) {
    case "text": {
      const html = (clampText(block.html, 4000) ?? "")
        .replace(
          /(\S)(<a\b[^>]*href="(?:#update-payment|#billing)")/gi,
          "$1 $2",
        )
        .replace(
          /(<a\b[^>]*href="(?:#update-payment|#billing)"[^>]*>[\s\S]*?<\/a>)(\S)/gi,
          "$1 $2",
        );
      const color =
        block.color === "muted" || block.color === "link"
          ? block.color
          : "default";
      const hex = block.hexColor?.trim() ?? "";
      const hexColor = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)
        ? hex
        : undefined;
      return {
        id,
        type: "text",
        html,
        fontSize: clampNumber(block.fontSize ?? 15, 12, 28),
        color,
        hexColor,
        bold: block.bold === true ? true : undefined,
        italic: block.italic === true ? true : undefined,
        underline: block.underline === true ? true : undefined,
        align,
        marginTop,
        marginBottom,
      };
    }
    case "image":
      return {
        id,
        type: "image",
        src: normalizeHttpsUrl(block.src),
        alt: clampText(block.alt, 120) ?? "",
        width: clampNumber(block.width ?? 100, 20, 100),
        heightPx: clampNumber(block.heightPx ?? 180, 80, 560),
        zoom: clampNumber(block.zoom ?? 1, 1, 2.4),
        radius: clampNumber(block.radius ?? 8, 0, 9999),
        cropTop: clampNumber(block.cropTop ?? 0, 0, 560),
        cropBottom: clampNumber(block.cropBottom ?? 0, 0, 560),
        cropLeft: clampNumber(block.cropLeft ?? 0, 0, 80),
        cropRight: clampNumber(block.cropRight ?? 0, 0, 80),
        shadow: block.shadow === true ? true : undefined,
        shadowColor: (() => {
          const c = block.shadowColor?.trim() ?? "";
          return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(c) ? c : undefined;
        })(),
        border: block.border === true ? true : undefined,
        borderColor: (() => {
          const c = block.borderColor?.trim() ?? "";
          return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(c) ? c : undefined;
        })(),
        borderWidth: clampNumber(block.borderWidth ?? 1, 1, 8),
        shape:
          block.shape === "square" ||
          block.shape === "circle" ||
          block.shape === "pill" ||
          block.shape === "star" ||
          block.shape === "triangle"
            ? block.shape
            : undefined,
        fit: block.fit === "stretch" ? "stretch" : undefined,
        panX: clampNumber(block.panX ?? 50, 0, 100),
        offsetX: clampNumber(
          typeof block.offsetX === "number"
            ? block.offsetX
            : align === "center"
              ? 50
              : align === "right"
                ? 100
                : 0,
          0,
          100,
        ),
        align,
        marginTop,
        marginBottom,
      };
    case "button":
      return {
        id,
        type: "button",
        label: clampText(block.label, 60) ?? "Update payment",
        backgroundColor: (() => {
          const c = block.backgroundColor?.trim() ?? "";
          return /^#[0-9a-fA-F]{6}$/.test(c) ? c.toLowerCase() : "";
        })(),
        align,
        marginTop,
        marginBottom,
      };
    case "spacer":
      return {
        id,
        type: "spacer",
        height: clampNumber(block.height ?? 16, 4, 120),
        marginTop,
        marginBottom,
      };
    case "divider":
      return {
        id,
        type: "divider",
        marginTop,
        marginBottom,
      };
    case "linkRow": {
      const prefixRaw = clampText(block.prefix, 80) ?? "Or";
      const suffixRaw = clampText(block.suffix, 120) ?? "to update your card.";
      return {
        id,
        type: "linkRow",
        prefix: prefixRaw.endsWith(" ") ? prefixRaw : `${prefixRaw} `,
        linkLabel: clampText(block.linkLabel, 80) ?? "open the billing page",
        suffix: suffixRaw.startsWith(" ") ? suffixRaw : ` ${suffixRaw}`,
        marginTop,
        marginBottom,
      };
    }
    default:
      return null;
  }
}

function normalizeEditableCopy(
  input: EditableCopyInput | undefined,
): EditableCopyInput | undefined {
  if (!input) return undefined;
  const subject = clampText(input.subject, 180);
  const headline = clampText(input.headline, 160);
  const body = clampText(input.body, 2000);
  const cta = clampText(input.cta, 60);
  const linkColor = (() => {
    const c = input.linkColor?.trim() ?? "";
    return /^#[0-9a-fA-F]{6}$/.test(c) ? c.toLowerCase() : undefined;
  })();
  const emailPadding =
    typeof input.emailPadding === "number"
      ? clampNumber(input.emailPadding, 12, 48)
      : undefined;
  const hex = (raw: string | undefined) => {
    const c = raw?.trim() ?? "";
    return /^#[0-9a-fA-F]{6}$/.test(c) ? c.toLowerCase() : undefined;
  };
  const shellBackground = hex(input.shellBackground);
  const shellBorderColor = hex(input.shellBorderColor);
  const shellBorder =
    typeof input.shellBorder === "boolean" ? input.shellBorder : undefined;
  const shellBorderWidth =
    typeof input.shellBorderWidth === "number"
      ? clampNumber(input.shellBorderWidth, 1, 8)
      : undefined;
  const shellRadius =
    typeof input.shellRadius === "number"
      ? clampNumber(input.shellRadius, 0, 48)
      : undefined;
  const blocks = Array.isArray(input.blocks)
    ? input.blocks
        .slice(0, 40)
        .map(normalizeBlock)
        .filter((b): b is EmailBlockInput => b != null)
    : undefined;

  if (
    !subject &&
    !headline &&
    !body &&
    !cta &&
    !linkColor &&
    emailPadding === undefined &&
    !shellBackground &&
    !shellBorderColor &&
    shellBorder === undefined &&
    shellBorderWidth === undefined &&
    shellRadius === undefined &&
    (!blocks || blocks.length === 0)
  ) {
    return undefined;
  }
  return {
    ...(subject ? { subject } : {}),
    ...(headline ? { headline } : {}),
    ...(body ? { body } : {}),
    ...(cta ? { cta } : {}),
    ...(blocks && blocks.length > 0 ? { blocks } : {}),
    ...(linkColor ? { linkColor } : {}),
    ...(emailPadding !== undefined ? { emailPadding } : {}),
    ...(shellBackground ? { shellBackground } : {}),
    ...(shellBorderColor ? { shellBorderColor } : {}),
    ...(shellBorder !== undefined ? { shellBorder } : {}),
    ...(shellBorderWidth !== undefined ? { shellBorderWidth } : {}),
    ...(shellRadius !== undefined ? { shellRadius } : {}),
  };
}

function normalizeEmailCopy(
  input: EmailCopyInput | undefined,
): EmailCopyInput | undefined {
  if (!input) return undefined;
  const gentle = normalizeEditableCopy(input.gentle);
  const direct = normalizeEditableCopy(input.direct);
  const urgent = normalizeEditableCopy(input.urgent);
  if (!gentle && !direct && !urgent) return undefined;
  return {
    ...(gentle ? { gentle } : {}),
    ...(direct ? { direct } : {}),
    ...(urgent ? { urgent } : {}),
  };
}

function mapSettings(row: Doc<"recoverySettings">) {
  const muted =
    row.mutedTextColor ?? row.secondaryColor ?? "#6b6b70";
  return {
    brandColor: row.brandColor,
    secondaryColor: muted,
    templateId: row.templateId,
    fromName: row.fromName ?? null,
    replyToEmail: row.replyToEmail ?? null,
    supportEmail: row.supportEmail ?? null,
    socialX: row.socialX ?? null,
    socialLinkedin: row.socialLinkedin ?? null,
    socialYoutube: row.socialYoutube ?? null,
    socialInstagram: row.socialInstagram ?? null,
    emailCopy: row.emailCopy ?? null,
    emailFont: normalizeEmailFont(row.emailFont),
    brandDomain: row.brandDomain ?? null,
    brandImportCompletedAt: row.brandImportCompletedAt ?? null,
    ctaBackgroundColor: row.ctaBackgroundColor ?? null,
    ctaTextColor: row.ctaTextColor ?? null,
    ctaBorderRadiusPx:
      typeof row.ctaBorderRadiusPx === "number" ? row.ctaBorderRadiusPx : null,
    emailBackgroundColor:
      row.emailBackgroundColor ?? row.pageBackgroundColor ?? null,
    emailTextColor: row.emailTextColor ?? row.pageTextColor ?? null,
    pageBackgroundColor:
      row.pageBackgroundColor ?? row.emailBackgroundColor ?? null,
    pageTextColor: row.pageTextColor ?? row.emailTextColor ?? null,
    mutedTextColor: muted,
    linkColor: row.linkColor ?? null,
    fontFamilyRaw: row.fontFamilyRaw ?? null,
    brandCaptureMethod: row.brandCaptureMethod ?? null,
    lastBrandImportAt: row.lastBrandImportAt ?? null,
    brandImportBonusCredits: Math.max(0, row.brandImportBonusCredits ?? 0),
    updatedAt: row.updatedAt,
  };
}

function quotaFromSettings(
  row: Doc<"recoverySettings"> | null,
  now: number,
): BrandImportQuota {
  return evaluateBrandImportQuota({
    brandImportCompletedAt: row?.brandImportCompletedAt ?? null,
    lastBrandImportAt: row?.lastBrandImportAt ?? null,
    brandImportBonusCredits: row?.brandImportBonusCredits ?? 0,
    now,
  });
}

export const getSettings = query({
  args: {},
  returns: v.union(settingsValidator, v.null()),
  handler: async (ctx) => {
    const user = await resolveProductUserOrNull(ctx);
    if (!user) return null;

    const row = await ctx.db
      .query("recoverySettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!row || isSoftDeleted(row)) return null;

    return mapSettings(row);
  },
});

/**
 * Production vs test sending status for Settings.
 * Only when a Lemon Squeezy store is connected.
 */
export const getEmailSetup = query({
  args: {},
  returns: v.union(
    v.object({
      fromAddress: v.string(),
      isProduction: v.boolean(),
      replyToEmail: v.union(v.string(), v.null()),
      fromName: v.union(v.string(), v.null()),
      hasApiKey: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const user = await resolveProductUserOrNull(ctx);
    if (!user) return null;

    const connection = await ctx.db
      .query("lemonConnections")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!connection || isSoftDeleted(connection)) return null;

    const settings = await ctx.db
      .query("recoverySettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    const activeSettings =
      settings && !isSoftDeleted(settings) ? settings : null;

    const displayName =
      activeSettings?.fromName?.trim() ||
      connection.storeName ||
      "DeclineGuard";
    const fromAddress = resolveFromAddress(displayName);

    return {
      fromAddress,
      isProduction: isProductionFromAddress(fromAddress),
      replyToEmail: activeSettings?.replyToEmail ?? null,
      fromName: activeSettings?.fromName ?? null,
      hasApiKey: Boolean(process.env.RESEND_API_KEY?.trim()),
    };
  },
});

export const saveSettings = mutation({
  args: {
    brandColor: v.string(),
    templateId: templateIdValidator,
    fromName: v.optional(v.string()),
    replyToEmail: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireWriteUser(ctx, "recovery_settings");
    const brandColor = normalizeHexColor(args.brandColor, "#0c0c0c");
    const now = Date.now();

    const existing = await ctx.db
      .query("recoverySettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    const senderPatch: {
      fromName?: string;
      replyToEmail?: string;
    } = {};
    if (args.fromName !== undefined) {
      senderPatch.fromName = args.fromName.trim() || undefined;
    }
    if (args.replyToEmail !== undefined) {
      senderPatch.replyToEmail = normalizeEmail(args.replyToEmail);
    }

    if (existing) {
      // Keep brand colors the merchant already customized — setup only sets defaults once.
      await ctx.db.patch(existing._id, {
        templateId: args.templateId,
        ...senderPatch,
        updatedAt: now,
        deletedAt: undefined,
        deletedBy: undefined,
      });
    } else {
      await ctx.db.insert("recoverySettings", {
        userId: user._id,
        brandColor,
        secondaryColor: "#6b6b70",
        templateId: args.templateId,
        ...senderPatch,
        updatedAt: now,
      });
    }
    return null;
  },
});

/** Save only sender fields from Settings (keeps brand/template). */
export const saveSenderSettings = mutation({
  args: {
    fromName: v.optional(v.string()),
    replyToEmail: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireWriteUser(ctx, "recovery_sender");
    const fromName = args.fromName?.trim() || undefined;
    const replyToEmail = normalizeEmail(args.replyToEmail);
    const now = Date.now();

    const existing = await ctx.db
      .query("recoverySettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        fromName,
        replyToEmail,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("recoverySettings", {
        userId: user._id,
        brandColor: "#0c0c0c",
        secondaryColor: "#6b6b70",
        templateId: "gentle",
        fromName,
        replyToEmail,
        updatedAt: now,
      });
    }
    return null;
  },
});

/** Persist CTA + accent colors (safe to call on every color change). */
export const saveEmailColors = mutation({
  args: {
    brandColor: v.string(),
    secondaryColor: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireWriteUser(ctx, "recovery_colors");
    const brandColor = normalizeHexColor(args.brandColor, "#0c0c0c");
    const secondaryColor = normalizeHexColor(args.secondaryColor, "#6b6b70");
    const now = Date.now();

    const existing = await ctx.db
      .query("recoverySettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        brandColor,
        secondaryColor,
        mutedTextColor: secondaryColor,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("recoverySettings", {
        userId: user._id,
        brandColor,
        secondaryColor,
        mutedTextColor: secondaryColor,
        templateId: "gentle",
        emailFont: DEFAULT_EMAIL_FONT,
        updatedAt: now,
      });
    }
    return null;
  },
});

/** Email template customizations from Customizations → Save */
export const saveEmailCustomizations = mutation({
  args: {
    brandColor: v.string(),
    secondaryColor: v.string(),
    ctaBackgroundColor: v.optional(v.string()),
    ctaTextColor: v.optional(v.string()),
    linkColor: v.optional(v.string()),
    fromName: v.optional(v.string()),
    replyToEmail: v.optional(v.string()),
    supportEmail: v.optional(v.string()),
    socialX: v.optional(v.string()),
    socialLinkedin: v.optional(v.string()),
    socialYoutube: v.optional(v.string()),
    socialInstagram: v.optional(v.string()),
    emailCopy: v.optional(emailCopyValidator),
    emailFont: v.optional(emailFontValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireWriteUser(ctx, "recovery_customizations");
    const brandColor = normalizeHexColor(args.brandColor, "#0c0c0c");
    const secondaryColor = normalizeHexColor(args.secondaryColor, "#6b6b70");
    const now = Date.now();

    const optionalPatch: Record<string, unknown> = {};
    if (args.ctaBackgroundColor !== undefined) {
      optionalPatch.ctaBackgroundColor = normalizeHexColor(
        args.ctaBackgroundColor,
        brandColor,
      );
    }
    if (args.ctaTextColor !== undefined) {
      optionalPatch.ctaTextColor = normalizeHexColor(
        args.ctaTextColor,
        "#ffffff",
      );
    }
    if (args.linkColor !== undefined) {
      optionalPatch.linkColor = normalizeHexColor(args.linkColor, brandColor);
    }
    if (args.fromName !== undefined) {
      optionalPatch.fromName = args.fromName.trim() || undefined;
    }
    if (args.replyToEmail !== undefined) {
      optionalPatch.replyToEmail = normalizeEmail(args.replyToEmail);
    }
    if (args.supportEmail !== undefined) {
      optionalPatch.supportEmail = normalizeEmail(args.supportEmail);
    }
    if (args.socialX !== undefined) {
      optionalPatch.socialX = normalizeUrl(args.socialX);
    }
    if (args.socialLinkedin !== undefined) {
      optionalPatch.socialLinkedin = normalizeUrl(args.socialLinkedin);
    }
    if (args.socialYoutube !== undefined) {
      optionalPatch.socialYoutube = normalizeUrl(args.socialYoutube);
    }
    if (args.socialInstagram !== undefined) {
      optionalPatch.socialInstagram = normalizeUrl(args.socialInstagram);
    }
    if (args.emailCopy !== undefined) {
      optionalPatch.emailCopy = normalizeEmailCopy(args.emailCopy);
    }
    if (args.emailFont !== undefined) {
      optionalPatch.emailFont = normalizeEmailFont(args.emailFont);
    }

    const existing = await ctx.db
      .query("recoverySettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    // Keep mutedTextColor in sync — mapSettings prefers mutedTextColor over
    // secondaryColor, so leaving it stale made Secondary edits appear to reset.
    if (existing) {
      await ctx.db.patch(existing._id, {
        brandColor,
        secondaryColor,
        mutedTextColor: secondaryColor,
        ...optionalPatch,
        updatedAt: now,
        deletedAt: undefined,
        deletedBy: undefined,
      });
    } else {
      const insertDoc: Record<string, unknown> = {
        userId: user._id,
        templateId: "gentle",
        brandColor,
        secondaryColor,
        mutedTextColor: secondaryColor,
        updatedAt: now,
      };
      for (const [key, value] of Object.entries(optionalPatch)) {
        if (value !== undefined) insertDoc[key] = value;
      }
      await ctx.db.insert(
        "recoverySettings",
        insertDoc as {
          userId: typeof user._id;
          templateId: "gentle";
          brandColor: string;
          secondaryColor: string;
          updatedAt: number;
        },
      );
    }
    return null;
  },
});

/** Product quota for homepage brand import (1 / 30 days + support bonuses). */
export const getBrandImportQuota = query({
  args: {},
  returns: brandImportQuotaValidator,
  handler: async (ctx) => {
    const user = await resolveProductUserOrNull(ctx);
    if (!user) {
      return evaluateBrandImportQuota({
        brandImportCompletedAt: null,
        lastBrandImportAt: null,
        brandImportBonusCredits: 0,
        now: Date.now(),
      });
    }
    const row = await ctx.db
      .query("recoverySettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    const active = row && !isSoftDeleted(row) ? row : null;
    return quotaFromSettings(active, Date.now());
  },
});

/** Internal quota check for the import action (before scan). */
export const getBrandImportQuotaForClerkUser = internalQuery({
  args: { clerkUserId: v.string() },
  returns: brandImportQuotaValidator,
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.clerkUserId))
      .unique();
    if (!user || user.accountStatus === "disabled") {
      return evaluateBrandImportQuota({
        brandImportCompletedAt: null,
        lastBrandImportAt: null,
        brandImportBonusCredits: 0,
        now: Date.now(),
      });
    }
    const row = await ctx.db
      .query("recoverySettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    const active = row && !isSoftDeleted(row) ? row : null;
    return quotaFromSettings(active, Date.now());
  },
});

/** Staff: grant +1 rebrand import after a big homepage redesign. */
export const grantBrandImportBonus = mutation({
  args: {
    userId: v.id("users"),
    credits: v.optional(v.number()),
  },
  returns: v.object({ brandImportBonusCredits: v.number() }),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const add = Math.max(1, Math.min(5, Math.floor(args.credits ?? 1)));
    const existing = await ctx.db
      .query("recoverySettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    const now = Date.now();
    if (!existing || isSoftDeleted(existing)) {
      await ctx.db.insert("recoverySettings", {
        userId: args.userId,
        brandColor: "#0c0c0c",
        secondaryColor: "#6b6b70",
        templateId: "gentle",
        brandImportBonusCredits: add,
        updatedAt: now,
      });
      return { brandImportBonusCredits: add };
    }
    const next = Math.max(0, existing.brandImportBonusCredits ?? 0) + add;
    await ctx.db.patch(existing._id, {
      brandImportBonusCredits: next,
      updatedAt: now,
    });
    return { brandImportBonusCredits: next };
  },
});

/** Save imported brand tokens and unlock Sequences / Customizations + email sends. */
export const completeBrandImport = mutation({
  args: {
    domain: v.string(),
    brandColor: v.string(),
    secondaryColor: v.string(),
    emailFont: emailFontValidator,
    fromName: v.optional(v.string()),
    ctaBackgroundColor: v.optional(v.string()),
    ctaTextColor: v.optional(v.string()),
    ctaBorderRadiusPx: v.optional(v.number()),
    emailBackgroundColor: v.optional(v.string()),
    emailTextColor: v.optional(v.string()),
    pageBackgroundColor: v.optional(v.string()),
    pageTextColor: v.optional(v.string()),
    mutedTextColor: v.optional(v.string()),
    linkColor: v.optional(v.string()),
    fontFamilyRaw: v.optional(v.string()),
    brandCaptureMethod: v.optional(brandCaptureMethodValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireWriteUser(ctx, "brand_import");
    const { domain } = validateDomainInput(args.domain);
    const brandColor = normalizeHexColor(args.brandColor, "#0c0c0c");
    const secondaryColor = normalizeHexColor(args.secondaryColor, "#6b6b70");
    const mutedTextColor = normalizeHexColor(
      args.mutedTextColor ?? args.secondaryColor,
      secondaryColor,
    );
    const emailFont = normalizeEmailFont(args.emailFont);
    const ctaBackgroundColor = args.ctaBackgroundColor
      ? normalizeHexColor(args.ctaBackgroundColor, brandColor)
      : brandColor;
    const ctaTextColor = args.ctaTextColor
      ? normalizeHexColor(args.ctaTextColor, "#ffffff")
      : "#ffffff";
    const ctaBorderRadiusPx =
      typeof args.ctaBorderRadiusPx === "number" &&
      Number.isFinite(args.ctaBorderRadiusPx)
        ? Math.max(0, Math.min(9999, Math.round(args.ctaBorderRadiusPx)))
        : 12;
    const pageBackgroundColor = normalizeHexColor(
      args.pageBackgroundColor ?? args.emailBackgroundColor ?? "#ffffff",
      "#ffffff",
    );
    const pageTextColor = normalizeHexColor(
      args.pageTextColor ?? args.emailTextColor ?? "#0c0c0c",
      "#0c0c0c",
    );
    const emailBackgroundColor = normalizeHexColor(
      args.emailBackgroundColor ?? pageBackgroundColor,
      pageBackgroundColor,
    );
    const emailTextColor = normalizeHexColor(
      args.emailTextColor ?? pageTextColor,
      pageTextColor,
    );
    const linkColor = args.linkColor
      ? normalizeHexColor(args.linkColor, brandColor)
      : brandColor;
    const fontFamilyRaw = args.fontFamilyRaw?.trim().slice(0, 200) || undefined;
    const brandCaptureMethod = args.brandCaptureMethod ?? "css";
    const now = Date.now();

    const existing = await ctx.db
      .query("recoverySettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    const active = existing && !isSoftDeleted(existing) ? existing : null;

    const quota = quotaFromSettings(active, now);
    if (!quota.canImport) {
      const when = quota.nextImportAt
        ? new Date(quota.nextImportAt).toLocaleDateString()
        : "later";
      throw new Error(
        `You can re-import from your homepage once per month. Next free import: ${when}. Need an extra after a rebrand? Contact support.`,
      );
    }

    const connection = await ctx.db
      .query("lemonConnections")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    const fromName =
      args.fromName?.trim() ||
      connection?.storeName?.trim() ||
      undefined;

    let bonusCredits = Math.max(0, active?.brandImportBonusCredits ?? 0);
    // Consume a bonus credit when this is a re-import within the cooldown window
    // (reason ok_bonus). First import / cooldown-ready / unlimited do not spend bonuses.
    if (quota.reason === "ok_bonus" && bonusCredits > 0) {
      bonusCredits -= 1;
    }

    const patch = {
      brandColor,
      secondaryColor: mutedTextColor,
      mutedTextColor,
      linkColor,
      emailFont,
      brandDomain: domain,
      brandImportCompletedAt: now,
      lastBrandImportAt: now,
      brandImportBonusCredits: bonusCredits,
      brandCaptureMethod,
      ctaBackgroundColor,
      ctaTextColor,
      ctaBorderRadiusPx,
      pageBackgroundColor,
      pageTextColor,
      emailBackgroundColor,
      emailTextColor,
      ...(fontFamilyRaw ? { fontFamilyRaw } : {}),
      updatedAt: now,
      ...(fromName ? { fromName } : {}),
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...patch,
        deletedAt: undefined,
        deletedBy: undefined,
      });
    } else {
      await ctx.db.insert("recoverySettings", {
        userId: user._id,
        templateId: "gentle",
        ...patch,
      });
    }
    return null;
  },
});

export const getSettingsForUser = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(settingsValidator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("recoverySettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (!row || row.deletedAt != null) return null;
    return mapSettings(row);
  },
});

/** LS store context for domain brand import action. */
export const getBrandImportContext = internalQuery({
  args: { clerkUserId: v.string() },
  returns: v.union(
    v.object({
      userId: v.id("users"),
      storeName: v.string(),
      storeLogoUrl: v.union(v.string(), v.null()),
      storeSlug: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.clerkUserId))
      .unique();
    if (!user || user.accountStatus === "disabled") return null;

    const connection = await ctx.db
      .query("lemonConnections")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!connection || isSoftDeleted(connection)) return null;

    return {
      userId: user._id,
      storeName: connection.storeName,
      storeLogoUrl: connection.storeAvatarUrl ?? null,
      storeSlug: connection.storeSlug,
    };
  },
});

const EMAIL_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const EMAIL_IMAGE_MAX_BYTES = 2_500_000;

export const generateEmailImageUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const user = await requireWriteUser(ctx, "email_image_upload");
    await consumeRateLimit(
      ctx,
      `email_image_upload:${user._id}`,
      30,
      60 * 60 * 1000,
    );
    return await ctx.storage.generateUploadUrl();
  },
});

export const finalizeEmailImageUpload = mutation({
  args: { storageId: v.id("_storage") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const user = await requireWriteUser(ctx, "email_image_finalize");
    const meta = await ctx.db.system.get("_storage", args.storageId);
    if (!meta) {
      throw new Error("Upload not found");
    }
    const contentType = meta.contentType ?? "";
    if (!EMAIL_IMAGE_TYPES.has(contentType)) {
      await ctx.storage.delete(args.storageId);
      throw new Error("Use a JPG, PNG, WebP, or GIF image");
    }
    if (meta.size > EMAIL_IMAGE_MAX_BYTES) {
      await ctx.storage.delete(args.storageId);
      throw new Error("Image must be under 2.5 MB");
    }
    await assertStorageOwnedByUser(ctx, user._id, args.storageId);
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      throw new Error("Upload not found");
    }
    return url;
  },
});
