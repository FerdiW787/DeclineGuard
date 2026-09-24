import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Activity, ChevronRight, RotateCcw, X } from "lucide-react";

type AppRole = "user" | "staff" | "admin";

type LiveEntry = {
  _id: Id<"auditLogs">;
  action: string;
  reason: string | null;
  metadata: string | null;
  createdAt: number;
  revokedAt: number | null;
  revokeNote: string | null;
  reversible: boolean;
  actor: {
    _id: Id<"users">;
    userName: string;
    role: AppRole;
    userId: string;
  } | null;
  target: {
    _id: Id<"users">;
    userName: string;
    role: AppRole;
    userId: string;
    accountStatus: "active" | "frozen" | "disabled";
  } | null;
  revokedBy: { _id: Id<"users">; userName: string } | null;
};

function humanAction(action: string): string {
  const map: Record<string, string> = {
    "account_status:frozen": "Froze account",
    "account_status:active": "Set account to healthy",
    "account_status:disabled": "Disabled account",
    restore_account: "Restored backup",
    reclaim_store: "Reclaimed Lemon Squeezy store",
    revoke_sessions: "Kicked all sign-ins",
    ban_user: "Banned merchant",
    unban_user: "Lifted ban",
    audit_revoked: "Revoked a prior action",
    support_claim: "Claimed support chat",
    support_release: "Released support chat",
    support_force_claim: "Force-claimed support chat",
    support_escalate: "Escalated support chat to Admin",
    support_resolve: "Resolved support chat",
    support_close: "Closed support chat",
    staff_access_grant: "Merchant granted temporary access",
    staff_access_revoke: "Revoked temporary staff access",
    resend_quota_blocked: "Resend quota blocked",
  };
  return map[action] ?? action.replace(/_/g, " ");
}

function roleBadge(role: AppRole): string {
  switch (role) {
    case "admin":
      return "bg-violet-50 text-violet-900 border-violet-200";
    case "staff":
      return "bg-sky-50 text-sky-900 border-sky-200";
    default:
      return "bg-black/[0.04] text-black/65 border-black/10";
  }
}

function formatWhen(ts: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toISOString();
  }
}

