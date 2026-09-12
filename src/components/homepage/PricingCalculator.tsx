import { useMemo, useState } from "react";
import {
  calculatePlanCost,
  formatUsd,
  getRecommendedPlan,
  PLANS,
  proBreakevenRecoveredUsd,
  type PlanId,
} from "@/lib/pricing";

function SliderField({
  id,
  label,
  hint,
  value,
  min,
  max,
  step,
  formatValue,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  formatValue: (n: number) => string;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-[#08090a]">
          {label}
        </label>
        <span className="text-lg tabular-nums tracking-tight text-[#08090a]">
          {formatValue(value)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-black/10 accent-[#08090a]"
      />
      <p className="mt-2 text-[12px] leading-relaxed text-[#8a8a8e]">{hint}</p>
    </div>
  );
}

function CostCard({
  planId,
  recoveredUsd,
  emailsSent,
  extraStores,
  highlighted,
}: {
  planId: PlanId;
  recoveredUsd: number;
  emailsSent: number;
  extraStores: number;
  highlighted: boolean;
}) {
  const plan = PLANS[planId];
  const cost = calculatePlanCost(planId, {
    recoveredUsd,
    recoveryEmailsSent: emailsSent,
    extraStoresOnFree: planId === "free" ? extraStores : 0,
  });

  return (
    <div
      className={`rounded-2xl border p-6 transition-shadow ${
        highlighted
          ? "border-black/15 bg-[#f7f8f8]"
          : "border-black/[0.08] bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-[#8a8a8e]">{plan.name}</p>
        {highlighted ? (
          <span className="rounded-full bg-[#08090a] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#f7f8f8]">
            Best fit
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-3xl tracking-tight tabular-nums">
        {formatUsd(cost.totalMonthlyUsd)}
        <span className="text-base font-medium text-black/35">/mo</span>
      </p>
      {cost.extraStoresOneTimeUsd > 0 ? (
        <p className="mt-1 text-[12px] text-[#8a8a8e]">
          + {formatUsd(cost.extraStoresOneTimeUsd)} one-time store add-ons (first
          month only)
        </p>
      ) : null}
      <dl className="mt-5 space-y-2 border-t border-black/[0.08] pt-4 text-[13px]">
        <div className="flex justify-between gap-4 text-[#8a8a8e]">
          <dt>Subscription</dt>
          <dd className="tabular-nums">{formatUsd(cost.baseUsd)}</dd>
        </div>
        <div className="flex justify-between gap-4 text-[#8a8a8e]">
          <dt>Recovery fee ({plan.recoveryFeePercent}%)</dt>
          <dd className="tabular-nums">{formatUsd(cost.recoveryFeeUsd)}</dd>
        </div>
        {cost.emailOverageUsd > 0 ? (
          <div className="flex justify-between gap-4 text-[#8a8a8e]">
            <dt>Email overage</dt>
            <dd className="tabular-nums">{formatUsd(cost.emailOverageUsd)}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

export default function PricingCalculator() {
  const [recoveredUsd, setRecoveredUsd] = useState(800);
  const [emailsSent, setEmailsSent] = useState(120);
  const [extraStores, setExtraStores] = useState(0);

  const recommended = useMemo(
    () =>
      getRecommendedPlan({
        recoveredUsd,
        recoveryEmailsSent: emailsSent,
        extraStoresOnFree: extraStores,
      }),
    [recoveredUsd, emailsSent, extraStores],
  );

  const breakeven = proBreakevenRecoveredUsd();

  return (
    <section className="mx-auto mt-20 max-w-4xl md:mt-24">
      <div className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/35">
          Plan calculator
        </p>
        <h2 className="mt-3 text-2xl tracking-tight md:text-3xl">
          See what you&apos;d pay
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-[#8a8a8e]">
          Slide your typical recovered revenue and email volume. Pro usually
          wins above about {formatUsd(breakeven)}/mo recovered — before overage
          packs.
        </p>
      </div>

      <div className="mt-10 rounded-xl border border-black/[0.08] bg-white p-6 md:p-8">
        <div className="grid gap-8 md:grid-cols-2 md:gap-10">
          <div className="space-y-8">
            <SliderField
              id="recovered"
              label="Recovered per month"
              hint="Subscription revenue DeclineGuard helped bring back."
              value={recoveredUsd}
              min={0}
              max={10000}
              step={50}
              formatValue={(n) => formatUsd(n)}
              onChange={setRecoveredUsd}
            />
            <SliderField
              id="emails"
              label="Recovery emails sent"
              hint="Each failed payment uses up to 3 emails in the sequence."
              value={emailsSent}
              min={0}
              max={800}
              step={10}
              formatValue={(n) => `${n} / mo`}
              onChange={setEmailsSent}
            />
            <SliderField
              id="stores"
              label="Extra stores (Free only)"
              hint="Free includes 1 store. Each extra is $5 one-time."
              value={extraStores}
              min={0}
              max={5}
              step={1}
              formatValue={(n) => String(n)}
              onChange={setExtraStores}
            />
          </div>

          <div className="grid gap-4">
            <CostCard
              planId="free"
              recoveredUsd={recoveredUsd}
              emailsSent={emailsSent}
              extraStores={extraStores}
              highlighted={recommended === "free"}
            />
            <CostCard
              planId="pro"
              recoveredUsd={recoveredUsd}
              emailsSent={emailsSent}
              extraStores={extraStores}
              highlighted={recommended === "pro"}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
