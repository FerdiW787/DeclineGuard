import { ArrowRight } from "lucide-react";
import { SignedIn, SignedOut } from "@clerk/astro/react";
import { LinearCta } from "../LinearCta";

export function LinearFinalCta() {
  return (
    <section className="ln-section py-28 md:py-36">
      <div className="ln-container">
        <div className="ln-reveal mx-auto max-w-2xl text-center">
          <h2 className="text-[clamp(1.85rem,4.2vw,3rem)] font-semibold leading-[1.1] tracking-[-0.04em] text-white">
            Don&apos;t let a declined card end the subscription
          </h2>
          <p className="mx-auto mt-5 max-w-md text-base text-[#8a8a8e] md:text-lg">
            Connect Lemon Squeezy in seconds. Pay only when we help recover.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
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
      </div>
    </section>
  );
}
