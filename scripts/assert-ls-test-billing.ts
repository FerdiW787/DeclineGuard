/**
 * Pure-function checks for LS test-mode plan gating and catalog-omit promote.
 * Run: npx tsx scripts/assert-ls-test-billing.ts
 */
import {
  canPromoteWithoutCatalogIds,
  checkoutNonceMatches,
  extractCustomUserRefs,
  isLsTestBillingAllowed,
  shouldIgnoreLsTestEvent,
} from "../convex/lib/billingPlan";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

assert(!isLsTestBillingAllowed(undefined), "unset env must not allow test billing");
assert(!isLsTestBillingAllowed(""), "empty env must not allow test billing");
assert(!isLsTestBillingAllowed("false"), "false must not allow test billing");
assert(isLsTestBillingAllowed("true"), "true must allow test billing");
assert(isLsTestBillingAllowed("TRUE"), "TRUE must allow test billing");
assert(isLsTestBillingAllowed("1"), "1 must allow test billing");

assert(
  shouldIgnoreLsTestEvent(true, undefined),
  "test_mode without allow env must be ignored",
);
assert(
  shouldIgnoreLsTestEvent(true, "false"),
  "test_mode with ALLOW_LS_TEST_BILLING=false must be ignored",
);
assert(
  !shouldIgnoreLsTestEvent(true, "true"),
  "test_mode with ALLOW_LS_TEST_BILLING=true must apply",
);
assert(
  !shouldIgnoreLsTestEvent(false, undefined),
  "live events must not be ignored",
);

assert(
  !canPromoteWithoutCatalogIds({ knownSub: false, checkoutNonceOk: false }),
  "bare custom_data must not promote when catalog ids omitted",
);
assert(
  canPromoteWithoutCatalogIds({ knownSub: true, checkoutNonceOk: false }),
  "knownSub must promote when catalog ids omitted",
);
assert(
  canPromoteWithoutCatalogIds({ knownSub: false, checkoutNonceOk: true }),
  "pending-checkout nonce must promote when catalog ids omitted",
);

const now = 1_000_000;
assert(
  checkoutNonceMatches({
    provided: "nonce-1",
    stored: "nonce-1",
    expiresAt: now + 1,
    nowMs: now,
  }),
  "matching unexpired nonce must pass",
);
assert(
  !checkoutNonceMatches({
    provided: "nonce-1",
    stored: "nonce-1",
    expiresAt: now,
    nowMs: now,
  }),
  "expired nonce must fail",
);
assert(
  !checkoutNonceMatches({
    provided: "nonce-1",
    stored: "nonce-2",
    expiresAt: now + 1,
    nowMs: now,
  }),
  "mismatched nonce must fail",
);

const refs = extractCustomUserRefs({
  custom_data: {
    convex_user_id: "user123",
    clerk_user_id: "clerk123",
    checkout_nonce: "abc",
  },
});
assert(refs.checkoutNonce === "abc", "extractCustomUserRefs must read checkout_nonce");
assert(refs.convexUserId === "user123", "extractCustomUserRefs must read convex_user_id");

console.log("assert-ls-test-billing: ok");
