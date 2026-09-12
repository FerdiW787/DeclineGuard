import { Bold } from "lucide-react";
import { COPY_TOKENS } from "@/lib/recoveryEmailCopy";

type Props = {
  onBold: () => void;
  onInsertToken: (token: string) => void;
};

export default function TextFormatToolbar({ onBold, onInsertToken }: Props) {
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-black/10 bg-white px-1.5 py-1 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.35)]">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onBold}
        className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-black/70 transition-colors hover:bg-black/5 hover:text-black"
        title="Bold selection"
        aria-label="Bold"
      >
        <Bold className="size-3.5" />
      </button>
      <span className="mx-0.5 h-4 w-px bg-black/10" aria-hidden />
      {COPY_TOKENS.map((t) => (
        <button
          key={t.token}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onInsertToken(t.token)}
          className="cursor-pointer rounded-md px-1.5 py-1 font-mono text-[10px] text-black/55 transition-colors hover:bg-black/5 hover:text-black"
          title={`Insert ${t.token}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
