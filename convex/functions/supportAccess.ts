import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { isSoftDeleted, requireSupportParticipant } from "../lib/accountGuard";
import {
  normalizeRole,
  requireStaff,
  writeAuditLog,
  type AppRole,
} from "../lib/admin";
import {
  isProductionFromAddress,
  resolveFromAddress,
} from "../lib/recoveryEmailFrom";

export const GIVE_ACCESS_TOKEN = "[Give Access]";
const GRANT_TTL_MS = 4 * 60 * 60 * 1000;

const grantSummaryValidator = v.object({
  _id: v.id("staffAccessGrants"),
  merchantUserId: v.id("users"),
  granteeUserId: v.id("users"),
  granteeName: v.string(),
  threadId: v.id("supportThreads"),
  messageId: v.id("supportMessages"),
  status: v.union(
    v.literal("active"),
    v.literal("revoked"),
    v.literal("expired"),
  ),
  createdAt: v.number(),
  expiresAt: v.number(),
  revokedAt: v.union(v.number(), v.null()),
});

async function summarizeGrant(
  ctx: QueryCtx | MutationCtx,
  grant: Doc<"staffAccessGrants">,
) {
  const grantee = await ctx.db.get(grant.granteeUserId);
  return {
    _id: grant._id,
    merchantUserId: grant.merchantUserId,
    granteeUserId: grant.granteeUserId,
    granteeName: grantee?.userName ?? "Support",
    threadId: grant.threadId,
    messageId: grant.messageId,
    status: grant.status,
    createdAt: grant.createdAt,
    expiresAt: grant.expiresAt,
    revokedAt: grant.revokedAt ?? null,
  };
}

async function expireIfNeeded(
  ctx: MutationCtx,
  grant: Doc<"staffAccessGrants">,
): Promise<Doc<"staffAccessGrants">> {
  if (grant.status === "active" && grant.expiresAt <= Date.now()) {
    await ctx.db.patch(grant._id, { status: "expired" });
    return { ...grant, status: "expired" };
  }
  return grant;
}

function messageOffersGiveAccess(message: Doc<"supportMessages">): boolean {
  return (
    message.visibility === "customer" &&
    (message.kind ?? "chat") === "chat" &&
    (message.authorRole === "staff" || message.authorRole === "admin") &&
    message.body.includes(GIVE_ACCESS_TOKEN)
  );
}

async function insertSystemNote(
  ctx: MutationCtx,
  args: {
    threadId: Id<"supportThreads">;
    authorUserId: Id<"users">;
    authorRole: AppRole;
    body: string;
    now: number;
  },
): Promise<void> {
  await ctx.db.insert("supportMessages", {
    threadId: args.threadId,
    authorUserId: args.authorUserId,
    authorRole: args.authorRole,
    body: args.body,
    visibility: "customer",
    kind: "system",
    createdAt: args.now,
  });
}

/** Active grant on a thread (merchant or staff viewing the chat). */
export const getActiveGrantForThread = query({
  args: { threadId: v.id("supportThreads") },
  returns: v.union(grantSummaryValidator, v.null()),
  handler: async (ctx, args) => {
    const me = await requireSupportParticipant(ctx);
    const thread = await ctx.db.get(args.threadId);
    if (!thread) return null;

    const role = normalizeRole(me.role);
    const isStaff = role === "staff" || role === "admin";
    if (!isStaff && thread.userId !== me._id) return null;

    const rows = await ctx.db
      .query("staffAccessGrants")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .take(20);

    const now = Date.now();
    const active = rows.find(
      (g) => g.status === "active" && g.expiresAt > now,
    );
    if (!active) return null;
    return await summarizeGrant(ctx, active);
  },
});

/** Grants where the signed-in staff/admin is the grantee. */
export const listMyActiveGrants = query({
  args: {},
  returns: v.array(grantSummaryValidator),
  handler: async (ctx) => {
    const me = await requireStaff(ctx);
    const rows = await ctx.db
      .query("staffAccessGrants")
      .withIndex("by_grantee_status", (q) =>
        q.eq("granteeUserId", me._id).eq("status", "active"),
      )
      .take(40);

    const now = Date.now();
    const out = [];
    for (const row of rows) {
      if (row.expiresAt <= now) continue;
      out.push(await summarizeGrant(ctx, row));
    }
    return out;
  },
});

