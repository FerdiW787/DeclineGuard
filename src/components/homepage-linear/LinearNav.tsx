import { useEffect, useState } from "react";
import { SignedIn, SignedOut } from "@clerk/astro/react";
import BrandLogo from "@/components/BrandLogo";
import { useClerkClient } from "@/components/auth/useClerkClient";
import { LinearCta } from "./LinearCta";

export function LinearNav() {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={`border-b transition-[background-color,border-color,backdrop-filter] duration-200 ${
          solid
            ? "border-black/[0.08] bg-[#f7f8f8]/90 backdrop-blur-xl"
            : "border-transparent bg-transparent"
        }`}
      >
        <div className="ln-container flex h-14 items-center justify-between gap-4 md:h-16">
          <BrandLogo size="sm" href="/" />

          <nav className="hidden items-center gap-1 text-[13px] font-medium text-[#8a8a8e] md:flex">
            <a href="/#product" className="rounded-md px-3 py-1.5 hover:text-[#08090a]">
              Product
            </a>
            <a href="/#features" className="rounded-md px-3 py-1.5 hover:text-[#08090a]">
              Features
            </a>
            <a href="/#how" className="rounded-md px-3 py-1.5 hover:text-[#08090a]">
              How it works
            </a>
            <a href="/#faq" className="rounded-md px-3 py-1.5 hover:text-[#08090a]">
              FAQ
            </a>
            <a href="/pricing" className="rounded-md px-3 py-1.5 hover:text-[#08090a]">
              Pricing
            </a>
            <a href="/features" className="rounded-md px-3 py-1.5 hover:text-[#08090a]">
              Requests
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <SignedOut>
              <a
                href="/a/sign-in"
                className="hidden text-[13px] font-medium text-[#8a8a8e] hover:text-[#08090a] sm:inline"
              >
                Log in
              </a>
              <LinearCta href="/a/sign-up" className="!px-4 !py-1.5 text-[13px]">
                Sign up
              </LinearCta>
            </SignedOut>
            <SignedIn>
              <LinearLogOut />
              <LinearCta href="/a/dashboard" className="!px-4 !py-1.5 text-[13px]">
                Dashboard
              </LinearCta>
            </SignedIn>
          </div>
        </div>
      </div>
    </header>
  );
}

function LinearLogOut() {
  const { clerk, isLoaded } = useClerkClient();
  return (
    <button
      type="button"
      disabled={!isLoaded || !clerk}
      onClick={() => void clerk?.signOut({ redirectUrl: "/" })}
      className="hidden text-[13px] font-medium text-[#8a8a8e] hover:text-[#08090a] disabled:opacity-40 sm:inline"
    >
      Log out
    </button>
  );
}
