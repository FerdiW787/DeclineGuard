import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { MarketingProductTab } from "@/components/homepage/marketing/MarketingProductPreview";
import { LinearNav } from "./LinearNav";
import { LinearHero } from "./sections/LinearHero";
import { LinearGuardian } from "./sections/LinearGuardian";
import { LinearFeatures } from "./sections/LinearFeatures";
import { LinearHowItWorks } from "./sections/LinearHowItWorks";
import { LinearTrust } from "./sections/LinearTrust";
import { LinearFaq } from "./sections/LinearFaq";
import { LinearFinalCta } from "./sections/LinearFinalCta";
import { LinearFooter } from "./sections/LinearFooter";
import "./linear.css";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export default function HomePageLinear() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<MarketingProductTab>("dashboard");

  useGSAP(
    () => {
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      ScrollTrigger.batch(".ln-reveal", {
        start: "top 90%",
        once: true,
        onEnter: (elements) => {
          gsap.from(elements, {
            y: reduce ? 0 : 160,
            opacity: 0,
            duration: reduce ? 0.01 : 0.45,
            stagger: 0.04,
            ease: "power3.out",
            overwrite: true,
          });
        },
      });

      const guardian = rootRef.current?.querySelector(".dg-guardian");
      const fistLeft = rootRef.current?.querySelector(".dg-fist-left");
      const fistRight = rootRef.current?.querySelector(".dg-fist-right");
      if (guardian && fistLeft && fistRight) {
        gsap.set(fistLeft, { xPercent: reduce ? 0 : -22 });
        gsap.set(fistRight, { xPercent: reduce ? 0 : 22 });
        if (!reduce) {
          gsap
            .timeline({
              scrollTrigger: {
                trigger: guardian,
                start: "top 85%",
                end: "center 50%",
                scrub: 1.2,
              },
            })
            .to(fistLeft, { xPercent: 0, ease: "none" }, 0)
            .to(fistRight, { xPercent: 0, ease: "none" }, 0);
        }
      }
    },
    { scope: rootRef, revertOnUpdate: true },
  );

  return (
    <div ref={rootRef} className="ln-home min-h-screen overflow-x-hidden bg-[#f7f8f8] text-[#08090a]">
      <LinearNav />
      <main>
        <LinearHero tab={tab} onTabChange={setTab} />
        <LinearGuardian />
        <LinearFeatures tab={tab} onTabChange={setTab} />
        <LinearHowItWorks />
        <LinearTrust />
        <LinearFaq />
        <LinearFinalCta />
        <LinearFooter />
      </main>
    </div>
  );
}
