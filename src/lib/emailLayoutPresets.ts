/**
 * Catalog + lifecycle types. IDs come from the Riley contract
 * (`src/lib/emailLayoutContract.ts` → `convex/lib` when that tips).
 */

export {
  DEFAULT_LAYOUT_PRESET_ID,
  DEFAULT_STYLING_MODE,
  LAYOUT_PRESET_IDS,
  isLayoutPresetId,
  isStylingMode,
  resolveLayoutPresetId,
  type LayoutPresetId,
  type RecoverySettingsLayoutFields,
  type StylingMode,
} from "./emailLayoutContract";

import {
  DEFAULT_LAYOUT_PRESET_ID,
  type LayoutPresetId,
} from "./emailLayoutContract";

export const LIFECYCLE_EMAIL_TYPES = [
  "verify",
  "decline_pause",
  "trial_ended",
  "renewal",
  "expiry",
] as const;

export type LifecycleEmailType = (typeof LIFECYCLE_EMAIL_TYPES)[number];

export const DEFAULT_LIFECYCLE_EMAIL_TYPE: LifecycleEmailType = "verify";

export type LayoutPresetMeta = {
  id: LayoutPresetId;
  label: string;
  /** One-line structure hint — not third-party attribution. */
  structure: string;
};

export const LAYOUT_PRESET_CATALOG: readonly LayoutPresetMeta[] = [
  {
    id: "quiet-verify",
    label: "Quiet Verify",
    structure: "Centered check, one action, lots of air",
  },
  {
    id: "soft-expire",
    label: "Soft Expire",
    structure: "What’s ending, then a calm restore",
  },
  {
    id: "safe-pause",
    label: "Safe Pause",
    structure: "Paused — data stays, resume when ready",
  },
  {
    id: "soft-renew",
    label: "Soft Renew",
    structure: "Upcoming renewal, what’s included",
  },
  {
    id: "alert-expire",
    label: "Alert Expire",
    structure: "Accent bar, what happens next",
  },
] as const;

export const LIFECYCLE_EMAIL_META: Record<
  LifecycleEmailType,
  { label: string; hint: string }
> = {
  verify: { label: "Verify", hint: "Confirm the address" },
  decline_pause: { label: "Decline / pause", hint: "Payment failed or paused" },
  trial_ended: { label: "Trial ended", hint: "Trial wrapped up" },
  renewal: { label: "Renewal", hint: "Upcoming or due" },
  expiry: { label: "Expiry", hint: "Access is ending" },
};

export function isLifecycleEmailType(
  value: string,
): value is LifecycleEmailType {
  return (LIFECYCLE_EMAIL_TYPES as readonly string[]).includes(value);
}

export function layoutPresetMeta(id: LayoutPresetId): LayoutPresetMeta {
  const found = LAYOUT_PRESET_CATALOG.find((item) => item.id === id);
  if (found) return found;
  return (
    LAYOUT_PRESET_CATALOG.find((item) => item.id === DEFAULT_LAYOUT_PRESET_ID) ??
    LAYOUT_PRESET_CATALOG[0]!
  );
}
