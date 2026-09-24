import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import {
  assertCanActOnTarget,
  requireActionReason,
  requireStaff,
  writeAuditLog,
} from "../lib/admin";
import {
  existingClaimBlocksNewCharge,
  feeInvoiceClaimKey,
  orderCoversClaimedCents,
} from "../lib/feeBilling";
import { allowHttpsUrl } from "../lib/safeUrl";
import { resolveProductUserOrNull } from "../lib/accountGuard";

/**
 * Caps per-merchant owed-fee load when claiming a period.
 * Merchants with more than this many still-owed rows are under-invoiced
 * until older rows are paid/waived or staff releases and force-runs.
 */
const FEE_INVOICE_SCAN_LIMIT = 2000;

const billingInvoiceStatusValidator = v.union(
  v.literal("claiming"),
  v.literal("created"),
  v.literal("paid"),
  v.literal("failed"),
);

const feeInvoiceListItemValidator = v.object({
  _id: v.id("billingInvoices"),
  userId: v.id("users"),
  claimKey: v.string(),
  periodKey: v.string(),
  currency: v.string(),
  totalCents: v.number(),
  feeCount: v.number(),
  status: billingInvoiceStatusValidator,
  lsCheckoutId: v.union(v.string(), v.null()),
  lsCheckoutUrl: v.union(v.string(), v.null()),
  lsOrderId: v.union(v.string(), v.null()),
  expiresAt: v.union(v.number(), v.null()),
  checkoutEmailSentAt: v.union(v.number(), v.null()),
  createdAt: v.number(),
  paidAt: v.union(v.number(), v.null()),
  lastError: v.union(v.string(), v.null()),
});

const owedFeeSummaryValidator = v.object({
  _id: v.id("recoveryFees"),
  userId: v.id("users"),
  feeCents: v.number(),
  currency: v.string(),
  testMode: v.boolean(),
  billingInvoiceId: v.optional(v.id("billingInvoices")),
});

function isBillableFee(fee: Doc<"recoveryFees">): boolean {
  return (
    fee.status === "owed" &&
    !fee.testMode &&
    fee.billingInvoiceId == null &&
    fee.feeCents > 0
  );
}

async function unlinkFeesFromInvoice(
  ctx: MutationCtx,
  invoiceId: Id<"billingInvoices">,
  feeIds: Id<"recoveryFees">[],
): Promise<void> {
  for (const feeId of feeIds) {
    const fee = await ctx.db.get(feeId);
    if (!fee) continue;
    if (fee.billingInvoiceId !== invoiceId) continue;
    const { _id, _creationTime, billingInvoiceId: _linked, ...fields } = fee;
    await ctx.db.replace(_id, fields);
  }
}

async function loadBillableFeesForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"recoveryFees">[]> {
  const rows = await ctx.db
    .query("recoveryFees")
    .withIndex("by_user_status", (q) =>
      q.eq("userId", userId).eq("status", "owed"),
    )
    .take(FEE_INVOICE_SCAN_LIMIT);

  return rows.filter(isBillableFee);
}

async function winnerForClaimKey(
  ctx: MutationCtx | QueryCtx,
  claimKey: string,
): Promise<Doc<"billingInvoices"> | null> {
  const rows = await ctx.db
    .query("billingInvoices")
    .withIndex("by_claimKey", (q) => q.eq("claimKey", claimKey))
    .collect();
  if (rows.length === 0) return null;
  rows.sort((a, b) => a._creationTime - b._creationTime);
  return rows[0] ?? null;
}

/**
 * Paginated owed-fee scan for the monthly job (distinct merchants derived
 * in the action). Skips nothing here — caller filters testMode / already billed.
 */
export const listOwedFeePage = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(owedFeeSummaryValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("recoveryFees")
      .withIndex("by_status_userId", (q) => q.eq("status", "owed"))
      .paginate(args.paginationOpts);

    return {
      page: result.page.map((row) => ({
        _id: row._id,
        userId: row.userId,
        feeCents: row.feeCents,
        currency: row.currency,
        testMode: row.testMode,
        billingInvoiceId: row.billingInvoiceId,
      })),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

export const getUserBillingTarget = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      userName: v.string(),
      clerkUserId: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    return {
      _id: user._id,
      userName: user.userName,
      clerkUserId: user.userId,
    };
  },
});

