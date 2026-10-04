import type { ReactNode } from "react";
import { Check, Loader2, Plus, Redo2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type CustomizeDockVariant = "compact" | "full";

type Props = {
  visible: boolean;
  variant: CustomizeDockVariant;
  canUndo: boolean;
  canRedo: boolean;
  canSave: boolean;
  saving: boolean;
  showSaved: boolean;
  error: string | null;
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
  className,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
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
        className,
      )}
    >
      {children}
    </button>
  );
}

export default function CustomizeDock({
  visible,
  variant,
  canUndo,
  canRedo,
  canSave,
  saving,
  showSaved,
  error,
  onUndo,
  onRedo,
  onSave,
  onAdd,
}: Props) {
  const expanded = variant === "full";

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-5 transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-[120%] opacity-0",
      )}
      aria-hidden={!visible}
    >
      <div
        className={cn(
          "pointer-events-auto flex flex-col items-center gap-2 transition-opacity duration-300",
          visible ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        {error ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-800">
            {error}
          </p>
        ) : null}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "overflow-hidden transition-[max-width,opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
              expanded
                ? "max-w-[4.5rem] translate-x-0 opacity-100"
                : "max-w-0 -translate-x-2 opacity-0",
            )}
          >
            <DockIsland>
              <DockIconButton
                label="Undo (⌘Z)"
                disabled={!canUndo}
                onClick={onUndo}
              >
                <Undo2 className="size-3.5" />
              </DockIconButton>
            </DockIsland>
          </div>

          <DockIsland>
            <div className="relative flex items-center">
              <button
                type="button"
                disabled={!canSave && !saving}
                onClick={onSave}
                className={cn(
                  "relative z-20 inline-flex h-9 items-center justify-center rounded-sm px-4 text-[13px] font-medium tracking-[-0.015em] transition-colors",
                  canSave || saving
                    ? "cursor-pointer bg-[#08090a] text-[#f7f8f8] hover:bg-[#2a2b2e]"
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
              <DockIconButton
                label="Add block"
                onClick={onAdd}
                className={cn(
                  "transition-[transform,opacity,margin] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  expanded
                    ? "relative z-10 ml-0.5 translate-x-0 scale-100 opacity-100"
                    : "pointer-events-none absolute left-1/2 z-0 -translate-x-1/2 translate-y-0.5 scale-[0.88] opacity-35",
                )}
              >
                <Plus className="size-4" />
              </DockIconButton>
            </div>
          </DockIsland>

          <div
            className={cn(
              "overflow-hidden transition-[max-width,opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
              expanded
                ? "max-w-[4.5rem] translate-x-0 opacity-100"
                : "max-w-0 translate-x-2 opacity-0",
            )}
          >
            <DockIsland>
              <DockIconButton
                label="Redo (⌘⇧Z)"
                disabled={!canRedo}
                onClick={onRedo}
              >
                <Redo2 className="size-3.5" />
              </DockIconButton>
            </DockIsland>
          </div>
        </div>
      </div>
    </div>
  );
}
