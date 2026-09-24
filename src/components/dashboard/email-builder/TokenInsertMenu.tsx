import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  x: number;
  y: number;
  flipUp?: boolean;
  onInsertAmount: () => void;
  onInsertProduct: () => void;
};

export default function TokenInsertMenu({
  x,
  y,
  flipUp = false,
  onInsertAmount,
  onInsertProduct,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    setReady(true);
  }, []);

  const height = wrapRef.current?.offsetHeight ?? 40;
  const top = flipUp ? y - height : y;

  return createPortal(
    <div
      ref={wrapRef}
      className="pointer-events-auto fixed z-[80]"
      style={{
        left: x,
        top,
        transition: ready
          ? "left 180ms cubic-bezier(0.22, 1, 0.36, 1), top 180ms cubic-bezier(0.22, 1, 0.36, 1)"
          : "none",
      }}
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="dg-format-in origin-top">
        <div className="flex items-center gap-0.5 rounded border border-black/8 bg-white p-1 shadow-[0_10px_36px_-16px_rgba(8,9,10,0.35)]">
          <button
            type="button"
            onClick={onInsertAmount}
            className="h-8 rounded-sm px-2.5 text-[12px] font-medium tracking-tight text-[#08090a] transition-colors hover:bg-black/5"
          >
            Insert amount
          </button>
          <span className="mx-0.5 h-4 w-px bg-black/8" aria-hidden />
          <button
            type="button"
            onClick={onInsertProduct}
            className="h-8 rounded-sm px-2.5 text-[12px] font-medium tracking-tight text-[#08090a] transition-colors hover:bg-black/5"
          >
            Insert product name
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
