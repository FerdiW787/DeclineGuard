/**
 * Role checks for staff reclaimStore: current owner must be a merchant.
 * Run: npx tsx scripts/assert-admin-reclaim.ts
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertCurrentStoreOwnerMayBeReclaimed,
  canActOnTarget,
  currentStoreOwnerMayBeReclaimed,
  reclaimLiveConnectionMaySoftDelete,
  reclaimOwnerDecision,
} from "../convex/lib/admin";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const adminSrc = readFileSync(join(repoRoot, "convex/functions/admin.ts"), "utf8");

assert(currentStoreOwnerMayBeReclaimed("user") === true, "merchant owner may be reclaimed");
assert(
  currentStoreOwnerMayBeReclaimed("standard") === true,
  "legacy standard merchant may be reclaimed",
);
assert(currentStoreOwnerMayBeReclaimed("staff") === false, "staff owner must not be reclaimed");
assert(currentStoreOwnerMayBeReclaimed("admin") === false, "admin owner must not be reclaimed");

assertCurrentStoreOwnerMayBeReclaimed({ role: "user" });

let missingOwnerThrew = false;
try {
  assertCurrentStoreOwnerMayBeReclaimed(null);
} catch (err) {
  missingOwnerThrew =
    err instanceof Error && err.message === "Current store owner not found";
}
assert(missingOwnerThrew, "missing owner fails closed");

let staffOwnerThrew = false;
try {
  assertCurrentStoreOwnerMayBeReclaimed({ role: "staff" });
} catch (err) {
  staffOwnerThrew =
    err instanceof Error &&
    err.message === "Cannot reclaim a store from a Staff or Admin account.";
}
assert(staffOwnerThrew, "staff current owner throws before soft-delete");

let adminOwnerThrew = false;
try {
  assertCurrentStoreOwnerMayBeReclaimed({ role: "admin" });
} catch (err) {
  adminOwnerThrew =
    err instanceof Error &&
    err.message === "Cannot reclaim a store from a Staff or Admin account.";
}
assert(adminOwnerThrew, "admin current owner throws before soft-delete");

const missingOwnerDecision = reclaimOwnerDecision(null);
assert(
  missingOwnerDecision.allow === false &&
    missingOwnerDecision.reason === "missing_owner",
  "reclaimOwnerDecision fails closed on a missing row",
);
assert(
  reclaimLiveConnectionMaySoftDelete({
    bindingOwner: { role: "user" },
    connectionOwner: { role: "user" },
  }).allow === true,
  "merchant binding + merchant connection may soft-delete",
);
const staffConnDecision = reclaimLiveConnectionMaySoftDelete({
  bindingOwner: { role: "user" },
  connectionOwner: { role: "staff" },
});
assert(
  staffConnDecision.allow === false &&
    staffConnDecision.reason === "privileged_owner",
  "staff connection owner is refused even when they are the new owner",
);
const adminConnDecision = reclaimLiveConnectionMaySoftDelete({
  bindingOwner: { role: "user" },
  connectionOwner: { role: "admin" },
});
assert(
  adminConnDecision.allow === false &&
    adminConnDecision.reason === "privileged_owner",
  "admin connection owner is refused even when they are the new owner",
);
const missingConnOwner = reclaimLiveConnectionMaySoftDelete({
  bindingOwner: { role: "user" },
  connectionOwner: null,
});
const missingBindingOwner = reclaimLiveConnectionMaySoftDelete({
  bindingOwner: null,
  connectionOwner: { role: "user" },
});
assert(
  missingConnOwner.allow === false &&
    missingConnOwner.reason === "missing_owner" &&
    missingBindingOwner.allow === false &&
    missingBindingOwner.reason === "missing_owner",
  "missing binding or connection owner fails closed and must not soft-delete",
);

assert(canActOnTarget("staff", "user") === true, "staff may still act on a merchant new owner");
assert(canActOnTarget("staff", "staff") === false, "staff still cannot act on staff");
assert(canActOnTarget("staff", "admin") === false, "staff still cannot act on admin");
assert(canActOnTarget("admin", "staff") === true, "admin may still act on a staff new owner");

const reclaimFn = adminSrc.slice(
  adminSrc.indexOf("export const reclaimStore"),
  adminSrc.indexOf("async function softDeleteConnectionAsAdmin"),
);
assert(
  reclaimFn.includes("assertCanActOnTarget(actor, toUser)") &&
    reclaimFn.includes("reclaimLiveConnectionMaySoftDelete") &&
    reclaimFn.includes("assertCurrentStoreOwnerMayBeReclaimed(currentOwner)") &&
    reclaimFn.includes("assertCurrentStoreOwnerMayBeReclaimed(connOwner)") &&
    reclaimFn.includes("Current store owner not found") &&
    reclaimFn.indexOf("reclaimLiveConnectionMaySoftDelete") <
      reclaimFn.indexOf("softDeleteConnectionAsAdmin") &&
    reclaimFn.indexOf("assertCurrentStoreOwnerMayBeReclaimed(connOwner)") <
      reclaimFn.indexOf("softDeleteConnectionAsAdmin") &&
    !reclaimFn.includes("otherConn.userId !== args.toUserId") &&
    reclaimFn.includes("const currentOwner = await ctx.db.get(binding.userId)"),
  "reclaimStore checks binding and connection owners before soft-delete, including toUserId, and keeps the new-owner check",
);

console.log(
  "asserts green: reclaim refuses staff/admin connection owners including toUserId; missing owner fails closed; merchant owners still reclaim; new-owner check kept",
);
