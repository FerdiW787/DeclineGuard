import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { UserButton, useAuth } from "@clerk/astro/react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { withConvexClerkProvider } from "@/lib/withConvexClerkProvider";
import BrandLogo from "@/components/BrandLogo";
import LiveStaffLog from "@/components/admin/LiveStaffLog";
import PageEnter, {
  type PageEnterHandle,
} from "@/components/dashboard/PageEnter";
import StaffInbox from "@/components/support/StaffInbox";
import {
  ArchiveRestore,
  Ban,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Headphones,
  KeyRound,
  LayoutDashboard,
  Lock,
  Radio,
  Search,
  ShieldAlert,
  Store,
  Unlock,
  Users,
} from "lucide-react";

const ADMIN_DOCS = "/a/admin/docs";

const STAFF_NAV: {
  id: "support" | "merchants" | "live" | "docs";
  label: string;
  icon: typeof Headphones;
  adminOnly?: boolean;
}[] = [
  { id: "support", label: "Support", icon: Headphones },
  { id: "merchants", label: "Merchants", icon: Users },
  { id: "live", label: "Live log", icon: Radio, adminOnly: true },
  { id: "docs", label: "Guides", icon: BookOpen },
];

type StaffNavId = (typeof STAFF_NAV)[number]["id"];

function DocLink({
  hash,
  label = "How this works",
}: {
  hash: string;
  label?: string;
}) {
  return (
    <a
      href={`${ADMIN_DOCS}#${hash}`}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-700 underline-offset-2 hover:underline"
    >
      <BookOpen className="size-3.5 shrink-0 opacity-70" />
      {label}
    </a>
  );
}

