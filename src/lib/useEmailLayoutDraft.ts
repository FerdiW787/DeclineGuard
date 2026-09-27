import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadEmailLayoutDraft,
  writeEmailLayoutDraft,
  type EmailLayoutDraft,
} from "./emailLayoutDraft";
import {
  isStylingMode,
  resolveLayoutPresetId,
  type StylingMode,
} from "./emailLayoutPresets";

export type EmailLayoutServerTheme = {
  stylingMode?: string | null;
  layoutPresetId?: string | null;
};

/** Shared FE draft — one global layout + styling mode for all lifecycle emails. */
export function useEmailLayoutDraft(server?: EmailLayoutServerTheme | null) {
  const [draft, setDraftState] = useState(loadEmailLayoutDraft);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current || !server) return;
    const mode: StylingMode | null = isStylingMode(server.stylingMode)
      ? server.stylingMode
      : null;
    const layout = server.layoutPresetId
      ? resolveLayoutPresetId(server.layoutPresetId)
      : null;
    if (!mode && !layout) return;
    hydratedRef.current = true;
    setDraftState((prev) => {
      const next: EmailLayoutDraft = {
        ...prev,
        ...(mode ? { stylingMode: mode } : {}),
        ...(layout ? { layoutPresetId: layout } : {}),
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
