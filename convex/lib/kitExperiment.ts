import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  DEFAULT_LAYOUT_PRESET_ID,
  LAYOUT_PRESET_IDS,
  NEW_MERCHANT_THEME_DEFAULTS,
  normalizeLayoutPresetId,
  type LayoutPresetId,
} from "./emailTheme";

/**
 * Per-merchant kit A/B (Set A only).
 *
 * Merchants cannot pick templates. We rotate the five locked kits across
 * new declines, keep Day 0/2/5 sticky on `failedPayments.assignedKitId`,
 * then lock the winner onto `recoverySettings.layoutPresetId`.
 *
 * Default / fallback / tie-break: `quiet-column`.
 * Rotation order: LAYOUT_PRESET_IDS (poster-notice → … → quiet-column).
 *
 * Promote when every kit has ≥ KIT_EXPERIMENT_MIN_SEQUENCES sequences
 * started. No early-stop / sequential-testing rule — wait for the N
 * floor on all five arms so rates are comparable.
 *
 * Recoveries use the same signal as the fee ledger: `day0SentAt` set and
 * `isWithinAttributionWindow`. Test-mode recoveries are not counted.
 */
export const KIT_EXPERIMENT_MIN_SEQUENCES = 20;

export const KIT_EXPERIMENT_STATUSES = ["active", "won"] as const;
export type KitExperimentStatus = (typeof KIT_EXPERIMENT_STATUSES)[number];

export const kitExperimentStatusValidator = {
  active: "active",
  won: "won",
} as const;

export function isKitExperimentStatus(
  value: unknown,
): value is KitExperimentStatus {
  return value === "active" || value === "won";
}

export function normalizeKitExperimentStatus(
  value: string | null | undefined,
): KitExperimentStatus {
  return value === "won" ? "won" : "active";
}

export type KitExperimentStat = {
  kitId: LayoutPresetId;
  sequencesStarted: number;
  recoveries: number;
};

export function recoveryRate(stat: KitExperimentStat): number {
  if (stat.sequencesStarted <= 0) return 0;
  return stat.recoveries / stat.sequencesStarted;
}

/** Highest rate, then most recoveries, then quiet-column. */
export function pickWinningKit(stats: readonly KitExperimentStat[]): LayoutPresetId {
  const byId = new Map(stats.map((row) => [row.kitId, row]));
  const ranked = LAYOUT_PRESET_IDS.map((kitId) => {
    const row = byId.get(kitId);
    return {
      kitId,
      sequencesStarted: row?.sequencesStarted ?? 0,
      recoveries: row?.recoveries ?? 0,
    };
  });
  ranked.sort((a, b) => {
    const rateDiff = recoveryRate(b) - recoveryRate(a);
    if (rateDiff !== 0) return rateDiff;
    if (b.recoveries !== a.recoveries) return b.recoveries - a.recoveries;
    if (a.kitId === DEFAULT_LAYOUT_PRESET_ID) return -1;
    if (b.kitId === DEFAULT_LAYOUT_PRESET_ID) return 1;
    return 0;
  });
  return ranked[0]?.kitId ?? DEFAULT_LAYOUT_PRESET_ID;
}

export function shouldPromoteKitExperiment(
  stats: readonly KitExperimentStat[],
  minSequences = KIT_EXPERIMENT_MIN_SEQUENCES,
): boolean {
  const byId = new Map(stats.map((row) => [row.kitId, row.sequencesStarted]));
  return LAYOUT_PRESET_IDS.every(
    (kitId) => (byId.get(kitId) ?? 0) >= minSequences,
  );
}

/**
 * Send / preview kit — assigned arm is sticky for Day 0/2/5.
 *   assigned → that decline’s arm (even after promote)
 *   won, no arm → persisted winner (`layoutPresetId`)
 *   missing  → quiet-column
 */
export function resolveSendKit(input: {
  experimentStatus?: string | null;
  winnerKitId?: string | null;
  assignedKitId?: string | null;
}): LayoutPresetId {
  if (input.assignedKitId) {
    return normalizeLayoutPresetId(input.assignedKitId);
  }
  if (normalizeKitExperimentStatus(input.experimentStatus) === "won") {
    return normalizeLayoutPresetId(input.winnerKitId);
  }
  return DEFAULT_LAYOUT_PRESET_ID;
}

export function nextRotationKit(
  rotationIndex: number | null | undefined,
): { kitId: LayoutPresetId; nextIndex: number } {
  const index =
    typeof rotationIndex === "number" && Number.isFinite(rotationIndex)
      ? Math.max(0, Math.floor(rotationIndex))
      : 0;
  const kitId = LAYOUT_PRESET_IDS[index % LAYOUT_PRESET_IDS.length]!;
  return { kitId, nextIndex: index + 1 };
}

