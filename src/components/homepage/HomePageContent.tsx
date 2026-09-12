import { ArrowRight } from "lucide-react";
import { SignedIn, SignedOut } from "@clerk/astro/react";

const steps = [
  {
    n: "01",
    title: "Connect once",
    body: "Paste your Lemon Squeezy API key. We watch for failed payments.",
  },
  {
    n: "02",
    title: "Sequence fires",
    body: "Branded emails on day 0, 2, and 5 — your logo, your tone.",
  },
  {
    n: "03",
    title: "Revenue returns",
    body: "Track recoveries live. Pay only when we helped bring it back.",
  },
] as const;

const trust = [
  {
    title: "Native to Lemon Squeezy",
    body: "API key in, webhooks on. No checkout changes.",
  },
  {
    title: "Pay on recovery",
    body: "10% on Free, 4% on Pro — only after money returns.",
  },
  {
    title: "Cards stay with LS",
    body: "Customers update payment in Lemon Squeezy. We never see cards.",
  },
] as const;

export function HomePageContent() {
  return (
    <div className="ln-surface bg-white text-[#08090a]">
      <section id="how" className="scroll-mt-24">
        <div className="mx-auto max-w-[1440px] px-6 py-24 md:py-32 lg:px-10">
          <p className="text-[13px] font-medium text-[#8a8f98]">How it works</p>
          <h2 className="ln-h1 mt-5 max-w-xl text-[clamp(1.75rem,3.2vw,2.6rem)] font-medium leading-[1.1] tracking-[-0.02em] text-[#08090a]">
            Live in minutes. Recover for months.
          </h2>

          <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            {steps.map((step) => (
              <li key={step.n} className="border-t border-black/[0.08] pt-6">
                <span className="text-[13px] font-medium text-[#8a8f98]">
                  {step.n}
                </span>
                <h3 className="mt-4 text-[17px] font-medium tracking-[-0.01em] text-[#08090a]">
                  {step.title}
                </h3>
                <p className="mt-3 text-[14px] leading-[1.6] text-[#8a8f98]">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>

          <div className="mt-14 flex flex-wrap items-center gap-3">
            <SignedOut>
              <a href="/a/sign-up" className="ln-btn ln-btn-primary">
                Grab a founding spot
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
      </section>

      <section className="border-t border-black/[0.06]">
        <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
          <div className="grid md:grid-cols-3">
            {trust.map((item, i) => (
              <div
                key={item.title}
                className={`px-1 py-12 md:px-8 md:py-16 ${
                  i > 0
                    ? "border-t border-black/[0.06] md:border-t-0 md:border-l"
                    : ""
                }`}
              >
                <h3 className="text-[17px] font-medium tracking-[-0.01em] text-[#08090a]">
                  {item.title}
                </h3>
                <p className="mt-3 text-[14px] leading-[1.6] text-[#8a8f98]">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
