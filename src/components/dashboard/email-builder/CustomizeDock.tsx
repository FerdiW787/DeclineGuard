import type { ReactNode } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Redo2,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  canGoLeft: boolean;
  canGoRight: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canSave: boolean;
  saving: boolean;
  showSaved: boolean;
  error: string | null;
  onGoLeft: () => void;
  onGoRight: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onAdd: () => void;
};

function DockIsland({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-0.5 rounded border border-black/8 bg-white/90 p-1 shadow-[0_10px_36px_-16px_rgba(8,9,10,0.35)] backdrop-blur-xl">
      {children}
    </div>
  );
}

function DockIconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-sm transition-colors",
        disabled
          ? "cursor-not-allowed text-black/20"
          : "cursor-pointer text-[#6b6f76] hover:bg-black/5 hover:text-[#08090a]",
      )}
    >
      {children}
    </button>
  );
}

export default function CustomizeDock({
  canGoLeft,
  canGoRight,
  canUndo,
  canRedo,
  canSave,
  saving,
  showSaved,
  error,
  onGoLeft,
  onGoRight,
  onUndo,
  onRedo,
  onSave,
  onAdd,
}: Props) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-5">
      <div className="pointer-events-auto flex flex-col items-center gap-2">
        {error ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-800">
            {error}
          </p>
        ) : null}
        <div className="flex items-center gap-2">
          <DockIsland>
            <DockIconButton
              label="Previous email"
              disabled={!canGoLeft}
              onClick={onGoLeft}
            >
              <ChevronLeft className="size-4" />
            </DockIconButton>
            <DockIconButton
              label="Undo (⌘Z)"
              disabled={!canUndo}
              onClick={onUndo}
            >
              <Undo2 className="size-3.5" />
            </DockIconButton>
          </DockIsland>

          <DockIsland>
            <button
              type="button"
              disabled={!canSave}
              onClick={onSave}
              className={cn(
                "inline-flex h-9 items-center justify-center rounded-sm px-4 text-[13px] font-medium tracking-[-0.015em] transition-colors",
                canSave
                  ? "cursor-pointer bg-[#08090a] text-[#f7f8f8] hover:bg-[#2a2b2e]"
                  : saving
                    ? "cursor-wait bg-[#08090a] text-[#f7f8f8]"
                    : "cursor-not-allowed bg-black/8 text-black/30",
              )}
            >
              <span
                className={cn(
                  "inline-flex overflow-hidden transition-[max-width,opacity,margin]",
                  saving
                    ? "mr-1.5 max-w-3.5 opacity-100"
                    : "mr-0 max-w-0 opacity-0",
                )}
                aria-hidden
              >
                <Loader2
                  className={cn("size-3.5 shrink-0", saving && "animate-spin")}
                />
              </span>
              {showSaved && !saving ? (
                <span className="inline-flex items-center gap-1">
                  <Check className="size-3.5" aria-hidden />
                  Saved
                </span>
              ) : (
                "Save"
              )}
            </button>
            <DockIconButton label="Add" onClick={onAdd}>
              <Plus className="size-4" />
            </DockIconButton>
          </DockIsland>

          <DockIsland>
            <DockIconButton
              label="Redo (⌘⇧Z)"
              disabled={!canRedo}
              onClick={onRedo}
            >
              <Redo2 className="size-3.5" />
            </DockIconButton>
            <DockIconButton
              label="Next email"
              disabled={!canGoRight}
              onClick={onGoRight}
            >
              <ChevronRight className="size-4" />
            </DockIconButton>
          </DockIsland>
        </div>
      </div>
    </div>
  );
}