/**
 * Claim a UTC-month billing period for one merchant.
 *
 * Insert-then-reconcile on claimKey (same pattern as webhook events):
 * a retry of a successful create/paid/claiming-with-fees row does not
 * open a second LS charge. `$0` owed returns skipped without inserting.
 */
export const claimBillingPeriod = internalMutation({
  args: {
    userId: v.id("users"),
    periodKey: v.string(),
    storeCurrency: v.string(),
    nowMs: v.number(),
  },
  returns: v.object({
    claimed: v.boolean(),
    skippedZero: v.boolean(),
    currencyMismatch: v.boolean(),
    currencyMixed: v.boolean(),
    reason: v.union(v.string(), v.null()),
    invoiceId: v.union(v.id("billingInvoices"), v.null()),
    totalCents: v.number(),
    feeCount: v.number(),
    currency: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const none = {
      claimed: false,
      skippedZero: false,
      currencyMismatch: false,
      currencyMixed: false,
      reason: null as string | null,
      invoiceId: null as Id<"billingInvoices"> | null,
      totalCents: 0,
      feeCount: 0,
      currency: null as string | null,
    };

    const claimKey = feeInvoiceClaimKey(args.userId, args.periodKey);
    const existingWinner = await winnerForClaimKey(ctx, claimKey);

    if (
      existingWinner &&
      existingClaimBlocksNewCharge(
        existingWinner.status,
        existingWinner.feeIds.length,
        existingWinner.lsCheckoutId != null,
      )
    ) {
      return {
        ...none,
        reason: existingWinner.status === "paid" ? "already_paid" : "already_claimed",
        invoiceId: existingWinner._id,
        totalCents: existingWinner.totalCents,
        feeCount: existingWinner.feeIds.length,
        currency: existingWinner.currency,
      };
    }

    const billable = await loadBillableFeesForUser(ctx, args.userId);
    if (billable.length === 0) {
      if (existingWinner?.status === "failed" || existingWinner?.status === "claiming") {
        return { ...none, skippedZero: true, invoiceId: existingWinner._id, reason: "zero_owed" };
      }
      return { ...none, skippedZero: true, reason: "zero_owed" };
    }

    const byCurrency = new Map<string, Doc<"recoveryFees">[]>();
    for (const fee of billable) {
      const code = fee.currency.trim().toUpperCase() || "USD";
      const list = byCurrency.get(code) ?? [];
      list.push(fee);
      byCurrency.set(code, list);
    }
    if (byCurrency.size > 1) {
      await writeAuditLog(ctx, {
        actorUserId: null,
        targetUserId: args.userId,
        action: "fee_invoice:skipped_currency",
        metadata: {
          reason: "currency_mixed",
          currencies: [...byCurrency.keys()],
          periodKey: args.periodKey,
        },
      });
      return { ...none, currencyMixed: true, reason: "currency_mixed" };
    }

    const currency = [...byCurrency.keys()][0] ?? "USD";
    const storeCurrency = args.storeCurrency.trim().toUpperCase() || "USD";
    if (currency !== storeCurrency) {
      await writeAuditLog(ctx, {
        actorUserId: null,
        targetUserId: args.userId,
        action: "fee_invoice:skipped_currency",
        metadata: {
          reason: "currency_mismatch",
          feeCurrency: currency,
          storeCurrency,
          periodKey: args.periodKey,
        },
      });
      return {
        ...none,
        currencyMismatch: true,
        currency,
        reason: "currency_mismatch",
      };
    }

    const fees = byCurrency.get(currency) ?? [];
    const totalCents = fees.reduce((sum, fee) => sum + fee.feeCents, 0);
    if (totalCents <= 0) {
      return { ...none, skippedZero: true, currency, reason: "zero_owed" };
    }

    let invoiceId: Id<"billingInvoices">;
    if (existingWinner && existingWinner.status === "failed") {
      invoiceId = existingWinner._id;
      await ctx.db.patch(invoiceId, {
        currency,
        feeIds: [],
        totalCents,
        status: "claiming",
        lsCheckoutId: undefined,
        lsCheckoutUrl: undefined,
        lsOrderId: undefined,
        lastError: undefined,
        createdAt: args.nowMs,
        createdLsAt: undefined,
        paidAt: undefined,
      });
    } else if (
      existingWinner &&
      existingWinner.status === "claiming" &&
      existingWinner.feeIds.length === 0 &&
      existingWinner.lsCheckoutId == null
    ) {
      invoiceId = existingWinner._id;
      await ctx.db.patch(invoiceId, {
        currency,
        feeIds: [],
        totalCents,
        createdAt: args.nowMs,
        lastError: undefined,
      });
    } else {
      invoiceId = await ctx.db.insert("billingInvoices", {
        userId: args.userId,
        claimKey,
        periodKey: args.periodKey,
        currency,
        feeIds: [],
        totalCents,
        status: "claiming",
        createdAt: args.nowMs,
      });

      const winner = await winnerForClaimKey(ctx, claimKey);
      if (!winner || winner._id !== invoiceId) {
        await ctx.db.delete(invoiceId);
        return {
          ...none,
          reason: "already_claimed",
          invoiceId: winner?._id ?? null,
          totalCents: winner?.totalCents ?? 0,
          feeCount: winner?.feeIds.length ?? 0,
          currency: winner?.currency ?? currency,
        };
      }
    }

    const feeIds: Id<"recoveryFees">[] = [];
    for (const fee of fees) {
      const fresh = await ctx.db.get(fee._id);
      if (!fresh || !isBillableFee(fresh)) continue;
      await ctx.db.patch(fee._id, { billingInvoiceId: invoiceId });
      feeIds.push(fee._id);
    }

    const linkedTotal = fees
      .filter((fee) => feeIds.includes(fee._id))
      .reduce((sum, fee) => sum + fee.feeCents, 0);

    if (feeIds.length === 0 || linkedTotal <= 0) {
      await ctx.db.patch(invoiceId, {
        feeIds: [],
        totalCents: 0,
        status: "failed",
        lastError: "zero_owed_after_link",
      });
      return {
        ...none,
        skippedZero: true,
        invoiceId,
        currency,
        reason: "zero_owed",
      };
    }

    await ctx.db.patch(invoiceId, {
      feeIds,
      totalCents: linkedTotal,
      status: "claiming",
    });

    return {
      claimed: true,
      skippedZero: false,
      currencyMismatch: false,
      currencyMixed: false,
      reason: null,
      invoiceId,
      totalCents: linkedTotal,
      feeCount: feeIds.length,
      currency,
    };
  },
});

export const attachLsCheckout = internalMutation({
  args: {
    invoiceId: v.id("billingInvoices"),
    lsCheckoutId: v.string(),
    lsCheckoutUrl: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    nowMs: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) return false;
    if (invoice.status === "paid") return false;
    if (
      invoice.lsCheckoutId != null &&
      invoice.lsCheckoutId !== args.lsCheckoutId
    ) {
      return false;
    }

    const safeUrl = allowHttpsUrl(args.lsCheckoutUrl);
    await ctx.db.patch(args.invoiceId, {
      status: "created",
      lsCheckoutId: args.lsCheckoutId,
      lsCheckoutUrl: safeUrl ?? undefined,
      expiresAt: args.expiresAt,
      createdLsAt: args.nowMs,
      lastError: safeUrl ? undefined : "missing_checkout_url",
    });
    return true;
  },
});

