import {
  MarketingProductPreview,
  marketingProductTabs,
  type MarketingProductTab,
} from "@/components/homepage/marketing/MarketingProductPreview";

const featureCells = [
  {
    title: "Native to Lemon Squeezy",
    body: "API key in, webhooks on. No checkout changes.",
  },
  {
    title: "Pay on recovery",
    body: "10% on Free, 4% on Pro — only after our sequence started and money returns within 30 days.",
  },
  {
    title: "Cards stay with LS",
    body: "Subscribers fix payment in Lemon Squeezy — we never see card data.",
  },
] as const;

type Props = {
  tab: MarketingProductTab;
  onTabChange: (tab: MarketingProductTab) => void;
};

export function LinearFeatures({ tab, onTabChange }: Props) {
  return (
    <section id="features" className="ln-section scroll-mt-28 py-24 md:py-32">
      <div className="ln-container">
        <div className="ln-reveal mx-auto max-w-2xl text-center">
          <p className="ln-eyebrow">Product</p>
          <h2 className="mt-4 text-[clamp(1.75rem,3.5vw,2.5rem)] font-semibold tracking-[-0.03em] text-white">
            Everything you need to recover revenue
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#8a8a8e] md:text-[17px]">
            A focused toolkit for Lemon Squeezy merchants — sequences, branding,
            and a recovered-€ number your team can trust.
          </p>
        </div>

        <div className="ln-reveal mx-auto mt-14 max-w-5xl">
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            {marketingProductTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onTabChange(t.id)}
                className={`cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  tab === t.id
                    ? "bg-white text-black"
                    : "text-[#8a8a8e] hover:bg-white/5 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="overflow-hidden rounded-xl border border-white/10">
            <MarketingProductPreview tab={tab} frameSize="hero" />
          </div>
        </div>

        <div className="ln-reveal mt-10 grid overflow-hidden rounded-xl border border-white/10 md:grid-cols-3">
          {featureCells.map((item, i) => (
            <div
              key={item.title}
              className={`bg-white/[0.02] p-6 md:p-8 ${
                i > 0 ? "border-t border-white/10 md:border-t-0 md:border-l" : ""
              }`}
            >
              <h3 className="text-[15px] font-semibold tracking-tight text-white">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#8a8a8e]">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
