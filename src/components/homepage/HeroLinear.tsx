import { SignedIn, SignedOut } from "@clerk/astro/react";
import { ArrowRight } from "lucide-react";
import { HomeNav } from "./HomeNav";
import { YellowStory } from "./YellowStory";

export function HeroLinear() {
  return (
    <div className="relative flex h-dvh min-h-dvh flex-col overflow-x-clip bg-white">
      <section className="ln-hero relative z-10 isolate text-[#08090a]">
        <HomeNav />

        <div className="relative z-10 mx-auto w-full max-w-[1440px] px-6 lg:px-10">
          <div className="mx-auto flex max-w-[920px] flex-col items-center pt-[132px] text-center md:pt-[152px]">
            <p className="mb-5 flex flex-wrap items-center justify-center gap-y-1 text-[13px] font-medium tracking-[-0.01em] text-[#8a8f98]">
              <span>Built for</span>
              <span className="relative ml-1.5 mr-2 inline-block h-[1rem] aspect-[212/28] overflow-visible md:h-[1.125rem]">
                <img
                  src="/lemon-squeezy-logo.svg"
                  alt="Lemon Squeezy"
                  width={212}
                  height={40}
                  className="absolute left-0 top-0 h-[calc(100%*40/28)] w-auto max-w-none brightness-0"
                />
              </span>
              <span>merchants</span>
            </p>

            <div className="flex flex-col items-center gap-7 md:gap-8">
              <h1 className="ln-h1 text-center text-[clamp(2.25rem,4.8vw,3.75rem)] font-medium leading-[1.06] tracking-[-0.022em] text-[#08090a]">
                The revenue recovery system
                <br className="hidden sm:block" /> for your Lemon Squeezy stores
              </h1>

              <p className="mx-auto max-w-[34rem] text-center text-[15px] leading-[1.6] tracking-[-0.011em] text-[#8a8f98]">
                When a card declines, customers get an email that sounds like you.<br />
                Connect once — you only pay if the payment comes back.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <SignedOut>
                  <a href="/a/sign-up" className="ln-btn ln-btn-primary">
                    Start recovering free
                    <ArrowRight className="size-4" />
                  </a>
                  <a href="/pricing" className="ln-btn ln-btn-ghost">
                    See pricing
                  </a>
                </SignedOut>
                <SignedIn>
                  <a href="/a/dashboard" className="ln-btn ln-btn-primary">
                    Open dashboard
                    <ArrowRight className="size-4" />
                  </a>
                </SignedIn>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-10 mt-7 min-h-0 w-full flex-1 md:mt-8">
        <YellowStory />
      </div>
    </div>
  );
}