/** Active grant for a merchant (staff portal banner). */
export const getActiveGrantForMerchant = query({
  args: { merchantUserId: v.id("users") },
  returns: v.union(grantSummaryValidator, v.null()),
  handler: async (ctx, args) => {
    const me = await requireStaff(ctx);
    const rows = await ctx.db
      .query("staffAccessGrants")
      .withIndex("by_merchant_status", (q) =>
        q.eq("merchantUserId", args.merchantUserId).eq("status", "active"),
      )
      .take(20);

    const now = Date.now();
    // Least privilege: only the grantee — Admins must receive their own
    // [Give Access] consent (or use Admin takeover for real access).
    const forMe = rows.find(
      (g) => g.granteeUserId === me._id && g.expiresAt > now,
    );
    if (forMe) return await summarizeGrant(ctx, forMe);
    return null;
  },
});

/**
 * Merchant accepts [Give Access] on a staff message.
 * Grant goes to the message author (staff/admin who asked).
 */
export const acceptStaffAccessGrant = mutation({
  args: {
    threadId: v.id("supportThreads"),
    messageId: v.id("supportMessages"),
  },
  returns: v.id("staffAccessGrants"),
  handler: async (ctx, args) => {
    const me = await requireSupportParticipant(ctx);

    // Ownership of the chat — not role. Staff/Admin testing via Help on their
    // own account must still be able to click Give Access.
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== me._id) {
      throw new Error(
        "Only the merchant who owns this chat can grant access.",
      );
    }
    if (thread.status === "closed") {
      throw new Error("This chat is closed.");
    }

    const message = await ctx.db.get(args.messageId);
    if (
      !message ||
      message.threadId !== args.threadId ||
      !messageOffersGiveAccess(message)
    ) {
      throw new Error("That access request is no longer valid.");
    }

    const grantee = await ctx.db.get(message.authorUserId);
    if (!grantee) throw new Error("Support member not found.");
    const granteeRole = normalizeRole(grantee.role);
    if (granteeRole !== "staff" && granteeRole !== "admin") {
      throw new Error("Access can only be granted to Staff or Admin.");
    }

    const existing = await ctx.db
      .query("staffAccessGrants")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .take(20);
    const now = Date.now();
    for (const row of existing) {
      if (row.status === "active" && row.expiresAt > now) {
        if (row.granteeUserId === message.authorUserId) {
          return row._id;
        }
        await ctx.db.patch(row._id, {
          status: "revoked",
          revokedAt: now,
        });
      }
    }

    const expiresAt = now + GRANT_TTL_MS;
    const grantId = await ctx.db.insert("staffAccessGrants", {
      merchantUserId: me._id,
      granteeUserId: message.authorUserId,
      threadId: args.threadId,
      messageId: args.messageId,
      status: "active",
      createdAt: now,
      expiresAt,
    });

    await insertSystemNote(ctx, {
      threadId: args.threadId,
      authorUserId: me._id,
      authorRole: "user",
      body: `You granted temporary access to ${grantee.userName}. They can review your account in the staff portal for 4 hours.`,
      now,
    });
    await ctx.db.patch(args.threadId, { lastMessageAt: now });

    await writeAuditLog(ctx, {
      actorUserId: me._id,
      targetUserId: me._id,
      action: "staff_access_grant",
      reason: `Granted temporary access to ${grantee.userName}`,
      metadata: {
        threadId: args.threadId,
        messageId: args.messageId,
        granteeUserId: message.authorUserId,
        expiresAt,
      },
    });

    return grantId;
  },
});

