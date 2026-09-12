import { useEffect, useId, useRef, useState } from "react";
import { SignedIn, SignedOut } from "@clerk/astro/react";
import { ChevronDown } from "lucide-react";
import Mascot from "./Mascot";

/**
 * Header layout twin of seline.com:
 * logo left · Pricing · About + avatars · Product ⌄ · Resources ⌄ · | · Sign in · blue CTA
 */
export default function SelineHeader() {
  const [open, setOpen] = useState<"product" | "resources" | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const productId = useId();
  const resourcesId = useId();

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <header
      ref={rootRef}
      className="dg-open-nav sticky top-0 z-50 w-full border-b border-transparent bg-white/90 backdrop-blur-md"
    >
      <div className="mx-auto grid h-[3.75rem] max-w-[1120px] grid-cols-[auto_1fr_auto] items-center gap-3 px-5 md:h-[4.25rem] md:px-8">
        {/* Logo — mascot mark only */}
        <a
          href="/"
          className="inline-flex shrink-0 items-center justify-self-start"
          aria-label="DeclineGuard home"
        >
          <Mascot size="xs" />
        </a>

        {/* Center nav */}
        <nav className="hidden items-center justify-center gap-0.5 justify-self-center lg:flex">
          <a
            href="#pricing"
            className="rounded-md px-3 py-2 text-[15px] font-medium text-[#1a1a1a]/85 transition hover:text-black"
          >
            Pricing
          </a>

          <a
            href="#how"
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-[15px] font-medium text-[#1a1a1a]/85 transition hover:text-black"
          >
            About us
            <span className="flex -space-x-1.5" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="inline-flex size-[22px] items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#e8e8ea] text-[8px] font-semibold text-black/35"
                  title="Team photo placeholder"
                >
                  {i === 0 ? (
                    <img
                      src="/declineguard-mascot.png"
                      alt=""
                      className="size-full object-cover object-[center_20%]"
                    />
                  ) : (
                    "?"
                  )}
                </span>
              ))}
            </span>
          </a>

          <div className="relative">
            <button
              type="button"
              aria-expanded={open === "product"}
              aria-controls={productId}
              onClick={() =>
                setOpen((v) => (v === "product" ? null : "product"))
              }
              className="inline-flex cursor-pointer items-center gap-1 rounded-md px-3 py-2 text-[15px] font-medium text-[#1a1a1a]/85 transition hover:text-black"
            >
              Product
              <ChevronDown
                className={`size-3.5 opacity-55 transition ${
                  open === "product" ? "rotate-180" : ""
                }`}
              />
            </button>
            {open === "product" ? (
              <div
                id={productId}
                className="absolute left-1/2 top-full z-50 mt-1 min-w-[11rem] -translate-x-1/2 overflow-hidden rounded-xl border border-black/8 bg-white py-1.5 shadow-[0_16px_40px_-20px_rgba(0,0,0,0.35)]"
              >
                {[
                  ["#product", "Overview"],
                  ["#product", "Recoveries"],
                  ["#product", "Sequences"],
                  ["#how", "How it works"],
                ].map(([href, label]) => (
                  <a
                    key={label}
                    href={href}
                    onClick={() => setOpen(null)}
                    className="block px-3.5 py-2 text-sm font-medium text-black/75 hover:bg-black/[0.04] hover:text-black"
                  >
                    {label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              type="button"
              aria-expanded={open === "resources"}
              aria-controls={resourcesId}
              onClick={() =>
                setOpen((v) => (v === "resources" ? null : "resources"))
              }
              className="inline-flex cursor-pointer items-center gap-1 rounded-md px-3 py-2 text-[15px] font-medium text-[#1a1a1a]/85 transition hover:text-black"
            >
              Resources
              <ChevronDown
                className={`size-3.5 opacity-55 transition ${
                  open === "resources" ? "rotate-180" : ""
                }`}
              />
            </button>
            {open === "resources" ? (
              <div
                id={resourcesId}
                className="absolute left-1/2 top-full z-50 mt-1 min-w-[11rem] -translate-x-1/2 overflow-hidden rounded-xl border border-black/8 bg-white py-1.5 shadow-[0_16px_40px_-20px_rgba(0,0,0,0.35)]"
              >
                {[
                  ["#pricing", "Pricing"],
                  ["#how", "FAQ"],
                  ["/a/sign-up", "Get started"],
                ].map(([href, label]) => (
                  <a
                    key={label}
                    href={href}
                    onClick={() => setOpen(null)}
                    className="block px-3.5 py-2 text-sm font-medium text-black/75 hover:bg-black/[0.04] hover:text-black"
                  >
                    {label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2 justify-self-end sm:gap-3">
          <span
            className="hidden h-5 w-px bg-black/12 lg:block"
            aria-hidden
          />
          <SignedOut>
            <a
              href="/a/sign-in"
              className="hidden px-2.5 py-2 text-[15px] font-medium text-[#1a1a1a]/75 transition hover:text-black sm:inline"
            >
              Sign in
            </a>
            <a
              href="/a/sign-up"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-[#3b82f6] px-3.5 text-[14px] font-semibold text-white shadow-sm transition hover:bg-[#2563eb] sm:h-10 sm:px-4 sm:text-[15px]"
            >
              Start free trial
            </a>
          </SignedOut>
          <SignedIn>
            <a
              href="/a/dashboard"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-[#3b82f6] px-3.5 text-[14px] font-semibold text-white shadow-sm transition hover:bg-[#2563eb] sm:h-10 sm:px-4 sm:text-[15px]"
            >
              Dashboard
            </a>
          </SignedIn>
        </div>
      </div>
    </header>
  );
}
