import { ArrowRight, Check, Minus } from "lucide-react";
import { SignedIn, SignedOut } from "@clerk/astro/react";
import { LinearNav } from "@/components/homepage-linear/LinearNav";
import { LinearCta } from "@/components/homepage-linear/LinearCta";
import { HomePageFooter } from "./HomePageBento";
import PricingCalculator from "./PricingCalculator";
import {
  formatUsd,
  PLANS,
  PRICING_FAQS,
  proBreakevenRecoveredUsd,
} from "@/lib/pricing";

const free = PLANS.free;
const pro = PLANS.pro;
const breakeven = proBreakevenRecoveredUsd();

const comparisonRows = [
  {
    label: "Monthly price",
    free: "$0",
    pro: formatUsd(pro.monthlyPriceUsd) + "/mo",
  },
  {
    label: "Recovery fee",
    free: `${free.recoveryFeePercent}% when we recover`,
    pro: `${pro.recoveryFeePercent}% when we recover`,
  },
  {
    label: "Recovery emails / mo",
    free: String(free.includedRecoveryEmails),
    pro: String(pro.includedRecoveryEmails),
  },
  {
    label: "Email overage",
    free: `$${free.emailOveragePackPriceUsd}/mo per +${free.emailOveragePackSize}`,
    pro: `$${pro.emailOveragePackPriceUsd}/mo per +${pro.emailOveragePackSize}`,
  },
  {
    label: "Lemon Squeezy stores",
    free: "1 (+ $5 one-time each extra)",
    pro: "Unlimited",
  },
  {
    label: "DeclineGuard badge in emails",
    free: "Yes",
    pro: "No",
  },
  {
    label: "Branded recovery sequence",
    free: true,
    pro: true,
  },
  {
    label: "Recovery dashboard",
    free: true,
    pro: true,
  },
  {
    label: "Full email customization",
    free: false,
    pro: true,
  },
  {
    label: "CSV export",
    free: false,
    pro: true,
  },
] as const;

function CellValue({ value }: { value: string | boolean }) {
  if (value === true) {
    return <Check className="mx-auto size-4 text-[#08090a]" aria-label="Included" />;
  }
  if (value === false) {
    return <Minus className="mx-auto size-4 text-black/25" aria-label="Not included" />;
  }
  return <span>{value}</span>;
}

export default function PricingPage() {
  return (
    <div className="ln-surface min-h-screen bg-[#f7f8f8] text-[#08090a]">
      <LinearNav />

      <main className="ln-container pb-24 pt-28 md:pb-32 md:pt-36">
        <div className="mx-auto max-w-2xl text-center">
          <p className="ln-eyebrow">Pricing</p>
          <h1 className="ln-h1 mt-4 text-[clamp(2rem,4.5vw,3rem)] leading-[1.08] tracking-[-0.03em]">
            Pay when we recover. Scale when you grow.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#8a8a8e]">
            Start free with no card. Upgrade to Pro when lower fees and more
            volume beat the math — usually around {formatUsd(breakeven)} recovered
            per month.
          </p>
        </div>

        <div className="mt-14 grid gap-4 md:mt-16 md:grid-cols-2 md:gap-5">
          <article className="flex flex-col rounded-xl border border-black/[0.08] bg-white p-8 md:p-9">
            <p className="text-sm font-medium text-[#8a8a8e]">{free.name}</p>
            <p className="mt-3 text-5xl tracking-tight">$0</p>
            <p className="mt-2 text-base text-[#8a8a8e]">
              + {free.recoveryFeePercent}% per recovery we help win
            </p>
            <p className="mt-3 text-sm font-medium text-[#08090a]">
              No card. No monthly fee. Nothing until a payment comes back.
            </p>
            <ul className="mt-8 flex-1 space-y-3 text-sm text-[#b1b1b3]">
              {free.features.map((line) => (
                <li key={line} className="flex gap-3">
                  <Check className="mt-0.5 size-4 shrink-0 text-black/35" />
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-8">
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
            </div>
          </article>

          <article className="relative flex flex-col rounded-xl border border-black/[0.08] bg-white p-8 md:p-9 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
            <span className="absolute right-6 top-6 rounded-full bg-[#08090a] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#f7f8f8]">
              Popular
            </span>
            <p className="text-sm font-medium text-[#8a8a8e]">{pro.name}</p>
            <p className="mt-3 text-5xl tracking-tight">
              {formatUsd(pro.monthlyPriceUsd)}
              <span className="text-xl font-medium text-black/35">/mo</span>
            </p>
            <p className="mt-2 text-base text-[#8a8a8e]">
              + {pro.recoveryFeePercent}% per recovery — half the Free rate
            </p>
            <ul className="mt-8 flex-1 space-y-3 text-sm text-[#b1b1b3]">
              {pro.features.map((line) => (
                <li key={line} className="flex gap-3">
                  <Check className="mt-0.5 size-4 shrink-0 text-black/35" />
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <SignedOut>
                <span className="inline-flex w-full cursor-default items-center justify-center rounded-lg border border-black/10 bg-black/[0.03] px-4 py-2.5 text-sm font-medium text-[#8a8a8e]">
                  Coming soon
                </span>
              </SignedOut>
              <SignedIn>
                <span className="inline-flex w-full cursor-default items-center justify-center rounded-lg border border-black/10 bg-black/[0.03] px-4 py-2.5 text-sm font-medium text-[#8a8a8e]">
                  Coming soon
                </span>
              </SignedIn>
            </div>
          </article>
        </div>

        <section className="mx-auto mt-16 max-w-4xl md:mt-20">
          <h2 className="text-center text-xl tracking-tight md:text-2xl">
            Compare plans
          </h2>
          <div className="mt-8 overflow-x-auto rounded-xl border border-black/[0.08] bg-white">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-black/[0.08] bg-[#f7f8f8]">
                  <th className="px-5 py-4 font-medium text-black/35" scope="col">
                    &nbsp;
                  </th>
                  <th className="px-5 py-4 font-semibold tracking-tight" scope="col">
                    Free
                  </th>
                  <th className="px-5 py-4 font-semibold tracking-tight" scope="col">
                    Pro
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label} className="border-b border-black/[0.06] last:border-0">
                    <th
                      scope="row"
                      className="px-5 py-3.5 font-normal text-[#8a8a8e]"
                    >
                      {row.label}
                    </th>
                    <td className="px-5 py-3.5 text-center text-[#b1b1b3]">
                      <CellValue value={row.free} />
                    </td>
                    <td className="px-5 py-3.5 text-center text-[#b1b1b3]">
                      <CellValue value={row.pro} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <PricingCalculator />

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
