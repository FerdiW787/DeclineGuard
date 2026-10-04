/**
 * Thin FE mirror of Riley’s public API (`convex/lib/emailTheme.ts` @ d87c049).
 * After that branch merges to `dev`, re-export from convex/lib/emailTheme.
 * Do not import Convex validators here.
 */

import {
  DEFAULT_EMAIL_FONT,
  normalizeEmailFont,
  type EmailFontId,
} from "./emailFonts";

export const STYLING_MODES = ["preset", "configured"] as const;
export type StylingMode = (typeof STYLING_MODES)[number];

export const QUIET_VERIFY_LAYOUT_ID = "quiet-verify";
export const SONOS_LAYOUT_ID = "sonos";
export const POSTER_NOTICE_LAYOUT_ID = "poster-notice";
export const QUIET_COLUMN_LAYOUT_ID = "quiet-column";

/**
 * Recovery starter kits — structure only. Hard reset: these IDs replace
 * the RGE / invoice-stack generation. Tokens are not a brand palette.
 *
 * FE catalog is Set A (5). Riley BE still knows older IDs (sonos…).
 * Assigned kit is BE-owned — FE does not persist a merchant-chosen id.
 *
 *   poster-notice | amount-due | plain-letter | what-happened | quiet-column
 *
 * Merchants do not pick a kit. We A/B these five; Riley BE assigns.
 */
export const LAYOUT_PRESET_IDS = [
  "poster-notice",
  "amount-due",
  "plain-letter",
  "what-happened",
  "quiet-column",
] as const;

/** IDs Riley BE is expected to accept today. New FE kits persist locally. */
export const BE_LAYOUT_PRESET_IDS = [
  "sonos",
  "avocode",
  "benchmark",
  "fontbase",
  "nordvpn-structure",
] as const;

export type LayoutPresetId = (typeof LAYOUT_PRESET_IDS)[number];

export const DEFAULT_LAYOUT_PRESET_ID: LayoutPresetId = QUIET_COLUMN_LAYOUT_ID;
export const DEFAULT_STYLING_MODE: StylingMode = "preset";

/** MVP lifecycle emails — same layout via the single global layoutPresetId. */
export const LIFECYCLE_EMAIL_TYPES = [
  "verify",
  "decline_pause",
  "trial_ended",
  "renewal",
  "expiry",
] as const;

export type LifecycleEmailType = (typeof LIFECYCLE_EMAIL_TYPES)[number];

export const DEFAULT_LIFECYCLE_EMAIL_TYPE: LifecycleEmailType = "verify";

/**
 * Visual tokens applied to lifecycle + recovery emails.
 * Field names match persisted BrandKit / recoverySettings columns.
 */
export type EmailThemeTokens = {
  brandColor: string;
  secondaryColor: string;
  mutedTextColor: string;
  linkColor: string;
  pageBackgroundColor: string;
  pageTextColor: string;
  emailBackgroundColor: string;
  emailTextColor: string;
  ctaBackgroundColor: string;
  ctaTextColor: string;
  ctaBorderRadiusPx: number;
  emailFont: EmailFontId;
  fontFamilyRaw: string | null;
};

/** Sonos verify — black/white, super-pill CTA (RGE: verify-your-email-sonos). */
export const SONOS_TOKENS: EmailThemeTokens = {
  brandColor: "#000000",
  secondaryColor: "#6b6b6b",
  mutedTextColor: "#6b6b6b",
  linkColor: "#000000",
  pageBackgroundColor: "#ffffff",
  pageTextColor: "#000000",
  emailBackgroundColor: "#ffffff",
  emailTextColor: "#000000",
  ctaBackgroundColor: "#c8ff00",
  ctaTextColor: "#000000",
  ctaBorderRadiusPx: 9999,
  emailFont: "system",
  fontFamilyRaw: null,
};

