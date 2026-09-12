import { useCallback, useRef, useState } from "react";
import { SignedIn, SignedOut } from "@clerk/astro/react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import WelcomeIntro from "./WelcomeIntro";
import {
  AskCard,
  EmailCard,
  FailedCard,
  Glass,
  RecoveredCard,
} from "./HeroInteractiveCards";

gsap.registerPlugin(useGSAP, ScrollTrigger);

function skyTargets(): HTMLElement[] {
  return [
    document.querySelector<HTMLElement>(".dg-fluid-host"),
    document.querySelector<HTMLElement>(".dg-mega-brand"),
  ].filter((el): el is HTMLElement => el != null);
}

export default function ScrollHero({ welcome = false }: { welcome?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const [welcomeDone, setWelcomeDone] = useState(!welcome);

  const onWelcomeComplete = useCallback(() => {
    setWelcomeDone(true);
    requestAnimationFrame(() => ScrollTrigger.refresh());
  }, []);

  useGSAP(
    () => {
      const hero = heroRef.current;
      if (!hero) return;

      const mm = gsap.matchMedia();

      mm.add(
        "(min-width: 900px) and (prefers-reduced-motion: no-preference)",
        () => {
          const sky = skyTargets();
          gsap.set(sky, {
            clearProps: "y",
            opacity: 0.5,
            visibility: "visible",
          });

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: hero,
              start: "top top",
              end: "+=280%",
              pin: true,
              scrub: 1.15,
              anticipatePin: 1,
            },
          });

          // Left cluster = yellow · right cluster = purple · rate = both
          const yellowShadow =
            "0 20px 50px -24px rgba(234, 179, 8, 0.45)";
          const yellowMid =
            "0 10px 28px -18px rgba(234, 179, 8, 0.22)";
          const yellowSoft =
            "0 4px 12px -10px rgba(234, 179, 8, 0.1)";
          const purpleShadow =
            "0 20px 50px -24px rgba(168, 85, 247, 0.42)";
          const purpleMid =
            "0 10px 28px -18px rgba(168, 85, 247, 0.2)";
          const purpleSoft =
            "0 4px 12px -10px rgba(168, 85, 247, 0.08)";
          const mixShadow =
            "-16px 18px 44px -22px rgba(234, 179, 8, 0.48), 16px 18px 44px -22px rgba(168, 85, 247, 0.45)";
          const mixMid =
            "-10px 12px 28px -18px rgba(234, 179, 8, 0.24), 10px 12px 28px -18px rgba(168, 85, 247, 0.22)";
          const mixSoft =
            "-4px 6px 14px -10px rgba(234, 179, 8, 0.12), 4px 6px 14px -10px rgba(168, 85, 247, 0.1)";
          const noShadow = "0 0 0 0 rgba(0, 0, 0, 0)";
          const noMixShadow =
            "0 0 0 0 rgba(0, 0, 0, 0), 0 0 0 0 rgba(0, 0, 0, 0)";

          gsap.set(".dg-hero-copy", { opacity: 1 });
          gsap.set(".dg-mega-brand", { opacity: 1 });
          gsap.set(".dg-dash-shell", { opacity: 0 });
          gsap.set(".dg-dash-frame", {
            backgroundColor: "rgba(255,255,255,0)",
            borderColor: "rgba(0,0,0,0)",
            boxShadow: "0 0 0 0 rgba(0,0,0,0)",
          });
          gsap.set(".dg-dash-stage", { y: 40, scale: 1 });
          // scale:1 + force3D:false keeps text crisp (scaled GPU layers go soft)
          gsap.set(".dg-fly-recovered", {
            x: "-32vw",
            y: "-12vh",
            scale: 1,
            rotate: -8,
            force3D: false,
            boxShadow: yellowShadow,
          });
          gsap.set(".dg-fly-email", {
            x: "36vw",
            y: "-15vh",
            scale: 1,
            rotate: -9,
            force3D: false,
            boxShadow: purpleShadow,
          });
          gsap.set(".dg-fly-failed", {
            x: "-43vw",
            y: "13vh",
            scale: 1,
            rotate: 7,
            force3D: false,
            boxShadow: yellowShadow,
          });
          gsap.set(".dg-fly-ask", {
            x: "20vw",
            y: "38vh",
            scale: 1,
            rotate: -8,
            force3D: false,
            boxShadow: purpleShadow,
          });
          gsap.set(".dg-fly-rate", {
            x: "-24vw",
            y: "8vh",
            scale: 1,
            rotate: 7,
            force3D: false,
            boxShadow: mixShadow,
          });
          gsap.set(".dg-fly-cursor", { opacity: 0 });

          tl.to(
            ".dg-hero-copy",
            {
              opacity: 0,
              duration: 0.35,
              ease: "power2.inOut",
            },
            0,
          )
            .to(
              ".dg-dash-stage",
              { y: 0, duration: 0.5, ease: "power2.out" },
              0.08,
            )
            .to(
              ".dg-dash-frame",
              {
                backgroundColor: "rgba(255,255,255,1)",
                borderColor: "rgba(0,0,0,0.08)",
                boxShadow: "0 40px 100px -30px rgba(0,0,0,0.28)",
                duration: 0.45,
                ease: "power2.out",
              },
              0.15,
            )
            .to(
              ".dg-dash-shell",
              { opacity: 1, duration: 0.4, ease: "power1.out" },
              0.2,
            )
            .to(
              ".dg-fly-recovered",
              {
                x: 0,
                y: 0,
                rotate: 0,
                force3D: false,
                duration: 0.6,
                ease: "power3.inOut",
              },
              0.12,
            )
            .to(
              ".dg-fly-failed",
              {
                x: 0,
                y: 0,
                rotate: 0,
                force3D: false,
                duration: 0.6,
                ease: "power3.inOut",
              },
              0.16,
            )
            .to(
              ".dg-fly-email",
              {
                x: 0,
                y: 0,
                rotate: 0,
                force3D: false,
                duration: 0.6,
                ease: "power3.inOut",
              },
              0.14,
            )
            .to(
              ".dg-fly-ask",
              {
                x: 0,
                y: 0,
                rotate: 0,
                force3D: false,
                duration: 0.6,
                ease: "power3.inOut",
              },
              0.18,
            )
            .to(
              ".dg-fly-rate",
              {
                x: 0,
                y: 0,
                rotate: 0,
                force3D: false,
                duration: 0.6,
                ease: "power3.inOut",
              },
              0.2,
            )
            .to(
              [".dg-fly-recovered", ".dg-fly-failed"],
              {
                keyframes: [
                  { boxShadow: yellowMid, duration: 0.18, ease: "none" },
                  { boxShadow: yellowSoft, duration: 0.16, ease: "none" },
                  { boxShadow: noShadow, duration: 0.14, ease: "none" },
                ],
              },
              0.1,
            )
            .to(
              [".dg-fly-email", ".dg-fly-ask"],
              {
                keyframes: [
                  { boxShadow: purpleMid, duration: 0.18, ease: "none" },
                  { boxShadow: purpleSoft, duration: 0.16, ease: "none" },
                  { boxShadow: noShadow, duration: 0.14, ease: "none" },
                ],
              },
              0.1,
            )
            .to(
              ".dg-fly-rate",
              {
                keyframes: [
                  { boxShadow: mixMid, duration: 0.18, ease: "none" },
                  { boxShadow: mixSoft, duration: 0.16, ease: "none" },
                  { boxShadow: noMixShadow, duration: 0.14, ease: "none" },
                ],
              },
              0.1,
            )
            .to(
              ".dg-fly-cursor",
              { opacity: 0, duration: 0.25, ease: "power1.out" },
              0.58,
            );

          // Sky stays fixed (like the nav); below-fold just covers it, then we fade
          const below = document.getElementById("dg-below");
          if (sky.length > 0 && below) {
            gsap.to(sky, {
              opacity: 0,
              ease: "none",
              scrollTrigger: {
                trigger: below,
                start: "top 40%",
                end: "top 5%",
                scrub: true,
                onLeave: () => {
                  gsap.set(sky, { visibility: "hidden" });
                },
                onEnterBack: () => {
                  gsap.set(sky, { visibility: "visible" });
                },
              },
            });
          }
        },
      );

      mm.add(
        "(max-width: 899px), (prefers-reduced-motion: reduce)",
        () => {
          const sky = skyTargets();
          gsap.set(".dg-hero-copy", { opacity: 1 });
          gsap.set(".dg-mega-brand", { opacity: 1 });
          gsap.set(".dg-dash-shell", { opacity: 1 });
          gsap.set(".dg-dash-frame", {
            backgroundColor: "rgba(255,255,255,1)",
            borderColor: "rgba(0,0,0,0.08)",
            boxShadow: "0 40px 100px -30px rgba(0,0,0,0.28)",
          });
          gsap.set(".dg-dash-stage", { y: 0, scale: 1 });
          gsap.set(
            [
              ".dg-fly-recovered",
              ".dg-fly-failed",
              ".dg-fly-email",
              ".dg-fly-ask",
              ".dg-fly-rate",
            ],
            {
              x: 0,
              y: 0,
              scale: 1,
              rotate: 0,
              boxShadow: "0 0 0 0 rgba(0,0,0,0)",
            },
          );
          gsap.set(".dg-fly-cursor", { opacity: 0 });
          gsap.set(sky, {
            clearProps: "y",
            opacity: 0.5,
            visibility: "visible",
          });

          // Mobile / reduced motion: simple fade when below-fold covers the sky
          const below = document.getElementById("dg-below");
          if (sky.length > 0 && below) {
            gsap.to(sky, {
              opacity: 0,
              ease: "none",
              scrollTrigger: {
                trigger: below,
                start: "top 70%",
                end: "top 25%",
                scrub: true,
              },
            });
          }
        },
      );

      return () => mm.revert();
    },
    { scope: rootRef, dependencies: [welcomeDone] },
  );

  return (
    <div ref={rootRef}>
      {/* Fixed sky — stays put like the nav; below-fold covers it */}
      <div
        className="dg-mega-brand pointer-events-none fixed top-16 z-[5] md:top-20"
        aria-hidden
      >
        <svg
          className="dg-mega-brand-svg"
          viewBox="0 0 100 18"
          preserveAspectRatio="none"
          role="presentation"
        >
          <text
            x="-1.8"
            y="14.5"
            textLength="103.6"
            lengthAdjust="spacingAndGlyphs"
            fill="rgba(12,12,12,0.08)"
            fontFamily="Syne, ui-sans-serif, system-ui, sans-serif"
            fontSize="16"
            fontWeight="800"
            fontStyle="normal"
          >
            DeclineGuard
          </text>
        </svg>
      </div>

      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 md:px-6 md:pt-5">
        <div className="pointer-events-auto flex w-full max-w-3xl items-center justify-between gap-3 rounded-full border border-black/5 bg-white/80 px-2.5 py-2 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md sm:gap-4 sm:px-3">
          <a
            href="/"
            className="inline-flex shrink-0 items-center pl-1.5 sm:pl-2"
            aria-label="DeclineGuard home"
          >
            <img
              src="/declineguard-wordmark.png"
              alt="DeclineGuard"
              width={1007}
              height={182}
              className="h-6 w-auto sm:h-7"
              decoding="async"
            />
          </a>

          <nav className="hidden items-center gap-0.5 text-sm font-medium md:flex">
            <a
              href="#product"
              className="rounded-full px-3 py-1.5 hover:bg-black/5"
            >
              Product
            </a>
            <a
              href="#how"
              className="rounded-full px-3 py-1.5 hover:bg-black/5"
            >
              How it works
            </a>
            <a
              href="#pricing"
              className="rounded-full px-3 py-1.5 hover:bg-black/5"
            >
              Pricing
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <SignedOut>
              <a
                href="/a/sign-in"
                className="hidden rounded-full px-3 py-1.5 text-sm font-medium text-foreground/70 hover:bg-black/5 hover:text-foreground sm:inline"
              >
                Sign in
              </a>
              <a href="/a/sign-up" className="dg-btn dg-btn-nav">
                Claim spot
              </a>
            </SignedOut>
            <SignedIn>
              <a href="/a/dashboard" className="dg-btn dg-btn-nav">
                Dashboard
              </a>
            </SignedIn>
          </div>
        </div>
      </header>

      {/* Pinned hero body only — nav / shader / watermark stay fixed outside */}
      <section
        ref={heroRef}
        className="relative z-10 max-md:min-h-0 md:h-screen md:overflow-hidden"
      >
        {welcome && !welcomeDone ? (
          <WelcomeIntro active onComplete={onWelcomeComplete} />
        ) : null}

        {/* Spacer for fixed nav */}
        <div className="h-16 md:h-[4.5rem]" aria-hidden />

        <div className="relative z-40 px-6 pb-8 pt-6 text-center md:pointer-events-none md:absolute md:inset-x-0 md:top-[25%] md:pb-0 md:pt-0">
          <div className="dg-hero-copy mx-auto max-w-5xl">
            <p className="inline-flex flex-wrap items-center justify-center gap-y-1 md:mb-5 font-bold">
              <span className="">Built For</span>
              {/* Layout box = wordmark height × full logo width so side text doesn’t collide */}
              <span className="relative inline-block h-[1rem] aspect-[212/28] overflow-visible md:h-5 ml-1.5 mr-2">
                <img
                  src="/lemon-squeezy-logo.svg"
                  alt="Lemon Squeezy, a Stripe company"
                  width={212}
                  height={40}
                  className="absolute left-0 top-0 h-[calc(100%*40/28)] w-auto max-w-none"
                />
              </span>
              <span>Merchants</span>
            </p>
            <h1 className="font-display text-7xl font-bold leading-[1.08] tracking-[-0.04em] text-foreground">
              Stop Losing Subscribers
              <br /> To{" "}
              <em className="inline-block pb-[0.12em] font-bold italic">
                Failed Payments
              </em>
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-foreground/70 md:text-lg">
              We send branded recovery emails that sound like you — and you only
              pay when the money comes back. Cha-ching.
            </p>
            <div className="pointer-events-auto mt-8 flex flex-wrap items-center justify-center gap-3">
              <SignedOut>
                <a href="/a/sign-up" className="dg-btn dg-btn-primary">
                  Grab a founding spot →
                </a>
              </SignedOut>
              <SignedIn>
                <a href="/a/dashboard" className="dg-btn dg-btn-primary">
                  Open dashboard →
                </a>
              </SignedIn>
              <a href="#pricing" className="dg-btn dg-btn-secondary">
                Peek at pricing
              </a>
            </div>
          </div>
        </div>

        <div className="relative z-20 flex justify-center px-3 pb-10 md:absolute md:inset-0 md:items-center md:px-8 md:pb-0 md:pt-36">
          <div className="dg-dash-stage w-full max-w-5xl">
            <div className="dg-dash-frame overflow-visible rounded-[1.25rem] md:rounded-[1.5rem]">
              <div className="dg-dash-shell flex items-center gap-2 border-b border-black/6 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-[#e5e5e5]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#e5e5e5]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#e5e5e5]" />
              </div>

              <div className="flex min-h-[380px] md:min-h-[500px]">
                <aside className="dg-dash-shell hidden w-48 shrink-0 border-r border-black/6 bg-[#f7f7f8] p-4 md:block">
                  <div className="flex items-center gap-2 px-1">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-[10px] font-bold text-background">
                      CS
                    </div>
                    <span className="text-sm font-semibold">Cool SaaS</span>
                  </div>
                  <nav className="mt-6 space-y-1 text-sm">
                    {(
                      [
                        ["Home", true],
                        ["Recoveries", false],
                        ["Sequences", false],
                        ["Settings", false],
                      ] as const
                    ).map(([label, active]) => (
                      <button
                        key={label}
                        type="button"
                        className={`w-full cursor-pointer rounded-lg px-3 py-2 text-left transition ${
                          active
                            ? "bg-white font-medium shadow-sm"
                            : "text-muted-foreground hover:bg-white/70 hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </nav>
                </aside>

                <div className="flex min-w-0 flex-1 flex-col gap-3 p-3 md:gap-4 md:p-6">
                  <div className="dg-dash-shell flex items-center justify-between">
                    <p className="text-lg font-semibold tracking-tight md:text-xl">
                      Good morning ☀️
                    </p>
                    <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-muted-foreground">
                      Lemon Squeezy
                    </span>
                  </div>

                  <AskCard />

                  <div className="grid flex-1 grid-cols-2 gap-2.5 md:grid-cols-6 md:gap-4">
                    <RecoveredCard />
                    <FailedCard />
                    <EmailCard />

                    <div className="dg-fly-rate pointer-events-auto relative z-20 col-span-2 md:col-span-2">
                      <Glass className="flex h-full flex-col justify-between p-4">
                        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-black/45">
                          Rate
                        </p>
                        <p className="font-display text-[2.1rem] leading-none tracking-tight md:text-[2.4rem]">
                          34%
                        </p>
                        <p className="text-xs text-black/45">
                          of failed cards came back
                        </p>
                      </Glass>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
