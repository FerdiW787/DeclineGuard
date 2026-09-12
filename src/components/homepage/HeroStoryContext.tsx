import { createContext, useContext, type ReactNode } from "react";
import type { HeroStoryBeat } from "./heroStory";

const HeroStoryContext = createContext<HeroStoryBeat>(0);

export function HeroStoryProvider({
  beat,
  children,
}: {
  beat: HeroStoryBeat;
  children: ReactNode;
}) {
  return (
    <HeroStoryContext.Provider value={beat}>{children}</HeroStoryContext.Provider>
  );
}

export function useHeroStoryBeat(): HeroStoryBeat {
  return useContext(HeroStoryContext);
}
