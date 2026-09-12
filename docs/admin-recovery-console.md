# Staff recovery console — what every action actually does

> Written for anyone who opens `/a/admin` and needs to know **exactly** what a button does before they click it.
>
> Also available in the app: [`/a/admin/docs`](/a/admin/docs) (deep-links from each admin step).
>
> Support chat guide: [`/a/admin/docs/support`](/a/admin/docs/support) · source `docs/support-chat.md`.
>
> Source of truth in code: `convex/functions/admin.ts`, `convex/functions/adminActions.ts`, `convex/lib/accountGuard.ts`.

---

## The mental model (read this first) {#overview}

DeclineGuard is not “delete the merchant.” It is a **YouTube-style recovery desk**.

When something goes wrong (hacked login, stolen Lemon Squeezy API key, wiped connection), staff should:

1. **Stop the bleeding** — freeze and/or kick sessions  
2. **Put data / store routing back** — restore backup, reclaim store  
3. **Unlock** — unfreeze / lift ban  
4. **Only ban** for real abuse — not for “we’re investigating”

Everything staff do is written to `auditLogs` so the next person can see what already happened.

```
Healthy (active)  →  Frozen  →  Healthy again     ← normal recovery path
Healthy / Frozen  →  Banned (disabled)            ← abuse / last resort
Banned            →  Unlock (unban)               ← lift the ban
```

---

## Who can use this panel? {#access}

| Requirement | Detail |
| --- | --- |
| URL | `/a/admin` (middleware-gated) |
| Auth | Must be signed in with Clerk |
| Role | Convex `users.role` is `staff` or `admin` |
| How you get the role | Clerk **private** metadata: `role = "staff"` or `"admin"`, then sign out / in so Convex syncs |

If you are a normal **User**, the page refuses you. Non-staff cannot call these APIs either.

---

## Role hierarchy {#roles}

| Role | Portal | Help merchants (User) | Freeze / kick Staff or Admins | Ban anyone |
| --- | --- | --- | --- | --- |
| **User** | No — dashboard only | — | — | — |
| **Staff** | Yes | Yes (freeze, kick, restore, reclaim, unfreeze) | **No** | **No** |
| **Admin** | Yes | Yes | Yes | **Yes** (only Admins) |

**Why Staff cannot ban (Jack):** if a Staff account is compromised or goes rogue, they still cannot permanently lock merchants out of sign-in. Ban is the nuclear option and stays Admin-only. Staff also cannot freeze other Staff/Admins, so they cannot lock the rest of the help desk out of the portal.

