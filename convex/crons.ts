import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "purge expired soft-deleted merchant data",
  { hourUTC: 4, minuteUTC: 15 },
  internal.functions.admin.purgeExpiredSoftDeletes,
);

crons.interval(
  "sweep expired admin takeovers",
  { minutes: 2 },
  internal.functions.adminTakeover.sweepExpiredTakeovers,
);

crons.monthly(
  "invoice owed recovery fees",
  { day: 1, hourUTC: 6, minuteUTC: 0 },
  internal.functions.feeBillingActions.runMonthlyFeeInvoices,
);

crons.monthly(
  "release held declines for new month capacity",
  { day: 1, hourUTC: 0, minuteUTC: 20 },
  internal.functions.declineHoldActions.runMonthlyHeldDeclineRelease,
);

export default crons;