async function loadSettings(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  return await ctx.db
    .query("recoverySettings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

/** Create a default recoverySettings row so rotation + promote can persist. */
async function ensureSettings(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  const existing = await loadSettings(ctx, userId);
  if (existing) return existing;
  const now = Date.now();
  const id = await ctx.db.insert("recoverySettings", {
    userId,
    brandColor: "#0c0c0c",
    secondaryColor: "#6b6b70",
    templateId: "gentle",
    ...NEW_MERCHANT_THEME_DEFAULTS,
    kitExperimentStatus: "active",
    kitExperimentRotationIndex: 0,
    updatedAt: now,
  });
  const created = await ctx.db.get(id);
  if (!created) throw new Error("Recovery settings not found");
  return created;
}

async function loadStats(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<KitExperimentStat[]> {
  // Bounded: one row per Set A kit (5).
  // eslint-disable-next-line @convex-dev/no-query-collect
  const rows = await ctx.db
    .query("kitExperimentStats")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return rows.map((row) => ({
    kitId: normalizeLayoutPresetId(row.kitId),
    sequencesStarted: row.sequencesStarted,
    recoveries: row.recoveries,
  }));
}

async function upsertStat(
  ctx: MutationCtx,
  userId: Id<"users">,
  kitId: LayoutPresetId,
  patch: { sequencesStarted?: number; recoveries?: number },
): Promise<void> {
  // Concurrent first assigns can insert duplicate (userId, kitId) rows.
  // `.unique()` would throw; take the first and fold extras.
  // Bounded: one logical row per kit; extras are a race leftover.
  // eslint-disable-next-line @convex-dev/no-query-collect
  const rows = await ctx.db
    .query("kitExperimentStats")
    .withIndex("by_user_and_kit", (q) =>
      q.eq("userId", userId).eq("kitId", kitId),
    )
    .collect();
  const now = Date.now();
  const existing = rows[0];
  if (existing) {
    let sequencesStarted = existing.sequencesStarted;
    let recoveries = existing.recoveries;
    for (const extra of rows.slice(1)) {
      sequencesStarted += extra.sequencesStarted;
      recoveries += extra.recoveries;
      await ctx.db.delete(extra._id);
    }
    await ctx.db.patch(existing._id, {
      sequencesStarted:
        patch.sequencesStarted !== undefined
          ? sequencesStarted + patch.sequencesStarted
          : sequencesStarted,
      recoveries:
        patch.recoveries !== undefined
          ? recoveries + patch.recoveries
          : recoveries,
      updatedAt: now,
    });
    return;
  }
  await ctx.db.insert("kitExperimentStats", {
    userId,
    kitId,
    sequencesStarted: patch.sequencesStarted ?? 0,
    recoveries: patch.recoveries ?? 0,
    updatedAt: now,
  });
}

async function maybePromoteWinner(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const settings = await loadSettings(ctx, userId);
  if (!settings || normalizeKitExperimentStatus(settings.kitExperimentStatus) === "won") {
    return;
  }
  const stats = await loadStats(ctx, userId);
  if (!shouldPromoteKitExperiment(stats)) return;
  const winner = pickWinningKit(stats);
  await ctx.db.patch(settings._id, {
    kitExperimentStatus: "won",
    layoutPresetId: winner,
    kitExperimentWonAt: Date.now(),
    updatedAt: Date.now(),
  });
}

/**
 * Assign a kit for a newly inserted decline / recovery sequence.
 * Sticky for Day 0/2/5 via the returned id (caller persists on the failure).
 * Won merchants keep receiving the winner; rotation stats stop.
 */
export async function assignKitForNewSequence(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<LayoutPresetId> {
  const settings = await ensureSettings(ctx, userId);
  const status = normalizeKitExperimentStatus(settings.kitExperimentStatus);
  if (status === "won") {
    return normalizeLayoutPresetId(settings.layoutPresetId);
  }

  const stats = await loadStats(ctx, userId);
  const { kitId, nextIndex } = nextRotationKit(
    settings.kitExperimentRotationIndex ??
      stats.reduce((n, row) => n + row.sequencesStarted, 0),
  );
  const now = Date.now();
  await ctx.db.patch(settings._id, {
    kitExperimentStatus: "active",
    kitExperimentRotationIndex: nextIndex,
    updatedAt: now,
  });
  await upsertStat(ctx, userId, kitId, { sequencesStarted: 1 });
  await maybePromoteWinner(ctx, userId);
  return kitId;
}

/** Count an attributed recovery against the decline’s assigned kit. */
export async function recordKitRecovery(
  ctx: MutationCtx,
  userId: Id<"users">,
  assignedKitId: string | null | undefined,
): Promise<void> {
  if (!assignedKitId) return;
  const kitId = normalizeLayoutPresetId(assignedKitId);
  await upsertStat(ctx, userId, kitId, { recoveries: 1 });
  await maybePromoteWinner(ctx, userId);
}

/** Admin reset: rotate again; previous winner is cleared. */
export async function resetKitExperimentForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const settings = await loadSettings(ctx, userId);
  const now = Date.now();
  if (settings) {
    await ctx.db.patch(settings._id, {
      kitExperimentStatus: "active",
      kitExperimentRotationIndex: 0,
      kitExperimentWonAt: undefined,
      layoutPresetId: DEFAULT_LAYOUT_PRESET_ID,
      updatedAt: now,
    });
  }
  // Bounded: one row per Set A kit (5).
  // eslint-disable-next-line @convex-dev/no-query-collect
  const rows = await ctx.db
    .query("kitExperimentStats")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
}
