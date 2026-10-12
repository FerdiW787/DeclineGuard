import type { ReactNode } from "react";

/** Light Linear auth shell — centered column, no chrome. */
export default function AuthSplitLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dg-shell light ln-surface min-h-dvh bg-background text-foreground">
      <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-16">
        <div className="w-full max-w-[20.5rem] text-center">{children}</div>
      </main>
    </div>
  );
}
