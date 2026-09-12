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

export default crons;
