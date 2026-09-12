import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { SignedIn, SignedOut, useAuth } from "@clerk/astro/react";
import {
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import gsap from "gsap";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  ArrowUp,
  Check,
  Loader2,
  RotateCcw,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import BrandLogo from "@/components/BrandLogo";
import { useClerkClient } from "@/components/auth/useClerkClient";
import { PrimaryCta } from "@/components/homepage/CtaButton";
import SegmentedControl from "@/components/dashboard/SegmentedControl";
import { withConvexClerkProvider } from "@/lib/withConvexClerkProvider";
import {
  readCachedTop,
  writeCachedTop,
  type CachedFeatureRequest,
  type FeatureTab,
} from "./featureRequestsCache";
import { getOrCreateAnonVoterKey } from "./featureVoter";
import { useDebouncedVotes } from "./useDebouncedVotes";

type Tab = FeatureTab;

function FeatureLogOutButton() {
  const { clerk, isLoaded } = useClerkClient();

  return (
    <button
      type="button"
      disabled={!isLoaded || !clerk}
      onClick={() => {
        void clerk?.signOut({ redirectUrl: "/" });
      }}
      className="rounded-md px-3 py-1.5 text-sm font-medium text-[#8a8a8e] transition hover:text-[#08090a] disabled:opacity-40"
    >
      Log out
    </button>
  );
}

function FeatureRequestsPageInner() {
  const { isSignedIn } = useAuth();
  const currentUser = useQuery(
    api.functions.user.getCurrentUser,
    isSignedIn ? {} : "skip",
  );
  const ensureUser = useMutation(api.functions.user.ensureCurrentUser);
  const createRequest = useMutation(api.functions.featureRequests.create);
  const toggleVote = useMutation(api.functions.featureRequests.toggleVote);
  const setStatus = useMutation(api.functions.featureRequests.setStatus);
  const removeRequest = useMutation(api.functions.featureRequests.remove);

  const [tab, setTab] = useState<Tab>("open");
  // Sync init — avoids skipping the query for a full paint while waiting on useEffect.
  const [anonKey] = useState(() =>
    typeof window === "undefined" ? null : getOrCreateAnonVoterKey(),
  );
  const [cachedByTab, setCachedByTab] = useState<
    Partial<Record<Tab, CachedFeatureRequest[]>>
  >(() => {
    if (typeof window === "undefined") return {};
    return {
      open: readCachedTop("open") ?? undefined,
      added: readCachedTop("added") ?? undefined,
    };
  });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [adminBusy, setAdminBusy] = useState<Id<"featureRequests"> | null>(
    null,
  );
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: Id<"featureRequests">;
    title: string;
  } | null>(null);
  const [pulseId, setPulseId] = useState<Id<"featureRequests"> | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [navSolid, setNavSolid] = useState(false);
  const [hoveredVoteId, setHoveredVoteId] = useState<
    Id<"featureRequests"> | null
  >(null);
  /** After a vote, once the pointer leaves, re-hover no longer uses black fill. */
  const [leftSinceVoted, setLeftSinceVoted] = useState(
    () => new Set<Id<"featureRequests">>(),
  );

  const listRef = useRef<HTMLUListElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const listEnterTabRef = useRef<Tab | null>(null);

  useEffect(() => {
    if (isSignedIn) {
      void ensureUser({});
    }
  }, [isSignedIn, ensureUser]);

  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const voterKeyForMutations =
    currentUser != null ? `u:${currentUser._id}` : anonKey;

  const { results, status, loadMore } = usePaginatedQuery(
    api.functions.featureRequests.listByStatus,
    anonKey
      ? {
          status: tab,
          voterKey: currentUser ? undefined : anonKey,
        }
      : "skip",
    { initialNumItems: 20 },
  );

  const queryReady = anonKey != null && status !== "LoadingFirstPage";
  const cachedResults = cachedByTab[tab] ?? [];
  /** Show cached top ideas while Convex reconnects — then swap to live. */
  const sourceResults = queryReady ? results : cachedResults;
  const showingCache = !queryReady && cachedResults.length > 0;

  useEffect(() => {
    if (!queryReady) return;
    writeCachedTop(tab, results);
    setCachedByTab((prev) => ({
      ...prev,
      [tab]: results.slice(0, 10),
    }));
  }, [queryReady, tab, results]);

  const isAdmin = currentUser?.role === "admin";
  const isStaff =
    currentUser?.role === "staff" || currentUser?.role === "admin";

  const serverVotedById = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const item of sourceResults) {
      map.set(item._id, item.viewerHasVoted);
    }
    return map;
  }, [sourceResults]);

  const { scheduleToggle, resolveDisplay } = useDebouncedVotes({
    voterKey: voterKeyForMutations,
    serverVotedById,
    toggleVote: (voteArgs) => toggleVote(voteArgs),
    onSyncError: (message) => setActionError(message),
  });

  /** Rank by optimistic counts so upvote order updates before the 1‑min sync. */
  const rankedResults = useMemo(() => {
    return [...sourceResults].sort((a, b) => {
      const aCount = resolveDisplay(a._id, a.viewerHasVoted, a.voteCount)
        .voteCount;
      const bCount = resolveDisplay(b._id, b.viewerHasVoted, b.voteCount)
        .voteCount;
      if (bCount !== aCount) return bCount - aCount;
      return b.createdAt - a.createdAt;
    });
  }, [sourceResults, resolveDisplay]);

  useLayoutEffect(() => {
    const el = leftRef.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    if (reduced) return;
    gsap.fromTo(
      el.querySelectorAll("[data-fr-enter]"),
      { opacity: 0, y: 12 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        stagger: 0.07,
        ease: "power3.out",
      },
    );
  }, []);

  const reduceMotion = useReducedMotion();

  // Enter animation once per tab load — not on vote reordering or load-more.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || sourceResults.length === 0) return;
    if (listEnterTabRef.current === tab) return;
    listEnterTabRef.current = tab;
    if (reduceMotion) return;
    const items = list.querySelectorAll("[data-fr-item]");
    gsap.fromTo(
      items,
      { opacity: 0, y: 8 },
      {
        opacity: 1,
        y: 0,
        duration: 0.32,
        stagger: 0.035,
        ease: "power2.out",
        overwrite: "auto",
      },
    );
  }, [tab, reduceMotion, sourceResults.length > 0]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await createRequest({ title, body });
      setTitle("");
      setBody("");
      setTab("open");
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Could not send request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function onToggleVote(
    requestId: Id<"featureRequests">,
    itemStatus: "open" | "added",
    currentlyDisplayedVoted: boolean,
  ) {
    if (!voterKeyForMutations || itemStatus === "added") return;
    setActionError(null);
    setPulseId(requestId);
    window.setTimeout(() => setPulseId(null), 280);
    scheduleToggle(requestId, currentlyDisplayedVoted);
    // Reset leave tracking so a fresh vote stays black until pointer leaves.
    setLeftSinceVoted((prev) => {
      const next = new Set(prev);
      next.delete(requestId);
      return next;
    });
  }

  async function onSetStatus(
    requestId: Id<"featureRequests">,
    next: "open" | "added",
  ) {
    if (!isAdmin || adminBusy) return;
    setActionError(null);
    setAdminBusy(requestId);
    try {
      await setStatus({ requestId, status: next });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not update status.",
      );
    } finally {
      setAdminBusy(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteBusy) return;
    setActionError(null);
    setDeleteBusy(true);
    try {
      await removeRequest({ requestId: deleteTarget.id });
      setDeleteTarget(null);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not delete request.",
      );
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="ln-surface min-h-dvh bg-[#f7f8f8] text-[#08090a]">
      <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 md:px-6 md:pt-5">
        <div
          className={`flex w-full max-w-5xl items-center justify-between gap-3 px-2.5 py-2 transition-[background-color,border-color,backdrop-filter] duration-200 sm:gap-4 sm:px-3 ${
            navSolid
              ? "rounded-none border-b border-black/[0.08] bg-[#f7f8f8]/90 backdrop-blur-xl"
              : "border border-transparent bg-transparent"
          }`}
        >
          <BrandLogo size="sm" className="pl-1.5 sm:pl-2" />

          <nav className="hidden items-center gap-0.5 text-sm font-medium md:flex">
            <a href="/" className="rounded-md px-3 py-1.5 text-[#8a8a8e] hover:text-[#08090a]">
              Home
            </a>
            <a
              href="/#how"
              className="rounded-md px-3 py-1.5 text-[#8a8a8e] hover:text-[#08090a]"
            >
              How it works
            </a>
            <a
              href="/pricing"
              className="rounded-md px-3 py-1.5 text-[#8a8a8e] hover:text-[#08090a]"
            >
              Pricing
            </a>
            <a
              href="/features"
              className="rounded-md px-3 py-1.5 text-[#8a8a8e] hover:text-[#08090a]"
            >
              Requests
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <SignedOut>
              <a
                href="/a/sign-in?redirect=/features"
                className="hidden rounded-md px-3 py-1.5 text-sm font-medium text-[#8a8a8e] hover:text-[#08090a] sm:inline"
              >
                Sign in
              </a>
              <PrimaryCta href="/a/sign-up" size="sm">
                Claim spot
              </PrimaryCta>
            </SignedOut>
            <SignedIn>
              <FeatureLogOutButton />
              <PrimaryCta href="/a/dashboard" size="sm">
                Dashboard
              </PrimaryCta>
            </SignedIn>
          </div>
        </div>
      </header>

      <div className="mx-auto grid min-h-dvh max-w-6xl pt-24 lg:grid-cols-2">
        {/* Left — form (top-aligned) */}
        <section
          ref={leftRef}
          className="flex flex-col justify-start px-5 pb-12 pt-2 sm:px-10 lg:pb-16"
        >
          <div className="w-full max-w-md">
            <h1
              data-fr-enter
              className="ln-h1 text-[clamp(2rem,4vw,2.75rem)] font-medium leading-[1.05] tracking-[-0.035em]"
            >
              Feature requests
            </h1>
            <p
              data-fr-enter
              className="mt-3 text-[15px] leading-relaxed text-[#8a8a8e]"
            >
              Suggest what DeclineGuard should build next. Everyone can vote —
              click once to support, again to take it back.
            </p>

            <SignedIn>
              <form
                data-fr-enter
                onSubmit={onSubmit}
                className="mt-8 space-y-4"
              >
                <label className="block">
                  <span className="text-[12px] font-medium text-[#8a8a8e]">
                    Title
                  </span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={80}
                    placeholder="e.g. Slack alerts when a recovery succeeds"
                    className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-[#08090a] outline-none transition focus:border-black focus:shadow-[0_3px_0_#10b981]"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-[12px] font-medium text-[#8a8a8e]">
                    Why it matters
                  </span>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    maxLength={1000}
                    rows={4}
                    placeholder="A short note on the problem and how you’d use it…"
                    className="mt-1.5 w-full resize-none rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-[#08090a] outline-none transition focus:border-black focus:shadow-[0_3px_0_#10b981]"
                    required
                  />
                </label>
                {formError ? (
                  <p
                    className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/70"
                    role="alert"
                  >
                    {formError}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={submitting}
                  className="dg-btn dg-btn-primary dg-btn-wide disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Send request
                </button>
              </form>
            </SignedIn>

            <SignedOut>
              <div data-fr-enter className="mt-8 space-y-4">
                <p className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#8a8a8e]">
                  Sign in to suggest a feature. You can still vote on the right
                  without an account.
                </p>
                <a
                  href="/a/sign-in?redirect=/features"
                  className="dg-btn dg-btn-primary dg-btn-wide"
                >
                  Sign in to suggest
                </a>
              </div>
            </SignedOut>

            <p
              data-fr-enter
              className="mt-10 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-black/40"
            >
              <a href="/legal/privacy" className="hover:text-[#08090a]">
                Privacy
              </a>
              <a href="/legal/terms" className="hover:text-[#08090a]">
                Terms
              </a>
            </p>
          </div>
        </section>

        {/* Right — list + slider */}
        <section className="flex flex-col bg-white px-5 pb-12 pt-2 sm:px-8 lg:pb-16">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-xl tracking-tight">
                {tab === "open"
                  ? "Request Features"
                  : "Request Features Added"}
              </h2>
              <p className="mt-0.5 text-[13px] text-[#8a8a8e]">
                Vote to push what matters up the list.
              </p>
            </div>
            <SegmentedControl
              ariaLabel="Feature request tabs"
              value={tab}
              onChange={setTab}
              options={[
                { id: "open", label: "Open" },
                { id: "added", label: "Added" },
              ]}
            />
          </div>

          {actionError ? (
            <p
              className="mt-4 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-black/70"
              role="alert"
            >
              {actionError}
            </p>
          ) : null}

          <div className="mt-6 min-h-0 flex-1">
            {!queryReady && !showingCache ? (
              <p className="py-16 text-center text-sm text-black/40">
                Loading ideas…
              </p>
            ) : sourceResults.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/15 px-6 py-16 text-center">
                <p className="font-display text-xl tracking-tight">
                  {tab === "open"
                    ? "No open ideas yet"
                    : "Nothing shipped here yet"}
                </p>
                <p className="mx-auto mt-2 max-w-sm text-sm text-black/50">
                  {tab === "open"
                    ? "Be the first — use the form on the left."
                    : "When we ship a request, it lands here."}
                </p>
              </div>
            ) : (
              <LayoutGroup>
              <ul ref={listRef} className="flex flex-col gap-2.5">
                {rankedResults.map((item) => {
                  const display = resolveDisplay(
                    item._id,
                    item.viewerHasVoted,
                    item.voteCount,
                  );
                  const voted = display.voted;
                  const pulsing = pulseId === item._id;
                  const votingLocked = item.status === "added";
                  const hovering = hoveredVoteId === item._id;
                  const leftAfterVote = leftSinceVoted.has(item._id);
                  // Unvoted + hover → black.
                  // Voted + not hovered → black fill.
                  // Voted + left + hover again → no black fill.
                  const blackFill =
                    !votingLocked &&
                    (voted
                      ? !hovering || !leftAfterVote
                      : hovering);
                  return (
                    <motion.li
                      key={item._id}
                      layout={reduceMotion ? false : "position"}
                      transition={{
                        layout: {
                          type: "spring",
                          stiffness: 420,
                          damping: 36,
                          mass: 0.85,
                        },
                      }}
                      data-fr-item
                      className="flex gap-3 rounded-2xl border border-black/10 bg-white px-3.5 py-3.5 sm:gap-4 sm:px-4"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          onToggleVote(item._id, item.status, voted)
                        }
                        onMouseEnter={() => {
                          if (!votingLocked) setHoveredVoteId(item._id);
                        }}
                        onMouseLeave={() => {
                          setHoveredVoteId((id) =>
                            id === item._id ? null : id,
                          );
                          if (voted && !votingLocked) {
                            setLeftSinceVoted((prev) => {
                              const next = new Set(prev);
                              next.add(item._id);
                              return next;
                            });
                          }
                        }}
                        disabled={votingLocked || !voterKeyForMutations}
                        aria-pressed={voted}
                        aria-label={
                          votingLocked
                            ? `Votes locked, ${display.voteCount} votes`
                            : voted
                              ? `Remove vote, currently ${display.voteCount}`
                              : `Vote up, currently ${display.voteCount}`
                        }
                        className={`flex w-12 shrink-0 flex-col items-center justify-center rounded-xl border py-2 transition ${
                          votingLocked
                            ? "cursor-default border-black/10 bg-white text-black/40"
                            : blackFill
                              ? "cursor-pointer border-black bg-black text-white"
                              : voted
                                ? "cursor-pointer border-black/15 bg-white text-black"
                                : "cursor-pointer border-black/10 bg-white text-black"
                        } ${pulsing && !votingLocked ? "scale-[1.04]" : ""} disabled:opacity-50`}
                      >
                        <ArrowUp className="size-4" strokeWidth={2.25} />
                        <span className="mt-0.5 text-[13px] font-semibold tabular-nums">
                          {display.voteCount}
                        </span>
                      </button>

                      <div className="relative flex min-w-0 flex-1 flex-col">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h3 className="font-display text-[1.05rem] font-medium leading-snug tracking-tight">
                            {item.title}
                          </h3>
                          {isAdmin ? (
                            item.status === "open" ? (
                              <button
                                type="button"
                                disabled={adminBusy === item._id}
                                onClick={() =>
                                  void onSetStatus(item._id, "added")
                                }
                                className="dg-btn dg-btn-primary cursor-pointer !gap-1 !px-2.5 !py-1.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Check className="size-3" />
                                Mark added
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={adminBusy === item._id}
                                onClick={() =>
                                  void onSetStatus(item._id, "open")
                                }
                                className="dg-btn dg-btn-secondary cursor-pointer !gap-1 !px-2.5 !py-1.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <RotateCcw className="size-3" />
                                Reopen
                              </button>
                            )
                          ) : null}
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-[#8a8a8e]">
                          {item.body}
                        </p>
                        <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-black/40">
                            <span>
                              {item.authorName}
                              {" · "}
                              {new Date(item.createdAt).toLocaleDateString(
                                undefined,
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )}
                            </span>
                            {isStaff && item.signedInVoteCount != null ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-[#a855f7]/12 px-1.5 py-0.5 font-medium text-[#6b21a8]">
                                <Users className="size-3" strokeWidth={2} />
                                {item.signedInVoteCount} signed-in
                                {item.voteCount > 0
                                  ? ` · ${Math.max(0, item.voteCount - item.signedInVoteCount)} anon`
                                  : ""}
                              </span>
                            ) : null}
                          </div>
                          {item.viewerIsAuthor || isAdmin ? (
                            <button
                              type="button"
                              disabled={deleteBusy}
                              onClick={() =>
                                setDeleteTarget({
                                  id: item._id,
                                  title: item.title,
                                })
                              }
                              aria-label="Delete request"
                              className="dg-btn dg-btn-danger shrink-0 cursor-pointer !gap-1 !px-2.5 !py-1.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trash2 className="size-3" />
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
              </LayoutGroup>
            )}

            {status === "CanLoadMore" ? (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => loadMore(20)}
                  className="dg-btn dg-btn-secondary cursor-pointer"
                >
                  Load more
                </button>
              </div>
            ) : null}
            {status === "LoadingMore" ? (
              <p className="mt-6 text-center text-sm text-black/40">Loading…</p>
            ) : null}
          </div>
        </section>
      </div>

      <AnimatePresence>
        {deleteTarget ? (
          <motion.div
            key="fr-delete-overlay"
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="fr-delete-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: reduceMotion ? 0 : 0.22,
              ease: [0.22, 1, 0.36, 1],
            }}
            onClick={() => {
              if (!deleteBusy) setDeleteTarget(null);
            }}
          >
            <motion.div
              className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-6 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.45)]"
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 12, scale: 0.97 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 8, scale: 0.98 }
              }
              transition={{
                duration: reduceMotion ? 0 : 0.28,
                ease: [0.22, 1, 0.36, 1],
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                id="fr-delete-title"
                className="font-display text-xl tracking-tight text-black"
              >
                Delete this request?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#8a8a8e]">
                <span className="font-medium text-black/80">
                  “{deleteTarget.title}”
                </span>{" "}
                will be removed for everyone, including its votes. This can’t be
                undone.
              </p>
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={deleteBusy}
                  onClick={() => setDeleteTarget(null)}
                  className="cursor-pointer rounded-xl px-3.5 py-2 text-sm font-medium text-[#8a8a8e] hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Keep it
                </button>
                <button
                  type="button"
                  disabled={deleteBusy}
                  onClick={() => void confirmDelete()}
                  className="dg-btn dg-btn-danger cursor-pointer !px-3.5 !py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleteBusy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default withConvexClerkProvider(FeatureRequestsPageInner);
