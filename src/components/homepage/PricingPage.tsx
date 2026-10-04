import { ArrowRight, Check, Plus } from "lucide-react";
import { SignedIn, SignedOut } from "@clerk/astro/react";
import { ProCheckoutButton } from "@/components/billing/ProCheckoutButton";
import { LinearCta } from "@/components/homepage-linear/LinearCta";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { withConvexClerkProvider } from "@/lib/withConvexClerkProvider";
import { HomePageFooter } from "./HomePageBento";
import { HomeNav } from "./HomeNav";
import {
  DECLINE_ADDON,
  formatDeclineAddon,
  formatDeclineQuota,
  formatUsd,
  PLANS,
  PRICING_FAQS,
} from "@/lib/pricing";

const free = PLANS.free;
const pro = PLANS.pro;

const darkCtaClass = cn(
  buttonVariants({ size: "lg" }),
  "w-full bg-primary-foreground text-primary hover:bg-primary-foreground/90",
);

function FreePlanCtas() {
  return (
    <>
      <SignedOut>
        <LinearCta href="/a/sign-up" className="w-full justify-center">
          {free.cta}
        </LinearCta>
      </SignedOut>
      <SignedIn>
        <LinearCta href="/a/dashboard" className="w-full justify-center">
          Open dashboard
        </LinearCta>
      </SignedIn>
    </>
  );
}

