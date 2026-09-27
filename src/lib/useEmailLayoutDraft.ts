import { useCallback, useState } from "react";
import {
  loadEmailLayoutDraft,
  writeEmailLayoutDraft,
  type EmailLayoutDraft,
} from "./emailLayoutDraft";

/** Shared FE draft — one global layout + styling mode for all lifecycle emails. */
export function useEmailLayoutDraft() {
  const [draft, setDraftState] = useState(loadEmailLayoutDraft);

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
