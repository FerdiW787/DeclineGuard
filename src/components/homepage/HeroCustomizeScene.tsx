import { useLayoutEffect, useRef, useState } from "react";
import { BrandWordSwap } from "./BrandWordSwap";
import CRTWarp from "./crt-warp/CRTWarp";
import EmailPreviewBody from "@/components/dashboard/EmailPreviewBody";
import { blocksFromGuided, DEFAULT_EMAIL_PADDING } from "@/lib/emailBuilder";

const BRAND_WORDS = ["Personality", "Charisma", "Brand"] as const;

const AMONEN_PRIMARY = "#c6fe1e";
const AMONEN_BUTTON = "#c6fe1e";
const AMONEN_BUTTON_TEXT = "#00160d";
const AMONEN_SECONDARY = "#666666";
const AMONEN_LINKS = "#666666";
const AMONEN_LOGO = "/marketing/amonen-mark.png";
const HEADER_IMAGE =
  "https://images.unsplash.com/photo-1777661712187-ffdf721f238d?q=80&w=3432&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

const DEMO_BLOCKS = blocksFromGuided({
  headline: "Quick update on your subscription",
  body: "We couldn’t charge **{{amount}}** for **{{product}}**. Update your card below — takes about a minute.",
  ctaLabel: "Update payment method",
  image: {
    enabled: true,
    src: HEADER_IMAGE,
    alt: "Amonen brand image",
    heightPx: 104,
    zoom: 2.4,
  },
  secondaryLink: {
    enabled: true,
    prefix: "Or ",
    label: "open the billing page",
    suffix: " to update your card.",
  },
});

export function HeroCustomizeScene() {
  const clipRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useLayoutEffect(() => {
    const clip = clipRef.current;
    const card = cardRef.current;
    if (!clip || !card) return;
    const apply = () => {
      const clipH = clip.clientHeight;
      const shift = `${Math.min(0, clipH - card.scrollHeight)}px`;
      clip.style.setProperty("--email-shift", shift);
      card.style.setProperty("--email-shift", shift);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(card);
    ro.observe(clip);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className={revealed ? "ln-customize-panel is-revealed" : "ln-customize-panel"}
      onMouseEnter={() => setRevealed(true)}
      onMouseLeave={() => setRevealed(false)}
    >
      <div className="ln-customize-copy">
        <p className="ln-h1 flex flex-wrap items-center text-[clamp(1.85rem,3.4vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.035em] text-[#08090a]">
          <span>Your&nbsp;</span>
          <BrandWordSwap texts={BRAND_WORDS} />
        </p>
        <p className="ln-h1 mt-1 text-[clamp(1.85rem,3.4vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.035em] text-[#08090a]">
          Our Expertise
        </p>
        <p className="mt-4 max-w-[22rem] text-[15px] leading-[1.45] tracking-[-0.011em] text-[#8a8f98]">
          We write it in your voice, send it when a card fails, and bring the
          payment back.
        </p>
      </div>
      <div className="ln-customize-stage">
        <div className="ln-customize-crt">
          <CRTWarp
            color="#c6fe1e"
            backgroundColor="#c6fe1e"
            speed={0}
            curvature={0.22}
            scanlineStrength={0.22}
            scanlineFrequency={180}
            waveAmplitude={0.28}
            waveFrequency={2.4}
            bloom={1.45}
            bloomRadius={1}
            noise={0.08}
            vignette={0.18}
            brightness={1.2}
            pixelation={1}
            rgbShift={0.012}
            mouseReact={false}
            mouseStrength={0}
            dpr={1}
            fps={24}
          />
        </div>
        <div className="ln-customize-email">
          <div ref={clipRef} className="ln-customize-email__clip dg-keep-light">
            <div ref={cardRef} className="ln-customize-email__mover">
              <EmailPreviewBody
                className="ln-customize-email__card px-6 py-8"
                content={{
                  headline: "Quick update on your subscription",
                  body: "We couldn’t charge €29 for Pro Monthly. Update your card below — takes about a minute.",
                  cta: "Update payment method",
                }}
                blocks={DEMO_BLOCKS}
                storeName="Amonen"
                storeLogoUrl={AMONEN_LOGO}
                primary={AMONEN_PRIMARY}
                secondary={AMONEN_SECONDARY}
                emailFont="inter"
                linkColor={AMONEN_LINKS}
                emailPadding={DEFAULT_EMAIL_PADDING}
                ctaStyle={{
                  backgroundColor: AMONEN_BUTTON,
                  textColor: AMONEN_BUTTON_TEXT,
                  borderRadiusPx: 12,
                }}
                emailBackgroundColor="#ffffff"
                emailTextColor="#0c0c0c"
                customerFirstName="Maya"
                previewVars={{
                  product: "Pro Monthly",
                  amount: "€29",
                  firstName: "Maya",
                }}
                footerSupport="hey@gmail.com"
                socialLinks={[
                  ["X", "https://x.com"],
                  ["LinkedIn", "https://linkedin.com"],
                  ["YouTube", "https://youtube.com"],
                  ["Instagram", "https://instagram.com"],
                ]}
                showDeclineGuardBadge
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