/** @deprecated Use SONOS_TOKENS. Kept for Riley catalog mirrors. */
export const QUIET_VERIFY_TOKENS: EmailThemeTokens = SONOS_TOKENS;

export type LayoutPreset = {
  id: string;
  name: string;
  description: string;
  tokens: EmailThemeTokens;
};

export const LAYOUT_PRESET_CATALOG: Record<string, LayoutPreset> = {
  "poster-notice": {
    id: "poster-notice",
    name: "Poster notice",
    description: "One announcement, then the button.",
    tokens: SONOS_TOKENS,
  },
  "amount-due": {
    id: "amount-due",
    name: "Amount due",
    description: "Money first, then the problem.",
    tokens: SONOS_TOKENS,
  },
  "plain-letter": {
    id: "plain-letter",
    name: "Plain letter",
    description: "A short letter, then the ask.",
    tokens: SONOS_TOKENS,
  },
  "what-happened": {
    id: "what-happened",
    name: "What happened",
    description: "Two beats: happened, then do.",
    tokens: SONOS_TOKENS,
  },
  "quiet-column": {
    id: "quiet-column",
    name: "Quiet column",
    description: "Wide type, almost nothing else.",
    tokens: SONOS_TOKENS,
  },
};

export const NEW_MERCHANT_THEME_DEFAULTS = {
  stylingMode: "preset" as const,
  layoutPresetId: QUIET_COLUMN_LAYOUT_ID,
};

export type ResolveThemeInput = {
  stylingMode?: StylingMode | string | null;
  layoutPresetId?: string | null;
  configured?: Partial<EmailThemeTokens> | null;
};

export type ResolvedEmailTheme = {
  stylingMode: StylingMode;
  layoutPresetId: string;
  tokens: EmailThemeTokens;
};

export type RecoverySettingsLayoutFields = {
  stylingMode: StylingMode;
  layoutPresetId: string;
};

/**
 * Legacy id → Set A. Must match BE `LEGACY_LAYOUT_PRESET_ID_MAP`:
 *   sonos / quiet-verify / calm-verify     → quiet-column
 *   avocode / soft-renew / trial-ended     → amount-due
 *   benchmark / safe-pause / data-safe     → what-happened
 *   fontbase / soft-expire / upcoming-renewal → plain-letter
 *   nordvpn-structure / alert-expire / account-expired → poster-notice
 */
const LEGACY_LAYOUT_PRESET_IDS: Record<string, LayoutPresetId> = {
  "quiet-verify": "quiet-column",
  quiet_verify: "quiet-column",
  sonos: "quiet-column",
  "calm-verify": "quiet-column",
  "soft-expire": "plain-letter",
  soft_expire: "plain-letter",
  "upcoming-renewal": "plain-letter",
  avocode: "amount-due",
  "soft-renew": "amount-due",
  soft_renew: "amount-due",
  "trial-ended": "amount-due",
  "safe-pause": "what-happened",
  safe_pause: "what-happened",
  "data-safe": "what-happened",
  benchmark: "what-happened",
  fontbase: "plain-letter",
  "alert-expire": "poster-notice",
  alert_expire: "poster-notice",
  "account-expired": "poster-notice",
  nordvpn: "poster-notice",
  "nordvpn-structure": "poster-notice",
  "invoice-stack": "amount-due",
  "checklist-card": "what-happened",
  "split-banner": "poster-notice",
  "step-rail": "poster-notice",
  "tight-notice": "poster-notice",
  "cta-lead": "poster-notice",
  "ruled-editorial": "poster-notice",
  "postscript-note": "poster-notice",
  "stub-header": "amount-due",
  "end-action": "poster-notice",
  "italic-lead": "poster-notice",
  "status-word": "poster-notice",
  "deck-headline": "poster-notice",
  "hold-open": "poster-notice",
  "folio-mark": "poster-notice",
};

export function isStylingMode(value: unknown): value is StylingMode {
  return value === "preset" || value === "configured";
}

