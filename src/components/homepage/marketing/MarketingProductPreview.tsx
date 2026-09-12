import { useEffect, useState, type ComponentType } from "react";
import { MarketingProductFrame } from "./MarketingProductFrame";

export type MarketingProductTab =
  | "dashboard"
  | "recoveries"
  | "sequences"
  | "customizations"
  | "settings";

export const marketingProductTabs = [
  { id: "dashboard" as const, label: "Overview" },
  { id: "recoveries" as const, label: "Recoveries" },
  { id: "sequences" as const, label: "Sequences" },
  { id: "customizations" as const, label: "Customizations" },
  { id: "settings" as const, label: "Settings" },
];

type Props = {
  tab: MarketingProductTab;
  frameSize?: "default" | "hero";
  className?: string;
  theme?: "light" | "dark";
};

function previewTitle(tab: MarketingProductTab) {
  if (tab === "dashboard") return "Overview — Cool SaaS";
  if (tab === "recoveries") return "Recoveries — Cool SaaS";
  if (tab === "sequences") return "Sequences — Cool SaaS";
  if (tab === "settings") return "Settings — Cool SaaS";
  return "Customizations — Cool SaaS";
}

export function MarketingProductPreview({
  tab,
  frameSize = "default",
  className = "",
  theme = "light",
}: Props) {
  const [Inner, setInner] = useState<ComponentType<{
    tab: MarketingProductTab;
  }> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("./MarketingProductPreviewInner").then((mod) => {
      if (!cancelled) {
        setInner(() => mod.MarketingProductPreviewInner);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <MarketingProductFrame
      title={previewTitle(tab)}
      size={frameSize}
      className={className}
      theme={theme}
    >
      {Inner ? (
        <Inner tab={tab} />
      ) : (
        <div
          className={`flex h-full min-h-0 items-center justify-center text-sm ${
            theme === "dark" ? "text-white/40" : "text-black/40"
          }`}
        >
          Loading dashboard preview…
        </div>
      )}
    </MarketingProductFrame>
  );
}
