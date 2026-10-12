import { SignedIn, SignedOut } from "@clerk/astro/react";
import { Button } from "@/components/ui/button";
import {
  formatDeclineAddon,
  formatDeclineQuota,
  formatUsd,
  PLANS,
} from "@/lib/pricing";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";

const free = PLANS.free;
const pro = PLANS.pro;

export function HomePageTiers() {
  return (
    <section
      id="plans"
      className="scroll-mt-24 border-t border-border bg-white text-foreground"
    >
      <div className="mx-auto max-w-[1440px] px-6 py-24 md:py-32 lg:px-10">
        <div className="max-w-xl">
          <p className="text-[13px] font-medium text-muted-foreground">Plans</p>
          <h2 className="ln-h1 mt-5 text-[clamp(1.75rem,3.2vw,2.6rem)] font-medium leading-[1.1] tracking-[-0.02em] text-foreground">
            Free to start. Pro when volume grows.
          </h2>
          <p className="mt-5 text-[15px] leading-[1.6] text-muted-foreground">
            Monthly decline buckets. Over quota, new declines wait in a hold
            queue.
          </p>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-2 md:gap-5">
          <article className="flex flex-col justify-between rounded-2xl border border-border px-7 py-7 md:px-8 md:py-8">
            <div>
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-[17px] font-medium tracking-[-0.01em]">
                  {free.name}
                </h3>
                <p className="text-[17px] font-medium tracking-tight">$0</p>
              </div>
              <p className="mt-3 text-[14px] leading-[1.6] text-muted-foreground">
                {formatDeclineQuota(free.includedDeclinesPerMonth)}
              </p>
            </div>
            <div className="mt-6">
              <SignedOut>
                <Button asChild variant="outline" size="lg">
                  <a href="/a/sign-up">
                    {free.cta}
                    <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4" />
                  </a>
                </Button>
              </SignedOut>
              <SignedIn>
                <Button asChild variant="outline" size="lg">
                  <a href="/a/dashboard">
                    Open dashboard
                    <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4" />
                  </a>
                </Button>
              </SignedIn>
            </div>
          </article>

          <article className="flex flex-col justify-between rounded-2xl bg-primary px-7 py-7 text-foreground md:px-8 md:py-8">
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
              <Button
                asChild
                size="lg"
                className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              >
                <a href="/pricing">
                  See Pro details
                  <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4" />
                </a>
              </Button>
            </div>
          </article>
        </div>

        <p className="mt-6 text-[14px] leading-[1.6] text-muted-foreground">
          Need more? Stack {formatDeclineAddon()} on either plan.{" "}
          <a href="/pricing" className="font-medium text-foreground hover:underline">
            Full pricing
          </a>
        </p>
      </div>
    </section>
  );
}
