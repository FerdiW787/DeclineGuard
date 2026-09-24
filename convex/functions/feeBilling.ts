import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
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
} from "../lib/feeBilling";

const FEE_INVOICE_SCAN_LIMIT = 2000;

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
      return { ...none, currencyMixed: true, reason: "currency_mixed" };
    }

    const currency = [...byCurrency.keys()][0] ?? "USD";
    const storeCurrency = args.storeCurrency.trim().toUpperCase() || "USD";
    if (currency !== storeCurrency) {
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

    await ctx.db.patch(args.invoiceId, {
      status: "created",
      lsCheckoutId: args.lsCheckoutId,
      lsCheckoutUrl: args.lsCheckoutUrl,
      createdLsAt: args.nowMs,
      lastError: undefined,
    });
    return true;
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
 * Does not mark paid on test-mode orders or non-paid LS statuses.
 */
export const markBillingInvoicePaid = internalMutation({
  args: {
    invoiceId: v.id("billingInvoices"),
    lsOrderId: v.string(),
    lsCheckoutId: v.optional(v.string()),
    orderStatus: v.string(),
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

/**
 * Staff/Admin: release a stuck or unpaid period claim so the next run
 * can invoice the same owed set. Paid invoices cannot be released.
 * Does not void an LS checkout — ops must ignore/expire that checkout.
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
