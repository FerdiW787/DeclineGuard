import { useEffect, useState } from "react";
import WelcomeIntro from "./WelcomeIntro";
import { HeroLinear } from "./HeroLinear";
import { HomePageContent } from "./HomePageContent";
import { HomePageFaq, HomePageFinalCta, HomePageFooter } from "./HomePageBento";

export default function HomePage({ welcome = false }: { welcome?: boolean }) {
  const [welcomeDone, setWelcomeDone] = useState(!welcome);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.classList.add("ln-home-lock-x");
    body.classList.add("ln-home-lock-x");

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
    };
    const onScroll = (event: Event) => {
      if (window.scrollX !== 0) {
        window.scrollTo(0, window.scrollY);
      }
      const target = event.target;
      if (target instanceof Element && target.scrollLeft !== 0) {
        target.scrollLeft = 0;
      }
      html.scrollLeft = 0;
      body.scrollLeft = 0;
    };

    document.addEventListener("wheel", onWheel, {
      passive: false,
      capture: true,
    });
    document.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });

    return () => {
      html.classList.remove("ln-home-lock-x");
      body.classList.remove("ln-home-lock-x");
      document.removeEventListener("wheel", onWheel, true);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  return (
    <div className="ln-surface ln-home-lock-x min-h-screen overflow-x-clip bg-white text-[#08090a]">
      {welcome && !welcomeDone ? (
        <WelcomeIntro active onComplete={() => setWelcomeDone(true)} />
      ) : null}

      <main className="relative overflow-x-clip">
        <HeroLinear />
        <HomePageContent />
        <HomePageFaq />
        <HomePageFinalCta />
        <HomePageFooter />
      </main>
    </div>
  );
}
