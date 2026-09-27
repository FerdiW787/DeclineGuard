import { v } from "convex/values";
import {
  DEFAULT_EMAIL_FONT,
  emailFontValidator,
  normalizeEmailFont,
  type EmailFontId,
} from "./emailFonts";

/**
 * Shared recovery-email theme contract for Jules + send paths.
 *
 * Import:
 *   import { resolveTheme, type EmailThemeTokens } from "../../convex/lib/emailTheme";
 *
 * One global `layoutPresetId` selects layout structure for the 3 recovery
 * emails (Day 0 / Day 2 / Day 5). `stylingMode` only swaps token source:
 * catalog (preset) vs merchant BrandKit (configured). Token field names match
 * recoverySettings / BrandKit — do not invent a parallel alias set.
 */

export const STYLING_MODES = ["preset", "configured"] as const;
export type StylingMode = (typeof STYLING_MODES)[number];

/** Five layout templates (RGE structural refs). IDs describe layout, not product emails. */
export const LAYOUT_PRESET_IDS = [
  "sonos",
  "avocode",
  "benchmark",
  "fontbase",
  "nordvpn-structure",
] as const;

export type LayoutPresetId = (typeof LAYOUT_PRESET_IDS)[number];

export const SONOS_LAYOUT_ID: LayoutPresetId = "sonos";
export const DEFAULT_LAYOUT_PRESET_ID: LayoutPresetId = SONOS_LAYOUT_ID;

/** Recovery sequence only — the sole themed email surface. */
export const RECOVERY_SEQUENCE_STEPS = ["day0", "day2", "day5"] as const;
export type RecoverySequenceStep = (typeof RECOVERY_SEQUENCE_STEPS)[number];

export const RECOVERY_STEP_TEMPLATE = {
  day0: "gentle",
  day2: "direct",
  day5: "urgent",
} as const;

export const stylingModeValidator = v.union(
  v.literal("preset"),
  v.literal("configured"),
);

export const layoutPresetIdValidator = v.union(
  v.literal("sonos"),
  v.literal("avocode"),
  v.literal("benchmark"),
  v.literal("fontbase"),
  v.literal("nordvpn-structure"),
);

export const recoverySequenceStepValidator = v.union(
  v.literal("day0"),
  v.literal("day2"),
  v.literal("day5"),
);

/**
 * Visual tokens applied to recovery emails.
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

export const emailThemeTokensValidator = v.object({
  brandColor: v.string(),
  secondaryColor: v.string(),
  mutedTextColor: v.string(),
  linkColor: v.string(),
  pageBackgroundColor: v.string(),
  pageTextColor: v.string(),
  emailBackgroundColor: v.string(),
  emailTextColor: v.string(),
  ctaBackgroundColor: v.string(),
  ctaTextColor: v.string(),
  ctaBorderRadiusPx: v.number(),
  emailFont: emailFontValidator,
  fontFamilyRaw: v.union(v.string(), v.null()),
});

function layoutTokens(
  partial: Omit<EmailThemeTokens, "fontFamilyRaw"> & {
    fontFamilyRaw?: string | null;
  },
): EmailThemeTokens {
  return {
    ...partial,
    fontFamilyRaw: partial.fontFamilyRaw ?? null,
  };
}

/** Sonos — warm, quiet, editorial whitespace. */
export const SONOS_TOKENS: EmailThemeTokens = layoutTokens({
  brandColor: "#1a1a1a",
  secondaryColor: "#6f6b66",
  mutedTextColor: "#6f6b66",
  linkColor: "#1a1a1a",
  pageBackgroundColor: "#f7f5f2",
  pageTextColor: "#1a1a1a",
  emailBackgroundColor: "#f7f5f2",
  emailTextColor: "#1a1a1a",
  ctaBackgroundColor: "#1a1a1a",
  ctaTextColor: "#f7f5f2",
  ctaBorderRadiusPx: 4,
  emailFont: "georgia",
});

export type LayoutPreset = {
  id: LayoutPresetId;
  name: string;
  description: string;
  tokens: EmailThemeTokens;
};

