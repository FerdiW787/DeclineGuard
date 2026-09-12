import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Star } from "lucide-react";
import { useRef, useState } from "react";
import ImageSlot from "./ImageSlot";
import { MascotGaze } from "./MascotGaze";

const TABS = [
  {
    id: "dashboard",
    label: "Dashboard",
    slot: "dashboard",
    brief: "Live recoveries, revenue saved, failed vs recovered.",
    hint: "1920×1080 product shot",
  },
  {
    id: "sequences",
    label: "Sequences",
    slot: "sequences",
    brief: "Email timeline preview with real copy.",
    hint: "Product UI crop",
  },
  {
    id: "customizations",
    label: "Customizations",
    slot: "customizations",
    brief: "Tone + brand color controls.",
    hint: "Settings UI crop",
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * Seline-structure hero — DeclineGuard brand.
 * Mascot: full viewport height, ~50% off the right edge,
 * stacks over the navbar but under the product stage.
 */
export function SelineHero() {
  const rootRef = useRef<HTMLElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const mascotWrapRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<TabId>("dashboard");
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

  useGSAP(
    () => {
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const copy = copyRef.current;
      const mascot = mascotWrapRef.current;
      if (!copy) return;

      gsap.from(copy.children, {
        y: reduce ? 0 : 28,
        opacity: 0,
        duration: reduce ? 0.01 : 0.7,
        stagger: reduce ? 0 : 0.08,
        ease: "power3.out",
        delay: 0.05,
      });

      if (mascot) {
        gsap.from(mascot, {
          x: reduce ? 0 : 48,
          opacity: 0,
          duration: reduce ? 0.01 : 1.1,
          ease: "power3.out",
          delay: 0.12,
        });
      }
    },
    { scope: rootRef },
  );

  return (
    <section
      ref={rootRef}
      className="relative mx-auto w-full max-w-[1400px] px-5 pt-6 sm:px-8 sm:pt-8 lg:px-10"
    >
      {/*
        Fixed full-height mascot — half hangs off the right edge.
        z-60: above sticky header (z-50). Product stage sits at z-70.
      */}
      <div
        ref={mascotWrapRef}
        aria-hidden
        className="pointer-events-none fixed top-0 right-0 z-[60] hidden h-screen md:block"
      >
        {/* Inner offset so GSAP can animate the wrap without wiping translate-x-1/2 */}
        <div className="h-full translate-x-1/2">
          <MascotGaze />
        </div>
      </div>

      <div className="relative">
        <div
          ref={copyRef}
          className="relative z-10 max-w-[34rem] md:max-w-[min(34rem,54%)]"
        >
          <h1 className="font-display text-[clamp(2.35rem,5.6vw,4.35rem)] font-medium leading-[1.05] tracking-[-0.035em] text-[#0c0a09]">
            Analytics made{" "}
            <span className="text-[#3b82f6]">simple &amp; actionable</span>
          </h1>

          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[#57534e] sm:text-base">
            Everything you need to grow — beautiful dashboards, funnels, user
            profiles, and session replays. All in one place.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href="/sign-up"
              className="inline-flex h-11 items-center justify-center rounded-md bg-[#3b82f6] px-5 text-[15px] font-semibold text-white transition hover:bg-[#2563eb]"
            >
              Start free trial
            </a>
            <a
              href="#product"
              className="inline-flex h-11 items-center justify-center rounded-md border border-black/10 bg-white px-5 text-[15px] font-semibold text-[#0c0a09] transition hover:bg-black/[0.03]"
            >
              See how it works
            </a>
          </div>

          <div className="mt-10">
            <p className="text-[11px] font-medium tracking-[0.06em] text-[#a8a29e] uppercase">
              Trusted by teams shipping products
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 opacity-45 grayscale">
              {["Acme", "Northwind", "Globex", "Umbrella", "Initech"].map(
                (name) => (
                  <span
                    key={name}
                    className="font-display text-lg font-semibold tracking-tight text-[#0c0a09]"
                  >
                    {name}
                  </span>
                ),
              )}
            </div>
          </div>

          <div className="mt-8 flex max-w-md items-start gap-2.5">
            <div className="mt-0.5 flex shrink-0 gap-0.5 text-[#f59e0b]">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-3.5 fill-current" />
              ))}
            </div>
            <p className="text-[13px] leading-snug text-[#78716c] sm:text-sm">
              on G2 — “It&apos;s refreshing to use an analytics tool that just
              works without any hassle.”
            </p>
          </div>
        </div>

        {/* Mobile mascot — under copy, before product */}
        <div className="mt-8 flex justify-end md:hidden">
          <img
            src="/declineguard-mascot.png"
            alt="DeclineGuard guardian — side profile with spear"
            width={768}
            height={1024}
            className="h-[280px] w-auto object-contain object-right"
            decoding="async"
          />
        </div>

        {/* Product stage — above mascot (z-70 > z-60) */}
        <div
          id="product"
          className="relative z-[70] mt-8 w-full scroll-mt-28 sm:mt-10"
        >
          <div className="mb-3 flex flex-wrap gap-1 sm:mb-4">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  tab === t.id
                    ? "bg-black/[0.06] text-[#0c0a09]"
                    : "text-[#78716c] hover:text-[#0c0a09]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative mb-6 overflow-hidden rounded-lg border border-black/10 bg-stone-100 shadow-[0_25px_50px_-20px_rgba(0,0,0,0.25)]">
            <ImageSlot
              label={active.slot}
              brief={active.brief}
              hint={active.hint}
              className="min-h-[280px] rounded-none border-0 sm:min-h-[420px] md:min-h-[520px]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
