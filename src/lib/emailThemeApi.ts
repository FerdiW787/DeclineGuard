/**
 * Typed wrappers for Riley’s Convex theme API.
 * Names match recoverySettings / brandImportActions after their merge.
 * Refs are optional until `api` is regenerated on `dev`.
 */

import { api } from "../../convex/_generated/api";
import type { FunctionReference, FunctionReturnType } from "convex/server";
import type {
  EmailThemeTokens,
  LifecycleEmailType,
  ResolvedEmailTheme,
  StylingMode,
} from "./emailTheme";

export type EmailThemeSettings = {
  stylingMode: StylingMode;
  layoutPresetId: string;
  resolved: ResolvedEmailTheme;
  catalog: Array<{ id: string; name: string; description: string }>;
  lifecycleEmailTypes: LifecycleEmailType[];
  storefrontDomain: string | null;
  crawlDomain: string | null;
  brandDomain: string | null;
  brandImportCompletedAt: number | null;
  configuredTokens: EmailThemeTokens;
  quota: unknown;
};

export type LifecycleEmailPreview = {
  emailType: LifecycleEmailType;
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
  getLifecycleEmailTheme?: FunctionReference<
    "query",
    "public",
    { emailType: LifecycleEmailType },
    LifecycleEmailPreview | null
  >;
  getLifecycleEmailPreviews?: FunctionReference<
    "query",
    "public",
    Record<string, never>,
    LifecycleEmailPreview[] | null
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

/** Riley query/mutation/action refs — null until generated on this branch. */
export const emailThemeRefs = {
  getEmailTheme: () => recoverySettingsApi().getEmailTheme ?? null,
  getLifecycleEmailTheme: () =>
    recoverySettingsApi().getLifecycleEmailTheme ?? null,
  getLifecycleEmailPreviews: () =>
    recoverySettingsApi().getLifecycleEmailPreviews ?? null,
  setStylingMode: () => recoverySettingsApi().setStylingMode ?? null,
  setLayoutPresetId: () => recoverySettingsApi().setLayoutPresetId ?? null,
  importBrandFromStorefront: () =>
    brandImportApi().importBrandFromStorefront ?? null,
};

export function emailThemeApiLive(): boolean {
  return emailThemeRefs.getEmailTheme() != null;
}
