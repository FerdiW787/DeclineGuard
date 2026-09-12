const proof = [
  {
    label: "Native",
    title: "Lemon Squeezy",
    body: "API key + webhooks. No checkout rewrite.",
  },
  {
    label: "Pricing",
    title: "Free or Pro",
    body: "10% on Free, 4% on Pro — only when we recover.",
  },
  {
    label: "Security",
    title: "No card data",
    body: "Updates happen in Lemon Squeezy.",
  },
] as const;

export function LinearTrust() {
  return (
    <section className="ln-section py-20 md:py-24">
      <div className="ln-container">
        <div className="ln-reveal mb-10 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="ln-eyebrow">Why merchants choose us</p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-white md:text-2xl">
              Built for category-leading stores on Lemon Squeezy
            </h2>
          </div>
          <a
            href="/pricing"
            className="text-sm font-medium text-[#8a8a8e] hover:text-white"
          >
            See pricing →
          </a>
        </div>

        <div className="ln-reveal grid overflow-hidden rounded-xl border border-white/10 sm:grid-cols-3">
          {proof.map((item, i) => (
            <div
              key={item.title}
              className={`flex min-h-[9rem] flex-col justify-center bg-white/[0.02] p-6 md:p-8 ${
                i > 0 ? "border-t border-white/10 sm:border-t-0 sm:border-l" : ""
              }`}
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8a8a8e]">
                {item.label}
              </p>
              <p className="mt-3 text-base font-semibold text-white">
                {item.title}
              </p>
              <p className="mt-1.5 text-sm text-[#8a8a8e]">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
