import { useAction, useConvex, useQuery } from "convex/react";
import { useCallback } from "react";
import { api } from "../../convex/_generated/api";
import {
  emailThemeRefs,
  type BrandImportResult,
  type EmailThemeSettings,
  type LifecycleEmailPreview,
} from "./emailThemeApi";
import {
  toBackendLayoutPresetId,
  type LifecycleEmailType,
  type StylingMode,
} from "./emailTheme";

/**
 * Optional Convex hooks. Safe when Riley’s functions are not generated yet
 * (`useQuery` / mutations are skipped). Requires ConvexProvider.
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

export function useLifecycleEmailThemeQuery(
  emailType: LifecycleEmailType | null,
): LifecycleEmailPreview | null | undefined {
  const ref = emailThemeRefs.getLifecycleEmailTheme();
  return useQuery(
    (ref ?? api.functions.recoverySettings.getSettings) as NonNullable<
      typeof ref
    >,
    ref && emailType ? { emailType } : "skip",
  );
}

export function useLifecycleEmailPreviewsQuery():
  | LifecycleEmailPreview[]
  | null
  | undefined {
  const ref = emailThemeRefs.getLifecycleEmailPreviews();
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
    async (stylingMode: StylingMode): Promise<EmailThemeSettings | null> => {
      const ref = emailThemeRefs.setStylingMode();
      if (!ref) return null;
      try {
        return await convex.mutation(ref, { stylingMode });
      } catch {
        return null;
      }
    },
    [convex],
  );
}

export function useSetLayoutPresetId() {
  const convex = useConvex();
  return useCallback(
    async (layoutPresetId: string): Promise<EmailThemeSettings | null> => {
      const ref = emailThemeRefs.setLayoutPresetId();
      if (!ref) return null;
      try {
        return await convex.mutation(ref, {
          layoutPresetId: toBackendLayoutPresetId(layoutPresetId),
        });
      } catch {
        return null;
      }
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
