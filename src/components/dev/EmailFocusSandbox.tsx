import { useState } from "react";
import CustomizationsPage from "@/components/dashboard/CustomizationsPage";
import {
  marketingOpenFailures,
  marketingStore,
} from "@/components/homepage/marketing/demoData";
import {
  createImageBlock,
  defaultEmailDocument,
} from "@/lib/emailBuilder";

const sandboxGentle = defaultEmailDocument("gentle");
const sandboxEmailCopy = {
  gentle: {
    ...sandboxGentle,
    blocks: [
      createImageBlock({
        src: "/mascot/sections/product.png",
        alt: "Product",
        width: 100,
        heightPx: 200,
      }),
      ...sandboxGentle.blocks,
    ],
  },
};

/** Local sandbox to try email hover + focus mode without signing in. */
export default function EmailFocusSandbox() {
  const [focusMode, setFocusMode] = useState(false);

  return (
    <div
      className="dg-shell light flex h-dvh overflow-hidden text-[#08090a] transition-colors duration-500"
      style={focusMode ? { background: "#ffffff" } : undefined}
    >
      <aside
        className={`relative z-20 flex w-[248px] shrink-0 flex-col overflow-hidden bg-[#f7f8f8] transition-[margin] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          focusMode ? "-ml-[248px] pointer-events-none" : ""
        }`}
      >
        <div className="px-5 py-5 text-[13px] font-semibold tracking-[-0.02em]">
          DeclineGuard
        </div>
        <p className="px-5 text-[12px] text-[#8a8f98]">Customizations</p>
      </aside>
      <div className="relative z-10 flex min-w-0 flex-1 overflow-hidden">
        <CustomizationsPage
          storeName={marketingStore.name}
          storeLogoUrl={marketingStore.logoUrl}
          brandColor={marketingStore.brandColor}
          secondaryColor={marketingStore.secondaryColor}
          fromName={marketingStore.fromName}
          replyToEmail={marketingStore.replyToEmail}
          supportEmail={marketingStore.supportEmail}
          socialX={marketingStore.socialX}
          socialLinkedin={marketingStore.socialLinkedin}
          socialYoutube={marketingStore.socialYoutube}
          socialInstagram={marketingStore.socialInstagram}
          emailCopy={sandboxEmailCopy}
          showDeclineGuardBadge={marketingStore.showDeclineGuardBadge}
          openFailures={marketingOpenFailures}
          fromAddressHint={marketingStore.fromAddressHint}
          onFocusModeChange={setFocusMode}
          onSave={async () => undefined}
        />
      </div>
    </div>
  );
}
