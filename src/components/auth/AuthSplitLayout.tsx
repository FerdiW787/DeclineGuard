import type { ReactNode } from "react";

/** Light Linear auth shell — centered column, no chrome. */
export default function AuthSplitLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dg-shell light ln-surface min-h-dvh bg-[#f7f8f8] text-[#08090a]">
      <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-16">
        <div className="w-full max-w-[20.5rem] text-center">{children}</div>
      </main>
    </div>
  );
}
