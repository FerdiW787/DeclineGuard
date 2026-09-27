import {
  DEFAULT_LAYOUT_PRESET_ID,
  DEFAULT_STYLING_MODE,
  isLayoutPresetId,
  isLifecycleEmailType,
  isStylingMode,
  LIFECYCLE_EMAIL_TYPES,
  type LayoutPresetId,
  type LifecycleEmailType,
  type StylingMode,
} from "./emailLayoutPresets";
import type { EmailCopyOverride, EmailLayoutCopyOverrides } from "./emailLayoutCopy";
import type { EmailThemeTokens } from "./emailTheme";

const STORAGE_KEY = "dg.emailLayoutDraft.v1";

/**
 * Riley-shaped FE contract. Convex does not persist these fields yet.
 * Preview and onboarding read/write this draft locally.
 */
export type EmailLayoutDraft = {
  stylingMode: StylingMode;
  layoutPresetId: LayoutPresetId;
  copyOverrides: EmailLayoutCopyOverrides;
  /**
   * Shell colors the current save mutation cannot store
   * (`emailBackgroundColor`, `emailTextColor`).
   */
  shellOverrides: {
    emailBackgroundColor?: string;
    emailTextColor?: string;
  };
};

export const DEFAULT_EMAIL_LAYOUT_DRAFT: EmailLayoutDraft = {
  stylingMode: DEFAULT_STYLING_MODE,
  layoutPresetId: DEFAULT_LAYOUT_PRESET_ID,
  copyOverrides: {},
  shellOverrides: {},
};

function sanitizeCopyOverrides(
  raw: unknown,
): EmailLayoutCopyOverrides {
  if (!raw || typeof raw !== "object") return {};
  const out: EmailLayoutCopyOverrides = {};
  for (const type of LIFECYCLE_EMAIL_TYPES) {
    if (!(type in raw)) continue;
    const entry = (raw as Record<string, unknown>)[type];
    if (!entry || typeof entry !== "object") continue;
    const rec = entry as Record<string, unknown>;
    const next: EmailCopyOverride = {};
    if (typeof rec.headline === "string") next.headline = rec.headline;
    if (typeof rec.body === "string") next.body = rec.body;
    if (typeof rec.cta === "string") next.cta = rec.cta;
    if (typeof rec.secondaryLink === "string") {
      next.secondaryLink = rec.secondaryLink;
    }
    if (Object.keys(next).length > 0) out[type] = next;
  }
  return out;
}

function sanitizeDraft(raw: unknown): EmailLayoutDraft {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_EMAIL_LAYOUT_DRAFT };
  const rec = raw as Record<string, unknown>;
  const layoutPresetId = isLayoutPresetId(String(rec.layoutPresetId ?? ""))
    ? (rec.layoutPresetId as LayoutPresetId)
    : DEFAULT_LAYOUT_PRESET_ID;
  const stylingMode = isStylingMode(String(rec.stylingMode ?? ""))
    ? (rec.stylingMode as StylingMode)
    : DEFAULT_STYLING_MODE;
  const shell =
    rec.shellOverrides && typeof rec.shellOverrides === "object"
      ? (rec.shellOverrides as Record<string, unknown>)
      : {};
  return {
    layoutPresetId,
    stylingMode,
    copyOverrides: sanitizeCopyOverrides(rec.copyOverrides),
    shellOverrides: {
      emailBackgroundColor:
        typeof shell.emailBackgroundColor === "string"
          ? shell.emailBackgroundColor
          : undefined,
      emailTextColor:
        typeof shell.emailTextColor === "string"
          ? shell.emailTextColor
          : undefined,
    },
  };
}

export function loadEmailLayoutDraft(): EmailLayoutDraft {
  if (typeof window === "undefined") return { ...DEFAULT_EMAIL_LAYOUT_DRAFT };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_EMAIL_LAYOUT_DRAFT };
    return sanitizeDraft(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT_EMAIL_LAYOUT_DRAFT };
  }
}

export function writeEmailLayoutDraft(draft: EmailLayoutDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* private mode / blocked storage */
  }
}

export function draftsEqual(a: EmailLayoutDraft, b: EmailLayoutDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Brand fields `saveEmailCustomizations` already accepts. */
export type PersistableEmailLayoutFields = {
  brandColor: string;
  secondaryColor: string;
  ctaBackgroundColor: string;
  ctaTextColor: string;
  linkColor: string;
};

/**
 * Thin persist adapter.
 *
 * Writes the Riley-shaped draft to localStorage. Returns only fields the
 * live Convex mutation already accepts — `layoutPresetId`, `stylingMode`,
 * copy overrides, and shell colors are **not** sent to the API.
 */
export function persistEmailLayoutSettings(input: {
  draft: EmailLayoutDraft;
  configured: Partial<EmailThemeTokens>;
}): {
  persisted: PersistableEmailLayoutFields | null;
  localOnly: Pick<EmailLayoutDraft, "layoutPresetId" | "stylingMode" | "copyOverrides" | "shellOverrides">;
  convexGap: readonly string[];
} {
  writeEmailLayoutDraft(input.draft);
  const brand = input.configured.brandColor?.trim();
  const persisted =
    brand && /^#([0-9a-fA-F]{6})$/.test(brand)
      ? {
          brandColor: brand,
          secondaryColor:
            input.configured.mutedTextColor?.trim() || "#6b6b70",
          ctaBackgroundColor:
            input.configured.ctaBackgroundColor?.trim() || brand,
          ctaTextColor: input.configured.ctaTextColor?.trim() || "#ffffff",
          linkColor: input.configured.linkColor?.trim() || brand,
        }
      : null;

  return {
    persisted,
    localOnly: {
      layoutPresetId: input.draft.layoutPresetId,
      stylingMode: input.draft.stylingMode,
      copyOverrides: input.draft.copyOverrides,
      shellOverrides: input.draft.shellOverrides,
    },
    convexGap: [
      "layoutPresetId",
      "stylingMode",
      "copyOverrides (lifecycle short copy)",
      "emailBackgroundColor",
      "emailTextColor",
    ],
  };
}

export function copyOverrideForType(
  draft: EmailLayoutDraft,
  emailType: LifecycleEmailType,
): EmailCopyOverride | undefined {
  return draft.copyOverrides[emailType];
}
