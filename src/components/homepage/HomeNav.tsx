import { useEffect, useState } from "react";
import { SignedIn, SignedOut } from "@clerk/astro/react";
import BrandLogo from "@/components/BrandLogo";
import { useClerkClient } from "@/components/auth/useClerkClient";

const navLinks = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#how" },
  { label: "Pricing", href: "/pricing" },
  { label: "Requests", href: "/features" },
];

export function HomeNav() {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const update = () => setSolid(window.scrollY > 12);
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={`transition-[background-color,border-color,backdrop-filter] duration-300 ${
          solid
            ? "border-b border-black/[0.08] bg-white/90 backdrop-blur-xl"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="relative mx-auto flex h-[68px] max-w-[1440px] items-center justify-between px-6 lg:px-10">
          <BrandLogo size="sm" href="/" />

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 text-[13px] text-[#8a8f98] md:flex">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="rounded-full px-3 py-1.5 transition-colors hover:text-[#08090a]"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-1">
            <SignedOut>
              <a
                href="/a/sign-in"
                className="hidden rounded-full px-3 py-1.5 text-[13px] text-[#8a8f98] transition-colors hover:text-[#08090a] sm:inline"
              >
                Log in
              </a>
              <a href="/a/sign-up" className="ln-btn ln-btn-nav">
                Sign up
              </a>
            </SignedOut>
            <SignedIn>
              <HomeLogOut />
              <a href="/a/dashboard" className="ln-btn ln-btn-nav">
                Dashboard
              </a>
            </SignedIn>
          </div>
        </div>
      </div>
    </header>
  );
}

function HomeLogOut() {
  const { clerk, isLoaded } = useClerkClient();
  return (
    <button
      type="button"
      disabled={!isLoaded || !clerk}
      onClick={() => void clerk?.signOut({ redirectUrl: "/" })}
      className="hidden rounded-full px-3 py-1.5 text-[13px] text-[#8a8f98] transition-colors hover:text-[#08090a] disabled:opacity-40 sm:inline"
    >
      Log out
    </button>
  );
}
