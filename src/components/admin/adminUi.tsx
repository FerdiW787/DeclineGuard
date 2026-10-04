import type { ReactNode } from "react";
import SegmentedControl from "@/components/dashboard/SegmentedControl";
import {
  ADMIN_METRICS_PERIODS,
  ADMIN_PERIOD_META,
  type AdminMetricsPeriod,
} from "@/lib/adminMetrics";

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header
      data-enter
      className="mb-6 flex shrink-0 flex-wrap items-start justify-between gap-4"
    >
      <div className="max-w-xl">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a8f98]">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className={`font-display text-3xl leading-[1.15] tracking-tight text-[#08090a] md:text-4xl ${
            eyebrow ? "mt-2" : ""
          }`}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-[#6b6f76]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

export function AdminCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-black/8 bg-white ${className}`}
    >
      {children}
    </section>
  );
}

export function AdminEmptyState({
  icon,
  title,
  body,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon ? <div className="mb-4 text-[#8a8f98]">{icon}</div> : null}
      <p className="font-display text-lg tracking-tight text-[#08090a]">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-[#6b6f76]">
        {body}
      </p>
    </div>
  );
}

const PERIOD_OPTIONS = ADMIN_METRICS_PERIODS.map((id) => ({
  id,
  label: ADMIN_PERIOD_META[id].short,
}));

export function AdminPeriodToggle({
  value,
  onChange,
  ariaLabel,
}: {
  value: AdminMetricsPeriod;
  onChange: (next: AdminMetricsPeriod) => void;
  ariaLabel: string;
}) {
  return (
    <SegmentedControl
      options={PERIOD_OPTIONS}
      value={value}
      onChange={onChange}
      ariaLabel={ariaLabel}
    />
  );
}