export function isLayoutPresetId(value: string): value is LayoutPresetId {
  return (LAYOUT_PRESET_IDS as readonly string[]).includes(value);
}

export function isLifecycleEmailType(
  value: unknown,
): value is LifecycleEmailType {
  return (
    typeof value === "string" &&
    (LIFECYCLE_EMAIL_TYPES as readonly string[]).includes(value)
  );
}

export function normalizeStylingMode(
  value: string | null | undefined,
  fallback: StylingMode = "preset",
): StylingMode {
  return isStylingMode(value) ? value : fallback;
}

export function normalizeLayoutPresetId(
  value: string | null | undefined,
): string {
  const raw = value?.trim() ?? "";
  const id = LEGACY_LAYOUT_PRESET_IDS[raw] ?? raw;
  if (id && LAYOUT_PRESET_CATALOG[id]) return id;
  return DEFAULT_LAYOUT_PRESET_ID;
}

export function resolveLayoutPresetId(id: string): LayoutPresetId {
  const normalized = normalizeLayoutPresetId(id);
  return isLayoutPresetId(normalized)
    ? normalized
    : DEFAULT_LAYOUT_PRESET_ID;
}

export function getLayoutPreset(layoutPresetId: string): LayoutPreset {
  const id = normalizeLayoutPresetId(layoutPresetId);
  return (
    LAYOUT_PRESET_CATALOG[id] ?? LAYOUT_PRESET_CATALOG[DEFAULT_LAYOUT_PRESET_ID]!
  );
}

export function assertKnownLayoutPresetId(value: string): string {
  const id = normalizeLayoutPresetId(value);
  if (!LAYOUT_PRESET_CATALOG[id]) {
    throw new Error(
      `Unknown layout preset. Valid ids: ${Object.keys(LAYOUT_PRESET_CATALOG).join(", ")}`,
    );
  }
  return id;
}

function pickToken(
  value: string | null | undefined,
  fallback: string,
): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function mergeConfiguredTokens(
  catalog: EmailThemeTokens,
  configured: Partial<EmailThemeTokens> | null | undefined,
): EmailThemeTokens {
  if (!configured) return catalog;
  const muted = pickToken(
    configured.mutedTextColor ?? configured.secondaryColor,
    catalog.mutedTextColor,
  );
  const pageBg = pickToken(
    configured.pageBackgroundColor ?? configured.emailBackgroundColor,
    catalog.pageBackgroundColor,
  );
  const pageText = pickToken(
    configured.pageTextColor ?? configured.emailTextColor,
    catalog.pageTextColor,
  );
  const emailBg = pickToken(configured.emailBackgroundColor, pageBg);
  const emailText = pickToken(configured.emailTextColor, pageText);
  const brand = pickToken(configured.brandColor, catalog.brandColor);
  const radius =
    typeof configured.ctaBorderRadiusPx === "number" &&
    Number.isFinite(configured.ctaBorderRadiusPx)
      ? Math.max(0, Math.min(9999, Math.round(configured.ctaBorderRadiusPx)))
      : catalog.ctaBorderRadiusPx;
  const raw = configured.fontFamilyRaw?.trim();

  return {
    brandColor: brand,
    secondaryColor: muted,
    mutedTextColor: muted,
    linkColor: pickToken(configured.linkColor, brand),
    pageBackgroundColor: pageBg,
    pageTextColor: pageText,
    emailBackgroundColor: emailBg,
    emailTextColor: emailText,
    ctaBackgroundColor: pickToken(configured.ctaBackgroundColor, brand),
    ctaTextColor: pickToken(configured.ctaTextColor, catalog.ctaTextColor),
    ctaBorderRadiusPx: radius,
    emailFont: normalizeEmailFont(configured.emailFont ?? DEFAULT_EMAIL_FONT),
    fontFamilyRaw: raw ? raw : null,
  };
}

/**
 * Resolve tokens for send + preview.
 * Layout id always selects structure; stylingMode only swaps token source.
 */
