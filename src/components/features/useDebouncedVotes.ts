import { useCallback, useEffect, useRef, useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";

/** Wait this long after the last toggle before syncing the final state. */
export const VOTE_DEBOUNCE_MS = 60_000;

type PendingVote = {
  desiredVoted: boolean;
};

/**
 * Optimistic upvote toggles with a 1-minute debounce.
 * Spamming only flips local UI; one server sync runs after idle with the final state.
 */
export function useDebouncedVotes(args: {
  voterKey: string | null;
  serverVotedById: Map<string, boolean>;
  toggleVote: (args: {
    requestId: Id<"featureRequests">;
    voterKey: string;
  }) => Promise<{ voteCount: number; viewerHasVoted: boolean }>;
  onSyncError: (message: string) => void;
}) {
  const [pendingById, setPendingById] = useState(
    () => new Map<string, PendingVote>(),
  );

  const timersRef = useRef(new Map<string, number>());
  const pendingRef = useRef(pendingById);
  pendingRef.current = pendingById;

  const voterKeyRef = useRef(args.voterKey);
  voterKeyRef.current = args.voterKey;

  const serverVotedRef = useRef(args.serverVotedById);
  serverVotedRef.current = args.serverVotedById;

  const toggleVoteRef = useRef(args.toggleVote);
  toggleVoteRef.current = args.toggleVote;

  const onSyncErrorRef = useRef(args.onSyncError);
  onSyncErrorRef.current = args.onSyncError;

  const flushOne = useCallback(async (requestId: Id<"featureRequests">) => {
    const key = requestId as string;
    const timer = timersRef.current.get(key);
    if (timer != null) {
      window.clearTimeout(timer);
      timersRef.current.delete(key);
    }

    const pending = pendingRef.current.get(key);
    if (!pending) return;

    const voterKey = voterKeyRef.current;
    const serverVoted = serverVotedRef.current.get(key) ?? false;

    setPendingById((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });

    if (!voterKey || pending.desiredVoted === serverVoted) {
      return;
    }

    try {
      await toggleVoteRef.current({ requestId, voterKey });
    } catch (error) {
      onSyncErrorRef.current(
        error instanceof Error ? error.message : "Could not save your vote.",
      );
    }
  }, []);

  const flushAll = useCallback(() => {
    const ids = [...pendingRef.current.keys()] as Id<"featureRequests">[];
    for (const id of ids) {
      void flushOne(id);
    }
  }, [flushOne]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flushAll();
    };
    window.addEventListener("pagehide", flushAll);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flushAll);
      document.removeEventListener("visibilitychange", onHide);
      flushAll();
      for (const timer of timersRef.current.values()) {
        window.clearTimeout(timer);
      }
      timersRef.current.clear();
    };
  }, [flushAll]);

  const scheduleToggle = useCallback(
    (requestId: Id<"featureRequests">, currentlyDisplayedVoted: boolean) => {
      const key = requestId as string;
      const desiredVoted = !currentlyDisplayedVoted;

      setPendingById((prev) => {
        const next = new Map(prev);
        next.set(key, { desiredVoted });
        return next;
      });

      const existing = timersRef.current.get(key);
      if (existing != null) window.clearTimeout(existing);

      const timer = window.setTimeout(() => {
        void flushOne(requestId);
      }, VOTE_DEBOUNCE_MS);
      timersRef.current.set(key, timer);
    },
    [flushOne],
  );

  const resolveDisplay = useCallback(
    (
      requestId: Id<"featureRequests">,
      serverVoted: boolean,
      serverCount: number,
    ) => {
      const pending = pendingById.get(requestId as string);
      const voted = pending?.desiredVoted ?? serverVoted;
      const voteCount =
        serverCount + (voted === serverVoted ? 0 : voted ? 1 : -1);
      return { voted, voteCount, isPending: pending != null };
    },
    [pendingById],
  );

  return { scheduleToggle, resolveDisplay, flushAll };
}
