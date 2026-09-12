import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

const SEED_PREFIX = "dg-seed-";
const TARGET_CLERK_ID = "user_3GYDxr01V6jNVEvpw4PobIVtfYf";
const DAY_MS = 24 * 60 * 60 * 1000;
const CURRENCY = "EUR";

const PEOPLE = [
  { name: "Maya Chen", email: "maya@studio.io", product: "Pro Plan" },
  { name: "Alex Rivera", email: "alex@build.co", product: "Team" },
  { name: "Sam Okonkwo", email: "sam@ship.app", product: "Starter" },
  { name: "Jules Park", email: "jules@founder.dev", product: "Annual" },
  { name: "Rio Alvarez", email: "rio@craft.so", product: "Pro Plan" },
  { name: "Nina Berg", email: "nina@pixel.fm", product: "Team" },
  { name: "Lee Nguyen", email: "lee@north.io", product: "Team" },
  { name: "Chris Holm", email: "chris@amonen.com", product: "Pro Plan" },
  { name: "Priya Shah", email: "priya@loom.studio", product: "Starter" },
  { name: "Owen Blake", email: "owen@field.app", product: "Annual" },
  { name: "Hana Idris", email: "hana@northstar.io", product: "Team" },
  { name: "Theo March", email: "theo@kit.fm", product: "Pro Plan" },
] as const;

const AMOUNTS = [7900, 9900, 14900, 19900, 24900, 4900, 12900] as const;

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function personAt(i: number) {
  return PEOPLE[i % PEOPLE.length]!;
}

function amountAt(i: number) {
  return AMOUNTS[i % AMOUNTS.length]!;
}

async function clearPreviousSeed(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const failures = await ctx.db
    .query("failedPayments")
    .withIndex("by_user_failedAt", (q) => q.eq("userId", userId))
    .take(400);
  const seeded = failures.filter((row) =>
    row.subscriptionInvoiceId.startsWith(SEED_PREFIX),
  );
  for (const row of seeded) {
    const fees = await ctx.db
      .query("recoveryFees")
      .withIndex("by_failure", (q) => q.eq("failureId", row._id))
      .take(8);
    for (const fee of fees) await ctx.db.delete(fee._id);
    const sends = await ctx.db
      .query("emailSends")
      .withIndex("by_failure", (q) => q.eq("failureId", row._id))
      .take(8);
    for (const send of sends) await ctx.db.delete(send._id);
    await ctx.db.delete(row._id);
  }

  const activity = await ctx.db
    .query("activityEvents")
    .withIndex("by_user_occurred", (q) => q.eq("userId", userId))
    .take(500);
  for (const row of activity) {
    if (row.detail?.startsWith(SEED_PREFIX) || row.title.startsWith(SEED_PREFIX)) {
      await ctx.db.delete(row._id);
    }
  }

  const webhooks = await ctx.db
    .query("lemonWebhookEvents")
    .withIndex("by_eventKey", (q) => q.eq("eventKey", `${SEED_PREFIX}webhook-live`))
    .take(4);
  for (const row of webhooks) await ctx.db.delete(row._id);
}

async function insertEmail(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    failureId: Id<"failedPayments">;
    storeId: string;
    customerEmail: string;
    step: "day0" | "day2" | "day5";
    sentAt: number;
    status: "queued" | "delivered" | "bounced";
  },
): Promise<void> {
  const label =
    args.step === "day0"
      ? "Email 1 · Day 0"
      : args.step === "day2"
        ? "Email 2 · Day 2"
        : "Email 3 · Day 5";
  await ctx.db.insert("emailSends", {
    userId: args.userId,
    failureId: args.failureId,
    storeId: args.storeId,
    step: args.step,
    resendMessageId: `${SEED_PREFIX}msg-${args.failureId}-${args.step}`,
    status: args.status,
    customerEmail: args.customerEmail,
    sentAt: args.sentAt,
    updatedAt: args.sentAt,
  });
  await ctx.db.insert("activityEvents", {
    userId: args.userId,
    storeId: args.storeId,
    type: args.status === "bounced" ? "email_bounced" : "email_sent",
    title: `${args.customerEmail} / ${label}`,
    detail: `${SEED_PREFIX}${label}`,
    customerEmail: args.customerEmail,
    relatedFailureId: args.failureId,
    occurredAt: args.sentAt,
  });
}

type SeedCase = {
  invoice: string;
  person: (typeof PEOPLE)[number];
  amountCents: number;
  failedAt: number;
  status: "open" | "recovered";
  recoveredAt?: number;
  emails: Array<{
    step: "day0" | "day2" | "day5";
    sentAt: number;
    status: "queued" | "delivered" | "bounced";
  }>;
  declineReason: string;
};

