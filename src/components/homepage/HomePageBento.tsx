import { ArrowRight, Plus } from "lucide-react";
import { SignedIn, SignedOut } from "@clerk/astro/react";
import BrandLogo from "@/components/BrandLogo";
import { formatDeclineAddon, formatUsd, PLANS } from "@/lib/pricing";

export const homeFaqs = [
  {
    q: "Isn’t Lemon Squeezy enough?",
    a: "Retries and generic notices, yes. Branded sequences that sound like your product — and a recovered-€ number you can actually show your team — that’s us.",
  },
  {
    q: "When do you take a cut?",
    a: "Only on Free, and only after DeclineGuard’s sequence has started and the payment comes back. Recover before our first email? You owe nothing. See pricing for details.",
  },
  {
    q: "Do you ever see card numbers?",
    a: "No. Customers update payment through Lemon Squeezy. We don’t touch cards — ever.",
  },
  {
    q: "When is Pro worth it?",
    a: `When ${PLANS.free.includedDeclinesPerMonth} declines a month isn’t enough. Pro is ${formatUsd(PLANS.pro.monthlyPriceUsd)}/mo with ${PLANS.pro.includedDeclinesPerMonth} declines, unlimited stores, and no DeclineGuard badge. Need more than that? Stack ${formatDeclineAddon()}.`,
  },
] as const;

export function HomePageFaq() {
  return (
    <section className="ln-surface border-t border-black/[0.06] bg-white text-[#08090a]">
      <div className="mx-auto max-w-[1440px] px-6 py-24 md:py-32 lg:px-10">
        <div className="dg-section-head grid gap-12 lg:grid-cols-[minmax(0,18rem)_1fr] lg:gap-24">
          <div>
            <p className="text-[13px] font-medium text-[#8a8f98]">FAQ</p>
            <h2 className="ln-h1 mt-5 text-[clamp(1.75rem,3.2vw,2.6rem)] font-medium leading-[1.1] tracking-[-0.02em] text-[#08090a]">
              Straight answers
            </h2>
            <p className="mt-5 max-w-xs text-[15px] leading-[1.6] text-[#8a8f98]">
              No hand-waving. If it matters to your store, it&apos;s here.
            </p>
          </div>

          <div className="min-w-0">
            {homeFaqs.map((item) => (
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
        </div>
      </div>
    </section>
  );
}

export function HomePageFinalCta() {
  return (
    <section className="ln-surface relative overflow-hidden border-t border-black/[0.06] bg-white text-[#08090a]">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 0%, rgba(16,185,129,0.14), transparent 70%)",
        }}
      />
      <div className="relative z-10 mx-auto flex max-w-[1440px] flex-col items-center px-6 py-28 text-center md:py-36 lg:px-10">
        <h2 className="dg-section-head ln-h1 max-w-2xl text-[clamp(1.9rem,4vw,3.25rem)] font-medium leading-[1.08] tracking-[-0.022em] text-[#08090a]">
          Don&apos;t let a declined card end the subscription
        </h2>
        <p className="dg-section-head mx-auto mt-6 max-w-md text-[15px] leading-[1.65] text-[#8a8f98]">
          Connect Lemon Squeezy in 10 seconds. Pay only when we help recover.
        </p>
        <div className="dg-section-head mt-9 flex flex-wrap items-center justify-center gap-3">
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
  );
}

export function HomePageFooter() {
  return (
    <footer className="ln-surface border-t border-black/[0.08] bg-white text-[#8a8f98]">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-6 px-6 py-10 text-center sm:flex-row sm:text-left lg:px-10">
        <BrandLogo size="sm" href="/" />
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px]">
          <a href="/pricing" className="transition-colors hover:text-[#08090a]">
            Pricing
          </a>
          <a href="/features" className="transition-colors hover:text-[#08090a]">
            Feature requests
          </a>
          <a href="/a/sign-in" className="transition-colors hover:text-[#08090a]">
            Sign in
          </a>
          <a
            href="/legal/impressum"
            className="transition-colors hover:text-[#08090a]"
          >
            Impressum
          </a>
          <a
            href="/legal/privacy"
            className="transition-colors hover:text-[#08090a]"
          >
            Privacy
          </a>
          <a
            href="/legal/terms"
            className="transition-colors hover:text-[#08090a]"
          >
            Terms
          </a>
          <a href="/legal/dpa" className="transition-colors hover:text-[#08090a]">
            DPA
          </a>
          <span className="text-[#6b7078]">
            © {new Date().getFullYear()} DeclineGuard
          </span>
        </div>
      </div>
    </footer>
  );
}