export const revokeStaffAccessGrant = mutation({
  args: { grantId: v.id("staffAccessGrants") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = await requireSupportParticipant(ctx);
    const grant = await ctx.db.get(args.grantId);
    if (!grant) throw new Error("Grant not found.");

    const role = normalizeRole(me.role);
    const isAdmin = role === "admin";
    const isMerchant = grant.merchantUserId === me._id;
    const isGrantee = grant.granteeUserId === me._id;

    if (!isMerchant && !isAdmin && !isGrantee) {
      throw new Error("Not authorized to revoke this grant.");
    }

    const current = await expireIfNeeded(ctx, grant);
    if (current.status !== "active") return null;

    const now = Date.now();
    await ctx.db.patch(grant._id, {
      status: "revoked",
      revokedAt: now,
    });

    const actorRole: AppRole =
      role === "admin" || role === "staff" ? role : "user";
    await insertSystemNote(ctx, {
      threadId: grant.threadId,
      authorUserId: me._id,
      authorRole: actorRole,
      body: isMerchant
        ? "You revoked temporary account access."
        : "Temporary account access was revoked.",
      now,
    });
    await ctx.db.patch(grant.threadId, { lastMessageAt: now });

    await writeAuditLog(ctx, {
      actorUserId: me._id,
      targetUserId: grant.merchantUserId,
      action: "staff_access_revoke",
      reason: "Revoked temporary staff access grant",
      metadata: { grantId: grant._id, threadId: grant.threadId },
    });
    return null;
  },
});

/** Whether the current staff member has an active grant for this merchant. */
export const hasActiveGrant = query({
  args: { merchantUserId: v.id("users") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const me = await requireStaff(ctx);
    const rows = await ctx.db
      .query("staffAccessGrants")
      .withIndex("by_merchant_status", (q) =>
        q.eq("merchantUserId", args.merchantUserId).eq("status", "active"),
      )
      .take(20);
    const now = Date.now();
    return rows.some(
      (g) => g.granteeUserId === me._id && g.expiresAt > now,
    );
  },
});

const SIM_SCAN = 400;

const emailDeliveryStatusSimValidator = v.union(
  v.literal("queued"),
  v.literal("delivered"),
  v.literal("bounced"),
  v.literal("complained"),
  v.literal("failed"),
);

const openFailureSimValidator = v.object({
  _id: v.id("failedPayments"),
  customerEmail: v.string(),
  customerName: v.union(v.string(), v.null()),
  productName: v.union(v.string(), v.null()),
  amountCents: v.number(),
  currency: v.string(),
  failedAt: v.number(),
  updatePaymentUrl: v.union(v.string(), v.null()),
  subscriptionId: v.string(),
  testMode: v.boolean(),
  sequenceLabel: v.string(),
  emailsSentCount: v.number(),
  nextEmailAt: v.union(v.number(), v.null()),
  declineReason: v.union(v.string(), v.null()),
  lastEmailDeliveryStatus: v.union(emailDeliveryStatusSimValidator, v.null()),
  day0SentAt: v.union(v.number(), v.null()),
  day2SentAt: v.union(v.number(), v.null()),
  day5SentAt: v.union(v.number(), v.null()),
});

const recoveredWinSimValidator = v.object({
  _id: v.id("failedPayments"),
  customerEmail: v.string(),
  customerName: v.union(v.string(), v.null()),
  productName: v.union(v.string(), v.null()),
  amountCents: v.number(),
  currency: v.string(),
  failedAt: v.number(),
  recoveredAt: v.number(),
  testMode: v.boolean(),
});

const activitySimValidator = v.object({
  _id: v.id("activityEvents"),
  type: v.union(
    v.literal("payment_failed"),
    v.literal("recovered"),
    v.literal("email_sent"),
    v.literal("email_bounced"),
    v.literal("email_delivered"),
  ),
  title: v.string(),
  detail: v.union(v.string(), v.null()),
  customerEmail: v.union(v.string(), v.null()),
  amountCents: v.union(v.number(), v.null()),
  currency: v.union(v.string(), v.null()),
  occurredAt: v.number(),
});

