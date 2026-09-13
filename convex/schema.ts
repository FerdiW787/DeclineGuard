import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { emailCopyValidator } from "./lib/emailBlockValidators";

export const deletedByValidator = v.union(
  v.literal("user"),
  v.literal("admin"),
  v.literal("system"),
);

/**
 * Recovery policy action — sole source of truth for what to do next.
 * - wait: Do not send email yet (LS is still retrying)
 * - nudge_update_pm: Send gentle update-PM email (attempt 2)
 * - push_update_pm: Send direct/urgent update-PM email (attempt 3+)
 * - stop: Sequence complete — recovered, cancelled, or expired
 */
export const recoveryActionValidator = v.union(
  v.literal("wait"),
  v.literal("nudge_update_pm"),
  v.literal("push_update_pm"),
  v.literal("stop"),
);

export const accountStatusValidator = v.union(
  v.literal("active"),
  v.literal("frozen"),
  v.literal("disabled"),
);

/** Billing plan: free (10% recovery fee) or pro (4% recovery fee). */
export const planValidator = v.union(v.literal("free"), v.literal("pro"));

/** user = merchant; staff = help desk; admin = full control. `standard` is legacy user. */
export const roleValidator = v.union(
  v.literal("user"),
  v.literal("staff"),
  v.literal("admin"),
  v.literal("standard"),
);

