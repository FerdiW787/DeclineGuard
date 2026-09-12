import { useEffect, useState } from "react";
import { SignedIn, SignedOut } from "@clerk/astro/react";
import BrandLogo from "@/components/BrandLogo";
import { useClerkClient } from "@/components/auth/useClerkClient";
import { PrimaryCta } from "./CtaButton";

type MarketingNavProps = {
  /** Use hash links for homepage sections when on `/`. */
  homeAnchors?: boolean;
};

export function MarketingNav({ homeAnchors = false }: MarketingNavProps) {
  const [navSolid, setNavSolid] = useState(false);
  const productHref = homeAnchors ? "#features" : "/#features";
  const howHref = homeAnchors ? "#how" : "/#how";

  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 md:px-6 md:pt-5">
      <div
        className={`flex w-full max-w-3xl items-center justify-between gap-3 rounded-xl px-2.5 py-2 transition-[background-color,border-color] duration-200 ease-out sm:gap-4 sm:px-3 ${
          navSolid
            ? "border border-black/5 bg-white/95 shadow-sm"
            : "border border-transparent bg-transparent shadow-none"
        }`}
      >
        <BrandLogo size="sm" className="pl-1.5 sm:pl-2" />

        <nav className="hidden items-center gap-0.5 text-sm font-medium md:flex">
          <a
            href={productHref}
            className="rounded-xl px-3 py-1.5 text-black/70 hover:bg-black/5 hover:text-black"
          >
            Product
          </a>
          <a
            href={howHref}
            className="rounded-xl px-3 py-1.5 text-black/70 hover:bg-black/5 hover:text-black"
          >
            How it works
          </a>
          <a
            href="/pricing"
            className="rounded-xl px-3 py-1.5 text-black/70 hover:bg-black/5 hover:text-black"
          >
            Pricing
          </a>
          <a
            href="/features"
            className="rounded-xl px-3 py-1.5 text-black/70 hover:bg-black/5 hover:text-black"
          >
            Requests
          </a>
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <SignedOut>
            <a
              href="/a/sign-in"
              className="hidden rounded-xl px-3 py-1.5 text-sm font-medium text-black/60 hover:bg-black/5 hover:text-black sm:inline"
            >
              Sign in
            </a>
            <PrimaryCta href="/a/sign-up" size="sm">
              Claim spot
            </PrimaryCta>
          </SignedOut>
          <SignedIn>
            <MarketingLogOutButton />
            <PrimaryCta href="/a/dashboard" size="sm">
              Dashboard
            </PrimaryCta>
          </SignedIn>
        </div>
      </div>
    </header>
  );
}

function MarketingLogOutButton() {
  const { clerk, isLoaded } = useClerkClient();

  return (
    <button
      type="button"
      disabled={!isLoaded || !clerk}
      onClick={() => {
        void clerk?.signOut({ redirectUrl: "/" });
      }}
      className="rounded-xl px-3 py-1.5 text-sm font-medium text-black/60 transition hover:bg-black/5 hover:text-black disabled:opacity-40"
    >
      Log out
    </button>
  );
}