export const LAYOUT_PRESET_CATALOG: Record<LayoutPresetId, LayoutPreset> = {
  sonos: {
    id: "sonos",
    name: "Sonos",
    description:
      "Sonos-structure recovery layout: warm paper, quiet type, Day 0/2/5.",
    tokens: SONOS_TOKENS,
  },
  avocode: {
    id: "avocode",
    name: "Avocode",
    description:
      "Avocode-structure recovery layout: cool product chrome, compact CTA.",
    tokens: layoutTokens({
      brandColor: "#2b4c7e",
      secondaryColor: "#6b7380",
      mutedTextColor: "#6b7380",
      linkColor: "#2b4c7e",
      pageBackgroundColor: "#f4f6f8",
      pageTextColor: "#1c2430",
      emailBackgroundColor: "#f4f6f8",
      emailTextColor: "#1c2430",
      ctaBackgroundColor: "#2b4c7e",
      ctaTextColor: "#f4f6f8",
      ctaBorderRadiusPx: 6,
      emailFont: "inter",
    }),
  },
  benchmark: {
    id: "benchmark",
    name: "Benchmark",
    description:
      "Benchmark-structure recovery layout: newsletter block, teal accent.",
    tokens: layoutTokens({
      brandColor: "#1f6f5b",
      secondaryColor: "#5f6f68",
      mutedTextColor: "#5f6f68",
      linkColor: "#1f6f5b",
      pageBackgroundColor: "#f3f7f5",
      pageTextColor: "#1a2a24",
      emailBackgroundColor: "#f3f7f5",
      emailTextColor: "#1a2a24",
      ctaBackgroundColor: "#1f6f5b",
      ctaTextColor: "#f3f7f5",
      ctaBorderRadiusPx: 8,
      emailFont: "system",
    }),
  },
  fontbase: {
    id: "fontbase",
    name: "FontBase",
    description:
      "FontBase-structure recovery layout: cream page, typographic ink.",
    tokens: layoutTokens({
      brandColor: "#2c241c",
      secondaryColor: "#7a7268",
      mutedTextColor: "#7a7268",
      linkColor: "#2c241c",
      pageBackgroundColor: "#f3efe6",
      pageTextColor: "#2c241c",
      emailBackgroundColor: "#f3efe6",
      emailTextColor: "#2c241c",
      ctaBackgroundColor: "#2c241c",
      ctaTextColor: "#f3efe6",
      ctaBorderRadiusPx: 2,
      emailFont: "merriweather",
    }),
  },
  "nordvpn-structure": {
    id: "nordvpn-structure",
    name: "NordVPN structure",
    description:
      "NordVPN-structure recovery layout: cool navy stack, structured sections.",
    tokens: layoutTokens({
      brandColor: "#1b2332",
      secondaryColor: "#5c6573",
      mutedTextColor: "#5c6573",
      linkColor: "#3d6df2",
      pageBackgroundColor: "#eef1f6",
      pageTextColor: "#1b2332",
      emailBackgroundColor: "#eef1f6",
      emailTextColor: "#1b2332",
      ctaBackgroundColor: "#1b2332",
      ctaTextColor: "#eef1f6",
      ctaBorderRadiusPx: 10,
      emailFont: "dm-sans",
    }),
  },
};

/** Legacy Quiet Verify rows / writes map onto Sonos. */
const LEGACY_LAYOUT_PRESET_IDS: Record<string, LayoutPresetId> = {
  "quiet-verify": "sonos",
  quiet_verify: "sonos",
};

export const NEW_MERCHANT_THEME_DEFAULTS = {
  stylingMode: "preset" as const,
  layoutPresetId: DEFAULT_LAYOUT_PRESET_ID,
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

export function isStylingMode(value: unknown): value is StylingMode {
  return value === "preset" || value === "configured";
}

export function isLayoutPresetId(value: unknown): value is LayoutPresetId {
  return (
    typeof value === "string" &&
    (LAYOUT_PRESET_IDS as readonly string[]).includes(value)
  );
}

export function isRecoverySequenceStep(
  value: unknown,
): value is RecoverySequenceStep {
  return (
    typeof value === "string" &&
    (RECOVERY_SEQUENCE_STEPS as readonly string[]).includes(value)
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
): LayoutPresetId {
  const raw = value?.trim() ?? "";
  const mapped = LEGACY_LAYOUT_PRESET_IDS[raw] ?? raw;
  if (isLayoutPresetId(mapped)) return mapped;
  return DEFAULT_LAYOUT_PRESET_ID;
}

export function getLayoutPreset(layoutPresetId: string): LayoutPreset {
  const id = normalizeLayoutPresetId(layoutPresetId);
  return LAYOUT_PRESET_CATALOG[id];
}

export function assertKnownLayoutPresetId(value: string): LayoutPresetId {
  const raw = value.trim();
  const mapped = LEGACY_LAYOUT_PRESET_IDS[raw] ?? raw;
  if (!isLayoutPresetId(mapped)) {
    throw new Error(
      `Unknown layout preset. Valid ids: ${LAYOUT_PRESET_IDS.join(", ")}`,
    );
  }
  return mapped;
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
 * Resolve tokens for recovery send + preview.
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

/**
 * Infer mode for rows created before stylingMode existed.
 * Unset → configured (legacy preserve). New merchants write explicit preset.
 */
export function inferStylingMode(row: {
  stylingMode?: string | null;
  brandImportCompletedAt?: number | null;
}): StylingMode {
  if (isStylingMode(row.stylingMode)) return row.stylingMode;
  return "configured";
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

/** Theme + recovery step. Same tokens for Day 0 / 2 / 5; layout from layoutPresetId. */
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

/** Map resolved tokens onto buildRecoveryEmail color inputs. */
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

export const catalogSummaryValidator = v.array(
  v.object({
    id: v.string(),
    name: v.string(),
    description: v.string(),
  }),
);

export function listLayoutPresets(): Array<{
  id: string;
  name: string;
  description: string;
}> {
  return LAYOUT_PRESET_IDS.map((id) => {
    const preset = LAYOUT_PRESET_CATALOG[id];
    return {
      id: preset.id,
      name: preset.name,
      description: preset.description,
    };
  });
}

export const resolvedEmailThemeValidator = v.object({
  stylingMode: stylingModeValidator,
  layoutPresetId: v.string(),
  tokens: emailThemeTokensValidator,
});
