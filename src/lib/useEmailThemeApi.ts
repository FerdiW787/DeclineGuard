import { useAction, useConvex, useQuery } from "convex/react";
import { useCallback } from "react";
import { api } from "../../convex/_generated/api";
import {
  emailThemeRefs,
  type BrandImportResult,
  type EmailThemeSettings,
  type RecoveryEmailPreview,
} from "./emailThemeApi";
import {
  toBackendLayoutPresetId,
  type RecoverySequenceStep,
  type StylingMode,
} from "./emailTheme";

/**
 * Convex hooks for recovery theme. Persist mutations throw so callers
 * can surface errors (do not swallow to null).
 */

export function useEmailThemeQuery(): EmailThemeSettings | null | undefined {
  const ref = emailThemeRefs.getEmailTheme();
  return useQuery(
    (ref ?? api.functions.recoverySettings.getSettings) as NonNullable<
      typeof ref
    >,
    ref ? {} : "skip",
  );
}

export function useRecoveryEmailThemeQuery(
  step: RecoverySequenceStep | null,
): RecoveryEmailPreview | null | undefined {
  const ref = emailThemeRefs.getRecoveryEmailTheme();
  return useQuery(
    (ref ?? api.functions.recoverySettings.getSettings) as NonNullable<
      typeof ref
    >,
    ref && step ? { step } : "skip",
  );
}

export function useRecoveryEmailPreviewsQuery():
  | RecoveryEmailPreview[]
  | null
  | undefined {
  const ref = emailThemeRefs.getRecoveryEmailPreviews();
  return useQuery(
    (ref ?? api.functions.recoverySettings.getSettings) as NonNullable<
      typeof ref
    >,
    ref ? {} : "skip",
  );
}

export function useSetStylingMode() {
  const convex = useConvex();
  return useCallback(
    async (stylingMode: StylingMode): Promise<EmailThemeSettings> => {
      const ref = emailThemeRefs.setStylingMode();
      if (!ref) {
        throw new Error("setStylingMode is not available");
      }
      return await convex.mutation(ref, { stylingMode });
    },
    [convex],
  );
}

export function useSetLayoutPresetId() {
  const convex = useConvex();
  return useCallback(
    async (layoutPresetId: string): Promise<EmailThemeSettings> => {
      const ref = emailThemeRefs.setLayoutPresetId();
      if (!ref) {
        throw new Error("setLayoutPresetId is not available");
      }
      return await convex.mutation(ref, {
        layoutPresetId: toBackendLayoutPresetId(layoutPresetId),
      });
    },
    [convex],
  );
}

export function useImportBrandFromStorefront() {
  const convex = useConvex();
  const fallback = useAction(
    api.functions.brandImportActions.importBrandFromDomain,
  );
  return useCallback(
    async (args: { domain?: string } = {}): Promise<BrandImportResult> => {
      const domain = args.domain?.trim();
      const ref = emailThemeRefs.importBrandFromStorefront();
      if (ref) {
        return await convex.action(ref, domain ? { domain } : {});
      }
      if (!domain) {
        throw new Error(
          "No Lemon storefront URL on this store. Reconnect Lemon Squeezy or pass a domain override.",
        );
      }
      return await fallback({ domain });
    },
    [convex, fallback],
  );
}

export function usePersistEmailTheme() {
  const setMode = useSetStylingMode();
  const setLayout = useSetLayoutPresetId();
  return useCallback(
    async (patch: {
      stylingMode?: StylingMode;
      layoutPresetId?: string;
    }): Promise<void> => {
      if (patch.stylingMode) await setMode(patch.stylingMode);
      if (patch.layoutPresetId) await setLayout(patch.layoutPresetId);
    },
    [setLayout, setMode],
  );
}