const recoverySummarySimValidator = v.object({
  openCount: v.number(),
  openAtRiskCents: v.number(),
  openCurrency: v.union(v.string(), v.null()),
  openCurrencyMixed: v.boolean(),
  recoveredThisMonthCents: v.number(),
  recoveredThisMonthCount: v.number(),
  recoveredPriorMonthCents: v.number(),
  recoveredPriorMonthCount: v.number(),
  recoveredCurrency: v.union(v.string(), v.null()),
  recoveredCurrencyMixed: v.boolean(),
  cohortOpenCount: v.number(),
  cohortRecoveredCount: v.number(),
  recoveryRatePercent: v.union(v.number(), v.null()),
  emailsSentThisMonth: v.number(),
  displayCurrency: v.union(v.string(), v.null()),
});

const DAY_MS = 24 * 60 * 60 * 1000;

function sequenceLabelForFailure(row: {
  day0SentAt?: number;
  day2SentAt?: number;
  day5SentAt?: number;
  day2JobId?: unknown;
  day5JobId?: unknown;
}): string {
  if (row.day5SentAt != null) return "Email 3 · Day 5 sent";
  if (row.day2SentAt != null) {
    return row.day5JobId ? "Email 2 · Day 5 pending" : "Email 2 · Day 2 sent";
  }
  if (row.day0SentAt != null) {
    return row.day2JobId ? "Email 1 · Day 2 pending" : "Email 1 · Day 0 sent";
  }
  return "Queued · Day 0";
}

function nextEmailAtForFailure(row: {
  day0SentAt?: number;
  day2SentAt?: number;
  day5SentAt?: number;
  day2JobId?: unknown;
  day5JobId?: unknown;
}): number | null {
  if (row.day5SentAt != null) return null;
  if (
    row.day2SentAt != null &&
    row.day5SentAt == null &&
    row.day5JobId != null
  ) {
    if (row.day0SentAt != null) return row.day0SentAt + 5 * DAY_MS;
    return row.day2SentAt + 3 * DAY_MS;
  }
  if (
    row.day0SentAt != null &&
    row.day2SentAt == null &&
    row.day2JobId != null
  ) {
    return row.day0SentAt + 2 * DAY_MS;
  }
  return null;
}

function emailFromActivity(row: {
  customerEmail?: string;
  title: string;
}): string | null {
  if (row.customerEmail?.trim()) return row.customerEmail.trim().toLowerCase();
  const match = /^([^\s·/]+@[^\s·/]+)\s*[·/]/.exec(row.title);
  return match?.[1]?.toLowerCase() ?? null;
}

function primaryCurrencyTotals(
  rows: ReadonlyArray<{ amountCents: number; currency: string }>,
): { cents: number; currency: string | null; mixed: boolean } {
  const byCurrency = new Map<string, number>();
  for (const row of rows) {
    const code = row.currency.trim().toUpperCase() || "USD";
    byCurrency.set(code, (byCurrency.get(code) ?? 0) + row.amountCents);
  }
  let currency: string | null = null;
  let cents = 0;
  for (const [code, total] of byCurrency) {
    if (total > cents) {
      currency = code;
      cents = total;
    }
  }
  return { cents, currency, mixed: byCurrency.size > 1 };
}

async function requireActiveGrant(
  ctx: QueryCtx,
  merchantUserId: Id<"users">,
): Promise<Doc<"staffAccessGrants"> | null> {
  const me = await requireStaff(ctx);
  const grants = await ctx.db
    .query("staffAccessGrants")
    .withIndex("by_merchant_status", (q) =>
      q.eq("merchantUserId", merchantUserId).eq("status", "active"),
    )
    .take(20);
  const now = Date.now();
  // Grantee only — no Admin override of another staffer's grant.
  return (
    grants.find((g) => g.expiresAt > now && g.granteeUserId === me._id) ?? null
  );
}

/**
 * 1:1 read-only snapshot of a merchant’s dashboard data for staff simulation.
 * Requires an active grant (grantee) or Admin. Never writes merchant data.
 */
