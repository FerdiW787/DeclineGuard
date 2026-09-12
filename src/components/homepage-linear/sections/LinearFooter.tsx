import BrandLogo from "@/components/BrandLogo";

const columns = [
  {
    title: "Product",
    links: [
      { href: "#features", label: "Features" },
      { href: "#how", label: "How it works" },
      { href: "/pricing", label: "Pricing" },
      { href: "/features", label: "Feature requests" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/a/sign-in", label: "Sign in" },
      { href: "/a/sign-up", label: "Sign up" },
      { href: "#faq", label: "FAQ" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/impressum", label: "Impressum" },
      { href: "/legal/privacy", label: "Privacy" },
      { href: "/legal/terms", label: "Terms" },
      { href: "/legal/dpa", label: "DPA" },
    ],
  },
] as const;

export function LinearFooter() {
  return (
    <footer className="ln-section py-14 md:py-16">
      <div className="ln-container">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <div>
            <BrandLogo size="sm" href="/" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#8a8a8e]">
              Branded recovery for Lemon Squeezy merchants.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-[13px] font-medium text-[#08090a]">{col.title}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href + link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-[#8a8a8e] hover:text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-12 border-t border-white/10 pt-6 text-sm text-[#8a8a8e]">
          © {new Date().getFullYear()} DeclineGuard
        </p>
      </div>
    </footer>
  );
}
