import { GuardianFists } from "@/components/homepage/GuardianFists";

export function LinearGuardian() {
  return (
    <section className="ln-section dg-guardian relative overflow-hidden py-28 md:py-36">
      <GuardianFists />

      <div className="ln-container relative z-10">
        <div className="ln-reveal mx-auto max-w-xl text-center">
          <p className="ln-eyebrow">The guardian</p>
          <h2 className="mt-5 text-[clamp(1.85rem,4vw,2.75rem)] font-semibold leading-[1.1] tracking-[-0.035em] text-white">
            Lemon Squeezy retries the card.
            <span className="mt-2 block text-[#8a8a8e]">
              We guard the relationship.
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-[#8a8a8e] md:text-[17px]">
            Generic dunning emails feel like spam. DeclineGuard sends recovery
            sequences that look and sound like your product — with a dashboard to
            prove it worked.
          </p>
        </div>
      </div>
    </section>
  );
}
