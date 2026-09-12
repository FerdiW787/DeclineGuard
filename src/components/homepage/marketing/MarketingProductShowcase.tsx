import {
  MarketingProductPreview,
  marketingProductTabs,
  type MarketingProductTab,
} from "./MarketingProductPreview";

type Props = {
  tab: MarketingProductTab;
  onTabChange: (tab: MarketingProductTab) => void;
  size?: "default" | "hero";
  className?: string;
};

export function MarketingProductShowcase({
  tab,
  onTabChange,
  size = "default",
  className = "",
}: Props) {
  return (
    <div className={className}>
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {marketingProductTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTabChange(t.id)}
            className={`cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              tab === t.id
                ? "bg-[#0c0a09] text-white"
                : "text-black/50 hover:bg-black/5 hover:text-black"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <MarketingProductPreview tab={tab} frameSize={size} />
    </div>
  );
}