function buildCases(now: number): SeedCase[] {
  const cases: SeedCase[] = [];
  let n = 0;

  // Recovered this month / last 30 days — ~€4.5k, denser toward today.
  const thisMonthRecovered = [
    0.2, 1.1, 2.4, 3.2, 4.8, 5.5, 6.3, 7.9, 8.4, 9.6, 10.2, 11.8, 12.5, 13.1,
    14.7, 15.3, 16.9, 18.2, 19.4, 20.1, 21.6, 22.3, 23.8, 24.5, 25.2, 26.4,
    27.1, 27.8, 28.3,
  ];
  for (const daysAgo of thisMonthRecovered) {
    const person = personAt(n);
    const amountCents = amountAt(n);
    const recoveredAt = now - Math.round(daysAgo * DAY_MS);
    const failedAt = recoveredAt - (1 + (n % 4)) * DAY_MS;
    const emails: SeedCase["emails"] = [
      {
        step: "day0",
        sentAt: failedAt + 20 * 60 * 1000,
        status: "delivered",
      },
    ];
    if (n % 3 !== 0) {
      emails.push({
        step: "day2",
        sentAt: failedAt + 2 * DAY_MS,
        status: "delivered",
      });
    }
    cases.push({
      invoice: `${SEED_PREFIX}rec-${n}`,
      person,
      amountCents,
      failedAt,
      status: "recovered",
      recoveredAt,
      emails,
      declineReason: n % 2 === 0 ? "insufficient_funds" : "generic_decline",
    });
    n += 1;
  }

  // Prior calendar-month recoveries for the MoM chip.
  for (let i = 0; i < 12; i += 1) {
    const person = personAt(n);
    const amountCents = amountAt(n + 2);
    const recoveredAt = now - (32 + i * 2) * DAY_MS;
    const failedAt = recoveredAt - 2 * DAY_MS;
    cases.push({
      invoice: `${SEED_PREFIX}prior-${i}`,
      person,
      amountCents,
      failedAt,
      status: "recovered",
      recoveredAt,
      emails: [
        {
          step: "day0",
          sentAt: failedAt + 15 * 60 * 1000,
          status: "delivered",
        },
      ],
      declineReason: "card_expired",
    });
    n += 1;
  }

  const openSpecs: Array<{
    daysAgo: number;
    emails: SeedCase["emails"];
    reason: string;
  }> = [
    {
      daysAgo: 0.4,
      emails: [],
      reason: "insufficient_funds",
    },
    {
      daysAgo: 1.2,
      emails: [
        { step: "day0", sentAt: now - 1.1 * DAY_MS, status: "delivered" },
      ],
      reason: "do_not_honor",
    },
    {
      daysAgo: 2.3,
      emails: [
        { step: "day0", sentAt: now - 2.2 * DAY_MS, status: "delivered" },
      ],
      reason: "insufficient_funds",
    },
    {
      daysAgo: 3.4,
      emails: [
        { step: "day0", sentAt: now - 3.3 * DAY_MS, status: "delivered" },
        { step: "day2", sentAt: now - 1.3 * DAY_MS, status: "delivered" },
      ],
      reason: "card_expired",
    },
    {
      daysAgo: 5.1,
      emails: [
        { step: "day0", sentAt: now - 5 * DAY_MS, status: "delivered" },
        { step: "day2", sentAt: now - 3 * DAY_MS, status: "bounced" },
      ],
      reason: "card_expired",
    },
    {
      daysAgo: 6.2,
      emails: [
        { step: "day0", sentAt: now - 6.1 * DAY_MS, status: "delivered" },
        { step: "day2", sentAt: now - 4.1 * DAY_MS, status: "delivered" },
        { step: "day5", sentAt: now - 1.1 * DAY_MS, status: "delivered" },
      ],
      reason: "generic_decline",
    },
  ];

  for (const [i, spec] of openSpecs.entries()) {
    const person = personAt(n);
    cases.push({
      invoice: `${SEED_PREFIX}open-${i}`,
      person,
      amountCents: amountAt(n + 1),
      failedAt: now - Math.round(spec.daysAgo * DAY_MS),
      status: "open",
      emails: spec.emails,
      declineReason: spec.reason,
    });
    n += 1;
  }

  return cases;
}