export function resolveTheme(input: ResolveThemeInput): ResolvedEmailTheme {
  const layoutPresetId = normalizeLayoutPresetId(input.layoutPresetId);
  const stylingMode = normalizeStylingMode(input.stylingMode);
  const catalog = getLayoutPreset(layoutPresetId);

  if (stylingMode === "preset") {
    return {
      stylingMode: "preset",
      layoutPresetId,
      tokens: catalog.tokens,
    };
  }

  return {
    stylingMode: "configured",
    layoutPresetId,
    tokens: mergeConfiguredTokens(catalog.tokens, input.configured),
  };
}

/** Infer mode for rows created before stylingMode existed. */
export function inferStylingMode(row: {
  stylingMode?: string | null;
  brandImportCompletedAt?: number | null;
}): StylingMode {
  if (isStylingMode(row.stylingMode)) return row.stylingMode;
  return row.brandImportCompletedAt != null ? "configured" : "preset";
}

export type SettingsTokenSource = {
  brandColor?: string | null;
  secondaryColor?: string | null;
  mutedTextColor?: string | null;
  linkColor?: string | null;
  pageBackgroundColor?: string | null;
  pageTextColor?: string | null;
  emailBackgroundColor?: string | null;
  emailTextColor?: string | null;
  ctaBackgroundColor?: string | null;
  ctaTextColor?: string | null;
  ctaBorderRadiusPx?: number | null;
  emailFont?: string | null;
  fontFamilyRaw?: string | null;
};

export function configuredTokensFromSettings(
  settings: SettingsTokenSource | null | undefined,
): Partial<EmailThemeTokens> {
  if (!settings) return {};
  const muted =
    settings.mutedTextColor?.trim() ||
    settings.secondaryColor?.trim() ||
    undefined;
  const pageBg =
    settings.pageBackgroundColor?.trim() ||
    settings.emailBackgroundColor?.trim() ||
    undefined;
  const pageText =
    settings.pageTextColor?.trim() ||
    settings.emailTextColor?.trim() ||
    undefined;
  return {
    ...(settings.brandColor?.trim()
      ? { brandColor: settings.brandColor.trim() }
      : {}),
    ...(muted ? { secondaryColor: muted, mutedTextColor: muted } : {}),
    ...(settings.linkColor?.trim()
      ? { linkColor: settings.linkColor.trim() }
      : {}),
    ...(pageBg ? { pageBackgroundColor: pageBg } : {}),
    ...(pageText ? { pageTextColor: pageText } : {}),
    ...(settings.emailBackgroundColor?.trim()
      ? { emailBackgroundColor: settings.emailBackgroundColor.trim() }
      : {}),
    ...(settings.emailTextColor?.trim()
      ? { emailTextColor: settings.emailTextColor.trim() }
      : {}),
    ...(settings.ctaBackgroundColor?.trim()
      ? { ctaBackgroundColor: settings.ctaBackgroundColor.trim() }
      : {}),
    ...(settings.ctaTextColor?.trim()
      ? { ctaTextColor: settings.ctaTextColor.trim() }
      : {}),
    ...(typeof settings.ctaBorderRadiusPx === "number"
      ? { ctaBorderRadiusPx: settings.ctaBorderRadiusPx }
      : {}),
    ...(settings.emailFont
      ? { emailFont: normalizeEmailFont(settings.emailFont) }
      : {}),
    fontFamilyRaw: settings.fontFamilyRaw?.trim() || null,
  };
}

export function resolveThemeFromSettings(settings: {
  stylingMode?: string | null;
  layoutPresetId?: string | null;
  brandImportCompletedAt?: number | null;
} & SettingsTokenSource): ResolvedEmailTheme {
  return resolveTheme({
    stylingMode: inferStylingMode(settings),
    layoutPresetId: settings.layoutPresetId,
    configured: configuredTokensFromSettings(settings),
  });
}