export const recordCheckoutEmailSent = internalMutation({
  args: {
    invoiceId: v.id("billingInvoices"),
    nowMs: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) return null;
    await ctx.db.patch(args.invoiceId, { checkoutEmailSentAt: args.nowMs });
    return null;
  },
});

export const getInvoiceCheckoutFields = internalQuery({
  args: { invoiceId: v.id("billingInvoices") },
  returns: v.union(
    v.object({
      _id: v.id("billingInvoices"),
      status: billingInvoiceStatusValidator,
      totalCents: v.number(),
      feeCount: v.number(),
      lsCheckoutId: v.union(v.string(), v.null()),
      lsCheckoutUrl: v.union(v.string(), v.null()),
      expiresAt: v.union(v.number(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.invoiceId);
    if (!row) return null;
    return {
      _id: row._id,
      status: row.status,
      totalCents: row.totalCents,
      feeCount: row.feeIds.length,
      lsCheckoutId: row.lsCheckoutId ?? null,
      lsCheckoutUrl: allowHttpsUrl(row.lsCheckoutUrl),
      expiresAt: row.expiresAt ?? null,
    };
  },
});

export const markBillingClaimFailed = internalMutation({
  args: {
    invoiceId: v.id("billingInvoices"),
    error: v.string(),
    unlinkFees: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) return null;
    if (invoice.status === "paid") return null;

    if (args.unlinkFees) {
      await unlinkFeesFromInvoice(ctx, invoice._id, invoice.feeIds);
    }

    await ctx.db.patch(args.invoiceId, {
      status: "failed",
      lastError: args.error.slice(0, 500),
      feeIds: args.unlinkFees ? [] : invoice.feeIds,
    });

    await writeAuditLog(ctx, {
      actorUserId: null,
      targetUserId: invoice.userId,
      action: "fee_invoice:failed",
      metadata: {
        invoiceId: invoice._id,
        claimKey: invoice.claimKey,
        error: args.error.slice(0, 300),
      },
    });
    return null;
  },
});

export const recordFeeInvoiceCreated = internalMutation({
  args: {
    invoiceId: v.id("billingInvoices"),
    actorUserId: v.union(v.id("users"), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) return null;
    await writeAuditLog(ctx, {
      actorUserId: args.actorUserId,
      targetUserId: invoice.userId,
      action: "fee_invoice:created",
      metadata: {
        invoiceId: invoice._id,
        claimKey: invoice.claimKey,
        periodKey: invoice.periodKey,
        totalCents: invoice.totalCents,
        feeCount: invoice.feeIds.length,
        lsCheckoutId: invoice.lsCheckoutId,
        lsCheckoutUrl: invoice.lsCheckoutUrl,
      },
    });
    return null;
  },
});

export const findBillingInvoiceForPaidOrder = internalQuery({
  args: {
    claimKey: v.optional(v.string()),
    billingInvoiceId: v.optional(v.string()),
    lsCheckoutId: v.optional(v.string()),
    lsOrderId: v.optional(v.string()),
  },
  returns: v.union(v.id("billingInvoices"), v.null()),
  handler: async (ctx, args) => {
    if (args.claimKey) {
      const byClaim = await winnerForClaimKey(ctx, args.claimKey);
      if (byClaim) return byClaim._id;
    }

    if (args.billingInvoiceId) {
      try {
        const row = await ctx.db.get(
          args.billingInvoiceId as Id<"billingInvoices">,
        );
        if (row) return row._id;
      } catch {
        // Malformed Convex id from webhook custom data — fall through.
      }
    }

    if (args.lsCheckoutId) {
      const byCheckout = await ctx.db
        .query("billingInvoices")
        .withIndex("by_lsCheckoutId", (q) =>
          q.eq("lsCheckoutId", args.lsCheckoutId),
        )
        .first();
      if (byCheckout) return byCheckout._id;
    }

    if (args.lsOrderId) {
      const byOrder = await ctx.db
        .query("billingInvoices")
        .withIndex("by_lsOrderId", (q) => q.eq("lsOrderId", args.lsOrderId))
        .first();
      if (byOrder) return byOrder._id;
    }

    return null;
  },
});

/**
 * Mark a claimed invoice paid and flip linked fees to `invoiced`.
 * Replay-safe: a second paid delivery is a no-op success.
 * Does not mark paid on test-mode, non-paid status, or when both
 * subtotal and total are below the claimed cents (tax may exceed).
 */
export const markBillingInvoicePaid = internalMutation({
  args: {
    invoiceId: v.id("billingInvoices"),
    lsOrderId: v.string(),
    lsCheckoutId: v.optional(v.string()),
    orderStatus: v.string(),
    subtotalCents: v.number(),
    totalCents: v.number(),
    testMode: v.boolean(),
    paidAt: v.number(),
  },
  returns: v.object({
    marked: v.boolean(),
    alreadyPaid: v.boolean(),
    reason: v.union(v.string(), v.null()),
    feeCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) {
      return {
        marked: false,
        alreadyPaid: false,
        reason: "not_found",
        feeCount: 0,
      };
    }

    if (invoice.status === "paid") {
      return {
        marked: true,
        alreadyPaid: true,
        reason: null,
        feeCount: invoice.feeIds.length,
      };
    }

    if (args.testMode) {
      await writeAuditLog(ctx, {
        actorUserId: null,
        targetUserId: invoice.userId,
        action: "fee_invoice:skipped_test_mode",
        metadata: {
          invoiceId: invoice._id,
          lsOrderId: args.lsOrderId,
          claimKey: invoice.claimKey,
        },
      });
      return {
        marked: false,
        alreadyPaid: false,
        reason: "test_mode",
        feeCount: invoice.feeIds.length,
      };
    }

    if (
      !orderCoversClaimedCents(
        invoice.totalCents,
        args.subtotalCents,
        args.totalCents,
      )
    ) {
      await writeAuditLog(ctx, {
        actorUserId: null,
        targetUserId: invoice.userId,
        action: "fee_invoice:amount_below",
        metadata: {
          invoiceId: invoice._id,
          lsOrderId: args.lsOrderId,
          claimKey: invoice.claimKey,
          claimedCents: invoice.totalCents,
          subtotalCents: args.subtotalCents,
          totalCents: args.totalCents,
        },
      });
      return {
        marked: false,
        alreadyPaid: false,
        reason: "amount_below",
        feeCount: invoice.feeIds.length,
      };
    }

    const status = args.orderStatus.trim().toLowerCase();
    if (status !== "paid") {
      await writeAuditLog(ctx, {
        actorUserId: null,
        targetUserId: invoice.userId,
        action: "fee_invoice:not_paid",
        metadata: {
          invoiceId: invoice._id,
          lsOrderId: args.lsOrderId,
          orderStatus: args.orderStatus,
          claimKey: invoice.claimKey,
        },
      });
      return {
        marked: false,
        alreadyPaid: false,
        reason: "not_paid",
        feeCount: invoice.feeIds.length,
      };
    }

    let markedFees = 0;
    for (const feeId of invoice.feeIds) {
      const fee = await ctx.db.get(feeId);
      if (!fee) continue;
      if (fee.status !== "owed") continue;
      await ctx.db.patch(feeId, { status: "invoiced" });
      markedFees += 1;
    }

    await ctx.db.patch(args.invoiceId, {
      status: "paid",
      lsOrderId: args.lsOrderId,
      lsCheckoutId: args.lsCheckoutId ?? invoice.lsCheckoutId,
      paidAt: args.paidAt,
      lastError: undefined,
    });

    await writeAuditLog(ctx, {
      actorUserId: null,
      targetUserId: invoice.userId,
      action: "fee_invoice:paid",
      metadata: {
        invoiceId: invoice._id,
        claimKey: invoice.claimKey,
        lsOrderId: args.lsOrderId,
        totalCents: args.totalCents,
        feeCount: markedFees,
      },
    });

    return {
      marked: true,
      alreadyPaid: false,
      reason: null,
      feeCount: markedFees,
    };
  },
});

export const assertStaffCanInvoiceUser = internalMutation({
  args: {
    userId: v.id("users"),
    reason: v.string(),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const actor = await requireStaff(ctx);
    const reason = requireActionReason(args.reason);
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("Target user not found");
    assertCanActOnTarget(actor, target);

    await writeAuditLog(ctx, {
      actorUserId: actor._id,
      targetUserId: target._id,
      action: "fee_invoice:force_run",
      reason,
      metadata: { targetUserId: target._id },
    });

    return actor._id;
  },
});

function toFeeInvoiceListItem(row: Doc<"billingInvoices">) {
  return {
    _id: row._id,
    userId: row.userId,
    claimKey: row.claimKey,
    periodKey: row.periodKey,
    currency: row.currency,
    totalCents: row.totalCents,
    feeCount: row.feeIds.length,
    status: row.status,
    lsCheckoutId: row.lsCheckoutId ?? null,
    lsCheckoutUrl: allowHttpsUrl(row.lsCheckoutUrl),
    lsOrderId: row.lsOrderId ?? null,
    expiresAt: row.expiresAt ?? null,
    checkoutEmailSentAt: row.checkoutEmailSentAt ?? null,
    createdAt: row.createdAt,
    paidAt: row.paidAt ?? null,
    lastError: row.lastError ?? null,
  };
}

/**
 * Staff/Admin: open and historical fee invoices for a merchant, including
 * the HTTPS checkout URL. After `expiresAt` the LS link dies — release
 * the claim (this mutation below) so the next run can re-invoice.
 */
export const adminListFeeInvoicesForUser = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  returns: v.array(feeInvoiceListItemValidator),
  handler: async (ctx, args) => {
    const actor = await requireStaff(ctx);
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("Target user not found");
    assertCanActOnTarget(actor, target);

    const limit = Math.min(Math.max(args.limit ?? 24, 1), 100);
    const rows = await ctx.db
      .query("billingInvoices")
      .withIndex("by_user_period", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);

    return rows.map(toFeeInvoiceListItem);
  },
});