async function seedMerchantDashboard(ctx: MutationCtx): Promise<{
  userId: Id<"users">;
  storeName: string;
  inserted: number;
  recoveredCents: number;
  openCount: number;
}> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_userId", (q) => q.eq("userId", TARGET_CLERK_ID))
    .unique();
  if (!user) throw new Error("Seed target user not found");

  const connection = await ctx.db
    .query("lemonConnections")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .first();
  if (!connection || connection.deletedAt != null) {
    throw new Error("Seed target has no active Lemon Squeezy connection");
  }

  await clearPreviousSeed(ctx, user._id);

  const now = Date.now();
  const cases = buildCases(now);
  let recoveredCents = 0;
  let openCount = 0;

  for (const item of cases) {
    const emailsSentCount = item.emails.length;
    const day0 = item.emails.find((e) => e.step === "day0");
    const day2 = item.emails.find((e) => e.step === "day2");
    const day5 = item.emails.find((e) => e.step === "day5");
    const lastEmail = item.emails[item.emails.length - 1];
    const lastEmailDeliveryStatus = lastEmail?.status === "queued"
      ? undefined
      : lastEmail?.status;

    const failureId = await ctx.db.insert("failedPayments", {
      userId: user._id,
      connectionId: connection._id,
      storeId: connection.storeId,
      subscriptionId: `${SEED_PREFIX}sub-${item.invoice}`,
      subscriptionInvoiceId: item.invoice,
      customerEmail: item.person.email,
      customerName: item.person.name,
      productName: item.person.product,
      amountCents: item.amountCents,
      currency: CURRENCY,
      status: item.status,
      updatePaymentUrl: "https://lemonsqueezy.com",
      failedAt: item.failedAt,
      recoveredAt: item.recoveredAt,
      lastEventName:
        item.status === "recovered"
          ? "subscription_payment_success"
          : "subscription_payment_failed",
      testMode: false,
      lastEmailSentAt: lastEmail?.sentAt,
      emailsSentCount,
      day0SentAt: day0?.sentAt,
      day2SentAt: day2?.sentAt,
      day5SentAt: day5?.sentAt,
      declineReason: item.declineReason,
      lastEmailDeliveryStatus,
    });

    const amountLabel = formatMoney(item.amountCents);
    await ctx.db.insert("activityEvents", {
      userId: user._id,
      storeId: connection.storeId,
      type: "payment_failed",
      title: `${item.person.email} / Recovery failed`,
      detail: `${SEED_PREFIX}${item.person.product} / ${amountLabel}`,
      customerEmail: item.person.email,
      amountCents: item.amountCents,
      currency: CURRENCY,
      relatedFailureId: failureId,
      occurredAt: item.failedAt,
    });

    for (const email of item.emails) {
      await insertEmail(ctx, {
        userId: user._id,
        failureId,
        storeId: connection.storeId,
        customerEmail: item.person.email,
        step: email.step,
        sentAt: email.sentAt,
        status: email.status,
      });
    }

    if (item.status === "recovered" && item.recoveredAt != null) {
      recoveredCents += item.amountCents;
      await ctx.db.insert("activityEvents", {
        userId: user._id,
        storeId: connection.storeId,
        type: "recovered",
        title: `${item.person.email} / recovered`,
        detail: `${SEED_PREFIX}${amountLabel}`,
        customerEmail: item.person.email,
        amountCents: item.amountCents,
        currency: CURRENCY,
        relatedFailureId: failureId,
        occurredAt: item.recoveredAt,
      });
      const feeCents = Math.round(item.amountCents * 0.1);
      if (feeCents > 0) {
        await ctx.db.insert("recoveryFees", {
          userId: user._id,
          failureId,
          storeId: connection.storeId,
          recoveredAt: item.recoveredAt,
          amountCents: item.amountCents,
          feeCents,
          currency: CURRENCY,
          status: "owed",
          testMode: false,
        });
      }
    } else {
      openCount += 1;
    }
  }

  await ctx.db.insert("lemonWebhookEvents", {
    eventKey: `${SEED_PREFIX}webhook-live`,
    eventName: "subscription_payment_success",
    storeId: connection.storeId,
    receivedAt: now - 2 * 60 * 60 * 1000,
  });

  return {
    userId: user._id,
    storeName: connection.storeName,
    inserted: cases.length,
    recoveredCents,
    openCount,
  };
}

export const seedDemoRecoveries = internalMutation({
  args: {},
  returns: v.object({
    userId: v.id("users"),
    storeName: v.string(),
    inserted: v.number(),
    recoveredCents: v.number(),
    openCount: v.number(),
  }),
  handler: async (ctx) => {
    return await seedMerchantDashboard(ctx);
  },
});
