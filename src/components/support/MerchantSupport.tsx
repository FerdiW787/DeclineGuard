import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import gsap from "gsap";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  ArrowLeft,
  Headphones,
  KeyRound,
  MessageCircle,
  Send,
  ShieldAlert,
  X,
} from "lucide-react";

type Topic = "account" | "billing" | "lemon_squeezy" | "bug" | "other";

const GIVE_ACCESS_TOKEN = "[Give Access]";
const TAKEOVER_CONSENT_TOKEN = "[Allow Admin Takeover]";

const TOPICS: { id: Topic; label: string }[] = [
  { id: "account", label: "Account access" },
  { id: "billing", label: "Billing / plan" },
  { id: "lemon_squeezy", label: "Lemon Squeezy" },
  { id: "bug", label: "Something’s broken" },
  { id: "other", label: "Something else" },
];

type LsIssue =
  | "cant_connect"
  | "emails_not_sending"
  | "webhook"
  | "test_mode"
  | "other";

const LS_ISSUES: { id: LsIssue; label: string }[] = [
  { id: "cant_connect", label: "Can’t connect / add store" },
  { id: "emails_not_sending", label: "Recovery emails not sending" },
  { id: "webhook", label: "Webhook / events not arriving" },
  { id: "test_mode", label: "Test vs live mode confusion" },
  { id: "other", label: "Something else with Lemon" },
];

function buildIntakeBody(args: {
  topic: Topic;
  body: string;
  lsIssue: LsIssue;
  storeNameHint: string;
  modeHint: "live" | "test" | "unsure";
}): string {
  const parts = [args.body.trim()];
  if (args.topic === "lemon_squeezy") {
    const issue =
      LS_ISSUES.find((i) => i.id === args.lsIssue)?.label ?? args.lsIssue;
    parts.push(`\n---\nLemon issue: ${issue}`);
    if (args.storeNameHint.trim()) {
      parts.push(`Store name: ${args.storeNameHint.trim()}`);
    }
    parts.push(
      `Mode: ${
        args.modeHint === "live"
          ? "Live"
          : args.modeHint === "test"
            ? "Test"
            : "Not sure"
      }`,
    );
  } else if (args.topic === "account") {
    parts.push("\n---\nTopic: Account access");
  } else if (args.topic === "billing") {
    parts.push("\n---\nTopic: Billing / plan");
  }
  return parts.join("\n").trim();
}

function statusLabel(
  status: string,
  escalatedAt: number | null | undefined,
): string {
  if (escalatedAt != null && (status === "open" || status === "waiting_staff")) {
    return "An Admin will help next";
  }
  switch (status) {
    case "open":
      return "Waiting for support";
    case "claimed":
    case "waiting_staff":
      return "Support is on it";
    case "waiting_customer":
      return "Waiting for you";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
    default:
      return status;
  }
}