/**
 * Merchant: unpaid `created` invoices that still have a reachable pay URL.
 * Auth-scoped to the signed-in product user — no self-invoice create.
 */
export const getMyOpenFeeInvoices = query({
  args: {},
  returns: v.array(feeInvoiceListItemValidator),
  handler: async (ctx) => {
    const user = await resolveProductUserOrNull(ctx);
    if (!user) return [];

    const rows = await ctx.db
      .query("billingInvoices")
      .withIndex("by_user_period", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(24);

    return rows
      .filter(
        (row) =>
          row.status === "created" && allowHttpsUrl(row.lsCheckoutUrl) != null,
      )
      .map(toFeeInvoiceListItem);
  },
});

/**
 * Staff/Admin: release a stuck or unpaid period claim so the next run
 * can invoice the same owed set. Paid invoices cannot be released.
 * Does not void an LS checkout — if `created` and past `expiresAt`,
 * release here so the next monthly/force run can charge the same fees.
 * If the LS checkout is still live, do not release unless ops will
 * ignore that checkout (releasing then re-running can double-bill).
 */
export const adminReleaseFeeInvoiceClaim = mutation({
  args: {
    userId: v.id("users"),
    periodKey: v.string(),
    reason: v.string(),
  },
  returns: v.object({
    released: v.boolean(),
    invoiceId: v.union(v.id("billingInvoices"), v.null()),
  }),
  handler: async (ctx, args) => {
    const actor = await requireStaff(ctx);
    const reason = requireActionReason(args.reason);
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("Target user not found");
    assertCanActOnTarget(actor, target);

    const claimKey = feeInvoiceClaimKey(args.userId, args.periodKey);
    const invoice = await winnerForClaimKey(ctx, claimKey);
    if (!invoice) {
      return { released: false, invoiceId: null };
    }
    if (invoice.status === "paid") {
      throw new Error("Cannot release a paid fee invoice");
    }

    await unlinkFeesFromInvoice(ctx, invoice._id, invoice.feeIds);
    await ctx.db.patch(invoice._id, {
      status: "failed",
      lastError: `released_by_staff:${reason.slice(0, 200)}`,
      feeIds: [],
    });

    await writeAuditLog(ctx, {
      actorUserId: actor._id,
      targetUserId: target._id,
      action: "fee_invoice:released",
      reason,
      metadata: {
        invoiceId: invoice._id,
        claimKey,
        priorStatus: invoice.status,
        lsCheckoutId: invoice.lsCheckoutId,
      },
    });

    return { released: true, invoiceId: invoice._id };
  },
});
