import type { Id } from "../../../convex/_generated/dataModel";

const CACHE_KEY = "dg.featureRequests.top.v1";
const TOP_N = 10;
/** Soft TTL — still shown while refetching; discarded if older than this. */
const MAX_AGE_MS = 1000 * 60 * 60 * 24;

export type FeatureTab = "open" | "added";

export type CachedFeatureRequest = {
  _id: Id<"featureRequests">;
  title: string;
  body: string;
  voteCount: number;
  createdAt: number;
  authorName: string;
  status: FeatureTab;
  viewerHasVoted: boolean;
  viewerIsAuthor: boolean;
  signedInVoteCount: number | null;
};

type TabBucket = {
  at: number;
  items: CachedFeatureRequest[];
};

type CacheStore = Partial<Record<FeatureTab, TabBucket>>;

function readStore(): CacheStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as CacheStore;
  } catch {
    return {};
  }
}

function writeStore(store: CacheStore): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {
    // Quota / private mode — ignore.
  }
}

/** Last top ideas for a tab, or null if missing/stale. */
export function readCachedTop(tab: FeatureTab): CachedFeatureRequest[] | null {
  const bucket = readStore()[tab];
  if (!bucket || !Array.isArray(bucket.items)) return null;
  if (Date.now() - bucket.at > MAX_AGE_MS) return null;
  return bucket.items.slice(0, TOP_N);
}

/** Persist the current top ideas for instant paint on the next visit. */
export function writeCachedTop(
  tab: FeatureTab,
  items: readonly CachedFeatureRequest[],
): void {
  const store = readStore();
  store[tab] = {
    at: Date.now(),
    items: items.slice(0, TOP_N).map((item) => ({
      _id: item._id,
      title: item.title,
      body: item.body,
      voteCount: item.voteCount,
      createdAt: item.createdAt,
      authorName: item.authorName,
      status: item.status,
      viewerHasVoted: item.viewerHasVoted,
      viewerIsAuthor: item.viewerIsAuthor,
      signedInVoteCount: item.signedInVoteCount,
    })),
  };
  writeStore(store);
}