function PricingPage() {
  return (
    <div className="ln-surface min-h-screen bg-white text-[#08090a]">
      <HomeNav homeAnchors={false} current="pricing" />

      <main className="mx-auto max-w-[1440px] px-6 pb-24 pt-28 md:pb-32 md:pt-36 lg:px-10">
        <div className="mx-auto max-w-xl text-center">
          <p className="text-[13px] font-medium text-[#8a8f98]">Pricing</p>
          <h1 className="ln-h1 mt-5 text-[clamp(2rem,4.5vw,3rem)] font-medium leading-[1.08] tracking-[-0.022em]">
            Free and Pro. Monthly decline buckets.
          </h1>
          <p className="mt-5 text-[15px] leading-[1.6] text-[#8a8f98]">
            {free.includedDeclinesPerMonth} or {pro.includedDeclinesPerMonth}{" "}
            declines each month. Need more? Stack {formatDeclineAddon()}. Over
            quota, new declines wait in a hold queue — we never kill a sequence
            mid-flight.
          </p>
        </div>

        <div className="mt-14 grid items-stretch gap-4 md:mt-16 md:grid-cols-2 md:gap-5">
          <article className="flex flex-col rounded-2xl border border-black/[0.08] bg-white p-7 md:p-8">
            <p className="text-[13px] font-medium text-[#8a8f98]">{free.name}</p>
            <p className="ln-h1 mt-3 text-5xl font-medium tracking-tight">$0</p>
            <p className="mt-2 text-[15px] font-medium text-[#08090a]">
              {formatDeclineQuota(free.includedDeclinesPerMonth)}
            </p>
            <p className="mt-2 text-[14px] leading-[1.6] text-[#8a8f98]">
              {free.tagline}
            </p>
            <ul className="mt-8 flex-1 space-y-3 text-[14px] leading-[1.6] text-[#6b6f76]">
              {free.features.map((line) => (
                <li key={line} className="flex gap-3">
                  <Check className="mt-0.5 size-4 shrink-0 text-black/35" />
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <FreePlanCtas />
            </div>
          </article>

          <article className="flex flex-col rounded-2xl bg-[#08090a] p-7 text-[#f7f8f8] md:p-8">
            <p className="text-[13px] font-medium text-white/50">{pro.name}</p>
            <p className="ln-h1 mt-3 text-5xl font-medium tracking-tight">
              {formatUsd(pro.monthlyPriceUsd)}
              <span className="text-xl font-medium text-white/40">/mo</span>
            </p>
            <p className="mt-2 text-[15px] font-medium text-[#f7f8f8]">
              {formatDeclineQuota(pro.includedDeclinesPerMonth)}
            </p>
            <p className="mt-2 text-[14px] leading-[1.6] text-white/50">
              {pro.tagline}
            </p>
            <ul className="mt-8 flex-1 space-y-3 text-[14px] leading-[1.6] text-white/65">
              {pro.features.map((line) => (
                <li key={line} className="flex gap-3">
                  <Check className="mt-0.5 size-4 shrink-0 text-white/40" />
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <ProCheckoutButton className={darkCtaClass} label={pro.cta} />
            </div>
          </article>
        </div>

        <section className="mt-10 rounded-2xl border border-black/[0.08] bg-[#f7f8f8] px-6 py-7 md:px-8">
          <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-start md:gap-12">
            <div>
              <p className="text-[13px] font-medium text-[#8a8f98]">Add-on</p>
              <h2 className="ln-h1 mt-3 text-[clamp(1.35rem,2.4vw,1.75rem)] font-medium leading-[1.15] tracking-[-0.02em]">
                Need more than your bucket?
              </h2>
              <p className="mt-3 text-[14px] leading-[1.6] text-[#8a8f98]">
                Same add-on on Free and Pro. Stack as many as you need — extra
                monthly decline capacity on top of your plan bucket.
              </p>
            </div>
            <dl className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-white px-4 py-4">
                <dt className="text-[12px] font-medium text-[#8a8f98]">
                  Capacity
                </dt>
                <dd className="mt-1 text-[15px] font-medium tracking-tight">
                  +{DECLINE_ADDON.extraDeclines} declines
                </dd>
              </div>
              <div className="rounded-xl bg-white px-4 py-4">
                <dt className="text-[12px] font-medium text-[#8a8f98]">Price</dt>
                <dd className="mt-1 text-[15px] font-medium tracking-tight">
                  {formatUsd(DECLINE_ADDON.monthlyPriceUsd)}/mo
                </dd>
              </div>
              <div className="rounded-xl bg-white px-4 py-4">
                <dt className="text-[12px] font-medium text-[#8a8f98]">
                  Over quota
                </dt>
                <dd className="mt-1 text-[15px] font-medium tracking-tight">
                  Hold queue
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section id="faq" className="mx-auto mt-20 max-w-2xl scroll-mt-24 md:mt-24">
          <p className="text-center text-[13px] font-medium text-[#8a8f98]">
            FAQ
          </p>
          <h2 className="ln-h1 mt-4 text-center text-[clamp(1.75rem,3.2vw,2.4rem)] font-medium leading-[1.1] tracking-[-0.02em]">
            Common questions
          </h2>
          <div className="mt-10">
            {PRICING_FAQS.map((item) => (
              <details
                key={item.q}
                className="group border-b border-black/[0.08] py-5 first:border-t"
              >
                <summary className="flex cursor-pointer list-none items-start gap-4 text-[15px] font-medium tracking-[-0.01em] text-[#08090a] [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-1">{item.q}</span>
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-black/15 text-[#8a8f98] transition-transform duration-200 group-open:rotate-45 group-hover:border-black/30 group-hover:text-[#08090a]">
                    <Plus className="size-4" />
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl pr-10 text-[14px] leading-[1.65] text-[#8a8f98]">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        <div className="mt-16 flex flex-col items-center text-center">
          <SignedOut>
            <LinearCta href="/a/sign-up">
              Start free — no card required
              <ArrowRight className="size-4" />
            </LinearCta>
          </SignedOut>
          <SignedIn>
            <LinearCta href="/a/dashboard">
              Open dashboard
              <ArrowRight className="size-4" />
            </LinearCta>
          </SignedIn>
          <p className="mt-4 text-[13px] text-[#8a8f98]">
            <a href="/" className="transition-colors hover:text-[#08090a]">
              ← Back to homepage
            </a>
          </p>
        </div>
      </main>

      <HomePageFooter />
    </div>
  );
}

export default withConvexClerkProvider(PricingPage, {
  allowMissingConvex: true,
});
