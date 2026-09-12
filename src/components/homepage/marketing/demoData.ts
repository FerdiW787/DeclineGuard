import type { DayRow } from "@/components/dashboard/OverviewSlider";
import type { ActivityTimelineSimulation } from "@/components/dashboard/ActivityTimeline";
import type {
  ActivityRow,
  OpenFailureRow,
  RecoveredWinRow,
} from "@/components/dashboard/dashboardUi";

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.now();

function daysAgo(n: number) {
  return now - n * DAY_MS;
}

function hoursAgo(n: number) {
  return now - n * 60 * 60 * 1000;
}

function isoDate(daysBack: number) {
  const d = new Date(now - daysBack * DAY_MS);
  d.setHours(12, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 30-day chart with a photogenic recovery curve (demo UI only). */
export function buildMarketingChartRows(): DayRow[] {
  const rows: DayRow[] = [];
  for (let i = 29; i >= 0; i -= 1) {
    const t = (29 - i) / 29;
    const ease = t * t * (3 - 2 * t);
    const recovered = Math.max(
      0,
      Math.round(10800 + ease * 8200 + Math.sin(i * 0.55) * 520),
    );
    rows.push({
      date: isoDate(i),
      moneyRecovered: recovered,
      moneyAtRisk: Math.max(900, Math.round(2800 + Math.sin(i * 0.7) * 500)),
      clientsRecovered: Math.max(0, Math.round(t * 5 + (recovered > 12000 ? 1 : 0))),
      clientsNew: i > 24 ? 0 : Math.max(0, 2 - Math.floor(i / 12)),
      clientsLost: i < 6 ? 1 : 0,
      emailsSent: Math.max(0, Math.round(2 + t * 11 + (i % 3))),
      emailsBounced: i === 18 ? 1 : 0,
    });
  }
  return rows;
}

export const marketingChartRows = buildMarketingChartRows();

export const marketingRecoveredThisMonthCents = marketingChartRows.reduce(
  (sum, row) => sum + row.moneyRecovered,
  0,
);

export const marketingRecoveredPriorMonthCents = Math.round(
  marketingRecoveredThisMonthCents * 0.72,
);

export const marketingOpenFailures: OpenFailureRow[] = [
  {
    _id: "mf1",
    customerEmail: "maya@studio.io",
    customerName: "Maya Chen",
    productName: "Pro Plan",
    amountCents: 2900,
    currency: "eur",
    failedAt: daysAgo(1),
    updatePaymentUrl: "https://",
    sequenceLabel: "Day 0 sent",
    emailsSentCount: 1,
    testMode: false,
    nextEmailAt: daysAgo(-2),
    declineReason: "insufficient_funds",
    lastEmailDeliveryStatus: "delivered",
    day0SentAt: daysAgo(1),
  },
  {
    _id: "mf2",
    customerEmail: "alex@build.co",
    customerName: "Alex Rivera",
    productName: "Team",
    amountCents: 4900,
    currency: "eur",
    failedAt: daysAgo(3),
    updatePaymentUrl: "https://",
    sequenceLabel: "Day 2 queued",
    emailsSentCount: 2,
    testMode: false,
    nextEmailAt: daysAgo(-1),
    declineReason: "card_expired",
    lastEmailDeliveryStatus: "delivered",
    day0SentAt: daysAgo(3),
    day2SentAt: daysAgo(1),
  },
  {
    _id: "mf3",
    customerEmail: "sam@ship.app",
    customerName: "Sam Okonkwo",
    productName: "Starter",
    amountCents: 1900,
    currency: "eur",
    failedAt: daysAgo(5),
    updatePaymentUrl: "https://",
    sequenceLabel: "Day 5 sent",
    emailsSentCount: 3,
    testMode: false,
    nextEmailAt: null,
    declineReason: "generic_decline",
    lastEmailDeliveryStatus: "delivered",
    day0SentAt: daysAgo(5),
    day2SentAt: daysAgo(3),
    day5SentAt: daysAgo(1),
  },
  {
    _id: "mf4",
    customerEmail: "jules@founder.dev",
    customerName: "Jules Park",
    productName: "Annual",
    amountCents: 9900,
    currency: "eur",
    failedAt: daysAgo(0),
    updatePaymentUrl: "https://",
    sequenceLabel: "Queued",
    emailsSentCount: 0,
    testMode: false,
    nextEmailAt: daysAgo(0),
    declineReason: "insufficient_funds",
    lastEmailDeliveryStatus: null,
  },
  {
    _id: "mf5",
    customerEmail: "rio@craft.so",
    customerName: "Rio Alvarez",
    productName: "Pro Plan",
    amountCents: 2900,
    currency: "eur",
    failedAt: daysAgo(2),
    updatePaymentUrl: "https://",
    sequenceLabel: "Day 0 sent",
    emailsSentCount: 1,
    testMode: false,
    nextEmailAt: daysAgo(-1),
    declineReason: "do_not_honor",
    lastEmailDeliveryStatus: "delivered",
    day0SentAt: daysAgo(2),
  },
  {
    _id: "mf6",
    customerEmail: "nina@pixel.fm",
    customerName: "Nina Berg",
    productName: "Team",
    amountCents: 4900,
    currency: "eur",
    failedAt: daysAgo(6),
    updatePaymentUrl: "https://",
    sequenceLabel: "Day 2 sent",
    emailsSentCount: 2,
    testMode: false,
    nextEmailAt: daysAgo(-3),
    declineReason: "card_expired",
    lastEmailDeliveryStatus: "bounced",
    day0SentAt: daysAgo(6),
    day2SentAt: daysAgo(4),
  },
];

export const marketingActivity: ActivityRow[] = [
  {
    _id: "ma1",
    type: "recovered",
    title: "maya@studio.io / recovered",
    detail: "Pro Plan · Maya Chen",
    customerEmail: "maya@studio.io",
    amountCents: 2900,
    currency: "eur",
    occurredAt: hoursAgo(2),
  },
  {
    _id: "ma2",
    type: "email_sent",
    title: "alex@build.co / Email 2",
    detail: "Day 2 · Direct tone",
    customerEmail: "alex@build.co",
    amountCents: 4900,
    currency: "eur",
    occurredAt: hoursAgo(9),
  },
  {
    _id: "ma3",
    type: "payment_failed",
    title: "jules@founder.dev / Recovery failed",
    detail: "Annual · Jules Park",
    customerEmail: "jules@founder.dev",
    amountCents: 9900,
    currency: "eur",
    occurredAt: hoursAgo(14),
  },
  {
    _id: "ma4",
    type: "recovered",
    title: "sam@ship.app / recovered",
    detail: "Starter · Sam Okonkwo",
    customerEmail: "sam@ship.app",
    amountCents: 1900,
    currency: "eur",
    occurredAt: daysAgo(2),
  },
  {
    _id: "ma5",
    type: "email_sent",
    title: "maya@studio.io / Email 1",
    detail: "Day 0 · Gentle tone",
    customerEmail: "maya@studio.io",
    amountCents: 2900,
    currency: "eur",
    occurredAt: daysAgo(3),
  },
  {
    _id: "ma6",
    type: "email_sent",
    title: "sam@ship.app / Email 3",
    detail: "Day 5 · Urgent tone",
    customerEmail: "sam@ship.app",
    amountCents: 1900,
    currency: "eur",
    occurredAt: daysAgo(5),
  },
  {
    _id: "ma7",
    type: "payment_failed",
    title: "lee@north.io / Recovery failed",
    detail: "Team · Lee Park",
    customerEmail: "lee@north.io",
    amountCents: 7900,
    currency: "eur",
    occurredAt: daysAgo(6),
  },
  {
    _id: "ma8",
    type: "recovered",
    title: "nina@pixel.fm / recovered",
    detail: "Studio · Nina Voss",
    customerEmail: "nina@pixel.fm",
    amountCents: 4900,
    currency: "eur",
    occurredAt: daysAgo(12),
  },
  {
    _id: "ma9",
    type: "payment_failed",
    title: "rio@atlas.co / Recovery failed",
    detail: "Pro Plan · Rio Alvarez",
    customerEmail: "rio@atlas.co",
    amountCents: 2900,
    currency: "eur",
    occurredAt: daysAgo(18),
  },
  {
    _id: "ma10",
    type: "email_sent",
    title: "lee@north.io / Email 1",
    detail: "Day 0 · Gentle tone",
    customerEmail: "lee@north.io",
    amountCents: 7900,
    currency: "eur",
    occurredAt: daysAgo(22),
  },
];

export const marketingStore = {
  name: "Cool SaaS",
  brandColor: "#0c0a09",
  secondaryColor: "#facc15",
  logoUrl: null as string | null,
  currency: "eur",
  supportEmail: "hello@coolsaas.com",
  socialX: null as string | null,
  socialLinkedin: "https://linkedin.com",
  socialYoutube: null as string | null,
  socialInstagram: null as string | null,
  fromName: "Cool SaaS",
  replyToEmail: "billing@coolsaas.com",
  fromAddressHint: "recovery@coolsaas.com",
  showDeclineGuardBadge: true,
  templateId: "gentle",
  emailsSentThisMonth: 47,
} as const;

export const marketingOverviewLabels = {
  userFullName: "Ferdi",
  recoveredLabel: new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(marketingRecoveredThisMonthCents / 100),
  openCount: marketingOpenFailures.length,
  openAtRiskLabel: new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(
    marketingOpenFailures.reduce((sum, row) => sum + row.amountCents, 0) / 100,
  ),
  emailsSentLabel: String(marketingStore.emailsSentThisMonth),
  recoveryRateLabel: "31%",
  feesOwedLabel: "€84",
  youKeepLabel: new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Math.max(0, marketingRecoveredThisMonthCents - 8400) / 100),
  openAtRiskCents: marketingOpenFailures.reduce(
    (sum, row) => sum + row.amountCents,
    0,
  ),
  recoveryRatePercent: 31,
} as const;

export const marketingRecoveredWins: RecoveredWinRow[] = [
  {
    _id: "mw1",
    customerEmail: "maya@studio.io",
    customerName: "Maya Chen",
    productName: "Pro Plan",
    amountCents: 2900,
    currency: "eur",
    failedAt: daysAgo(4),
    recoveredAt: daysAgo(0),
    testMode: false,
  },
  {
    _id: "mw2",
    customerEmail: "sam@ship.app",
    customerName: "Sam Okonkwo",
    productName: "Starter",
    amountCents: 1900,
    currency: "eur",
    failedAt: daysAgo(8),
    recoveredAt: daysAgo(2),
    testMode: false,
  },
  {
    _id: "mw3",
    customerEmail: "lee@north.io",
    customerName: "Lee Nguyen",
    productName: "Team",
    amountCents: 4900,
    currency: "eur",
    failedAt: daysAgo(12),
    recoveredAt: daysAgo(5),
    testMode: false,
  },
];

export const marketingActivitySimulation: ActivityTimelineSimulation = {
  emails: [
    ...new Set(
      marketingActivity
        .map((e) => e.customerEmail)
        .filter((e): e is string => Boolean(e)),
    ),
  ],
  events: marketingActivity.map((e) => ({
    _id: e._id,
    type: e.type,
    title: e.title,
    detail: e.detail,
    customerEmail: e.customerEmail,
    amountCents: e.amountCents,
    currency: e.currency,
    occurredAt: e.occurredAt,
  })),
};
