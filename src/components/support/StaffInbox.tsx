import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Headphones,
  MessageSquare,
  Send,
  UserPlus,
  Unlock,
  CheckCircle2,
  ArrowUpRight,
  Ban,
  ExternalLink,
  KeyRound,
  LayoutDashboard,
  MoreHorizontal,
  ShieldAlert,
} from "lucide-react";
import StaffDashboardSim from "@/components/support/StaffDashboardSim";

const GIVE_ACCESS_TOKEN = "[Give Access]";
const TAKEOVER_CONSENT_TOKEN = "[Allow Admin Takeover]";
const MERCHANT_DASHBOARD = "/a/dashboard?dest=merchant";

type InboxFilter = "unclaimed" | "mine" | "escalated" | "all";

type Props = {
  isAdmin: boolean;
  viewerUserId: Id<"users">;
  /** Stretch to fill the dashboard main pane */
  fillHeight?: boolean;
  onOpenMerchant?: (userId: Id<"users">) => void;
};

function statusLabel(status: string): string {
  switch (status) {
    case "open":
      return "Needs claim";
    case "claimed":
      return "You’re on it";
    case "waiting_staff":
      return "Needs your reply";
    case "waiting_customer":
      return "Waiting on them";
    case "resolved":
      return "Done";
    case "closed":
      return "Closed";
    default:
      return status;
  }
}

function statusLabelForOther(status: string, assigneeName: string | null): string {
  switch (status) {
    case "open":
      return "Needs claim";
    case "claimed":
    case "waiting_staff":
    case "waiting_customer":
      return assigneeName ? `${assigneeName} is helping` : "Claimed";
    case "resolved":
      return "Done";
    case "closed":
      return "Closed";
    default:
      return status;
  }
}

function topicLabel(topic: string): string {
  switch (topic) {
    case "account":
      return "Account";
    case "billing":
      return "Billing";
    case "lemon_squeezy":
      return "Lemon Squeezy";
    case "bug":
      return "Bug";
    default:
      return "Other";
  }
}

