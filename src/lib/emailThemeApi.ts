/**
 * Typed wrappers for the Convex recovery theme API.
 * Refs: getRecoveryEmailTheme / getRecoveryEmailPreviews / recoverySequenceSteps.
 */

import { api } from "../../convex/_generated/api";
import type { FunctionReference, FunctionReturnType } from "convex/server";
import type {
  EmailThemeTokens,
  RecoverySequenceStep,
  ResolvedEmailTheme,
  StylingMode,
} from "./emailTheme";

export type EmailThemeSettings = {
  stylingMode: StylingMode;
  layoutPresetId: string;
  resolved: ResolvedEmailTheme;
  catalog: Array<{ id: string; name: string; description: string }>;
  recoverySequenceSteps: RecoverySequenceStep[];
  storefrontDomain: string | null;
  crawlDomain: string | null;
  brandDomain: string | null;
  brandImportCompletedAt: number | null;
  configuredTokens: EmailThemeTokens;
  quota: unknown;
};

export type RecoveryEmailPreview = {
  step: RecoverySequenceStep;
  templateId: "gentle" | "direct" | "urgent";
  stylingMode: StylingMode;
  layoutPresetId: string;
  tokens: EmailThemeTokens;
  subject: string;
  html: string;
  text: string;
};

type RecoverySettingsBag = typeof api.functions.recoverySettings & {
  getEmailTheme?: FunctionReference<
    "query",
    "public",
    Record<string, never>,
    EmailThemeSettings | null
  >;
  getRecoveryEmailTheme?: FunctionReference<
    "query",
    "public",
    { step: RecoverySequenceStep },
    RecoveryEmailPreview | null
  >;
  getRecoveryEmailPreviews?: FunctionReference<
    "query",
    "public",
    Record<string, never>,
    RecoveryEmailPreview[] | null
  >;
  setStylingMode?: FunctionReference<
    "mutation",
    "public",
    { stylingMode: StylingMode },
    EmailThemeSettings
  >;
  setLayoutPresetId?: FunctionReference<
    "mutation",
    "public",
    { layoutPresetId: string },
    EmailThemeSettings
  >;
};

export type BrandImportResult = FunctionReturnType<
  typeof api.functions.brandImportActions.importBrandFromDomain
>;

type BrandImportBag = typeof api.functions.brandImportActions & {
  importBrandFromStorefront?: FunctionReference<
    "action",
    "public",
    { domain?: string },
    BrandImportResult
  >;
};

function recoverySettingsApi(): RecoverySettingsBag {
  return api.functions.recoverySettings as RecoverySettingsBag;
}

function brandImportApi(): BrandImportBag {
  return api.functions.brandImportActions as BrandImportBag;
}

export const emailThemeRefs = {
  getEmailTheme: () => recoverySettingsApi().getEmailTheme ?? null,
  getRecoveryEmailTheme: () =>
    recoverySettingsApi().getRecoveryEmailTheme ?? null,
  getRecoveryEmailPreviews: () =>
    recoverySettingsApi().getRecoveryEmailPreviews ?? null,
  setStylingMode: () => recoverySettingsApi().setStylingMode ?? null,
  setLayoutPresetId: () => recoverySettingsApi().setLayoutPresetId ?? null,
  importBrandFromStorefront: () =>
    brandImportApi().importBrandFromStorefront ?? null,
};

export function emailThemeApiLive(): boolean {
  return emailThemeRefs.getEmailTheme() != null;
}
