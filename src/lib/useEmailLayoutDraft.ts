import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadEmailLayoutDraft,
  writeEmailLayoutDraft,
  type EmailLayoutDraft,
} from "./emailLayoutDraft";
import { isStylingMode, type StylingMode } from "./emailLayoutPresets";
import { fromBackendLayoutPresetId } from "./emailTheme";

export type EmailLayoutServerTheme = {
  stylingMode?: string | null;
  layoutPresetId?: string | null;
};

/** Shared FE draft — one global recovery-layout + styling mode for Day 0 / 2 / 5. */
export function useEmailLayoutDraft(server?: EmailLayoutServerTheme | null) {
  const [draft, setDraftState] = useState(loadEmailLayoutDraft);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current || !server) return;
    const mode: StylingMode | null = isStylingMode(server.stylingMode)
      ? server.stylingMode
      : null;
    const hasLayout = Boolean(server.layoutPresetId?.trim());
    if (!mode && !hasLayout) return;
    hydratedRef.current = true;
    setDraftState((prev) => {
      const next: EmailLayoutDraft = {
        ...prev,
        ...(mode ? { stylingMode: mode } : {}),
        ...(hasLayout
          ? {
              layoutPresetId: fromBackendLayoutPresetId(
                server.layoutPresetId,
              ),
            }
          : {}),
      };
      writeEmailLayoutDraft(next);
      return next;
    });
  }, [server]);

  const setDraft = useCallback(
    (
      next:
        | EmailLayoutDraft
        | ((prev: EmailLayoutDraft) => EmailLayoutDraft),
    ) => {
      setDraftState((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        writeEmailLayoutDraft(resolved);
        return resolved;
      });
    },
    [],
  );

  return [draft, setDraft] as const;
}
