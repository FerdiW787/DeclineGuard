import { ArrowRight } from "lucide-react";
import { SignedIn, SignedOut } from "@clerk/astro/react";
import {
  MarketingProductPreview,
  marketingProductTabs,
  type MarketingProductTab,
} from "@/components/homepage/marketing/MarketingProductPreview";
import { LinearCta } from "../LinearCta";

type Props = {
  tab: MarketingProductTab;
  onTabChange: (tab: MarketingProductTab) => void;
};

export function LinearHero({ tab, onTabChange }: Props) {
  return (
    <section className="relative overflow-hidden pt-28 pb-16 md:pt-36 md:pb-0">
      <div className="ln-hero-glow pointer-events-none absolute inset-x-0 top-0 h-[70vh]" />

      <div className="ln-container relative z-10">
        <div className="ln-reveal mx-auto flex max-w-2xl flex-col items-center text-center">
          <a
            href="#product"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[12px] font-medium text-[#b1b1b3] transition hover:border-white/20 hover:text-white"
          >
            Built for Lemon Squeezy merchants
            <span aria-hidden className="text-white/40">
              →
            </span>
          </a>

          <h1 className="mt-7 text-[clamp(2.25rem,5.5vw,3.75rem)] font-semibold leading-[1.08] tracking-[-0.04em] text-white">
            Stop losing subscribers to failed payments
          </h1>

          <p className="mt-5 max-w-lg text-base leading-relaxed text-[#8a8a8e] md:text-lg">
            Branded recovery emails that sound like you — and you only pay when
            the money comes back.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <SignedOut>
              <LinearCta href="/a/sign-up">
                Grab a founding spot
                <ArrowRight className="size-4" />
              </LinearCta>
              <LinearCta href="/pricing" variant="ghost">
                See pricing
              </LinearCta>
            </SignedOut>
            <SignedIn>
              <LinearCta href="/a/dashboard">
                Open dashboard
                <ArrowRight className="size-4" />
              </LinearCta>
            </SignedIn>
          </div>
        </div>

        <div
          id="product"
          className="ln-reveal relative mx-auto mt-14 max-w-5xl scroll-mt-28 md:mt-20"
        >
          <div className="mb-4 flex flex-wrap items-center justify-center gap-1.5">
            {marketingProductTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onTabChange(t.id)}
                className={`cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  tab === t.id
                    ? "bg-white text-black"
                    : "text-[#8a8a8e] hover:bg-white/5 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="overflow-hidden rounded-xl border border-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_40px_80px_-40px_rgba(0,0,0,0.8)]">
            <MarketingProductPreview tab={tab} frameSize="hero" />
          </div>
        </div>
      </div>
    </section>
  );
}
