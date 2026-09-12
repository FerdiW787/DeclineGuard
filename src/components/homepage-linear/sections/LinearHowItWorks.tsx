import { ArrowRight } from "lucide-react";
import { SignedIn, SignedOut } from "@clerk/astro/react";
import { LinearCta } from "../LinearCta";

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

export function LinearHowItWorks() {
  return (
    <section id="how" className="ln-section scroll-mt-28 py-24 md:py-32">
      <div className="ln-container">
        <div className="ln-reveal max-w-xl">
          <p className="ln-eyebrow">How it works</p>
          <h2 className="mt-4 text-[clamp(1.75rem,3.5vw,2.5rem)] font-semibold tracking-[-0.03em] text-white">
            Live in minutes.
            <br />
            Recover for months.
          </h2>
        </div>

        <ol className="ln-reveal mt-16 grid gap-0 overflow-hidden rounded-xl border border-white/10 md:grid-cols-3">
          {steps.map((step, i) => (
            <li
              key={step.n}
              className={`bg-white/[0.02] p-6 md:p-8 ${
                i > 0 ? "border-t border-white/10 md:border-t-0 md:border-l" : ""
              }`}
            >
              <span className="text-xs font-medium tracking-wide text-[#8a8a8e]">
                {step.n}
              </span>
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-white">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#8a8a8e] md:text-[15px]">
                {step.body}
              </p>
            </li>
          ))}
        </ol>

        <div className="ln-reveal mt-12 flex flex-wrap items-center gap-3">
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
    </section>
  );
}
