import SideRays from "./SideRays";

export function HeroDashboardScene() {
  return (
    <div className="ln-customize-panel">
      <div className="ln-customize-rays" aria-hidden="true">
        <SideRays
          speed={0}
          rayColor1="#fff"
          rayColor2="#84CC16"
          intensity={10}
          spread={2}
          origin="bottom-left"
          tilt={0}
          saturation={1.5}
          blend={0.5}
          falloff={5}
          opacity={1.0}
        />
      </div>
      <div className="ln-customize-copy">
        <p className="ln-h1 text-[clamp(1.85rem,3.4vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.035em] text-[#08090a]">
          Recovery Made Easy
        </p>
        <p className="ln-h1 mt-1 text-[clamp(1.85rem,3.4vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.035em] text-[#08090a]">
          And Even Better
        </p>
        <p className="mt-4 text-[15px] leading-[1.45] tracking-[-0.011em] text-[#8a8f98]">
          Every decline, back on the board — as you.
        </p>
      </div>
      <div className="ln-dash-shot">
        <img
          src="/marketing/dashboard-preview.png?v=4"
          alt="DeclineGuard dashboard with recovered revenue this month"
          width={3200}
          height={1880}
        />
        <div className="ln-dash-shimmer" aria-hidden="true" />
      </div>
    </div>
  );
}