function waitLabel(lastMessageAt: number): string {
  const mins = Math.max(0, Math.floor((Date.now() - lastMessageAt) / 60_000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function friendlyError(raw: string): string {
  if (raw.includes("Claim this chat")) {
    return "Claim this chat first — then you can reply.";
  }
  if (raw.includes("Already claimed")) {
    return "Someone else grabbed this one. Pick another, or ask an Admin to take it.";
  }
  if (raw.includes("Force-claim")) {
    return "This chat belongs to someone else. Force-claim it first if you need to take over.";
  }
  if (raw.includes("rate") || raw.includes("Rate") || raw.includes("Too many")) {
    return "Slow down a second — too many messages. Try again in a minute.";
  }
  return raw;
}

const REPLY_MACROS: { id: string; label: string; body: string }[] = [
  {
    id: "reconnect",
    label: "Reconnect LS",
    body: "Thanks for writing in. Please try disconnecting Lemon Squeezy in Settings, then connect again and pick the correct store. Reply here with what you see after that.",
  },
  {
    id: "webhook",
    label: "Webhook check",
    body: "I’m checking whether webhooks are reaching us. If you can, confirm in Lemon Squeezy → Settings → Webhooks that the DeclineGuard endpoint is active and recent deliveries succeed. I’ll keep digging on our side too.",
  },
  {
    id: "freeze",
    label: "Freeze explain",
    body: "Your account is temporarily frozen, so product actions are paused — but this Help chat still works. Tell me what happened right before the freeze and we’ll get you unstuck.",
  },
  {
    id: "waiting",
    label: "Still looking",
    body: "Still looking into this on our side — thanks for your patience. I’ll update you as soon as I have something concrete.",
  },
];

function formatCents(cents: number, currency: string | null): string {
  const amount = (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return currency ? `${amount} ${currency}` : amount;
}

function appendMacro(prev: string, text: string): string {
  const base = prev.trim();
  return base ? `${base}\n\n${text}` : text;
}

export default function StaffInbox({
  isAdmin,
  viewerUserId,
  fillHeight = false,
  onOpenMerchant,
}: Props) {
  const [filter, setFilter] = useState<InboxFilter>("unclaimed");
  const [activeId, setActiveId] = useState<Id<"supportThreads"> | null>(null);
  const [reply, setReply] = useState("");
  const [internalNote, setInternalNote] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [forceReason, setForceReason] = useState("");
  const [escalateReason, setEscalateReason] = useState("");
  const [showClose, setShowClose] = useState(false);
  const [showForce, setShowForce] = useState(false);
  const [showEscalate, setShowEscalate] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showDashSim, setShowDashSim] = useState(false);
  const [showTakeoverStart, setShowTakeoverStart] = useState(false);
  const [takeoverReason, setTakeoverReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const unclaimedCount = useQuery(api.functions.support.unclaimedCount, {});
  const escalatedCount = useQuery(
    api.functions.support.escalatedCount,
    isAdmin ? {} : "skip",
  );
  const threads = useQuery(api.functions.support.listInbox, {
    filter:
      (filter === "all" || filter === "escalated") && !isAdmin
        ? "unclaimed"
        : filter,
  });
  const messages = useQuery(
    api.functions.support.listMessages,
    activeId ? { threadId: activeId } : "skip",
  );
  const activeGrant = useQuery(
    api.functions.supportAccess.getActiveGrantForThread,
    activeId ? { threadId: activeId } : "skip",
  );
  const takeover = useQuery(
    api.functions.adminTakeover.getTakeoverForThread,
    activeId ? { threadId: activeId } : "skip",
  );
  const active = threads?.find((t) => t._id === activeId) ?? null;
  const diag = useQuery(
    api.functions.support.getMerchantSupportSnapshot,
    active ? { merchantUserId: active.userId } : "skip",
  );

  const claimThread = useMutation(api.functions.support.claimThread);
  const releaseThread = useMutation(api.functions.support.releaseThread);
  const forceClaimThread = useMutation(api.functions.support.forceClaimThread);
  const escalateThread = useMutation(api.functions.support.escalateThread);
  const sendMessage = useMutation(api.functions.support.sendMessage);
  const resolveThread = useMutation(api.functions.support.resolveThread);
  const closeThread = useMutation(api.functions.support.closeThread);
  const revokeGrant = useMutation(
    api.functions.supportAccess.revokeStaffAccessGrant,
  );
  const startTakeover = useAction(api.functions.adminTakeoverActions.startTakeover);
  const endTakeover = useMutation(api.functions.adminTakeover.endTakeover);
  const extendTakeover = useMutation(api.functions.adminTakeover.extendTakeover);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  useEffect(() => {
    setShowMore(false);
    setShowClose(false);
    setShowForce(false);
    setShowEscalate(false);
    setShowDashSim(false);
    setShowTakeoverStart(false);
    setTakeoverReason("");
    setInternalNote(false);
    setReply("");
    setError(null);
  }, [activeId]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(
        friendlyError(e instanceof Error ? e.message : String(e)),
      );
    } finally {
      setBusy(null);
    }
  }

  const filters: {
    id: InboxFilter;
    label: string;
    hint: string;
    adminOnly?: boolean;
  }[] = [
    {
      id: "unclaimed",
      label: "Waiting",
      hint: "Nobody helping yet — claim one",
    },
    {
      id: "mine",
      label: "I’m helping",
      hint: "Chats you claimed",
    },
    {
      id: "escalated",
      label: "Needs Admin",
      hint: "Staff handed these up",
      adminOnly: true,
    },
    {
      id: "all",
      label: "Everyone",
      hint: "All open chats (Admin)",
      adminOnly: true,
    },
  ];

  const isMine = active?.assigneeId === viewerUserId;
  const isUnclaimed = active != null && active.assigneeId == null;
  const isEscalated = active?.escalatedAt != null;
  const claimedByOther =
    active != null &&
    active.assigneeId != null &&
    active.assigneeId !== viewerUserId;
  const canReply =
    active != null &&
    isMine &&
    active.status !== "closed";
  const needsClaim =
    active != null &&
    isUnclaimed &&
    active.status !== "closed" &&
    active.status !== "resolved" &&
    (!isEscalated || isAdmin);

  const emptyCopy =
    filter === "unclaimed"
      ? "No one waiting — nice. New chats land here."
      : filter === "mine"
        ? "You’re not helping anyone right now. Grab one from Waiting."
        : filter === "escalated"
          ? "No chats waiting on an Admin."
          : "No open chats.";

  return (
    <section
      className={`flex flex-col rounded-2xl border border-black/8 bg-white ${
        fillHeight ? "h-full min-h-0" : ""
      }`}
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-black/8 px-5 py-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Headphones className="size-4 text-black/50" />
            Support inbox
            {typeof unclaimedCount === "number" && unclaimedCount > 0 ? (
              <span className="rounded-full bg-[#111] px-2 py-0.5 text-[10px] font-bold text-white">
                {unclaimedCount} waiting
              </span>
            ) : null}
            {isAdmin &&
            typeof escalatedCount === "number" &&
            escalatedCount > 0 ? (
              <span className="rounded-full bg-violet-700 px-2 py-0.5 text-[10px] font-bold text-white">
                {escalatedCount} for Admin
              </span>
            ) : null}
          </div>
          <p className="mt-1 max-w-xl text-[13px] text-black/50">
            Claim → reply → mark done. One person per chat.{" "}
            <a
              href="/a/admin/docs/support"
              className="font-medium text-blue-700 underline-offset-2 hover:underline"
            >
              Guide
            </a>
          </p>
        </div>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Inbox views">
          {filters
            .filter((f) => !f.adminOnly || isAdmin)
            .map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                title={f.hint}
                onClick={() => {
                  setFilter(f.id);
                  setActiveId(null);
                }}
                className={`rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition ${
                  filter === f.id
                    ? "bg-[#111] text-white"
                    : "text-black/50 hover:bg-black/[0.04]"
                }`}
              >
                {f.label}
                {f.id === "unclaimed" &&
                typeof unclaimedCount === "number" &&
                unclaimedCount > 0
                  ? ` · ${unclaimedCount}`
                  : ""}
                {f.id === "escalated" &&
                typeof escalatedCount === "number" &&
                escalatedCount > 0
                  ? ` · ${escalatedCount}`
                  : ""}
              </button>
            ))}
        </div>
      </div>

      <div
        className={`grid min-h-0 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_minmax(0,14rem)] ${
          fillHeight ? "h-full min-h-0 flex-1" : "h-[min(72vh,44rem)]"
        }`}
      >
        <ul
          className={`divide-y divide-black/6 overflow-auto border-b border-black/8 lg:border-b-0 lg:border-r ${
            fillHeight ? "max-h-52 lg:max-h-none lg:h-full" : "max-h-52 lg:max-h-none"
          }`}
        >
          {threads === undefined ? (
            <li className="px-4 py-8 text-center text-sm text-black/40">
              Loading…
            </li>
          ) : threads.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm leading-relaxed text-black/40">
              {emptyCopy}
            </li>
          ) : (
            threads.map((t) => {
              const mine = t.assigneeId === viewerUserId;
              const escalated = t.escalatedAt != null;
              const label = escalated
                ? "Needs Admin"
                : mine
                  ? statusLabel(t.status)
                  : statusLabelForOther(t.status, t.assigneeName);
              return (
                <li key={t._id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(t._id)}
                    className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition ${
                      activeId === t._id
                        ? "bg-black/[0.05]"
                        : "hover:bg-black/[0.02]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">
                        {t.merchantName}
                      </span>
                      <span className="shrink-0 text-[10px] text-black/35">
                        {waitLabel(t.lastMessageAt)}
                      </span>
                    </div>
                    <span className="truncate text-[12px] text-black/55">
                      {t.subject}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-black/[0.05] px-1.5 py-0.5 text-[10px] font-medium text-black/55">
                        {topicLabel(t.topic)}
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                          escalated
                            ? "bg-violet-50 text-violet-900"
                            : t.assigneeId == null
                              ? "bg-amber-50 text-amber-900"
                              : mine
                                ? "bg-emerald-50 text-emerald-900"
                                : "bg-black/[0.04] text-black/50"
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <div className="flex min-h-0 flex-col">
          {!activeId || !active ? (
            <div className="flex flex-1 items-center justify-center px-6 py-12 text-center">
              <div className="max-w-xs">
                <MessageSquare className="mx-auto size-8 text-black/20" />
                <p className="mt-3 text-sm font-medium text-black/60">
                  Pick a chat on the left
                </p>
                <p className="mt-1 text-[13px] text-black/40">
                  {filter === "unclaimed"
                    ? "Claim it, then reply. Only one person can help at a time."
                    : filter === "mine"
                      ? "Continue the conversation, then mark it done."
                      : "See who owns each chat — force-claim only if needed."}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="shrink-0 space-y-3 border-b border-black/8 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg tracking-tight">
                        {active.merchantName}
                      </h3>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          isEscalated
                            ? "bg-violet-50 text-violet-900"
                            : isUnclaimed
                              ? "bg-amber-50 text-amber-900"
                              : isMine
                                ? "bg-emerald-50 text-emerald-900"
                                : "bg-black/[0.05] text-black/55"
                        }`}
                      >
                        {isEscalated
                          ? "Needs Admin"
                          : isMine
                            ? statusLabel(active.status)
                            : statusLabelForOther(
                                active.status,
                                active.assigneeName,
                              )}
                      </span>
                      <span className="rounded-md bg-black/[0.04] px-2 py-0.5 text-[11px] font-medium text-black/45">
                        {topicLabel(active.topic)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[13px] text-black/55">
                      {active.subject}
                    </p>
                    <p className="mt-0.5 text-[12px] text-black/40">
                      {active.storeName
                        ? `Store: ${active.storeName}`
                        : "No store linked"}
                      {active.merchantAccountStatusAtOpen !== "active"
                        ? ` · Account was ${active.merchantAccountStatusAtOpen} when they wrote`
                        : ""}
                      {isEscalated && active.escalatedByName
                        ? ` · Escalated by ${active.escalatedByName}`
                        : ""}
                    </p>
                    {diag ? (
                      <p className="mt-1.5 text-[11px] text-black/45 xl:hidden">
                        {diag.accountStatus !== "active"
                          ? `${diag.accountStatus} · `
                          : ""}
                        {diag.storeLinked
                          ? diag.testMode
                            ? "Test store"
                            : "Live store"
                          : "No store"}
                        {" · "}
                        {diag.openFailureCount} open
                        {diag.webhookLastReceivedAt
                          ? ` · webhook ${waitLabel(diag.webhookLastReceivedAt)}`
                          : " · no webhooks"}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {needsClaim ? (
                      <button
                        type="button"
                        disabled={busy != null}
                        onClick={() =>
                          void run("claim", async () => {
                            await claimThread({ threadId: active._id });
                            setFilter("mine");
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#111] px-3.5 py-2 text-[13px] font-semibold text-white"
                      >
                        <UserPlus className="size-3.5" />
                        {busy === "claim"
                          ? "Claiming…"
                          : isEscalated
                            ? "Claim as Admin"
                            : "Claim & help"}
                      </button>
                    ) : null}

                    {isMine &&
                    active.status !== "resolved" &&
                    active.status !== "closed" ? (
                      <button
                        type="button"
                        disabled={busy != null}
                        onClick={() =>
                          void run("resolve", () =>
                            resolveThread({ threadId: active._id }),
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-[13px] font-semibold text-emerald-900"
                      >
                        <CheckCircle2 className="size-3.5" />
                        {busy === "resolve" ? "…" : "Mark done"}
                      </button>
                    ) : null}

                    {isMine && active.status !== "closed" ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-[12px] font-semibold text-violet-900"
                        onClick={() => {
                          setShowEscalate(true);
                          setShowMore(false);
                          setShowClose(false);
                          setShowForce(false);
                        }}
                      >
                        <ArrowUpRight className="size-3.5" />
                        Ask an Admin
                      </button>
                    ) : null}

                    {onOpenMerchant ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-xl border border-black/10 px-3 py-2 text-[12px] font-semibold text-black/65"
                        onClick={() => onOpenMerchant(active.userId)}
                      >
                        <ExternalLink className="size-3.5" />
                        Account tools
                      </button>
                    ) : null}

                    {(isMine || isAdmin) && active.status !== "closed" ? (
                      <button
                        type="button"
                        className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-2 text-[12px] font-semibold ${
                          showMore
                            ? "border-black/20 bg-black/[0.04] text-black"
                            : "border-black/10 text-black/55"
                        }`}
                        onClick={() => {
                          setShowMore((v) => !v);
                          setShowClose(false);
                          setShowForce(false);
                          setShowEscalate(false);
                        }}
                        aria-expanded={showMore}
                      >
                        <MoreHorizontal className="size-3.5" />
                        More
                      </button>
                    ) : null}
                  </div>
                </div>

                {claimedByOther && isAdmin ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2.5">
                    <p className="text-[13px] text-violet-950">
                      {active.assigneeName ?? "Someone"} is helping. You can
                      take over if they’re stuck.
                    </p>
                    <button
                      type="button"
                      className="rounded-lg bg-violet-800 px-3 py-1.5 text-[12px] font-semibold text-white"
                      onClick={() => {
                        setShowForce(true);
                        setShowMore(false);
                        setShowClose(false);
                      }}
                    >
                      Take over
                    </button>
                  </div>
                ) : null}

                {showMore ? (
                  <div className="flex flex-wrap gap-2 rounded-xl border border-black/8 bg-black/[0.02] px-3 py-2.5">
                    {isMine || isAdmin ? (
                      <button
                        type="button"
                        disabled={busy != null || active.assigneeId == null}
                        onClick={() =>
                          void run("release", () =>
                            releaseThread({ threadId: active._id }),
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-black/70 disabled:opacity-40"
                      >
                        <Unlock className="size-3.5" />
                        Release to queue
                      </button>
                    ) : null}
                    {active.status !== "closed" ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-rose-800"
                        onClick={() => {
                          setShowClose(true);
                          setShowForce(false);
                        }}
                      >
                        <Ban className="size-3.5" />
                        Close as spam
                      </button>
                    ) : null}
                    <p className="w-full text-[11px] text-black/40">
                      Release = back to Waiting. Close = merchant cannot reopen
                      this chat.
                    </p>
                  </div>
                ) : null}

                {showEscalate ? (
                  <div className="space-y-2 rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-3">
                    <p className="text-[13px] text-violet-950">
                      Hands this chat to Admins. Leave a short note so they know
                      what’s stuck (customer won’t see it).
                    </p>
                    <input
                      value={escalateReason}
                      onChange={(e) => setEscalateReason(e.target.value)}
                      placeholder="e.g. Needs store reclaim / API key stolen…"
                      className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={
                          busy != null || escalateReason.trim().length < 8
                        }
                        onClick={() =>
                          void run("escalate", async () => {
                            await escalateThread({
                              threadId: active._id,
                              reason: escalateReason.trim(),
                            });
                            setShowEscalate(false);
                            setEscalateReason("");
                            setActiveId(null);
                            setFilter(isAdmin ? "escalated" : "unclaimed");
                          })
                        }
                        className="rounded-lg bg-violet-800 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-45"
                      >
                        Send to Admins
                      </button>
                      <button
                        type="button"
                        className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-black/50"
                        onClick={() => setShowEscalate(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                {showForce ? (
                  <div className="space-y-2 rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-3">
                    <p className="text-[13px] text-violet-950">
                      You’ll become the helper. Leave a short reason (audit
                      log).
                    </p>
                    <input
                      value={forceReason}
                      onChange={(e) => setForceReason(e.target.value)}
                      placeholder="e.g. Original assignee offline…"
                      className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy != null || forceReason.trim().length < 8}
                        onClick={() =>
                          void run("force", async () => {
                            await forceClaimThread({
                              threadId: active._id,
                              reason: forceReason.trim(),
                            });
                            setShowForce(false);
                            setForceReason("");
                            setFilter("mine");
                          })
                        }
                        className="rounded-lg bg-violet-800 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-45"
                      >
                        Confirm take over
                      </button>
                      <button
                        type="button"
                        className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-black/50"
                        onClick={() => setShowForce(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                {showClose ? (
                  <div className="space-y-2 rounded-xl border border-rose-100 bg-rose-50/50 px-3 py-3">
                    <p className="text-[13px] text-rose-950">
                      Closes permanently (spam / abuse). They’ll need a new
                      chat. Prefer <strong>Mark done</strong> for normal
                      finishes.
                    </p>
                    <input
                      value={closeReason}
                      onChange={(e) => setCloseReason(e.target.value)}
                      placeholder="Why close? (min 8 characters)"
                      className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy != null || closeReason.trim().length < 8}
                        onClick={() =>
                          void run("close", async () => {
                            await closeThread({
                              threadId: active._id,
                              reason: closeReason.trim(),
                            });
                            setShowClose(false);
                            setCloseReason("");
                            setShowMore(false);
                          })
                        }
                        className="rounded-lg bg-rose-700 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-45"
                      >
                        Confirm close
                      </button>
                      <button
                        type="button"
                        className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-black/50"
                        onClick={() => setShowClose(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              {error ? (
                <div className="mx-4 mt-3 shrink-0 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                  {error}
                </div>
              ) : null}

              {isAdmin && takeover?.status === "pending_consent" ? (
                <div className="mx-4 mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5">
                  <div>
                    <p className="text-[12px] font-semibold text-violet-950">
                      Merchant allowed Admin takeover
                    </p>
                    <p className="text-[11px] text-violet-900/70">
                      Consent until{" "}
                      {new Date(takeover.consentExpiresAt).toLocaleString(
                        undefined,
                        { dateStyle: "short", timeStyle: "short" },
                      )}{" "}
                      · you’ll work on their dashboard as Admin (locks them out up to 60m)
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg bg-violet-900 px-2.5 py-1.5 text-[11px] font-semibold text-white"
                    onClick={() => {
                      setTakeoverReason("");
                      setShowTakeoverStart(true);
                    }}
                  >
                    <ShieldAlert className="size-3" />
                    Take over account
                  </button>
                </div>
              ) : null}

              {isAdmin && takeover?.status === "active" ? (
                <div className="mx-4 mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5">
                  <div>
                    <p className="text-[12px] font-semibold text-rose-950">
                      Takeover active
                      {takeover.adminName
                        ? ` · ${takeover.adminName}`
                        : ""}
                    </p>
                    <p className="text-[11px] text-rose-900/70">
                      Ends{" "}
                      {takeover.expiresAt
                        ? new Date(takeover.expiresAt).toLocaleString(
                            undefined,
                            { dateStyle: "short", timeStyle: "short" },
                          )
                        : "soon"}
                      {takeover.extended ? " · already extended" : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {!takeover.extended &&
                    takeover.adminUserId === viewerUserId ? (
                      <button
                        type="button"
                        disabled={busy != null}
                        className="rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-950 disabled:opacity-45"
                        onClick={() =>
                          void run("extend", () =>
                            extendTakeover({
                              takeoverId: takeover._id,
                              reason: "Need more time to finish diagnosis",
                            }),
                          )
                        }
                      >
                        +30 min
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy != null}
                      className="rounded-lg bg-rose-900 px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-45"
                      onClick={() =>
                        void run("endTakeover", () =>
                          endTakeover({
                            takeoverId: takeover._id,
                            reason: "Admin ended takeover from inbox",
                          }),
                        )
                      }
                    >
                      End takeover
                    </button>
                  </div>
                </div>
              ) : null}

              {activeGrant ? (
                <div className="mx-4 mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                  <div>
                    <p className="text-[12px] font-semibold text-emerald-950">
                      Granted Access
                    </p>
                    <p className="text-[11px] text-emerald-900/70">
                      Until{" "}
                      {new Date(activeGrant.expiresAt).toLocaleString(
                        undefined,
                        { dateStyle: "short", timeStyle: "short" },
                      )}
                      {activeGrant.granteeUserId === viewerUserId
                        ? " · simulation only — won’t change their account"
                        : ` · for ${activeGrant.granteeName}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(activeGrant.granteeUserId === viewerUserId ||
                      isAdmin) && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-lg bg-[#111] px-2.5 py-1.5 text-[11px] font-semibold text-white"
                        onClick={() => setShowDashSim(true)}
                      >
                        <LayoutDashboard className="size-3" />
                        Look at Dashboard
                      </button>
                    )}
                    {onOpenMerchant ? (
                      <button
                        type="button"
                        className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-950"
                        onClick={() => onOpenMerchant(active.userId)}
                      >
                        Account tools
                      </button>
                    ) : null}
                    {(activeGrant.granteeUserId === viewerUserId ||
                      isAdmin) && (
                      <button
                        type="button"
                        disabled={busy != null}
                        className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-950 disabled:opacity-45"
                        onClick={() =>
                          void run("revoke", () =>
                            revokeGrant({ grantId: activeGrant._id }),
                          )
                        }
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              ) : null}

              {showTakeoverStart &&
              isAdmin &&
              takeover?.status === "pending_consent" ? (
                <div className="mx-4 mt-3 shrink-0 rounded-xl border border-violet-200 bg-white p-3 shadow-sm">
                  <p className="text-[13px] font-semibold text-violet-950">
                    Start Admin takeover?
                  </p>
                  <p className="mt-1 text-[12px] text-black/55">
                    You stay signed in as Admin. Product actions run on their
                    account until you end the session or it expires. They stay
                    locked out. Leave a reason (min 8 characters).
                  </p>
                  <textarea
                    value={takeoverReason}
                    onChange={(e) => setTakeoverReason(e.target.value)}
                    rows={2}
                    placeholder="e.g. Testing Create store flow they reported…"
                    className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/25"
                  />
                  <div className="mt-2 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-black/10 px-3 py-1.5 text-[12px] font-semibold text-black/60"
                      onClick={() => setShowTakeoverStart(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={
                        busy != null || takeoverReason.trim().length < 8
                      }
                      className="rounded-lg bg-violet-900 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-45"
                      onClick={() =>
                        void run("startTakeover", async () => {
                          await startTakeover({
                            takeoverId: takeover._id,
                            reason: takeoverReason.trim(),
                          });
                          setShowTakeoverStart(false);
                          // Model B: stay signed in as Admin; product APIs
                          // resolve to the merchant while takeover is active.
                          window.location.assign(MERCHANT_DASHBOARD);
                        })
                      }
                    >
                      {busy === "startTakeover"
                        ? "Starting…"
                        : "Open their dashboard"}
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {messages === undefined ? (
                  <p className="text-sm text-black/40">Loading…</p>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-black/40">No messages yet.</p>
                ) : (
                  messages.map((m) => {
                    if (m.kind === "system") {
                      return (
                        <div
                          key={m._id}
                          className="mx-auto max-w-[92%] rounded-xl border border-black/8 bg-black/[0.03] px-3.5 py-2 text-center text-[12px] text-black/55"
                        >
                          {m.body}
                        </div>
                      );
                    }
                    const staffSide =
                      m.authorRole === "staff" || m.authorRole === "admin";
                    const internal = m.visibility === "internal";
                    return (
                      <div
                        key={m._id}
                        className={`flex ${staffSide ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                            internal
                              ? "border border-amber-200 bg-amber-50 text-amber-950"
                              : staffSide
                                ? "bg-[#111] text-white"
                                : "bg-black/[0.05] text-black"
                          }`}
                        >
                          <p
                            className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${
                              internal
                                ? "text-amber-800/70"
                                : staffSide
                                  ? "text-white/50"
                                  : "text-black/40"
                            }`}
                          >
                            {m.authorName}
                            {internal ? " · team only" : ""}
                          </p>
                          <p className="whitespace-pre-wrap">{m.body}</p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {active.status === "closed" ? (
                <p className="shrink-0 border-t border-black/8 px-4 py-3 text-sm text-black/45">
                  Closed — no further replies. Merchant must start a new chat.
                </p>
              ) : needsClaim ? (
                <div className="shrink-0 border-t border-black/8 bg-amber-50/40 px-4 py-4">
                  <p className="text-[13px] font-medium text-black/70">
                    {isEscalated
                      ? "Staff asked for an Admin on this one"
                      : "Claim this chat to reply"}
                  </p>
                  <p className="mt-0.5 text-[12px] text-black/45">
                    {isEscalated
                      ? active.escalatedByName
                        ? `${active.escalatedByName} escalated it — claim to take over.`
                        : "Claim as Admin to take over."
                      : "That puts you on the hook and keeps two people from typing at once."}
                  </p>
                  <button
                    type="button"
                    disabled={busy != null}
                    onClick={() =>
                      void run("claim", async () => {
                        await claimThread({ threadId: active._id });
                        setFilter("mine");
                      })
                    }
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#111] px-4 py-2.5 text-[13px] font-semibold text-white"
                  >
                    <UserPlus className="size-3.5" />
                    {busy === "claim"
                      ? "Claiming…"
                      : isEscalated
                        ? "Claim as Admin"
                        : "Claim & help"}
                  </button>
                </div>
              ) : isEscalated && !isAdmin ? (
                <div className="shrink-0 border-t border-violet-100 bg-violet-50/40 px-4 py-4 text-[13px] text-violet-950">
                  Waiting on an Admin — Staff can’t claim this one.
                </div>
              ) : claimedByOther ? (
                <div className="shrink-0 border-t border-black/8 px-4 py-4 text-[13px] text-black/50">
                  {active.assigneeName ?? "A teammate"} is helping.
                  {isAdmin
                    ? " Use Take over above if you need to jump in."
                    : " You can read along; only they can reply."}
                </div>
              ) : canReply ? (
                <div
                  className={`shrink-0 space-y-2 border-t p-3 ${
                    internalNote
                      ? "border-amber-100 bg-amber-50/40"
                      : "border-black/8 bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex rounded-lg border border-black/10 bg-white p-0.5 text-[12px] font-semibold">
                      <button
                        type="button"
                        onClick={() => setInternalNote(false)}
                        className={`rounded-md px-2.5 py-1 transition ${
                          !internalNote
                            ? "bg-[#111] text-white"
                            : "text-black/50 hover:text-black/70"
                        }`}
                      >
                        Reply to customer
                      </button>
                      <button
                        type="button"
                        onClick={() => setInternalNote(true)}
                        className={`rounded-md px-2.5 py-1 transition ${
                          internalNote
                            ? "bg-amber-700 text-white"
                            : "text-black/50 hover:text-black/70"
                        }`}
                      >
                        Note for team
                      </button>
                    </div>
                    {!internalNote ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {REPLY_MACROS.map((macro) => (
                          <button
                            key={macro.id}
                            type="button"
                            title={macro.body}
                            className="rounded-lg border border-black/10 bg-black/[0.02] px-2 py-1 text-[11px] font-semibold text-black/60 hover:bg-black/[0.04]"
                            onClick={() =>
                              setReply((prev) => appendMacro(prev, macro.body))
                            }
                          >
                            {macro.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg border border-black/10 bg-black/[0.02] px-2 py-1 text-[11px] font-semibold text-black/65 hover:bg-black/[0.04]"
                          onClick={() => {
                            setReply((prev) => {
                              if (prev.includes(GIVE_ACCESS_TOKEN)) return prev;
                              return appendMacro(
                                prev,
                                `Please give me access to your account so I can look at this myself.\n\n${GIVE_ACCESS_TOKEN}`,
                              );
                            });
                          }}
                        >
                          <KeyRound className="size-3" />
                          Give Access
                        </button>
                        {isAdmin ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-900 hover:bg-violet-100"
                            onClick={() => {
                              setReply((prev) => {
                                if (prev.includes(TAKEOVER_CONSENT_TOKEN)) {
                                  return prev;
                                }
                                return appendMacro(
                                  prev,
                                  `I need temporary access to work on your dashboard as Admin to reproduce this (max 60 minutes). You’ll be locked out while I work.\n\n${TAKEOVER_CONSENT_TOKEN}`,
                                );
                              });
                            }}
                          >
                            <ShieldAlert className="size-3" />
                            Admin takeover
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  {internalNote ? (
                    <p className="text-[11px] text-amber-900/70">
                      Customer never sees this.
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      rows={2}
                      placeholder={
                        internalNote
                          ? "Internal note…"
                          : "Write your reply…"
                      }
                      className={`min-w-0 flex-1 resize-none rounded-xl border px-3 py-2 text-sm outline-none focus:border-black/25 ${
                        internalNote
                          ? "border-amber-200 bg-white"
                          : "border-black/10 bg-white"
                      }`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (reply.trim().length < 1) return;
                          void run("send", async () => {
                            await sendMessage({
                              threadId: active._id,
                              body: reply.trim(),
                              visibility: internalNote
                                ? "internal"
                                : "customer",
                            });
                            setReply("");
                          });
                        }
                      }}
                    />
                    <button
                      type="button"
                      disabled={busy != null || reply.trim().length < 1}
                      onClick={() =>
                        void run("send", async () => {
                          await sendMessage({
                            threadId: active._id,
                            body: reply.trim(),
                            visibility: internalNote ? "internal" : "customer",
                          });
                          setReply("");
                        })
                      }
                      className={`inline-flex size-10 shrink-0 items-center justify-center self-end rounded-xl text-white disabled:opacity-45 ${
                        internalNote ? "bg-amber-700" : "bg-[#111]"
                      }`}
                      aria-label="Send"
                    >
                      <Send className="size-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <p className="shrink-0 border-t border-black/8 px-4 py-3 text-sm text-black/45">
                  This chat is marked done. If they write again, it returns to
                  Waiting.
                </p>
              )}
            </>
          )}
        </div>

        <aside
          className={`hidden min-h-0 flex-col overflow-y-auto border-l border-black/8 bg-black/[0.015] xl:flex ${
            active ? "" : "items-center justify-center"
          }`}
        >
          {!active ? (
            <p className="px-4 text-center text-[12px] text-black/35">
              Live triage appears when you open a chat.
            </p>
          ) : diag === undefined ? (
            <p className="px-4 py-6 text-[12px] text-black/40">Loading…</p>
          ) : (
            <div className="space-y-4 px-3 py-4 text-[12px]">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-black/35">
                  Live triage
                </p>
                <p className="mt-1 font-semibold text-black/80">
                  {diag.merchantName}
                </p>
                <p className="text-black/45">No Give Access needed</p>
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-black/35">
                  Account
                </p>
                <p
                  className={
                    diag.accountStatus === "active"
                      ? "font-medium text-emerald-800"
                      : diag.accountStatus === "frozen"
                        ? "font-medium text-amber-800"
                        : "font-medium text-red-800"
                  }
                >
                  {diag.accountStatus === "active"
                    ? "Active"
                    : diag.accountStatus === "frozen"
                      ? "Frozen"
                      : "Disabled"}
                </p>
                {diag.frozenReason ? (
                  <p className="text-black/50">{diag.frozenReason}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-black/35">
                  Lemon store
                </p>
                {diag.storeLinked ? (
                  <>
                    <p className="font-medium text-black/75">
                      {diag.storeName ?? "Linked"}
                    </p>
                    <p className="text-black/45">
                      {diag.testMode === true
                        ? "Test mode"
                        : diag.testMode === false
                          ? "Live mode"
                          : "Mode unknown"}
                      {diag.storeId ? ` · ${diag.storeId}` : ""}
                    </p>
                  </>
                ) : (
                  <p className="font-medium text-amber-800">
                    {diag.connectionSoftDeleted
                      ? "Disconnected (soft-deleted)"
                      : "Not linked"}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-black/35">
                  Webhooks
                </p>
                {diag.webhookLastReceivedAt != null ? (
                  <>
                    <p className="font-medium text-black/75">
                      {waitLabel(diag.webhookLastReceivedAt)}
                    </p>
                    <p className="truncate text-black/45">
                      {diag.webhookLastEventName ?? "event"}
                    </p>
                  </>
                ) : (
                  <p className="font-medium text-amber-800">None received</p>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-black/35">
                  Open failures
                </p>
                <p className="font-medium text-black/75">
                  {diag.openFailureCount === 0
                    ? "None open"
                    : `${diag.openFailureCount} · ${formatCents(
                        diag.openAtRiskCents,
                        diag.openCurrency,
                      )} at risk`}
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-black/35">
                  Recovery
                </p>
                <p className="font-medium text-black/75">
                  {diag.hasRecoverySettings
                    ? `Configured${
                        diag.recoveryTemplateId
                          ? ` · ${diag.recoveryTemplateId}`
                          : ""
                      }`
                    : "Not set up"}
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>

      {showDashSim && activeGrant ? (
        <StaffDashboardSim
          merchantUserId={activeGrant.merchantUserId}
          onClose={() => setShowDashSim(false)}
        />
      ) : null}
    </section>
  );
}