**Admin takeover (Jack):** only Admins may act on a merchant’s product data (Model B — Admin stays signed in; no Clerk actor tokens), and only after `[Allow Admin Takeover]` consent. Staff use Give Access + read-only simulation. See [support chat → Admin takeover](/a/admin/docs/support#support-admin-takeover).

**Required comments (Jack):** Staff **and** Admins must leave a comment (≥ 8 characters) on every privileged write (freeze, kick, restore, reclaim, unlock, ban, takeover start/extend). Same standard for everyone who can change account state — so the live log can tell “good adjustment” from “going rogue.”

Promote people in Clerk **private_metadata** only:

- Merchant → omit role or `user`
- Help desk → `staff`
- Owners → `admin`

---

## Live staff log {#live-log}

Admins see a **Live staff log** on `/a/admin` with recent Staff/Admin actions:

- Who acted (name + role)
- What they did
- Who they acted on (name + role + current status)
- Their required comment
- Timestamp
- Whether it was already revoked

Click an entry for detail. Admins can **Revoke** reversible actions (freeze / ban), which unlocks the target and unbans in Clerk when needed. Restore, reclaim, and kick-sessions are **not** auto-revocable — fix those manually if wrong.

---

## Account statuses {#statuses}

Stored on `users.accountStatus` (defaults to `active` if missing).

| Status in UI | Value in DB | Merchant can sign in? | Merchant can change settings / connect stores / trigger writes? | Recovery emails send? |
| --- | --- | --- | --- | --- |
| **Healthy** | `active` | Yes | Yes | Yes |
| **Frozen** | `frozen` | **Yes** | **No** (writes throw) | **No** (failures still saved) |
| **Banned** | `disabled` | **No** (Clerk ban) | No | No |

### What “frozen” means in practice

- Clerk login still works — they can open the dashboard and read.  
- Any merchant **write** that goes through `assertAccountActive` / the Lemon Squeezy action guard fails with a support message.  
- Scheduled recovery emails **skip sending** while frozen/disabled, but the failure row can still exist.  
- Does **not** revoke sessions by itself — use **Kick all sign-ins** if a thief is still logged in.

### What “banned” means in practice

Ban is **two systems at once**:

1. Convex sets `accountStatus: "disabled"`  
2. Clerk `users.banUser` + revoke all active sessions  

So they cannot sign in at all until staff **Unlock** (which unbans Clerk and sets status back to `active`).

---

## Soft-delete & the 90-day backup window {#soft-delete}

When a store is disconnected (by the merchant or by staff reclaim side-effects), DeclineGuard does **not** immediately hard-delete:

| Data | What happens |
| --- | --- |
| Lemon connection | Soft-deleted (`deletedAt` / `deletedBy`) |
| Open failures + scheduled Day 2/5 jobs | Soft-deleted; scheduled jobs cancelled |
| Activity events | Soft-deleted |
| Recovery settings | Soft-deleted |
| Live store bindings (`lemonStoreBindings`) | Removed so another account can bind |

**Restore from backup** clears those `deletedAt` flags and rebinds stores (if free).

**Hard purge:** a daily cron (`purgeExpiredSoftDeletes`) permanently deletes soft-deleted rows older than **90 days**. After that, Restore cannot bring them back.

---

## Action catalog

Each section below answers the same four questions:

1. **What it does**  
2. **Effect on the merchant**  
3. **Effect on us (DeclineGuard / ops)**  
4. **When to use / when not to**

---

### 1. Freeze account {#freeze}

**UI:** Step 2 → *Freeze account*  
**API:** `admin.setAccountStatus` with `status: "frozen"`  
**Audit:** `account_status:frozen`

| | |
| --- | --- |
| **What it does** | Sets `accountStatus` to `frozen`, stores optional `frozenReason` + `frozenAt`. |
| **Merchant** | Can still sign in and look around. Cannot connect/disconnect stores, change recovery settings, or perform other guarded writes. Will not receive new recovery emails. |
| **Us** | Webhooks can still land data; emails are paused. Investigation-safe. Reversible with Unlock / Unfreeze. No Clerk ban. |
| **Use when** | Suspected takeover, merchant reports “someone else in my account,” you need time to reclaim a store, or you want to pause outbound email without locking them out of support chat / login. |
| **Don’t use when** | You need them out of the product entirely → Ban. You only need to kill one stolen browser session and they’re otherwise fine → Kick sessions (optionally with freeze). |

---

### 2. Kick all sign-ins {#kick-sessions}

**UI:** Step 2 → *Kick all sign-ins*  
**API:** `adminActions.revokeSessions`  
**Audit:** `revoke_sessions` (metadata includes how many sessions were revoked)

| | |
| --- | --- |
| **What it does** | Lists Clerk **active** sessions for that Clerk user id and revokes each one. Does **not** change `accountStatus`. |
| **Merchant** | Immediately signed out everywhere. They can sign back in unless the account is banned. |
| **Us** | Stops an active attacker session without freezing or banning. Audit trail only. |
| **Use when** | Password may be compromised, weird concurrent sessions, or right after freeze during a takeover. |
| **Don’t use when** | You need lasting lockout → Ban. You only need to pause product writes → Freeze is enough (but kicking is still often wise together). |

---

### 3. Restore from backup {#restore}

**UI:** Step 3 → *Restore from backup*  
**API:** `admin.restoreAccount`  
**Audit:** `restore_account` (counts of restored failures / activity / whether connection revived)

| | |
| --- | --- |
| **What it does** | Clears soft-delete on the merchant’s connection (if soft-deleted), failed payments, activity, and recovery settings. Re-inserts `lemonStoreBindings` and writes `storeBindingHistory` (`bound` / `restore_account`). |
| **Merchant** | Their archived DeclineGuard history and connection come back into the live UI (if restore succeeds). |
| **Us** | Only works if each store on that connection is **not** currently bound to a *different* live account. If another account holds the store, restore throws — **Reclaim** that store first. |
| **Use when** | Merchant (or reclaim side-effect) soft-deleted the connection and you still have data inside the 90-day window. Panel shows “has backup.” |
| **Don’t use when** | Nothing is soft-deleted (UI says skip). Another live account owns the store id — reclaim first. Data older than 90 days — already purged. |

---

### 4. Give store back to them (Reclaim) {#reclaim}

**UI:** Step 3 → *Stolen Lemon Squeezy API key?* → enter store id → *Give store back to them*  
**API:** `admin.reclaimStore`  
**Audit:** `reclaim_store` (+ binding history `reclaimed` / `unbound`)

| | |
| --- | --- |
| **What it does** | Moves **live webhook routing** for a Lemon Squeezy `storeId` onto the selected merchant’s connection. Soft-deletes any *other* account currently holding that store (connection + failures/activity/settings archived; bindings removed). Revives the target connection if it was soft-deleted. Ensures the store is on their `stores` list and rebuilds bindings. |
| **Merchant (rightful owner)** | Their DeclineGuard account becomes the live owner of that store’s webhook routing again. |
| **Other merchant (if any)** | Their live connection for that store is soft-deleted (90-day backup), same as a staff-driven disconnect. |
| **Us** | Fixes “attacker connected the store to a new DeclineGuard account with a stolen LS API key.” Target user **must already have** a Lemon connection row (even if soft-deleted). After reclaim, tell the merchant to **rotate the Lemon Squeezy API key**. |
| **Use when** | Store id is on the wrong DeclineGuard user; rightful owner is the selected merchant. |
| **Don’t use when** | Target has never connected LS at all (no connection row) — they must reconnect or you restore an archived connection first. Wrong store id — you will move routing for whatever id you type. |

---

### 5. Unlock this merchant (Unfreeze / Lift ban) {#unlock}

**UI:** Step 4 → *Unlock this merchant*  
**API:**  
- If **Frozen** → `setAccountStatus` → `active`  
- If **Banned** → `adminActions.unbanUser` (Clerk unban + status `active`)  
**Audit:** `account_status:active` and/or `unban_user`

| | |
| --- | --- |
| **What it does** | Returns the account to Healthy. Clears freeze fields. If banned, also lifts the Clerk ban. |
| **Merchant** | Full product access again; can sign in; recovery emails can send again. |
| **Us** | End of the recovery checklist. Still remind them to rotate passwords / LS API keys when that was the incident. |
| **Use when** | Incident handled, data restored / store reclaimed, merchant ready. |
| **Don’t use when** | Attacker may still have credentials — unlock only after kick + credential rotation guidance. |

There is also an Unfreeze / Lift ban control in Step 2 when the account is already frozen or banned — same underlying APIs.

---

### 6. Ban this merchant {#ban}

**UI:** Danger zone → *Ban this merchant…* (**Admin only** — hidden for Staff)  
**API:** `adminActions.banUser`  
**Audit:** `account_status:disabled` + `ban_user`

| | |
| --- | --- |
| **What it does** | Sets Convex status to `disabled`, Clerk-bans the user, revokes all active sessions. |
| **Merchant** | Cannot sign in. Product writes blocked. Emails paused. |
| **Us** | Strong lockout. Reversible via Unlock (unban). **Do not ban yourself** — you lose `/a/admin` until another admin or Clerk Dashboard unbans you. Admins may ban Staff and other Admins; Staff cannot ban anyone. |
| **Use when** | Confirmed abuse, spam, fraud, or you must guarantee zero access. |
| **Don’t use when** | Investigating a takeover (use Freeze + Kick). Testing on your own staff account. Merchant just needs a pause (Freeze). You’re signed in as Staff — escalate to an Admin. |

If they are already banned, Ban is disabled in the UI — use Unlock instead.

---

## Recommended playbooks {#playbooks}

### A. “I think my DeclineGuard login was hacked”

1. Find merchant → **Freeze**  
2. **Kick all sign-ins**  
3. Restore backup only if they wiped / disconnected data  
4. Ask them to change password / enable stronger auth  
5. **Unlock** when done  

### B. “Someone stole my Lemon Squeezy API key and connected my store elsewhere”

1. Find the **rightful** merchant  
2. **Freeze** both sides if needed (especially the attacker account)  
3. **Give store back** with the correct Lemon store id  
4. **Restore from backup** on the rightful owner if their connection was archived  
5. Tell them to **rotate the LS API key** and rotate DeclineGuard password if login was also at risk  
6. **Unlock** when stable  
7. Consider **Ban** on the attacker DeclineGuard account if it was created for abuse  

### C. “Abuse / spam account”

1. **Ban** (not freeze)  
2. Optionally reclaim any stores that belong to real merchants  

---

## What staff see in the summary tiles

| Tile | Meaning |
| --- | --- |
| **Store** | Live or soft-deleted Lemon connection name + store id |
| **Open failures** | Count of non-deleted `failedPayments` with status `open` |
| **Backup** | Whether soft-deleted connection / failures / activity exist to restore |

---

## Audit log

Every staff action writes an `auditLogs` row (`actorUserId`, `targetUserId`, `action`, optional JSON `metadata`, `createdAt`).

Human labels in the UI map roughly to:

| Audit action | Meaning |
| --- | --- |
| `account_status:frozen` | Froze account |
| `account_status:active` | Set healthy / unfroze |
| `account_status:disabled` | Disabled via status mutation (also part of ban flow) |
| `revoke_sessions` | Kicked sign-ins |
| `restore_account` | Restored soft-deleted data |
| `reclaim_store` | Gave store routing back |
| `ban_user` | Full ban (Clerk + disabled) |
| `unban_user` | Lifted ban |
| `purge_expired_soft_deletes` | Cron hard-delete (system actor) |

---

## Ops checklist (environment)

| Need | Where |
| --- | --- |
| Staff access | Clerk user → **private** metadata `role: "staff"` |
| Admin access | Clerk user → **private** metadata `role: "admin"` |
| Ban / kick sessions | Convex env `CLERK_SECRET_KEY` (Backend API) |
| Open the panel | Sign in → `/a/admin` |

---

## Quick decision tree

```
Need them completely unable to sign in?
  YES → Ban
  NO  → Do they still have an active attacker session?
          YES → Kick sessions (+ usually Freeze)
          NO  → Only pause writes / emails?
                  YES → Freeze
                  NO  → Skip Step 2

Is their store on the wrong DeclineGuard account?
  YES → Reclaim store id onto the rightful user
  NO  → Skip reclaim

Is there soft-deleted backup inside 90 days?
  YES → Restore from backup (after reclaim if store conflict)
  NO  → Skip restore

Incident handled?
  YES → Unlock
```

---

## Code map (for engineers)

| Concern | File |
| --- | --- |
| Freeze / restore / reclaim / purge | `convex/functions/admin.ts` |
| Kick sessions / ban / unban (Clerk) | `convex/functions/adminActions.ts` |
| Write guards for merchants | `convex/lib/accountGuard.ts` |
| Skip emails when frozen/disabled | `convex/functions/recoveries.ts` |
| Soft-delete on merchant disconnect | `convex/functions/lemonSqueezy.ts` |
| Admin UI | `src/components/admin/AdminConsole.tsx` |
| Route + middleware | `src/pages/a/admin/index.astro`, `src/middleware.ts` |
| 90-day purge cron | `convex/crons.ts` → `purgeExpiredSoftDeletes` |

If behavior in code and this doc disagree, **trust the code** and update this doc.