export default defineSchema({
  users: defineTable({
    userId: v.string(),
    userName: v.string(),
    userProfilePic: v.union(v.string(), v.null()),
    role: roleValidator,
    /** Platform kill-switch for hacked accounts */
    accountStatus: v.optional(accountStatusValidator),
    frozenAt: v.optional(v.number()),
    frozenReason: v.optional(v.string()),
    /** Billing plan: free (10% fee) or pro (4% fee). Defaults to free if unset. */
    plan: v.optional(planValidator),
  }).index("by_userId", ["userId"]),

  /** One Lemon Squeezy account connection per DeclineGuard user (pick active store) */
  lemonConnections: defineTable({
    userId: v.id("users"),
    storeId: v.string(),
    storeName: v.string(),
    storeSlug: v.string(),
    /** LS store avatar (Settings → Store logo); refreshed from API */
    storeAvatarUrl: v.optional(v.string()),
    /** All stores on the linked LS account (for the sidebar picker) */
    stores: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          slug: v.string(),
          avatarUrl: v.optional(v.string()),
        }),
      ),
    ),
    apiKeyCipher: v.string(),
    apiKeyLast4: v.string(),
    testMode: v.boolean(),
    connectedAt: v.number(),
    /** Soft-delete archive (90-day restore window) */
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(deletedByValidator),
  })
    .index("by_user", ["userId"])
    .index("by_storeId", ["storeId"])
    .index("by_deletedAt", ["deletedAt"]),

  /**
   * Maps every LS store on a connection → DeclineGuard user.
   * Webhooks resolve merchants via store_id on the payload.
   */
  lemonStoreBindings: defineTable({
    storeId: v.string(),
    connectionId: v.id("lemonConnections"),
    userId: v.id("users"),
  })
    .index("by_storeId", ["storeId"])
    .index("by_connection", ["connectionId"]),

  /** Audit trail for store bind / unbind / admin reclaim */
  storeBindingHistory: defineTable({
    storeId: v.string(),
    userId: v.id("users"),
    connectionId: v.optional(v.id("lemonConnections")),
    action: v.union(
      v.literal("bound"),
      v.literal("unbound"),
      v.literal("reclaimed"),
    ),
    actor: v.union(
      v.literal("user"),
      v.literal("admin"),
      v.literal("system"),
    ),
    at: v.number(),
    meta: v.optional(v.string()),
  })
    .index("by_storeId_at", ["storeId", "at"])
    .index("by_user_at", ["userId", "at"]),

  /** Idempotency log for Lemon Squeezy webhook deliveries */
  lemonWebhookEvents: defineTable({
    eventKey: v.string(),
    eventName: v.string(),
    storeId: v.string(),
    receivedAt: v.number(),
  })
    .index("by_eventKey", ["eventKey"])
    .index("by_store_received", ["storeId", "receivedAt"]),

  /** Open / recovered failed subscription renewals */
  failedPayments: defineTable({
    userId: v.id("users"),
    connectionId: v.id("lemonConnections"),
    storeId: v.string(),
    subscriptionId: v.string(),
    subscriptionInvoiceId: v.string(),
    customerEmail: v.string(),
    customerName: v.optional(v.string()),
    productName: v.optional(v.string()),
    amountCents: v.number(),
    currency: v.string(),
    status: v.union(
      v.literal("open"),
      v.literal("recovered"),
      v.literal("cancelled"),
    ),
    updatePaymentUrl: v.optional(v.string()),
    failedAt: v.number(),
    recoveredAt: v.optional(v.number()),
    lastEventName: v.string(),
    testMode: v.boolean(),
    /**
     * Number of subscription_payment_failed webhooks since entering past_due.
     * Attempt 1 → wait; Attempt 2 → nudge; Attempt 3+ → push.
     */
    attemptIndex: v.optional(v.number()),
    /**
     * Current recovery policy action — sole source of truth for email logic.
     * Set by webhook handler based on attemptIndex and lifecycle state.
     */
    recoveryAction: v.optional(recoveryActionValidator),
    /** Recovery email tracking */
    lastEmailSentAt: v.optional(v.number()),
    lastEmailInvoiceId: v.optional(v.string()),
    emailsSentCount: v.optional(v.number()),
    /** Sequence: Day 0 gentle → Day 2 direct → Day 5 urgent */
    day0SentAt: v.optional(v.number()),
    day2SentAt: v.optional(v.number()),
    day5SentAt: v.optional(v.number()),
    day2JobId: v.optional(v.id("_scheduled_functions")),
    day5JobId: v.optional(v.id("_scheduled_functions")),
    /** Decline / billing reason from Lemon Squeezy when present */
    declineReason: v.optional(v.string()),
    /** Latest Resend delivery status for the most recent recovery email */
    lastResendMessageId: v.optional(v.string()),
    lastEmailDeliveryStatus: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("delivered"),
        v.literal("bounced"),
        v.literal("complained"),
        v.literal("failed"),
      ),
    ),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(deletedByValidator),
  })
    .index("by_user_status_failedAt", ["userId", "status", "failedAt"])
    .index("by_user_status_recoveredAt", ["userId", "status", "recoveredAt"])
    .index("by_user_failedAt", ["userId", "failedAt"])
    .index("by_store_subscription_status", [
      "storeId",
      "subscriptionId",
      "status",
    ])
    .index("by_invoice", ["subscriptionInvoiceId"])
    .index("by_deletedAt", ["deletedAt"]),

  /** One row per Resend send (for deliverability webhooks) */
  emailSends: defineTable({
    userId: v.id("users"),
    failureId: v.id("failedPayments"),
    storeId: v.string(),
    step: v.union(
      v.literal("day0"),
      v.literal("day2"),
      v.literal("day5"),
    ),
    resendMessageId: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("delivered"),
      v.literal("bounced"),
      v.literal("complained"),
      v.literal("failed"),
    ),
    customerEmail: v.string(),
    sentAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_resendMessageId", ["resendMessageId"])
    .index("by_failure", ["failureId"]),

  /**
   * Free-tier 10% recovery fee ledger (manual invoice for founding stores).
   * No automated charging yet.
   */
  recoveryFees: defineTable({
    userId: v.id("users"),
    failureId: v.id("failedPayments"),
    storeId: v.string(),
    recoveredAt: v.number(),
    amountCents: v.number(),
    feeCents: v.number(),
    currency: v.string(),
    status: v.union(
      v.literal("owed"),
      v.literal("invoiced"),
      v.literal("waived"),
    ),
    testMode: v.boolean(),
  })
    .index("by_user_recoveredAt", ["userId", "recoveredAt"])
    .index("by_failure", ["failureId"]),

  /**
   * Merchant-triggered test drip: Email 1 → +30s → Email 2 → +30s → Email 3.
   * Never uses customer addresses — only the signed-in account email.
   */
  previewSequences: defineTable({
    userId: v.id("users"),
    connectionId: v.id("lemonConnections"),
    toEmail: v.string(),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("cancelled"),
      v.literal("failed"),
    ),
    step1SentAt: v.optional(v.number()),
    step2SentAt: v.optional(v.number()),
    step3SentAt: v.optional(v.number()),
    /** Claim timestamps — set before Resend so retries do not double-send. */
    step1ClaimedAt: v.optional(v.number()),
    step2ClaimedAt: v.optional(v.number()),
    step3ClaimedAt: v.optional(v.number()),
    step1JobId: v.optional(v.id("_scheduled_functions")),
    step2JobId: v.optional(v.id("_scheduled_functions")),
    step3JobId: v.optional(v.id("_scheduled_functions")),
    lastError: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user_started", ["userId", "startedAt"])
    .index("by_user_status", ["userId", "status"]),

  /** Merchant recovery email preferences (from setup wizard + customizations) */
  recoverySettings: defineTable({
    userId: v.id("users"),
    /** Primary brand color (CTA, mark) */
    brandColor: v.string(),
    /** Secondary accent (links, headline accents) */
    secondaryColor: v.optional(v.string()),
    templateId: v.union(
      v.literal("gentle"),
      v.literal("direct"),
      v.literal("urgent"),
    ),
    /** Optional display name in From: "Name <platform@domain>" */
    fromName: v.optional(v.string()),
    /** Optional Reply-To for customer responses */
    replyToEmail: v.optional(v.string()),
    /** Footer “drop us a line” address (falls back to replyTo) */
    supportEmail: v.optional(v.string()),
    socialX: v.optional(v.string()),
    socialLinkedin: v.optional(v.string()),
    socialYoutube: v.optional(v.string()),
    socialInstagram: v.optional(v.string()),
    /**
     * Optional per-step copy overrides (plain-text + block builder).
     * Missing keys fall back to DeclineGuard defaults.
     */
    emailCopy: v.optional(emailCopyValidator),
    /** Body font for recovery emails (preview + sent) */
    emailFont: v.optional(
      v.union(
        v.literal("system"),
        v.literal("inter"),
        v.literal("georgia"),
        v.literal("dm-sans"),
        v.literal("merriweather"),
      ),
    ),
    /** Marketing domain used for brand import */
    brandDomain: v.optional(v.string()),
    /** Set when merchant completes domain brand import gate */
    brandImportCompletedAt: v.optional(v.number()),
    /** CTA button styling (scraped from homepage or defaults) */
    ctaBackgroundColor: v.optional(v.string()),
    ctaTextColor: v.optional(v.string()),
    /** px — use 9999 for pill */
    ctaBorderRadiusPx: v.optional(v.number()),
    /** Email shell / hero background (= page background when imported) */
    emailBackgroundColor: v.optional(v.string()),
    emailTextColor: v.optional(v.string()),
    /** Homepage body / muted / link colors */
    pageBackgroundColor: v.optional(v.string()),
    pageTextColor: v.optional(v.string()),
    mutedTextColor: v.optional(v.string()),
    linkColor: v.optional(v.string()),
    /** Raw CSS font-family from homepage */
    fontFamilyRaw: v.optional(v.string()),
    /** How the last successful kit was captured */
    brandCaptureMethod: v.optional(
      v.union(v.literal("browser"), v.literal("css"), v.literal("defaults")),
    ),
    /** Rolling monthly rebrand quota — set on each successful import */
    lastBrandImportAt: v.optional(v.number()),
    /** Support-granted extra imports (big rebrand) */
    brandImportBonusCredits: v.optional(v.number()),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(deletedByValidator),
  }).index("by_user", ["userId"]),

  /** Timeline feed for the dashboard */
  activityEvents: defineTable({
    userId: v.id("users"),
    storeId: v.string(),
    type: v.union(
      v.literal("payment_failed"),
      v.literal("recovered"),
      v.literal("email_sent"),
      v.literal("email_bounced"),
      v.literal("email_delivered"),
    ),
    title: v.string(),
    detail: v.optional(v.string()),
    /** Customer email for search / filters (also embedded in title) */
    customerEmail: v.optional(v.string()),
    amountCents: v.optional(v.number()),
    currency: v.optional(v.string()),
    relatedFailureId: v.optional(v.id("failedPayments")),
    occurredAt: v.number(),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(deletedByValidator),
  })
    .index("by_user_occurred", ["userId", "occurredAt"])
    .index("by_user_type_occurred", ["userId", "type", "occurredAt"])
    .index("by_deletedAt", ["deletedAt"]),

  /** Fixed-window rate-limit counters (abuse protection) */
  rateLimitBuckets: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_key", ["key"]),

  /** Which user may attach a Convex storage blob to their data */
  storageClaims: defineTable({
    storageId: v.id("_storage"),
    userId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_storageId", ["storageId"])
    .index("by_user", ["userId"]),

  /** Staff / Admin action log (reasons required on privileged writes) */
  auditLogs: defineTable({
    actorUserId: v.union(v.id("users"), v.null()),
    targetUserId: v.optional(v.id("users")),
    action: v.string(),
    /** Required human comment for privileged actions */
    reason: v.optional(v.string()),
    metadata: v.optional(v.string()),
    createdAt: v.number(),
    /** When an Admin undoes this action */
    revokedAt: v.optional(v.number()),
    revokedByUserId: v.optional(v.id("users")),
    revokeNote: v.optional(v.string()),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_target_createdAt", ["targetUserId", "createdAt"]),

  /** Customer ↔ Staff support conversations */
  supportThreads: defineTable({
    userId: v.id("users"),
    topic: v.union(
      v.literal("account"),
      v.literal("billing"),
      v.literal("lemon_squeezy"),
      v.literal("bug"),
      v.literal("other"),
    ),
    subject: v.string(),
    status: v.union(
      v.literal("open"),
      v.literal("claimed"),
      v.literal("waiting_customer"),
      v.literal("waiting_staff"),
      v.literal("resolved"),
      v.literal("closed"),
    ),
    assigneeId: v.optional(v.id("users")),
    claimedAt: v.optional(v.number()),
    /** Set when Staff hands the chat to Admins; cleared when an Admin claims. */
    escalatedAt: v.optional(v.number()),
    escalatedBy: v.optional(v.id("users")),
    lastMessageAt: v.number(),
    lastCustomerMessageAt: v.optional(v.number()),
    lastStaffMessageAt: v.optional(v.number()),
    /** Merchant last opened this chat (for unread badges). */
    customerLastReadAt: v.optional(v.number()),
    merchantAccountStatusAtOpen: accountStatusValidator,
    storeId: v.optional(v.string()),
    storeName: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_status_lastMessageAt", ["status", "lastMessageAt"])
    .index("by_assignee_lastMessageAt", ["assigneeId", "lastMessageAt"])
    .index("by_user_lastMessageAt", ["userId", "lastMessageAt"])
    .index("by_escalatedAt", ["escalatedAt"]),

  supportMessages: defineTable({
    threadId: v.id("supportThreads"),
    authorUserId: v.id("users"),
    authorRole: v.union(
      v.literal("user"),
      v.literal("staff"),
      v.literal("admin"),
    ),
    body: v.string(),
    visibility: v.union(v.literal("customer"), v.literal("internal")),
    /** System notes render as centered strips (handoff, grant confirmations). */
    kind: v.optional(v.union(v.literal("chat"), v.literal("system"))),
    createdAt: v.number(),
  }).index("by_thread_createdAt", ["threadId", "createdAt"]),

  supportEvents: defineTable({
    threadId: v.id("supportThreads"),
    actorUserId: v.id("users"),
    type: v.union(
      v.literal("claim"),
      v.literal("release"),
      v.literal("force_claim"),
      v.literal("resolve"),
      v.literal("close"),
      v.literal("reopen"),
      v.literal("escalate"),
    ),
    at: v.number(),
    meta: v.optional(v.string()),
  })
    .index("by_thread_at", ["threadId", "at"])
    .index("by_at", ["at"]),

  /**
   * Merchant-approved temporary debug access for Staff/Admin.
   * Not Clerk impersonation — consent + audit for in-portal account view.
   */
  staffAccessGrants: defineTable({
    merchantUserId: v.id("users"),
    granteeUserId: v.id("users"),
    threadId: v.id("supportThreads"),
    messageId: v.id("supportMessages"),
    status: v.union(
      v.literal("active"),
      v.literal("revoked"),
      v.literal("expired"),
    ),
    createdAt: v.number(),
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_merchant_status", ["merchantUserId", "status"])
    .index("by_grantee_status", ["granteeUserId", "status"])
    .index("by_thread", ["threadId"]),

  /**
   * Admin takeover (Model B): Admin stays signed in as Admin; product APIs
   * resolve to the merchant while status is active. Separate from
   * staffAccessGrants (read-only simulation).
   */
  adminTakeovers: defineTable({
    merchantUserId: v.id("users"),
    /**
     * Set at consent to the soliciting Admin; confirmed again at start.
     * Only this Admin may start / own the active session.
     */
    adminUserId: v.optional(v.id("users")),
    threadId: v.id("supportThreads"),
    messageId: v.id("supportMessages"),
    status: v.union(
      v.literal("pending_consent"),
      v.literal("active"),
      v.literal("ended"),
      v.literal("expired"),
      v.literal("revoked"),
    ),
    consentedAt: v.optional(v.number()),
    /** Consent expires if Admin never starts. */
    consentExpiresAt: v.number(),
    startedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    /** True after one +30m extend. */
    extended: v.optional(v.boolean()),
    priorAccountStatus: v.optional(
      v.union(
        v.literal("active"),
        v.literal("frozen"),
        v.literal("disabled"),
      ),
    ),
    priorFrozenReason: v.optional(v.string()),
    freezeOwnedByTakeover: v.optional(v.boolean()),
    /** @deprecated Model A leftover — unused in Model B. */
    writeCapabilityNonce: v.optional(v.string()),
    /** @deprecated Model A leftover — unused in Model B. */
    actorClerkSessionId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_merchant_status", ["merchantUserId", "status"])
    .index("by_admin_status", ["adminUserId", "status"])
    .index("by_thread", ["threadId"])
    .index("by_status_expiresAt", ["status", "expiresAt"])
    .index("by_status_consentExpiresAt", ["status", "consentExpiresAt"]),

  /** Public feature request board (submit signed-in; vote anyone). */
  featureRequests: defineTable({
    authorUserId: v.id("users"),
    /** Denormalized at create — avoids N+1 author reads on the public list. */
    authorName: v.string(),
    title: v.string(),
    body: v.string(),
    status: v.union(v.literal("open"), v.literal("added")),
    voteCount: v.number(),
    /** Votes from `u:` keys — Staff/Admin only in API responses. */
    signedInVoteCount: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    addedAt: v.optional(v.number()),
    addedByUserId: v.optional(v.id("users")),
  })
    .index("by_status_votes_created", ["status", "voteCount", "createdAt"])
    .index("by_status_created", ["status", "createdAt"])
    .index("by_author", ["authorUserId"]),

  featureVotes: defineTable({
    requestId: v.id("featureRequests"),
    voterKey: v.string(),
    createdAt: v.number(),
  })
    .index("by_request_voter", ["requestId", "voterKey"])
    .index("by_voter", ["voterKey"]),
});
