import { ArrowRight, Check } from "lucide-react";
import { SignedIn, SignedOut } from "@clerk/astro/react";
import { ProCheckoutButton } from "@/components/billing/ProCheckoutButton";
import { LinearNav } from "@/components/homepage-linear/LinearNav";
import { LinearCta } from "@/components/homepage-linear/LinearCta";
import { withConvexClerkProvider } from "@/lib/withConvexClerkProvider";
import { HomePageFooter } from "./HomePageBento";
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

const darkCtaClass =
  "inline-flex w-full items-center justify-center rounded-full bg-[#f7f8f8] px-4 py-2.5 text-sm font-medium text-[#08090a] transition-colors hover:bg-white";

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
    <div className="ln-surface min-h-screen bg-[#f7f8f8] text-[#08090a]">
      <LinearNav />

      <main className="ln-container pb-24 pt-28 md:pb-32 md:pt-36">
        <div className="mx-auto max-w-xl text-center">
          <p className="ln-eyebrow">Pricing</p>
          <h1 className="ln-h1 mt-4 text-[clamp(2rem,4.5vw,3rem)] leading-[1.08] tracking-[-0.03em]">
            Free and Pro. Monthly decline buckets.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#8a8a8e]">
            {free.includedDeclinesPerMonth} or {pro.includedDeclinesPerMonth}{" "}
            declines each month. Need more? Stack {formatDeclineAddon()}. Over
            quota, new declines wait in a hold queue — we never kill a sequence
            mid-flight.
          </p>
        </div>

        <div className="mt-14 grid items-stretch gap-4 md:mt-16 md:grid-cols-2 md:gap-5">
          <article className="flex flex-col rounded-2xl border border-black/[0.08] bg-white p-7 md:p-8">
            <p className="text-sm font-medium text-[#8a8a8e]">{free.name}</p>
            <p className="mt-3 text-5xl tracking-tight">$0</p>
            <p className="mt-2 text-[15px] font-medium text-[#08090a]">
              {formatDeclineQuota(free.includedDeclinesPerMonth)}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#8a8a8e]">
              {free.tagline}
            </p>
            <ul className="mt-8 flex-1 space-y-3 text-sm text-[#6b6f76]">
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
            <p className="text-sm font-medium text-white/50">{pro.name}</p>
            <p className="mt-3 text-5xl tracking-tight">
              {formatUsd(pro.monthlyPriceUsd)}
              <span className="text-xl font-medium text-white/40">/mo</span>
            </p>
            <p className="mt-2 text-[15px] font-medium text-[#f7f8f8]">
              {formatDeclineQuota(pro.includedDeclinesPerMonth)}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/50">
              {pro.tagline}
            </p>
            <ul className="mt-8 flex-1 space-y-3 text-sm text-white/65">
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

        <section className="mt-10 rounded-2xl border border-black/[0.08] bg-white px-6 py-7 md:px-8">
          <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-start md:gap-12">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/35">
                Add-on
              </p>
              <h2 className="mt-2 text-xl tracking-tight md:text-2xl">
                Need more than your bucket?
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#8a8a8e]">
                Same add-on on Free and Pro. Stack as many as you need — extra
                monthly decline capacity on top of your plan bucket.
              </p>
            </div>
            <dl className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-[#f7f8f8] px-4 py-4">
                <dt className="text-[12px] font-medium text-[#8a8a8e]">Capacity</dt>
                <dd className="mt-1 text-[15px] font-medium tracking-tight">
                  +{DECLINE_ADDON.extraDeclines} declines
                </dd>
              </div>
              <div className="rounded-xl bg-[#f7f8f8] px-4 py-4">
                <dt className="text-[12px] font-medium text-[#8a8a8e]">Price</dt>
                <dd className="mt-1 text-[15px] font-medium tracking-tight">
                  {formatUsd(DECLINE_ADDON.monthlyPriceUsd)}/mo
                </dd>
              </div>
              <div className="rounded-xl bg-[#f7f8f8] px-4 py-4">
                <dt className="text-[12px] font-medium text-[#8a8a8e]">
                  Over quota
                </dt>
                <dd className="mt-1 text-[15px] font-medium tracking-tight">
                  Hold queue
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="mx-auto mt-20 max-w-2xl md:mt-24">
          <h2 className="text-center text-2xl tracking-tight">
            Common questions
          </h2>
          <dl className="mt-8 divide-y divide-black/[0.08] border-y border-black/[0.08]">
            {PRICING_FAQS.map((item) => (
              <div key={item.q} className="py-6">
                <dt className="font-semibold tracking-tight">{item.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-[#8a8a8e]">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="mt-16 text-center">
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
          <p className="mt-4 text-sm text-[#8a8a8e]">
            <a href="/" className="hover:text-[#08090a]">
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