function StepCard({
  step,
  title,
  body,
  docHash,
  children,
}: {
  step: number;
  title: string;
  body: string;
  docHash?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-black/8 bg-white p-5">
      <div className="flex gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#111] text-[13px] font-bold text-white">
          {step}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="font-display text-lg tracking-tight">{title}</h3>
            {docHash ? <DocLink hash={docHash} /> : null}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-black/55">{body}</p>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

type AppRole = "user" | "staff" | "admin";

type Merchant = {
  _id: Id<"users">;
  userId: string;
  userName: string;
  role: AppRole;
  accountStatus: "active" | "frozen" | "disabled";
  frozenReason: string | null;
  frozenAt: number | null;
  connection: {
    _id: Id<"lemonConnections">;
    storeId: string;
    storeName: string;
    storeSlug: string;
    apiKeyLast4: string;
    deletedAt: number | null;
    connectedAt: number;
  } | null;
  openFailureCount: number;
  activityCount: number;
  hasSoftDeletedData: boolean;
};

type StatusInfo = {
  label: string;
  meaning: string;
  tone: "ok" | "warn" | "danger";
};

function normalizeRole(role: string): AppRole {
  if (role === "admin") return "admin";
  if (role === "staff") return "staff";
  return "user";
}

function roleLabel(role: AppRole): string {
  switch (role) {
    case "user":
      return "User";
    case "staff":
      return "Staff";
    case "admin":
      return "Admin";
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}

function roleBadgeClasses(role: AppRole): string {
  switch (role) {
    case "user":
      return "bg-black/[0.04] text-black/65 border-black/10";
    case "staff":
      return "bg-sky-50 text-sky-900 border-sky-200";
    case "admin":
      return "bg-violet-50 text-violet-900 border-violet-200";
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}

function canAccessPortal(role: AppRole): boolean {
  return role === "staff" || role === "admin";
}

function canBan(role: AppRole): boolean {
  return role === "admin";
}

/** Staff may only help Users. Admins may act on anyone. */
function canActOn(actorRole: AppRole, targetRole: AppRole): boolean {
  if (actorRole === "admin") return true;
  if (actorRole === "staff") return targetRole === "user";
  return false;
}

function statusInfo(status: Merchant["accountStatus"]): StatusInfo {
  switch (status) {
    case "active":
      return {
        label: "Healthy",
        meaning: "Merchant can sign in and use DeclineGuard normally.",
        tone: "ok",
      };
    case "frozen":
      return {
        label: "Frozen",
        meaning:
          "They can still sign in, but can’t change settings, connect stores, or send recovery emails. Use this when you’re investigating.",
        tone: "warn",
      };
    case "disabled":
      return {
        label: "Banned",
        meaning:
          "They cannot sign in at all. Use only for serious abuse — you’ll need Clerk/support to recover if you ban yourself.",
        tone: "danger",
      };
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function toneClasses(tone: StatusInfo["tone"]): string {
  switch (tone) {
    case "ok":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "warn":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "danger":
      return "bg-rose-50 text-rose-900 border-rose-200";
    default: {
      const _exhaustive: never = tone;
      return _exhaustive;
    }
  }
}

function ActionButton({
  children,
  onClick,
  disabled,
  variant = "secondary",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "success";
}) {
  const styles =
    variant === "primary"
      ? "bg-[#111] text-white hover:bg-black"
      : variant === "danger"
        ? "bg-rose-700 text-white hover:bg-rose-800"
        : variant === "success"
          ? "bg-emerald-700 text-white hover:bg-emerald-800"
          : "bg-black/[0.06] text-[#0c0c0c] hover:bg-black/[0.1]";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${styles}`}
    >
      {children}
    </button>
  );
}

function AdminConsoleInner() {
  const { isLoaded, isSignedIn } = useAuth();
  const me = useQuery(api.functions.user.getCurrentUser);
  const ensureCurrentUser = useMutation(api.functions.user.ensureCurrentUser);

  const [nav, setNav] = useState<StaffNavId>("support");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<Id<"users"> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);
  const [reclaimStoreId, setReclaimStoreId] = useState("");
  const [note, setNote] = useState("");
  const [showDanger, setShowDanger] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmBan, setConfirmBan] = useState(false);
  const pageEnterRef = useRef<PageEnterHandle>(null);
  const navBusyRef = useRef(false);

  const searchQ = q.trim().length >= 2 ? q.trim() : "";
  const actorRole = me ? normalizeRole(me.role) : null;
  const portalOk = actorRole != null && canAccessPortal(actorRole);

  const goToNav = useCallback((id: StaffNavId) => {
    if (navBusyRef.current) return;
    navBusyRef.current = true;
    const finish = () => {
      setNav(id);
      navBusyRef.current = false;
    };
    const handle = pageEnterRef.current;
    if (!handle) {
      finish();
      return;
    }
    handle.exit(finish);
  }, []);

  const results = useQuery(
    api.functions.admin.searchMerchants,
    portalOk && searchQ ? { q: searchQ } : "skip",
  ) as Merchant[] | undefined;

  const selected = useQuery(
    api.functions.admin.getMerchant,
    portalOk && selectedId ? { userId: selectedId } : "skip",
  ) as Merchant | null | undefined;

  const audit = useQuery(
    api.functions.admin.listAuditForTarget,
    portalOk && selectedId
      ? { targetUserId: selectedId, limit: 40 }
      : "skip",
  );

  const merchantGrant = useQuery(
    api.functions.supportAccess.getActiveGrantForMerchant,
    portalOk && selectedId ? { merchantUserId: selectedId } : "skip",
  );
  const revokeMerchantGrant = useMutation(
    api.functions.supportAccess.revokeStaffAccessGrant,
  );

  const unclaimedCount = useQuery(
    api.functions.support.unclaimedCount,
    portalOk ? {} : "skip",
  );
  const escalatedCount = useQuery(
    api.functions.support.escalatedCount,
    portalOk && actorRole === "admin" ? {} : "skip",
  );

  const setAccountStatus = useMutation(api.functions.admin.setAccountStatus);
  const restoreAccount = useMutation(api.functions.admin.restoreAccount);
  const reclaimStore = useMutation(api.functions.admin.reclaimStore);
  const revokeSessions = useAction(api.functions.adminActions.revokeSessions);
  const banUser = useAction(api.functions.adminActions.banUser);
  const unbanUser = useAction(api.functions.adminActions.unbanUser);

  useEffect(() => {
    if (isSignedIn) void ensureCurrentUser({});
  }, [isSignedIn, ensureCurrentUser]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8f8] text-sm text-[#8a8f98]">
        Loading…
      </div>
    );
  }

  if (!isSignedIn) {
    if (typeof window !== "undefined") {
      window.location.href = "/a/sign-in";
    }
    return null;
  }

  if (me === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8f8] text-sm text-[#8a8f98]">
        Syncing account…
      </div>
    );
  }

  if (!me || !canAccessPortal(normalizeRole(me.role))) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 bg-[#f7f8f8] px-6 text-center text-[#08090a]">
        <BrandLogo />
        <h1 className="ln-h1 text-2xl">Staff only</h1>
        <p className="text-sm text-[#6b6f76]">
          This page is for DeclineGuard Staff and Admins. Ask an owner to set
          your Clerk{" "}
          <code className="rounded bg-black/5 px-1.5 py-0.5 text-[12px]">
            private_metadata.role
          </code>{" "}
          to{" "}
          <code className="rounded bg-black/5 px-1.5 py-0.5 text-[12px]">
            staff
          </code>{" "}
          or{" "}
          <code className="rounded bg-black/5 px-1.5 py-0.5 text-[12px]">
            admin
          </code>
          , then sign out and back in.
        </p>
        <a href="/a/dashboard" className="text-sm font-semibold underline">
          Back to dashboard
        </a>
      </div>
    );
  }

  const myRole = normalizeRole(me.role);
  const iAmAdmin = canBan(myRole);
  const visibleNav = STAFF_NAV.filter((item) => !item.adminOnly || iAmAdmin);

  async function run(
    label: string,
    fn: () => Promise<unknown>,
    successText: string,
  ): Promise<void> {
    if (note.trim().length < 8) {
      setMessage({
        tone: "error",
        text: "Write a comment first (at least 8 characters) explaining why you’re doing this.",
      });
      return;
    }
    setBusy(label);
    setMessage(null);
    try {
      await fn();
      setMessage({ tone: "ok", text: successText });
    } catch (e) {
      setMessage({
        tone: "error",
        text: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(null);
    }
  }

  const commentReady = note.trim().length >= 8;

  const isSelf = selected != null && selected.userId === me.userId;
  const status = selected ? statusInfo(selected.accountStatus) : null;
  const storeArchived = Boolean(selected?.connection?.deletedAt);
  const needsRestore = Boolean(selected?.hasSoftDeletedData);
  const targetRole = selected ? normalizeRole(selected.role) : null;
  const canHelpSelected =
    selected != null && canActOn(myRole, normalizeRole(selected.role));
  const privilegedTargetBlocked = selected != null && !canHelpSelected;

  return (
    <div className="dg-shell light ln-surface relative flex h-dvh overflow-hidden bg-[#f7f8f8] text-[#08090a]">
      {/* Desktop sidebar — same flow as merchant dashboard */}
      <aside className="relative z-20 flex w-[248px] shrink-0 flex-col bg-[#f7f8f8] max-lg:hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-[#f7f8f8]"
          aria-hidden
        />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2.5 px-5 py-5">
            <BrandLogo size="sm" href="/a/admin" />
            <span className="rounded-md border border-black/8 bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8a8f98]">
              {roleLabel(myRole)}
            </span>
          </div>

          <nav className="flex flex-1 flex-col gap-0.5 px-3">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const active = nav === item.id;
              const waitingBadge =
                item.id === "support" &&
                typeof unclaimedCount === "number" &&
                unclaimedCount > 0
                  ? unclaimedCount
                  : null;
              const adminBadge =
                item.id === "support" &&
                iAmAdmin &&
                typeof escalatedCount === "number" &&
                escalatedCount > 0
                  ? escalatedCount
                  : null;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goToNav(item.id)}
                  className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                    active
                      ? "bg-black/[0.06] font-semibold text-[#08090a]"
                      : "font-medium text-[#8a8f98] hover:bg-black/[0.04] hover:text-[#08090a]"
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {waitingBadge != null ? (
                    <span className="rounded-full bg-[#111] px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {waitingBadge}
                    </span>
                  ) : null}
                  {adminBadge != null ? (
                    <span
                      className="rounded-full bg-violet-700 px-1.5 py-0.5 text-[10px] font-bold text-white"
                      title="Needs Admin"
                    >
                      {adminBadge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto space-y-2 px-3 py-4">
            <a
              href="/a/dashboard"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[#8a8f98] transition hover:bg-black/[0.04] hover:text-[#08090a]"
            >
              <LayoutDashboard className="size-4 shrink-0" />
              Merchant dashboard
            </a>
            <div className="flex items-center gap-2.5 px-3 py-1">
              <UserButton
                appearance={{
                  elements: { avatarBox: "size-9 rounded-full" },
                }}
              />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-sm font-semibold text-black">
                  {me.userName}
                </p>
                <p className="truncate text-xs text-black/45">
                  {roleLabel(myRole)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar + pills */}
        <header className="shrink-0 border-b border-black/6 bg-[#f7f8f8] lg:hidden">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <div className="flex items-center gap-2">
              <BrandLogo size="sm" href="/a/admin" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a8f98]">
                {roleLabel(myRole)}
              </span>
            </div>
            <UserButton />
          </div>
          <div className="flex gap-1 overflow-x-auto px-3 pb-3">
            {visibleNav.map((item) => {
              const active = nav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goToNav(item.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                    active
                      ? "bg-[#111] text-white"
                      : "bg-black/[0.04] text-black/55"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <PageEnter ref={pageEnterRef} pageKey={nav}>
            {nav === "support" ? (
              <div className="mx-auto flex h-full w-full max-w-6xl min-h-0 flex-1 flex-col px-5 py-5 md:px-8">
                <div className="mb-4 shrink-0" data-enter>
                  <h1 className="font-display text-2xl tracking-tight">
                    Support
                  </h1>
                  <p className="mt-1 text-sm text-black/55">
                    Claim a chat, help the merchant, mark done — or ask an
                    Admin when you’re stuck.
                  </p>
                </div>
                <div className="min-h-0 flex-1" data-enter>
                  <StaffInbox
                    isAdmin={iAmAdmin}
                    viewerUserId={me._id}
                    fillHeight
                    onOpenMerchant={(userId) => {
                      setSelectedId(userId);
                      setMessage(null);
                      setConfirmBan(false);
                      setShowDanger(false);
                      goToNav("merchants");
                    }}
                  />
                </div>
              </div>
            ) : null}

            {nav === "live" && iAmAdmin ? (
              <div
                className="mx-auto flex h-full w-full max-w-6xl min-h-0 flex-1 flex-col px-5 py-5 md:px-8"
                data-enter
              >
                <div className="mb-4 shrink-0">
                  <h1 className="font-display text-2xl tracking-tight">
                    Live staff log
                  </h1>
                  <p className="mt-1 text-sm text-black/55">
                    Watch privileged actions in real time. Revoke freeze or ban
                    if something looks wrong.
                  </p>
                </div>
                <div className="min-h-0 flex-1">
                  <LiveStaffLog fillHeight />
                </div>
              </div>
            ) : null}

            {nav === "docs" ? (
              <div
                className="mx-auto flex h-full w-full max-w-6xl min-h-0 flex-1 flex-col overflow-y-auto px-5 py-5 md:px-8"
                data-enter
              >
                <h1 className="font-display text-2xl tracking-tight">
                  Staff guides
                </h1>
                <p className="mt-1 text-sm text-black/55">
                  How recovery tools and support chat work — open in a new tab
                  when you need the full write-up.
                </p>
                <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <a
                    href={`${ADMIN_DOCS}#overview`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl border border-black/8 bg-white px-5 py-4 transition hover:border-black/15 hover:bg-black/[0.02]"
                  >
                    <p className="text-sm font-semibold">Recovery console</p>
                    <p className="mt-1 text-[13px] text-black/50">
                      Freeze, kick sessions, restore, reclaim store, unlock, ban
                    </p>
                  </a>
                  <a
                    href="/a/admin/docs/support"
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl border border-black/8 bg-white px-5 py-4 transition hover:border-black/15 hover:bg-black/[0.02]"
                  >
                    <p className="text-sm font-semibold">Support chat</p>
                    <p className="mt-1 text-[13px] text-black/50">
                      Claim, reply, mark done, escalate to Admin, close as spam
                    </p>
                  </a>
                  <a
                    href={`${ADMIN_DOCS}#roles`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl border border-black/8 bg-white px-5 py-4 transition hover:border-black/15 hover:bg-black/[0.02]"
                  >
                    <p className="text-sm font-semibold">Roles</p>
                    <p className="mt-1 text-[13px] text-black/50">
                      What Staff vs Admin can do
                    </p>
                  </a>
                </div>
              </div>
            ) : null}

            {nav === "merchants" ? (
              <div className="mx-auto flex h-full w-full max-w-6xl min-h-0 flex-1 flex-col overflow-y-auto px-5 py-5 md:px-8">
                <div className="mb-6 shrink-0" data-enter>
                  <h1 className="font-display text-2xl tracking-tight md:text-[1.75rem]">
                    Merchants
                  </h1>
                  <p className="mt-1.5 text-sm leading-relaxed text-black/55">
                    Find the account, stop the damage, put their data back, then
                    unlock them.
                  </p>
                </div>

                <div
                  className="grid min-h-0 flex-1 gap-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]"
                  data-enter
                >
        {/* LEFT: find account */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-black/8 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Search className="size-4 text-black/50" />
                1. Find the merchant
              </div>
              <DocLink hash="overview" label="Guide" />
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-black/50">
              Search by their name, email-ish Clerk id, or Lemon Squeezy store
              name / id.
            </p>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. store name or user…"
              className="mt-3 w-full rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white"
            />
          </div>

          <ul className="overflow-hidden rounded-2xl border border-black/8 bg-white">
            {!searchQ ? (
              <li className="px-4 py-8 text-center text-sm text-black/40">
                Type at least 2 characters to search
              </li>
            ) : results === undefined ? (
              <li className="px-4 py-8 text-center text-sm text-black/40">
                Searching…
              </li>
            ) : results.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-black/40">
                No merchants matched
              </li>
            ) : (
              results.map((row) => {
                const s = statusInfo(row.accountStatus);
                const active = selectedId === row._id;
                return (
                  <li key={row._id} className="border-b border-black/6 last:border-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(row._id);
                        setReclaimStoreId(row.connection?.storeId ?? "");
                        setMessage(null);
                        setConfirmBan(false);
                        setShowDanger(false);
                      }}
                      className={`flex w-full flex-col gap-1.5 px-4 py-3.5 text-left transition ${
                        active ? "bg-black/[0.04]" : "hover:bg-black/[0.02]"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold">
                          {row.userName}
                          {row.userId === me.userId ? " (you)" : ""}
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${roleBadgeClasses(normalizeRole(row.role))}`}
                          >
                            {roleLabel(normalizeRole(row.role))}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${toneClasses(s.tone)}`}
                          >
                            {s.label}
                          </span>
                        </span>
                      </span>
                      <span className="truncate text-[12px] text-black/45">
                        {row.connection
                          ? row.connection.storeName
                          : "No Lemon Squeezy store linked"}
                        {row.hasSoftDeletedData ? " · has backup" : ""}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        {/* RIGHT: work on account */}
        <div className="min-w-0 space-y-4">
          {!selectedId ? (
            <div className="rounded-2xl border border-dashed border-black/15 bg-black/[0.015] px-6 py-14 text-center">
              <ShieldAlert className="mx-auto size-8 text-black/25" />
              <h2 className="font-display mt-4 text-xl tracking-tight">
                Pick a merchant on the left
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-black/50">
                You’ll get a clear checklist: freeze if needed, restore wiped
                data, reclaim a stolen store, then unlock them again.
              </p>
            </div>
          ) : selected === undefined ? (
            <div className="rounded-2xl border border-black/8 bg-white px-5 py-12 text-center text-sm text-black/40">
              Loading merchant…
            </div>
          ) : selected === null ? (
            <div className="rounded-2xl border border-black/8 bg-white px-5 py-12 text-center text-sm text-black/40">
              Merchant not found
            </div>
          ) : (
            <>
              {/* Snapshot */}
              <section className="rounded-2xl border border-black/8 bg-white p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/40">
                      Working on
                    </p>
                    <h2 className="font-display mt-1 text-2xl tracking-tight">
                      {selected.userName}
                      {isSelf ? (
                        <span className="ml-2 text-base font-medium text-amber-800">
                          — this is you
                        </span>
                      ) : null}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${roleBadgeClasses(targetRole ?? "user")}`}
                      >
                        Role: {roleLabel(targetRole ?? "user")}
                      </span>
                      {status ? (
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${toneClasses(status.tone)}`}
                        >
                          {status.label}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {status ? (
                  <p className="mt-3 text-sm leading-relaxed text-black/60">
                    {status.meaning}
                  </p>
                ) : null}

                {merchantGrant ? (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3">
                    <div>
                      <p className="text-[13px] font-semibold text-emerald-950">
                        Merchant granted temporary access
                      </p>
                      <p className="mt-0.5 text-[12px] text-emerald-900/70">
                        To {merchantGrant.granteeName} until{" "}
                        {new Date(merchantGrant.expiresAt).toLocaleString(
                          undefined,
                          { dateStyle: "short", timeStyle: "short" },
                        )}
                        . Use the snapshot below to investigate — this is not a
                        sign-in as them.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy != null}
                      className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-emerald-950 disabled:opacity-45"
                      onClick={() => {
                        void (async () => {
                          setBusy("Revoke access");
                          setMessage(null);
                          try {
                            await revokeMerchantGrant({
                              grantId: merchantGrant._id,
                            });
                            setMessage({
                              tone: "ok",
                              text: "Temporary access revoked.",
                            });
                          } catch (e) {
                            setMessage({
                              tone: "error",
                              text:
                                e instanceof Error ? e.message : String(e),
                            });
                          } finally {
                            setBusy(null);
                          }
                        })();
                      }}
                    >
                      {busy === "Revoke access" ? "Revoking…" : "Revoke"}
                    </button>
                  </div>
                ) : null}

                {selected.frozenReason ? (
                  <p className="mt-2 text-sm text-amber-900">
                    Note on file: {selected.frozenReason}
                  </p>
                ) : null}

                {privilegedTargetBlocked ? (
                  <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-3 text-sm text-sky-950">
                    <strong>View only for Staff.</strong> This account is{" "}
                    {roleLabel(targetRole ?? "user")}. You can look them up, but
                    only an Admin can freeze, kick, restore, reclaim, or ban
                    Staff/Admin accounts.
                  </div>
                ) : null}

                {isSelf ? (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-950">
                    <strong>Don’t ban yourself.</strong> Ban locks you out of
                    sign-in. Prefer <em>Freeze</em> while testing.
                  </div>
                ) : null}

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-black/[0.03] px-3.5 py-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-black/40">
                      <Store className="size-3.5" />
                      Store
                    </div>
                    <p className="mt-1 text-sm font-medium">
                      {selected.connection
                        ? selected.connection.storeName
                        : "None linked"}
                    </p>
                    <p className="mt-0.5 text-[12px] text-black/45">
                      {storeArchived
                        ? "Disconnected (backup kept)"
                        : selected.connection
                          ? `ID ${selected.connection.storeId}`
                          : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-black/[0.03] px-3.5 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-black/40">
                      Open failures
                    </div>
                    <p className="mt-1 text-sm font-medium">
                      {selected.openFailureCount}
                    </p>
                    <p className="mt-0.5 text-[12px] text-black/45">
                      {selected.activityCount} activity events visible
                    </p>
                  </div>
                  <div className="rounded-xl bg-black/[0.03] px-3.5 py-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-black/40">
                      <ArchiveRestore className="size-3.5" />
                      Backup
                    </div>
                    <p className="mt-1 text-sm font-medium">
                      {needsRestore ? "Available to restore" : "Nothing archived"}
                    </p>
                    <p className="mt-0.5 text-[12px] text-black/45">
                      Kept ~90 days after disconnect
                    </p>
                  </div>
                </div>
              </section>

              {message ? (
                <div
                  className={`rounded-xl border px-4 py-3 text-sm ${
                    message.tone === "ok"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-rose-200 bg-rose-50 text-rose-900"
                  }`}
                >
                  {message.text}
                </div>
              ) : null}

              <StepCard
                step={2}
                title="Stop the bleeding"
                body="Freeze pauses the account without locking them out of login. Kick open sessions if a hacker is still signed in."
                docHash="freeze"
              >
                <div className="mb-3">
                  <DocLink hash="kick-sessions" label="About Kick sessions" />
                </div>
                <label className="block text-[12px] font-medium text-black/50">
                  Required comment{" "}
                  <span className="font-normal text-black/35">
                    (Staff and Admins — shown in the live log)
                  </span>
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Why are you taking this action? e.g. Suspected takeover · merchant emailed support Mar 12"
                  className="mt-1.5 w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
                />
                <p
                  className={`mt-1 text-[11px] ${
                    commentReady ? "text-black/35" : "text-amber-800"
                  }`}
                >
                  {commentReady
                    ? "Comment ready — applies to every action below until you change it."
                    : "At least 8 characters required before any action."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selected.accountStatus === "active" ? (
                    <ActionButton
                      variant="primary"
                      disabled={
                        busy != null ||
                        privilegedTargetBlocked ||
                        !commentReady
                      }
                      onClick={() =>
                        void run(
                          "Freeze",
                          () =>
                            setAccountStatus({
                              userId: selected._id,
                              status: "frozen",
                              reason: note.trim(),
                            }),
                          "Account frozen. Merchant can’t change settings or send recovery emails.",
                        )
                      }
                    >
                      <Lock className="size-4" />
                      {busy === "Freeze" ? "Freezing…" : "Freeze account"}
                    </ActionButton>
                  ) : selected.accountStatus === "frozen" ? (
                    <ActionButton
                      variant="success"
                      disabled={
                        busy != null ||
                        privilegedTargetBlocked ||
                        !commentReady
                      }
                      onClick={() =>
                        void run(
                          "Unfreeze",
                          () =>
                            setAccountStatus({
                              userId: selected._id,
                              status: "active",
                              reason: note.trim(),
                            }),
                          "Account unfrozen. They’re back to normal.",
                        )
                      }
                    >
                      <Unlock className="size-4" />
                      {busy === "Unfreeze" ? "Unfreezing…" : "Unfreeze account"}
                    </ActionButton>
                  ) : iAmAdmin ? (
                    <ActionButton
                      variant="success"
                      disabled={busy != null || !commentReady}
                      onClick={() =>
                        void run(
                          "Unban",
                          () =>
                            unbanUser({
                              userId: selected._id,
                              reason: note.trim(),
                            }),
                          "Ban lifted. They can sign in again.",
                        )
                      }
                    >
                      <Unlock className="size-4" />
                      {busy === "Unban" ? "Unbanning…" : "Lift ban"}
                    </ActionButton>
                  ) : (
                    <p className="w-full text-sm text-black/50">
                      This account is banned. Only an Admin can lift the ban.
                    </p>
                  )}

                  <ActionButton
                    disabled={
                      busy != null || privilegedTargetBlocked || !commentReady
                    }
                    onClick={() =>
                      void run(
                        "Revoke sessions",
                        () =>
                          revokeSessions({
                            userId: selected._id,
                            reason: note.trim(),
                          }),
                        "All active sign-ins were kicked out. They’ll need to log in again.",
                      )
                    }
                  >
                    <KeyRound className="size-4" />
                    {busy === "Revoke sessions"
                      ? "Kicking sessions…"
                      : "Kick all sign-ins"}
                  </ActionButton>
                </div>
              </StepCard>

              <StepCard
                step={3}
                title="Put their data back"
                body="If a hacker hit Disconnect, restore brings back the store link and recovery history from the 90-day backup."
                docHash="restore"
              >
                <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1">
                  <DocLink hash="reclaim" label="About Give store back" />
                  <DocLink hash="soft-delete" label="About 90-day backup" />
                </div>
                {needsRestore ? (
                  <>
                    <p className="mb-3 text-sm text-black/55">
                      We found archived data for this merchant.
                    </p>
                    <ActionButton
                      variant="success"
                      disabled={
                        busy != null ||
                        privilegedTargetBlocked ||
                        !commentReady
                      }
                      onClick={() =>
                        void run(
                          "Restore",
                          () =>
                            restoreAccount({
                              userId: selected._id,
                              reason: note.trim(),
                            }),
                          "Backup restored — store routing and history should be back.",
                        )
                      }
                    >
                      <ArchiveRestore className="size-4" />
                      {busy === "Restore" ? "Restoring…" : "Restore from backup"}
                    </ActionButton>
                  </>
                ) : (
                  <p className="flex items-start gap-2 text-sm text-black/50">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    Nothing to restore right now. Skip this step.
                  </p>
                )}

                <div className="mt-5 border-t border-black/8 pt-4">
                  <p className="text-sm font-semibold">
                    Stolen Lemon Squeezy API key?
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-black/50">
                    Point this store’s webhooks back to this merchant. Then tell
                    them to rotate the LS API key and change their password.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={reclaimStoreId}
                      onChange={(e) => setReclaimStoreId(e.target.value)}
                      placeholder="Lemon Squeezy store ID"
                      className="min-w-0 flex-1 rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
                    />
                    <ActionButton
                      variant="primary"
                      disabled={
                        busy != null ||
                        !reclaimStoreId.trim() ||
                        privilegedTargetBlocked ||
                        !commentReady
                      }
                      onClick={() =>
                        void run(
                          "Reclaim",
                          () =>
                            reclaimStore({
                              storeId: reclaimStoreId.trim(),
                              toUserId: selected._id,
                              reason: note.trim(),
                            }),
                          "Store reclaimed for this merchant. Ask them to rotate the LS API key.",
                        )
                      }
                    >
                      Give store back to them
                    </ActionButton>
                  </div>
                </div>
              </StepCard>

              <StepCard
                step={4}
                title="Finish & unlock"
                body="When the incident is handled, unfreeze (or lift the ban) so the merchant can work again."
                docHash="unlock"
              >
                <ul className="mb-3 space-y-1.5 text-sm text-black/55">
                  <li>• Ask them to change their DeclineGuard password</li>
                  <li>• Ask them to rotate their Lemon Squeezy API key</li>
                  <li>• Unfreeze / lift ban when you’re done</li>
                </ul>
                {selected.accountStatus !== "active" ? (
                  selected.accountStatus === "disabled" && !iAmAdmin ? (
                    <p className="text-sm text-black/50">
                      Banned accounts can only be unlocked by an Admin.
                    </p>
                  ) : (
                    <ActionButton
                      variant="success"
                      disabled={
                        busy != null ||
                        !commentReady ||
                        (selected.accountStatus === "frozen" &&
                          privilegedTargetBlocked)
                      }
                      onClick={() => {
                        if (selected.accountStatus === "disabled") {
                          void run(
                            "Unban",
                            () =>
                              unbanUser({
                                userId: selected._id,
                                reason: note.trim(),
                              }),
                            "Ban lifted. They’re unlocked.",
                          );
                        } else {
                          void run(
                            "Unfreeze",
                            () =>
                              setAccountStatus({
                                userId: selected._id,
                                status: "active",
                                reason: note.trim(),
                              }),
                            "Account unlocked.",
                          );
                        }
                      }}
                    >
                      <Unlock className="size-4" />
                      Unlock this merchant
                    </ActionButton>
                  )
                ) : (
                  <p className="flex items-start gap-2 text-sm text-black/50">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    Already unlocked — nothing to do here.
                  </p>
                )}
              </StepCard>

              {/* Danger zone — Admin only */}
              {iAmAdmin ? (
              <section className="rounded-2xl border border-rose-200/80 bg-rose-50/40">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                  onClick={() => {
                    setShowDanger((v) => !v);
                    setConfirmBan(false);
                  }}
                >
                  <span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="flex items-center gap-2 text-sm font-semibold text-rose-900">
                        <Ban className="size-4" />
                        Danger zone
                      </span>
                      <DocLink hash="ban" label="About Ban" />
                    </span>
                    <span className="mt-0.5 block text-[13px] text-rose-900/70">
                      Ban completely blocks sign-in. Prefer freeze for most cases.
                    </span>
                  </span>
                  <ChevronDown
                    className={`size-4 shrink-0 text-rose-800 transition ${showDanger ? "rotate-180" : ""}`}
                  />
                </button>
                {showDanger ? (
                  <div className="space-y-3 border-t border-rose-200/80 px-5 py-4">
                    {selected.accountStatus === "disabled" ? (
                      <>
                        <p className="text-sm text-rose-900/80">
                          This merchant is already banned. Use{" "}
                          <strong>Unlock this merchant</strong> above if you want
                          to let them sign in again.
                        </p>
                        <ActionButton variant="danger" disabled>
                          Already banned
                        </ActionButton>
                      </>
                    ) : (
                      <>
                        {isSelf ? (
                          <p className="text-sm text-rose-900">
                            You’re viewing your own account. Don’t ban yourself —
                            you’ll get locked out of this panel.
                          </p>
                        ) : null}
                        {!confirmBan ? (
                          <ActionButton
                            variant="danger"
                            disabled={busy != null || isSelf || !commentReady}
                            onClick={() => setConfirmBan(true)}
                          >
                            Ban this merchant…
                          </ActionButton>
                        ) : (
                          <div className="rounded-xl border border-rose-300 bg-white p-3">
                            <p className="text-sm text-rose-950">
                              Really ban <strong>{selected.userName}</strong>? They
                              won’t be able to sign in until you lift the ban.
                              Uses your required comment above.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <ActionButton
                                variant="danger"
                                disabled={busy != null || !commentReady}
                                onClick={() => {
                                  void (async () => {
                                    await run(
                                      "Ban",
                                      () =>
                                        banUser({
                                          userId: selected._id,
                                          reason: note.trim(),
                                        }),
                                      "Merchant banned and sessions revoked.",
                                    );
                                    setConfirmBan(false);
                                  })();
                                }}
                              >
                                {busy === "Ban" ? "Banning…" : "Yes, ban them"}
                              </ActionButton>
                              <ActionButton onClick={() => setConfirmBan(false)}>
                                Cancel
                              </ActionButton>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : null}
              </section>
              ) : (
                <section className="rounded-2xl border border-black/8 bg-black/[0.02] px-5 py-4">
                  <p className="text-sm font-semibold text-black/70">
                    Ban is Admin-only
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-black/50">
                    For safety, Staff cannot ban accounts. Freeze a merchant if
                    you need to pause them, and escalate to an Admin for bans.
                  </p>
                  <div className="mt-2">
                    <DocLink hash="ban" label="About Ban" />
                  </div>
                </section>
              )}

              {/* History */}
              <section className="rounded-2xl border border-black/8 bg-white">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                  onClick={() => setShowHistory((v) => !v)}
                >
                  <span>
                    <span className="text-sm font-semibold">Staff history</span>
                    <span className="mt-0.5 block text-[13px] text-black/50">
                      What you (and other staff) already did on this account
                    </span>
                  </span>
                  <ChevronDown
                    className={`size-4 shrink-0 text-black/40 transition ${showHistory ? "rotate-180" : ""}`}
                  />
                </button>
                {showHistory ? (
                  <ul className="max-h-72 space-y-0 overflow-auto border-t border-black/8">
                    {audit === undefined ? (
                      <li className="px-5 py-4 text-sm text-black/40">
                        Loading…
                      </li>
                    ) : audit.length === 0 ? (
                      <li className="px-5 py-4 text-sm text-black/40">
                        No staff actions yet
                      </li>
                    ) : (
                      audit.map(
                        (row: {
                          _id: Id<"auditLogs">;
                          action: string;
                          reason: string | null;
                          createdAt: number;
                          revokedAt: number | null;
                        }) => (
                        <li
                          key={row._id}
                          className="border-b border-black/5 px-5 py-3 last:border-0"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-sm font-medium">
                              {humanAction(row.action)}
                              {row.revokedAt ? (
                                <span className="ml-2 text-[11px] font-normal text-black/40">
                                  (revoked)
                                </span>
                              ) : null}
                            </span>
                            <span className="text-[12px] text-black/40">
                              {new Date(row.createdAt).toLocaleString()}
                            </span>
                          </div>
                          {row.reason ? (
                            <p className="mt-1 text-[13px] text-black/50">
                              {row.reason}
                            </p>
                          ) : null}
                        </li>
                      ),
                      )
                    )}
                  </ul>
                ) : null}
              </section>
            </>
          )}
        </div>
                </div>
              </div>
            ) : null}
          </PageEnter>
        </main>
      </div>
    </div>
  );
}

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
  };
  return map[action] ?? action.replace(/_/g, " ");
}

export default withConvexClerkProvider(AdminConsoleInner);