export default function LiveStaffLog({
  fillHeight = false,
}: {
  fillHeight?: boolean;
}) {
  const entries = useQuery(api.functions.admin.listLiveStaffActivity, {
    limit: 50,
  }) as LiveEntry[] | undefined;
  const revokeStaffAction = useAction(
    api.functions.adminActions.revokeStaffAction,
  );

  const [selectedId, setSelectedId] = useState<Id<"auditLogs"> | null>(null);
  const [revokeNote, setRevokeNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const selected = entries?.find((e) => e._id === selectedId) ?? null;

  async function handleRevoke() {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const result = await revokeStaffAction({
        auditId: selectedId,
        revokeNote,
      });
      setOk(
        `Revoked “${humanAction(result.undone)}”${
          result.clerkUnbanned ? " and lifted Clerk ban" : ""
        }.`,
      );
      setRevokeNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={`flex flex-col rounded-2xl border border-black/8 bg-white ${
        fillHeight ? "h-full min-h-0" : ""
      }`}
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-black/8 px-5 py-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="size-4 text-black/50" />
            Live staff log
            <span className="rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-900">
              Admin
            </span>
          </div>
          <p className="mt-1 text-[13px] text-black/50">
            Latest Staff and Admin actions with required comments — open one to
            review or revoke.
          </p>
        </div>
        <span className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
          Live
        </span>
      </div>

      <div
        className={`grid min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] ${
          fillHeight ? "flex-1" : ""
        }`}
      >
        <ul
          className={`divide-y divide-black/6 overflow-auto ${
            fillHeight ? "min-h-0 max-h-none" : "max-h-[28rem]"
          }`}
        >
          {entries === undefined ? (
            <li className="px-5 py-8 text-center text-sm text-black/40">
              Loading activity…
            </li>
          ) : entries.length === 0 ? (
            <li className="px-5 py-8 text-center text-sm text-black/40">
              No staff actions yet
            </li>
          ) : (
            entries.map((row) => {
              const active = selectedId === row._id;
              return (
                <li key={row._id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(row._id);
                      setError(null);
                      setOk(null);
                    }}
                    className={`flex w-full items-start gap-3 px-5 py-3.5 text-left transition ${
                      active ? "bg-black/[0.04]" : "hover:bg-black/[0.02]"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold text-black">
                          {row.actor?.userName ?? "Unknown"}
                        </span>
                        {row.actor ? (
                          <span
                            className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${roleBadge(row.actor.role)}`}
                          >
                            {row.actor.role === "admin"
                              ? "Admin"
                              : row.actor.role === "staff"
                                ? "Staff"
                                : "User"}
                          </span>
                        ) : null}
                        {row.revokedAt ? (
                          <span className="rounded-full border border-black/10 bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-semibold text-black/50">
                            Revoked
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-sm text-black/75">
                        {humanAction(row.action)}
                        {row.target ? (
                          <>
                            {" "}
                            → <strong>{row.target.userName}</strong>
                          </>
                        ) : null}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[12px] text-black/45">
                        {row.reason ?? "No comment on file"}
                      </p>
                      <p className="mt-1 text-[11px] text-black/35">
                        {formatWhen(row.createdAt)}
                      </p>
                    </div>
                    <ChevronRight className="mt-1 size-4 shrink-0 text-black/25" />
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <aside
          className={`border-t border-black/8 bg-black/[0.015] lg:border-l lg:border-t-0 ${
            fillHeight ? "min-h-0 overflow-y-auto" : ""
          }`}
        >
          {!selected ? (
            <div className="flex h-full min-h-48 items-center justify-center px-5 py-8 text-center text-sm text-black/40">
              Select an action to inspect
            </div>
          ) : (
            <div className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-lg tracking-tight">
                  {humanAction(selected.action)}
                </h3>
                <button
                  type="button"
                  className="rounded-lg p-1 text-black/40 hover:bg-black/5 hover:text-black"
                  onClick={() => setSelectedId(null)}
                  aria-label="Close detail"
                >
                  <X className="size-4" />
                </button>
              </div>

              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-black/40">
                    Who
                  </dt>
                  <dd className="mt-0.5">
                    {selected.actor?.userName ?? "—"}{" "}
                    <span className="text-black/45">
                      ({selected.actor?.role ?? "?"})
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-black/40">
                    Target
                  </dt>
                  <dd className="mt-0.5">
                    {selected.target ? (
                      <>
                        {selected.target.userName}{" "}
                        <span className="text-black/45">
                          ({selected.target.role} · {selected.target.accountStatus})
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-black/40">
                    Their comment
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-black/75">
                    {selected.reason ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-black/40">
                    When
                  </dt>
                  <dd className="mt-0.5">{formatWhen(selected.createdAt)}</dd>
                </div>
                {selected.revokedAt ? (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-black/40">
                      Revoked
                    </dt>
                    <dd className="mt-0.5">
                      {formatWhen(selected.revokedAt)} by{" "}
                      {selected.revokedBy?.userName ?? "Admin"}
                      {selected.revokeNote ? (
                        <span className="mt-1 block text-black/55">
                          {selected.revokeNote}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                ) : null}
              </dl>

              {selected.reversible ? (
                <div className="space-y-2 border-t border-black/8 pt-4">
                  <p className="text-[13px] text-black/55">
                    Undo this action (unfreeze / unban the target). Leave a
                    note for the audit trail.
                  </p>
                  <textarea
                    value={revokeNote}
                    onChange={(e) => setRevokeNote(e.target.value)}
                    rows={3}
                    placeholder="Why are you revoking this? (min 8 chars)"
                    className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/25"
                  />
                  <button
                    type="button"
                    disabled={busy || revokeNote.trim().length < 8}
                    onClick={() => void handleRevoke()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-700 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <RotateCcw className="size-4" />
                    {busy ? "Revoking…" : "Revoke this action"}
                  </button>
                </div>
              ) : selected.revokedAt ? null : (
                <p className="border-t border-black/8 pt-4 text-[13px] text-black/45">
                  This action can’t be auto-revoked (restore, reclaim, kick
                  sessions, unlock). Fix manually if needed.
                </p>
              )}

              {error ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                  {error}
                </p>
              ) : null}
              {ok ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  {ok}
                </p>
              ) : null}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
