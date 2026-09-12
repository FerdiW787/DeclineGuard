import { createContext, useContext, type ReactNode } from "react";

const MarketingDesktopContext = createContext(false);

/** True when product pages should use full desktop layouts inside the hero mock. */
export function useMarketingDesktop() {
  return useContext(MarketingDesktopContext);
}

export function MarketingDesktopProvider({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <MarketingDesktopContext.Provider value={active}>
      {children}
    </MarketingDesktopContext.Provider>
  );
}

/**
 * Extra utilities applied only in the hero mock (no media query).
 * Keep the matching `xl:` / `lg:` class literals in the call site so Tailwind
 * can scan them — this helper must not build `xl:` strings at runtime.
 */
export function whenDesktop(desktopPreview: boolean, classes: string) {
  return desktopPreview ? classes : "";
}