function stripAccessTokens(body: string): string {
  return body
    .replaceAll(GIVE_ACCESS_TOKEN, "")
    .replaceAll(TAKEOVER_CONSENT_TOKEN, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type SupportLaunch = {
  subject?: string;
  topic?: Topic;
  body?: string;
  lsIssue?: LsIssue;
  /** Create the thread as soon as the panel opens. */
  autoCreate?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Prefill when opened from frozen banner */
  initialSubject?: string;
  /** Prefill / auto-create when opened from preview or other flows */
  launch?: SupportLaunch | null;
  onLaunchConsumed?: () => void;
};

export default function MerchantSupport({
  open,
  onClose,
  initialSubject,
  launch,
  onLaunchConsumed,
}: Props) {
  const [mounted, setMounted] = useState(open);
  const rootRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const autoCreatedRef = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;

  const threads = useQuery(
    api.functions.support.listMyThreads,
    mounted ? {} : "skip",
  );
  const createThread = useMutation(api.functions.support.createThread);
  const sendMessage = useMutation(api.functions.support.sendMessage);
  const reopenThread = useMutation(api.functions.support.reopenThread);
  const acceptGrant = useMutation(
    api.functions.supportAccess.acceptStaffAccessGrant,
  );
  const revokeGrant = useMutation(
    api.functions.supportAccess.revokeStaffAccessGrant,
  );
  const acceptTakeover = useMutation(
    api.functions.adminTakeover.acceptTakeoverConsent,
  );
  const revokeTakeoverConsent = useMutation(
    api.functions.adminTakeover.revokeTakeoverConsent,
  );
  const markThreadRead = useMutation(api.functions.support.markThreadRead);

  const [view, setView] = useState<"list" | "new" | "chat">("list");
  const [activeId, setActiveId] = useState<Id<"supportThreads"> | null>(null);
  const [topic, setTopic] = useState<Topic>("account");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [lsIssue, setLsIssue] = useState<LsIssue>("cant_connect");
  const [storeNameHint, setStoreNameHint] = useState("");
  const [modeHint, setModeHint] = useState<"live" | "test" | "unsure">(
    "unsure",
  );
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = useQuery(
    api.functions.support.listMessages,
    mounted && activeId ? { threadId: activeId } : "skip",
  );
  const activeGrant = useQuery(
    api.functions.supportAccess.getActiveGrantForThread,
    mounted && activeId ? { threadId: activeId } : "skip",
  );
  const takeover = useQuery(
    api.functions.adminTakeover.getTakeoverForThread,
    mounted && activeId ? { threadId: activeId } : "skip",
  );
  const activeThread = threads?.find((t) => t._id === activeId) ?? null;

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useLayoutEffect(() => {
    if (!mounted) return;
    const root = rootRef.current;
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    if (!root || !panel || !backdrop) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;

    gsap.killTweensOf([panel, backdrop]);

    if (open) {
      if (reduced) {
        gsap.set(panel, { x: 0 });
        gsap.set(backdrop, { opacity: 1 });
        return;
      }
      gsap.set(panel, { x: "100%" });
      gsap.set(backdrop, { opacity: 0 });
      gsap.to(backdrop, { opacity: 1, duration: 0.28, ease: "power2.out" });
      gsap.to(panel, {
        x: 0,
        duration: 0.42,
        ease: "power3.out",
      });
      return;
    }

    if (reduced) {
      setMounted(false);
      return;
    }
    gsap.to(backdrop, { opacity: 0, duration: 0.22, ease: "power2.in" });
    gsap.to(panel, {
      x: "100%",
      duration: 0.36,
      ease: "power3.in",
      onComplete: () => {
        if (!openRef.current) setMounted(false);
      },
    });
  }, [open, mounted]);

  useEffect(() => {
    if (!open) {
      autoCreatedRef.current = false;
      return;
    }
    setError(null);
    if (launch) {
      if (launch.topic) setTopic(launch.topic);
      if (launch.subject) setSubject(launch.subject);
      if (launch.body) setBody(launch.body);
      if (launch.lsIssue) setLsIssue(launch.lsIssue);
      if (!launch.autoCreate) setView("new");
      return;
    }
    if (initialSubject) {
      setView("new");
      setSubject(initialSubject);
    }
  }, [open, initialSubject, launch]);

  useEffect(() => {
    if (!open || !launch?.autoCreate || autoCreatedRef.current) return;
    autoCreatedRef.current = true;

    const nextTopic = launch.topic ?? "lemon_squeezy";
    const nextLsIssue = launch.lsIssue ?? "emails_not_sending";
    const nextSubject =
      launch.subject?.trim() ||
      "Preview sequence — missing or wrong emails";
    const nextBody =
      launch.body?.trim() ||
      "I ran the recovery email preview sequence but did not receive all emails, or something looked wrong.";

    setTopic(nextTopic);
    setLsIssue(nextLsIssue);
    setSubject(nextSubject);
    setBody(nextBody);
    setView("new");
    setBusy(true);
    setError(null);

    void (async () => {
      try {
        const composed = buildIntakeBody({
          topic: nextTopic,
          body: nextBody,
          lsIssue: nextLsIssue,
          storeNameHint: "",
          modeHint: "unsure",
        });
        const id = await createThread({
          topic: nextTopic,
          subject: nextSubject,
          body: composed,
        });
        setActiveId(id);
        setView("chat");
        setBody("");
        setSubject("");
        setStoreNameHint("");
        setModeHint("unsure");
        setLsIssue("cant_connect");
        onLaunchConsumed?.();
      } catch (e) {
        setView("new");
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    })();
  }, [open, launch, createThread, onLaunchConsumed]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, view]);

  useEffect(() => {
    if (!mounted || !activeId || view !== "chat") return;
    void markThreadRead({ threadId: activeId }).catch(() => {
      /* ignore */
    });
  }, [mounted, activeId, view, messages?.length, markThreadRead]);

  if (!mounted) return null;

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      const composed = buildIntakeBody({
        topic,
        body,
        lsIssue,
        storeNameHint,
        modeHint,
      });
      const id = await createThread({
        topic,
        subject:
          subject.trim() ||
          (topic === "lemon_squeezy"
            ? (LS_ISSUES.find((i) => i.id === lsIssue)?.label ?? "Lemon Squeezy")
            : TOPICS.find((t) => t.id === topic)?.label) ||
          "Help",
        body: composed,
      });
      setActiveId(id);
      setView("chat");
      setBody("");
      setSubject("");
      setStoreNameHint("");
      setModeHint("unsure");
      setLsIssue("cant_connect");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleSend() {
    if (!activeId || reply.trim().length < 1) return;
    setBusy(true);
    setError(null);
    try {
      if (activeThread?.status === "resolved") {
        await reopenThread({ threadId: activeId });
      }
      await sendMessage({
        threadId: activeId,
        body: reply.trim(),
        visibility: "customer",
      });
      setReply("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleGiveAccess(messageId: Id<"supportMessages">) {
    if (!activeId) return;
    setBusy(true);
    setError(null);
    try {
      await acceptGrant({ threadId: activeId, messageId });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleRevokeAccess() {
    if (!activeGrant) return;
    setBusy(true);
    setError(null);
    try {
      await revokeGrant({ grantId: activeGrant._id });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleAllowTakeover(messageId: Id<"supportMessages">) {
    if (!activeId) return;
    setBusy(true);
    setError(null);
    try {
      await acceptTakeover({ threadId: activeId, messageId });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleRevokeTakeoverConsent() {
    if (!takeover || takeover.status !== "pending_consent") return;
    setBusy(true);
    setError(null);
    try {
      await revokeTakeoverConsent({ takeoverId: takeover._id });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[110] flex justify-end"
    >
      <button
        ref={backdropRef}
        type="button"
        className="absolute inset-0 bg-black/25"
        aria-label="Close help"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl will-change-transform"
      >
        <header className="flex items-center justify-between gap-3 border-b border-black/8 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {view !== "list" ? (
              <button
                type="button"
                className="rounded-lg p-1.5 text-black/50 hover:bg-black/5 hover:text-black"
                onClick={() => {
                  setView("list");
                  setActiveId(null);
                  setError(null);
                }}
                aria-label="Back"
              >
                <ArrowLeft className="size-4" />
              </button>
            ) : (
              <Headphones className="size-4 text-black/50" />
            )}
            <div className="min-w-0">
              <h2 className="font-display truncate text-lg tracking-tight">
                {view === "new"
                  ? "New chat"
                  : view === "chat"
                    ? "Chat with us"
                    : "Help"}
              </h2>
              {view === "chat" && activeThread ? (
                <p className="text-[12px] text-black/45">
                  {statusLabel(
                    activeThread.status,
                    activeThread.escalatedAt,
                  )}
                </p>
              ) : (
                <p className="text-[12px] text-black/45">
                  Talk to DeclineGuard support
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-black/40 hover:bg-black/5 hover:text-black"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </header>

        {error ? (
          <div className="mx-4 mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            {error}
          </div>
        ) : null}

        {view === "list" ? (
          <>
            <div className="flex-1 overflow-y-auto">
              {threads === undefined ? (
                <p className="px-4 py-10 text-center text-sm text-black/40">
                  Loading…
                </p>
              ) : threads.length === 0 ? (
                <div className="px-6 py-14 text-center">
                  <MessageCircle className="mx-auto size-8 text-black/20" />
                  <p className="mt-3 text-sm text-black/55">
                    No chats yet. Tell us what’s going on — we’ll help.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-black/6">
                  {threads.map((t) => (
                    <li key={t._id}>
                      <button
                        type="button"
                        className="flex w-full flex-col gap-0.5 px-4 py-3.5 text-left hover:bg-black/[0.02]"
                        onClick={() => {
                          setActiveId(t._id);
                          setView("chat");
                        }}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={`min-w-0 flex-1 truncate text-sm ${
                              t.hasUnread
                                ? "font-bold text-black"
                                : "font-semibold text-black/85"
                            }`}
                          >
                            {t.subject}
                          </span>
                          {t.hasUnread ? (
                            <span className="shrink-0 rounded-full bg-sky-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              New
                            </span>
                          ) : null}
                        </span>
                        {t.lastMessagePreview ? (
                          <span
                            className={`truncate text-[12px] ${
                              t.hasUnread
                                ? "font-medium text-black/65"
                                : "text-black/45"
                            }`}
                          >
                            {t.lastMessagePreview}
                          </span>
                        ) : null}
                        <span className="text-[11px] text-black/40">
                          {statusLabel(t.status, t.escalatedAt)} ·{" "}
                          {new Date(t.lastMessageAt).toLocaleString()}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t border-black/8 p-4">
              <button
                type="button"
                className="w-full rounded-xl bg-[#111] px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
                onClick={() => {
                  setView("new");
                  setError(null);
                }}
              >
                Start a new chat
              </button>
            </div>
          </>
        ) : null}

        {view === "new" ? (
          <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
            <p className="text-sm text-black/55">
              Pick a topic and tell us what happened. Keep it short — we can
              follow up in the chat.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {TOPICS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTopic(t.id)}
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
                    topic === t.id
                      ? "border-black bg-[#111] text-white"
                      : "border-black/10 text-black/60 hover:border-black/20"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {topic === "lemon_squeezy" ? (
              <div className="mt-4 space-y-3 rounded-xl border border-black/8 bg-black/[0.02] p-3">
                <p className="text-[12px] font-semibold text-black/60">
                  Quick details (helps us fix this faster)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {LS_ISSUES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setLsIssue(item.id)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                        lsIssue === item.id
                          ? "border-black bg-[#111] text-white"
                          : "border-black/10 text-black/55"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <label className="block text-[11px] font-medium text-black/50">
                  Store name (if you know it)
                </label>
                <input
                  value={storeNameHint}
                  onChange={(e) => setStoreNameHint(e.target.value)}
                  placeholder="e.g. Acme Shop"
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/25"
                />
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: "live" as const, label: "Live mode" },
                      { id: "test" as const, label: "Test mode" },
                      { id: "unsure" as const, label: "Not sure" },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setModeHint(m.id)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                        modeHint === m.id
                          ? "border-black bg-[#111] text-white"
                          : "border-black/10 text-black/55"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {topic === "account" ? (
              <p className="mt-3 text-[12px] text-black/45">
                Tip: if you’re frozen, say what happened right before — we’ll
                still see your chat.
              </p>
            ) : null}

            <label className="mt-4 block text-[12px] font-medium text-black/50">
              Short summary
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Can’t connect my store"
              className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/25"
            />
            <label className="mt-3 block text-[12px] font-medium text-black/50">
              What’s going on?
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder={
                topic === "lemon_squeezy"
                  ? "What did you try? Any error text?"
                  : "Describe the problem…"
              }
              className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/25"
            />
            <p className="mt-2 text-[11px] text-black/40">
              We usually reply within a few hours on weekdays.
            </p>
            <button
              type="button"
              disabled={busy || body.trim().length < 3}
              onClick={() => void handleCreate()}
              className="mt-3 rounded-xl bg-[#111] px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-45"
            >
              {busy ? "Sending…" : "Send to support"}
            </button>
          </div>
        ) : null}

        {view === "chat" && activeId ? (
          <>
            {takeover?.status === "active" ? (
              <div className="mx-4 mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5">
                <p className="text-[12px] font-semibold text-rose-950">
                  An Admin is signed into your account
                </p>
                <p className="mt-0.5 text-[11px] text-rose-900/70">
                  Dashboard locked until{" "}
                  {takeover.expiresAt
                    ? new Date(takeover.expiresAt).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "the session ends"}
                  . Support chat still works.
                </p>
              </div>
            ) : takeover?.status === "pending_consent" ? (
              <div className="mx-4 mt-3 flex items-start justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-violet-950">
                    Admin takeover allowed
                  </p>
                  <p className="mt-0.5 text-[11px] text-violet-900/70">
                    They can start a login session until{" "}
                    {new Date(takeover.consentExpiresAt).toLocaleString(
                      undefined,
                      { dateStyle: "short", timeStyle: "short" },
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleRevokeTakeoverConsent()}
                  className="shrink-0 rounded-lg border border-violet-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-violet-950"
                >
                  Revoke
                </button>
              </div>
            ) : null}

            {activeGrant ? (
              <div className="mx-4 mt-3 flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-amber-950">
                    Access granted to {activeGrant.granteeName}
                  </p>
                  <p className="mt-0.5 text-[11px] text-amber-900/70">
                    Until{" "}
                    {new Date(activeGrant.expiresAt).toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}{" "}
                    · view-only in staff portal
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleRevokeAccess()}
                  className="shrink-0 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-950"
                >
                  Revoke
                </button>
              </div>
            ) : null}

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {activeThread ? (
                <p className="text-[12px] font-medium text-black/40">
                  {activeThread.subject}
                </p>
              ) : null}
              {messages === undefined ? (
                <p className="text-sm text-black/40">Loading messages…</p>
              ) : (
                messages.map((m) => {
                  if (m.kind === "system") {
                    return (
                      <div
                        key={m._id}
                        className="mx-auto max-w-[95%] rounded-xl border border-black/8 bg-black/[0.03] px-3.5 py-2.5 text-center text-[12px] leading-relaxed text-black/60"
                      >
                        {m.body}
                      </div>
                    );
                  }

                  const mine = m.authorRole === "user";
                  const isAdmin = m.authorRole === "admin";
                  const isSupport =
                    m.authorRole === "staff" || m.authorRole === "admin";
                  const offersAccess =
                    isSupport && m.body.includes(GIVE_ACCESS_TOKEN);
                  const offersTakeover =
                    isAdmin && m.body.includes(TAKEOVER_CONSENT_TOKEN);
                  const displayBody =
                    offersAccess || offersTakeover
                      ? stripAccessTokens(m.body)
                      : m.body;
                  const grantActive =
                    activeGrant != null &&
                    activeGrant.messageId === m._id;
                  const takeoverPending =
                    takeover?.status === "pending_consent" &&
                    takeover.messageId === m._id;
                  const takeoverActive = takeover?.status === "active";
                  const initials = m.authorName
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((p) => p[0]?.toUpperCase() ?? "")
                    .join("");

                  return (
                    <div
                      key={m._id}
                      className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}
                    >
                      {!mine && isSupport ? (
                        <div className="mt-0.5 size-8 shrink-0 overflow-hidden rounded-full bg-black/[0.08] ring-1 ring-black/10">
                          {m.authorProfilePic ? (
                            <img
                              src={m.authorProfilePic}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : (
                            <span className="flex size-full items-center justify-center text-[10px] font-semibold text-black/50">
                              {initials || "?"}
                            </span>
                          )}
                        </div>
                      ) : null}
                      <div className="max-w-[80%] space-y-2">
                        <div
                          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                            mine
                              ? "bg-[#111] text-white"
                              : "bg-black/[0.05] text-black"
                          }`}
                        >
                          {!mine && isSupport ? (
                            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                              <span className="text-[12px] font-semibold text-black/80">
                                {m.authorName}
                              </span>
                              <span
                                className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                  isAdmin
                                    ? "border-violet-200 bg-violet-50 text-violet-900"
                                    : "border-sky-200 bg-sky-50 text-sky-900"
                                }`}
                              >
                                {isAdmin ? "Admin" : "Staff"}
                              </span>
                            </div>
                          ) : null}
                          {displayBody ? (
                            <p className="whitespace-pre-wrap">{displayBody}</p>
                          ) : null}
                        </div>
                        {offersAccess ? (
                          <button
                            type="button"
                            disabled={
                              busy ||
                              activeGrant != null ||
                              activeThread?.status === "closed"
                            }
                            onClick={() => void handleGiveAccess(m._id)}
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 py-2 text-[13px] font-semibold text-black shadow-sm transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <KeyRound className="size-3.5" />
                            {grantActive || activeGrant
                              ? "Access granted"
                              : "Give Access"}
                          </button>
                        ) : null}
                        {offersTakeover ? (
                          <div className="space-y-1.5">
                            <button
                              type="button"
                              disabled={
                                busy ||
                                takeoverPending ||
                                takeoverActive ||
                                activeThread?.status === "closed"
                              }
                              onClick={() => void handleAllowTakeover(m._id)}
                              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-[13px] font-semibold text-violet-950 shadow-sm transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <ShieldAlert className="size-3.5" />
                              {takeoverActive
                                ? "Admin takeover active"
                                : takeoverPending
                                  ? "Takeover allowed"
                                  : "Allow Admin Takeover"}
                            </button>
                            {!takeoverPending && !takeoverActive ? (
                              <p className="px-1 text-[11px] leading-snug text-black/45">
                                An Admin will sign in as you for up to 60
                                minutes. You will be locked out of the dashboard
                                while they work.
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>
            {activeThread?.status === "closed" ? (
              <div className="border-t border-black/8 px-4 py-3 text-sm text-black/50">
                This chat was closed. Start a new one if you still need help.
              </div>
            ) : (
              <div className="border-t border-black/8 p-3">
                {activeThread?.status === "resolved" ? (
                  <p className="mb-2 text-[12px] text-black/45">
                    Marked resolved — sending a message reopens it for support.
                  </p>
                ) : null}
                <div className="flex gap-2">
                  <input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder="Write a reply…"
                    className="min-w-0 flex-1 rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/25"
                  />
                  <button
                    type="button"
                    disabled={busy || reply.trim().length < 1}
                    onClick={() => void handleSend()}
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#111] text-white hover:bg-black disabled:opacity-45"
                    aria-label="Send"
                  >
                    <Send className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
