import { ArrowRight } from "lucide-react";
import { SignedIn, SignedOut } from "@clerk/astro/react";
import {
  formatDeclineAddon,
  formatDeclineQuota,
  formatUsd,
  PLANS,
} from "@/lib/pricing";

const free = PLANS.free;
const pro = PLANS.pro;

export function HomePageTiers() {
  return (
    <section
      id="plans"
      className="scroll-mt-24 border-t border-black/[0.06] bg-white text-[#08090a]"
    >
      <div className="mx-auto max-w-[1440px] px-6 py-20 md:py-24 lg:px-10">
        <div className="max-w-xl">
          <p className="text-[13px] font-medium text-[#8a8f98]">Plans</p>
          <h2 className="ln-h1 mt-5 text-[clamp(1.75rem,3.2vw,2.6rem)] font-medium leading-[1.1] tracking-[-0.02em] text-[#08090a]">
            Free to start. Pro when volume grows.
          </h2>
          <p className="mt-4 text-[15px] leading-[1.6] text-[#8a8f98]">
            Monthly decline buckets. Over quota, new declines wait in a hold
            queue.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 md:gap-5">
          <article className="flex flex-col justify-between rounded-2xl border border-black/[0.08] px-6 py-6">
            <div>
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-[17px] font-medium tracking-[-0.01em]">
                  {free.name}
                </h3>
                <p className="text-[17px] font-medium tracking-tight">$0</p>
              </div>
              <p className="mt-3 text-[14px] leading-[1.6] text-[#8a8f98]">
                {formatDeclineQuota(free.includedDeclinesPerMonth)}
              </p>
            </div>
            <div className="mt-6">
              <SignedOut>
                <a href="/a/sign-up" className="ln-btn ln-btn-ghost">
                  {free.cta}
                  <ArrowRight className="size-4" />
                </a>
              </SignedOut>
              <SignedIn>
                <a href="/a/dashboard" className="ln-btn ln-btn-ghost">
                  Open dashboard
                  <ArrowRight className="size-4" />
                </a>
              </SignedIn>
            </div>
          </article>

          <article className="flex flex-col justify-between rounded-2xl bg-[#08090a] px-6 py-6 text-[#f7f8f8]">
            <div>
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-[17px] font-medium tracking-[-0.01em]">
                  {pro.name}
                </h3>
                <p className="text-[17px] font-medium tracking-tight">
                  {formatUsd(pro.monthlyPriceUsd)}
                  <span className="text-[13px] font-medium text-white/45">
                    /mo
                  </span>
                </p>
              </div>
              <p className="mt-3 text-[14px] leading-[1.6] text-white/55">
                {formatDeclineQuota(pro.includedDeclinesPerMonth)}
              </p>
            </div>
            <div className="mt-6">
              <a
                href="/pricing"
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#f7f8f8] px-[1.15rem] py-[0.72rem] text-[14px] font-medium text-[#08090a] transition-colors hover:bg-white"
              >
                See Pro details
                <ArrowRight className="size-4" />
              </a>
            </div>
          </article>
        </div>

        <p className="mt-6 text-[14px] leading-[1.6] text-[#8a8f98]">
          Need more? Stack {formatDeclineAddon()} on either plan.{" "}
          <a href="/pricing" className="font-medium text-[#08090a] hover:underline">
            Full pricing
          </a>
        </p>
      </div>
    </section>
  );
}
