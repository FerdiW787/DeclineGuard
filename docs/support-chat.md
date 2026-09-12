# Support chat (Staff & Admin)

In-app help for signed-in merchants. Staff claim chats exclusively; Admins can force-claim and see all.

Also in the app: **Support inbox** on [`/a/admin`](/a/admin).

---

## How it works {#support-overview}

```
Merchant opens Help → new chat (topic + message)
        ↓
Unclaimed queue (all Staff / Admins see it)
        ↓
Someone Claims → only they reply (unless Admin force-claims)
        ↓
Resolve (done) or Close (spam / end permanently)
```

| Status (UI) | Meaning |
| --- | --- |
| Unclaimed / Waiting for support | In the queue |
| Support is on it / Needs reply | Claimed; Staff should answer |
| Waiting for you / Waiting on customer | Ball is in the merchant’s court |
| Resolved | Done; merchant can reopen by messaging |
| Closed | Over (spam/abuse). Merchant must start a **new** chat |

---

## Claiming {#support-claim}

1. Open **Support inbox** → **Waiting**
2. Select a chat → **Claim & help**
3. Reply with **Reply to customer** (they see it) or **Note for team** (internal only)
4. Use **Account tools** to jump into freeze / reclaim for that merchant
5. When finished → **Mark done**
6. If you can’t finish → **Release to queue**, or **Ask an Admin** if you need higher access

**Two people click Claim:** one wins; the other sees “Already claimed…”.

**Ask an Admin:** Staff hands the chat up with a short reason. It leaves their inbox and lands in the Admin **Needs Admin** tab. Only Admins can claim it after that.

The merchant sees a calm system note: *“Your chat was handed to an Admin…”* (not your internal reason). When an Admin claims it, they see *“An Admin joined your chat…”*.

**Admin force-claim / take over:** take a chat from another assignee (reason required, audited).

---

## Give Access {#support-give-access}

Ask the merchant for temporary **debug access** (not signing in as them):

1. In the reply composer, click **Insert [Give Access]** (or type `[Give Access]` yourself)
2. Send the message — the merchant sees a **Give Access** button
3. When they click it, you get a **4-hour** grant
4. Banner shows **Granted Access** → **Look at Dashboard** (read-only simulation of their real dashboard). Fake controls (e.g. Add store) only update the simulation — they never write to the merchant’s real data.
5. **Account tools** still opens freeze / reclaim (real ops). Merchant (or you / Admin) can **Revoke** anytime.

This is consent + audit. It does **not** elevate Staff to Admin and does **not** sign you in as the merchant.

---

## Admin takeover (act as merchant) {#support-admin-takeover}

**Admin only.** Use when you must reproduce a write path on their account (e.g. “I can’t create a store”). Staff keep Give Access / simulation.

**Model B (no Clerk impersonation limit):** you stay signed in as **Admin**. Convex product APIs temporarily resolve to the merchant while the takeover is active. No Clerk actor tokens — so no 5/month impersonation quota.

1. Admin inserts **`[Allow Admin Takeover]`** in a customer reply (composer chip).
2. Merchant clicks **Allow Admin Takeover** — consent is bound to **that** Admin and valid ~2 hours.
3. That Admin clicks **Take over account**, enters a reason (≥ 8 chars), then **Open as merchant**.
4. Merchant is frozen; their Clerk sessions are kicked (best-effort). Admin is sent to `/a/dashboard` **still as Admin**.
5. Banner: **Working as {Merchant}** — product reads/writes use their account. `/a/admin` still works as you.
6. **End session** → unfreeze (only our takeover freeze) → back to Admin console.

One active takeover per Admin (starting a second is rejected until you End the first).

| | Give Access | Admin takeover |
| --- | --- | --- |
| Who | Staff or Admin | Admin only |
| Merchant consent | `[Give Access]` | `[Allow Admin Takeover]` |
| What you get | Read-only simulation | Real product writes on their data |
| Clerk login as them? | No | No (you stay Admin) |
| Merchant locked out? | No | Yes, while session active |
| Duration | 4 hours | 60 minutes (+30m once) |
| Clerk impersonation quota | n/a | **Not used** |

Requires `CLERK_SECRET_KEY` on Convex only for kicking merchant sessions (optional hardening). Ending takeover does not undo a mid-session Admin disable / abuse freeze.

**Give Access:** only the grantee (the staff/admin who sent `[Give Access]`) can open the dashboard simulation — Admins do not inherit another staffer’s grant.

---

## Resolve vs Close {#support-resolve-close}

| Action | When | Merchant can reopen? |
| --- | --- | --- |
| **Resolve** | Problem fixed / answered | Yes — sending a message reopens into the queue (assignee cleared) |
| **Close** | Spam, abuse, or hard stop | No — they must start a new chat |

Always leave a reason when closing (min 8 characters).

---

## Frozen merchants {#support-frozen}

Frozen accounts **can still** open Help and chat. Product writes stay blocked; support is the lifeline.

Banned / disabled accounts cannot sign in → no chat (expected).

---

## Security notes (Jack)

- Merchants only see their own threads and never see internal notes
- Staff only see unclaimed + their own claimed chats; Admins see **All**
- Claim is atomic; messages are plain text only (v1)
- Rate limits: few new threads per hour; message burst limits
- Claim / release / force-claim / escalate / resolve / close write `auditLogs` (visible in Live staff log for Admins)
- Give Access grants are time-boxed, merchant-approved, and audited (`staff_access_grant` / `staff_access_revoke`)
- Admin takeover is Admin-only, merchant-consented (bound to the soliciting Admin), time-boxed, one active session per Admin, audited (`takeover_consent` / `takeover_start` / `takeover_end` / `takeover_extend` / `takeover_expire` / `takeover_write:*`). Product APIs resolve to the merchant only while that Admin owns an active takeover — a normal merchant login stays frozen for writes.
- Ending takeover does not undo a mid-session Admin disable / abuse freeze (only clears the takeover freeze reason).
- Expired takeovers stay visible on the banner until End / sweep (2‑min) restores access.
- Takeover targets merchant (`user`) accounts; Staff test accounts are also allowed. Never Admin accounts.

---

## Merchant UX extras

- **Unread badge** on Help when Staff/Admin replied since the merchant last opened the chat
- Thread list shows **last message preview** + a **New** pill
- **Guided intake** for Lemon Squeezy topics (issue type, store name, live/test)

## Staff UX extras

- **Live triage** side panel (xl+) — store link, mode, webhooks, open failures, account status — **without** Give Access
- Composer **macros**: Reconnect LS, Webhook check, Freeze explain, Still looking, plus Give Access / Admin takeover chips

## Merchant entry points

- Dashboard sidebar / mobile bar → **Help** (badge when unread)
- Frozen account banner → **Open a support chat**