export function resolveLifecycleEmailTheme(
  emailType: LifecycleEmailType,
  input: ResolveThemeInput,
): ResolvedEmailTheme & { emailType: LifecycleEmailType } {
  if (!isLifecycleEmailType(emailType)) {
    throw new Error("Unknown lifecycle email type");
  }
  const theme = resolveTheme(input);
  return { emailType, ...theme };
}

export function recoveryColorsFromTheme(tokens: EmailThemeTokens): {
  primaryColor: string;
  secondaryColor: string;
  ctaBackgroundColor: string;
  ctaTextColor: string;
  ctaBorderRadiusPx: number;
  emailBackgroundColor: string;
  emailTextColor: string;
  linkColor: string;
  emailFont: EmailFontId;
  fontFamilyRaw: string | null;
} {
  return {
    primaryColor: tokens.brandColor,
    secondaryColor: tokens.mutedTextColor,
    ctaBackgroundColor: tokens.ctaBackgroundColor,
    ctaTextColor: tokens.ctaTextColor,
    ctaBorderRadiusPx: tokens.ctaBorderRadiusPx,
    emailBackgroundColor: tokens.emailBackgroundColor,
    emailTextColor: tokens.emailTextColor,
    linkColor: tokens.linkColor,
    emailFont: tokens.emailFont,
    fontFamilyRaw: tokens.fontFamilyRaw,
  };
}

export function listLayoutPresets(): Array<{
  id: string;
  name: string;
  description: string;
}> {
  return Object.values(LAYOUT_PRESET_CATALOG).map((preset) => ({
    id: preset.id,
    name: preset.name,
    description: preset.description,
  }));
}

/** Convenience map for picker thumbs — same tokens as the catalog. */
export const PRESET_THEMES: Record<string, EmailThemeTokens> = Object.fromEntries(
  Object.values(LAYOUT_PRESET_CATALOG).map((preset) => [
    preset.id,
    preset.tokens,
  ]),
);

export function isDarkHex(hex: string | null | undefined): boolean {
  if (!hex) return false;
  const n = hex.trim().toLowerCase();
  const m = n.match(/^#([0-9a-f]{6})$/);
  if (!m?.[1]) return false;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.35;
}

/** Recovery send surface — Day 0 / 2 / 5. Kit pick is BE Auto A/B. */
export const RECOVERY_SEQUENCE_STEPS = ["day0", "day2", "day5"] as const;
export type RecoverySequenceStep = (typeof RECOVERY_SEQUENCE_STEPS)[number];
export const DEFAULT_RECOVERY_SEQUENCE_STEP = "day0" as const;
export const RECOVERY_STEP_TEMPLATE = {
  day0: "gentle",
  day2: "direct",
  day5: "urgent",
} as const;

export function isRecoverySequenceStep(
  value: unknown,
): value is RecoverySequenceStep {
  return (
    typeof value === "string" &&
    (RECOVERY_SEQUENCE_STEPS as readonly string[]).includes(value)
  );
}

export function toBackendLayoutPresetId(
  layoutPresetId: string | null | undefined,
): string {
  return normalizeLayoutPresetId(layoutPresetId);
}

export function fromBackendLayoutPresetId(
  backendId: string | null | undefined,
  _localFeId?: string | null,
): LayoutPresetId {
  return resolveLayoutPresetId(backendId ?? "");
}

export function resolveRecoveryEmailTheme(
  step: RecoverySequenceStep,
  input: ResolveThemeInput,
): ResolvedEmailTheme & {
  step: RecoverySequenceStep;
  templateId: (typeof RECOVERY_STEP_TEMPLATE)[RecoverySequenceStep];
} {
  if (!isRecoverySequenceStep(step)) {
    throw new Error("Unknown recovery sequence step");
  }
  const theme = resolveTheme(input);
  return {
    ...theme,
    step,
    templateId: RECOVERY_STEP_TEMPLATE[step],
  };
}