export const getDashboardSimulation = query({
  args: {
    merchantUserId: v.id("users"),
    monthStartMs: v.number(),
    priorMonthStartMs: v.number(),
    sinceMs: v.number(),
  },
  returns: v.union(
    v.object({
      merchantName: v.string(),
      merchantRole: v.string(),
      accountStatus: v.union(
        v.literal("active"),
        v.literal("frozen"),
        v.literal("disabled"),
      ),
      frozenReason: v.union(v.string(), v.null()),
      clerkUserId: v.string(),
      convexUserId: v.id("users"),
      grantExpiresAt: v.number(),
      grantId: v.id("staffAccessGrants"),
      connection: v.union(
        v.object({
          _id: v.id("lemonConnections"),
          storeId: v.string(),
          storeName: v.string(),
          storeSlug: v.string(),
          storeAvatarUrl: v.union(v.string(), v.null()),
          stores: v.array(
            v.object({
              id: v.string(),
              name: v.string(),
              slug: v.string(),
              avatarUrl: v.optional(v.string()),
            }),
          ),
          apiKeyLast4: v.string(),
          testMode: v.boolean(),
          connectedAt: v.number(),
        }),
        v.null(),
      ),
      openFailures: v.array(openFailureSimValidator),
      recentRecovered: v.array(recoveredWinSimValidator),
      recentActivity: v.array(activitySimValidator),
      activityHistory: v.array(activitySimValidator),
      activityEmails: v.array(v.string()),
      recoverySummary: recoverySummarySimValidator,
      recoverySettings: v.union(
        v.object({
          brandColor: v.string(),
          secondaryColor: v.string(),
          templateId: v.union(
            v.literal("gentle"),
            v.literal("direct"),
            v.literal("urgent"),
          ),
          fromName: v.union(v.string(), v.null()),
          replyToEmail: v.union(v.string(), v.null()),
          supportEmail: v.union(v.string(), v.null()),
          socialX: v.union(v.string(), v.null()),
          socialLinkedin: v.union(v.string(), v.null()),
          socialYoutube: v.union(v.string(), v.null()),
          socialInstagram: v.union(v.string(), v.null()),
          emailCopy: v.union(
            v.object({
              gentle: v.optional(
                v.object({
                  subject: v.optional(v.string()),
                  headline: v.optional(v.string()),
                  body: v.optional(v.string()),
                  cta: v.optional(v.string()),
                }),
              ),
              direct: v.optional(
                v.object({
                  subject: v.optional(v.string()),
                  headline: v.optional(v.string()),
                  body: v.optional(v.string()),
                  cta: v.optional(v.string()),
                }),
              ),
              urgent: v.optional(
                v.object({
                  subject: v.optional(v.string()),
                  headline: v.optional(v.string()),
                  body: v.optional(v.string()),
                  cta: v.optional(v.string()),
                }),
              ),
            }),
            v.null(),
          ),
          updatedAt: v.number(),
        }),
        v.null(),
      ),
      webhookSetup: v.union(
        v.object({
          callbackUrl: v.string(),
          serverConfigured: v.boolean(),
        }),
        v.null(),
      ),
      emailSetup: v.union(
        v.object({
          fromAddress: v.string(),
          isProduction: v.boolean(),
          replyToEmail: v.union(v.string(), v.null()),
          fromName: v.union(v.string(), v.null()),
          hasApiKey: v.boolean(),
        }),
        v.null(),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const grant = await requireActiveGrant(ctx, args.merchantUserId);
    if (!grant) return null;

    const user = await ctx.db.get(args.merchantUserId);
    if (!user) return null;

    const connectionRow = await ctx.db
      .query("lemonConnections")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    const connection =
      connectionRow && !isSoftDeleted(connectionRow) ? connectionRow : null;

    const settingsRow = await ctx.db
      .query("recoverySettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    const settings =
      settingsRow && !isSoftDeleted(settingsRow) ? settingsRow : null;

    const openRows = (
      await ctx.db
        .query("failedPayments")
        .withIndex("by_user_status_failedAt", (q) =>
          q.eq("userId", user._id).eq("status", "open"),
        )
        .order("desc")
        .take(SIM_SCAN)
    ).filter((row) => row.deletedAt == null);

    const openFailures = openRows.slice(0, 100).map((row) => ({
      _id: row._id,
      customerEmail: row.customerEmail,
      customerName: row.customerName ?? null,
      productName: row.productName ?? null,
      amountCents: row.amountCents,
      currency: row.currency,
      failedAt: row.failedAt,
      updatePaymentUrl: row.updatePaymentUrl ?? null,
      subscriptionId: row.subscriptionId,
      testMode: row.testMode,
      sequenceLabel: sequenceLabelForFailure(row),
      emailsSentCount: row.emailsSentCount ?? 0,
      nextEmailAt: nextEmailAtForFailure(row),
      declineReason: row.declineReason ?? null,
      lastEmailDeliveryStatus: row.lastEmailDeliveryStatus ?? null,
      day0SentAt: row.day0SentAt ?? null,
      day2SentAt: row.day2SentAt ?? null,
      day5SentAt: row.day5SentAt ?? null,
    }));

    const recentRecovered = (
      await ctx.db
        .query("failedPayments")
        .withIndex("by_user_status_recoveredAt", (q) =>
          q.eq("userId", user._id).eq("status", "recovered"),
        )
        .order("desc")
        .take(12)
    )
      .filter((row) => row.deletedAt == null && row.recoveredAt != null)
      .map((row) => ({
        _id: row._id,
        customerEmail: row.customerEmail,
        customerName: row.customerName ?? null,
        productName: row.productName ?? null,
        amountCents: row.amountCents,
        currency: row.currency,
        failedAt: row.failedAt,
        recoveredAt: row.recoveredAt!,
        testMode: row.testMode,
      }));

    const activityRows = (
      await ctx.db
        .query("activityEvents")
        .withIndex("by_user_occurred", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(500)
    ).filter((row) => row.deletedAt == null);

    const mapAct = (row: Doc<"activityEvents">) => ({
      _id: row._id,
      type: row.type,
      title: row.title,
      detail: row.detail ?? null,
      customerEmail: emailFromActivity(row),
      amountCents: row.amountCents ?? null,
      currency: row.currency ?? null,
      occurredAt: row.occurredAt,
    });

    const recentActivity = activityRows
      .filter((row) => row.occurredAt >= args.sinceMs)
      .map(mapAct);

    const activityHistory = activityRows.map(mapAct);
    const emailSet = new Set<string>();
    for (const row of activityHistory) {
      if (row.customerEmail) emailSet.add(row.customerEmail);
    }

    const openMoney = primaryCurrencyTotals(openRows);
    let cohortOpenCount = 0;
    for (const row of openRows) {
      if (row.failedAt >= args.monthStartMs) cohortOpenCount += 1;
    }

    const recoveredThisMonthRows = (
      await ctx.db
        .query("failedPayments")
        .withIndex("by_user_status_recoveredAt", (q) =>
          q
            .eq("userId", user._id)
            .eq("status", "recovered")
            .gte("recoveredAt", args.monthStartMs),
        )
        .take(SIM_SCAN)
    ).filter((row) => row.deletedAt == null);

    const recoveredPriorMonthRows = (
      await ctx.db
        .query("failedPayments")
        .withIndex("by_user_status_recoveredAt", (q) =>
          q
            .eq("userId", user._id)
            .eq("status", "recovered")
            .gte("recoveredAt", args.priorMonthStartMs),
        )
        .take(SIM_SCAN)
    ).filter(
      (row) =>
        row.deletedAt == null &&
        row.recoveredAt != null &&
        row.recoveredAt < args.monthStartMs,
    );

    const recoveredMoney = primaryCurrencyTotals(recoveredThisMonthRows);
    const recoveredPriorMoney = primaryCurrencyTotals(recoveredPriorMonthRows);

    const recoveredByFailedAt = (
      await ctx.db
        .query("failedPayments")
        .withIndex("by_user_status_failedAt", (q) =>
          q.eq("userId", user._id).eq("status", "recovered"),
        )
        .order("desc")
        .take(SIM_SCAN)
    ).filter((row) => row.deletedAt == null);

    let cohortRecoveredCount = 0;
    for (const row of recoveredByFailedAt) {
      if (row.failedAt < args.monthStartMs) break;
      cohortRecoveredCount += 1;
    }

    const cohortTotal = cohortRecoveredCount + cohortOpenCount;
    const recoveryRatePercent =
      cohortTotal === 0
        ? null
        : Math.round((cohortRecoveredCount / cohortTotal) * 100);

    let emailsSentThisMonth = 0;
    for (const row of activityRows) {
      if (row.type !== "email_sent") continue;
      if (row.occurredAt < args.monthStartMs) continue;
      emailsSentThisMonth += 1;
    }

    const displayCurrency =
      recoveredMoney.currency ?? openMoney.currency ?? null;

    let webhookSetup: {
      callbackUrl: string;
      serverConfigured: boolean;
    } | null = null;
    if (connection) {
      const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim();
      const site = process.env.CONVEX_SITE_URL?.trim().replace(/\/$/, "");
      if (site) {
        webhookSetup = {
          callbackUrl: `${site}/lemonsqueezy`,
          serverConfigured: Boolean(secret),
        };
      }
    }

    let emailSetup: {
      fromAddress: string;
      isProduction: boolean;
      replyToEmail: string | null;
      fromName: string | null;
      hasApiKey: boolean;
    } | null = null;
    if (connection) {
      const displayName =
        settings?.fromName?.trim() || connection.storeName || "DeclineGuard";
      const fromAddress = resolveFromAddress(displayName);
      emailSetup = {
        fromAddress,
        isProduction: isProductionFromAddress(fromAddress),
        replyToEmail: settings?.replyToEmail ?? null,
        fromName: settings?.fromName ?? null,
        hasApiKey: Boolean(process.env.RESEND_API_KEY?.trim()),
      };
    }

    return {
      merchantName: user.userName,
      merchantRole: normalizeRole(user.role),
      accountStatus: (user.accountStatus ?? "active") as
        | "active"
        | "frozen"
        | "disabled",
      frozenReason: user.frozenReason ?? null,
      clerkUserId: user.userId,
      convexUserId: user._id,
      grantExpiresAt: grant.expiresAt,
      grantId: grant._id,
      connection: connection
        ? {
            _id: connection._id,
            storeId: connection.storeId,
            storeName: connection.storeName,
            storeSlug: connection.storeSlug,
            storeAvatarUrl: connection.storeAvatarUrl ?? null,
            stores: connection.stores ?? [
              {
                id: connection.storeId,
                name: connection.storeName,
                slug: connection.storeSlug,
                ...(connection.storeAvatarUrl
                  ? { avatarUrl: connection.storeAvatarUrl }
                  : {}),
              },
            ],
            apiKeyLast4: connection.apiKeyLast4,
            testMode: connection.testMode,
            connectedAt: connection.connectedAt,
          }
        : null,
      openFailures,
      recentRecovered,
      recentActivity,
      activityHistory,
      activityEmails: [...emailSet].sort(),
      recoverySummary: {
        openCount: openRows.length,
        openAtRiskCents: openMoney.cents,
        openCurrency: openMoney.currency,
        openCurrencyMixed: openMoney.mixed,
        recoveredThisMonthCents: recoveredMoney.cents,
        recoveredThisMonthCount: recoveredThisMonthRows.length,
        recoveredPriorMonthCents: recoveredPriorMoney.cents,
        recoveredPriorMonthCount: recoveredPriorMonthRows.length,
        recoveredCurrency: recoveredMoney.currency,
        recoveredCurrencyMixed: recoveredMoney.mixed,
        cohortOpenCount,
        cohortRecoveredCount,
        recoveryRatePercent,
        emailsSentThisMonth,
        displayCurrency,
      },
      recoverySettings: settings
        ? {
            brandColor: settings.brandColor,
            secondaryColor: settings.secondaryColor ?? "#6b6b70",
            templateId: settings.templateId,
            fromName: settings.fromName ?? null,
            replyToEmail: settings.replyToEmail ?? null,
            supportEmail: settings.supportEmail ?? null,
            socialX: settings.socialX ?? null,
            socialLinkedin: settings.socialLinkedin ?? null,
            socialYoutube: settings.socialYoutube ?? null,
            socialInstagram: settings.socialInstagram ?? null,
            emailCopy: settings.emailCopy ?? null,
            updatedAt: settings.updatedAt,
          }
        : null,
      webhookSetup,
      emailSetup,
    };
  },
});
