import { useId, useState, type FormEvent, type ReactNode } from "react";

const CHART_BARS = [
  { h: 38, label: "W1", value: "€96" },
  { h: 52, label: "W2", value: "€132" },
  { h: 34, label: "W3", value: "€84" },
  { h: 68, label: "W4", value: "€168" },
  { h: 58, label: "W5", value: "€144" },
  { h: 82, label: "W6", value: "€204" },
  { h: 72, label: "W7", value: "€180" },
  { h: 88, label: "W8", value: "€216" },
  { h: 62, label: "W9", value: "€156" },
  { h: 94, label: "W10", value: "€228" },
] as const;

const FAILED = [
  ["maya@studio.io", "€29"],
  ["alex@build.co", "€49"],
  ["sam@ship.app", "€19"],
] as const;

/** Shared glass shell — opaque enough to stay crisp under orbit transforms */
export function Glass({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[1.15rem] border border-black/10 bg-white ${className}`}
    >
      {children}
    </div>
  );
}

export function AskCard() {
  const [value, setValue] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setValue("");
  }

  return (
    <div className="dg-fly-ask pointer-events-auto relative z-20">
      <Glass className="px-1 py-1">
        <form
          onSubmit={onSubmit}
          className="flex items-center gap-2 rounded-[0.9rem] px-3 py-2 transition focus-within:bg-white/50"
        >
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="What's recovering this week?"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-black/35"
            aria-label="Ask about recoveries"
          />
          <button
            type="submit"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#111] text-sm text-white transition hover:bg-[#2a2a2a] active:scale-95"
            aria-label="Send"
          >
            ↑
          </button>
        </form>
      </Glass>
    </div>
  );
}

export function RecoveredCard() {
  const tipId = useId();
  const [hover, setHover] = useState<number | null>(null);

  return (
    <div className="dg-fly-recovered pointer-events-auto relative z-20 col-span-2 md:col-span-3">
      <Glass className="h-full p-4 md:p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-black/45">
          Recovered
        </p>
        <div className="mt-1.5 flex items-end gap-2.5">
          <p className="font-display text-[2.1rem] leading-none tracking-tight md:text-[2.4rem]">
            €1,284
          </p>
          <p className="mb-0.5 text-xs font-semibold text-emerald-700">
            +18%
          </p>
        </div>
        <div
          className="relative mt-5 flex h-11 items-end gap-[3px] md:h-12"
          onMouseLeave={() => setHover(null)}
        >
          {CHART_BARS.map((bar, i) => (
            <button
              key={bar.label}
              type="button"
              className="relative flex flex-1 cursor-pointer items-end justify-center outline-none"
              style={{ height: "100%" }}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-describedby={hover === i ? tipId : undefined}
              aria-label={`${bar.label}: ${bar.value} recovered`}
            >
              <span
                className={`w-full rounded-full transition ${
                  hover === i
                    ? "bg-purple-600"
                    : hover === null
                      ? "bg-[#1a1a1a]/85"
                      : "bg-[#1a1a1a]/22"
                }`}
                style={{ height: `${bar.h}%` }}
              />
            </button>
          ))}
          {hover !== null ? (
            <div
              id={tipId}
              role="tooltip"
              className="pointer-events-none absolute -top-1 left-1/2 z-30 -translate-x-1/2 -translate-y-full rounded-md bg-[#111] px-2 py-1 text-[11px] font-medium text-white"
              style={{
                left: `${((hover + 0.5) / CHART_BARS.length) * 100}%`,
              }}
            >
              {CHART_BARS[hover].value}
            </div>
          ) : null}
        </div>
      </Glass>
    </div>
  );
}

export function FailedCard() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <div className="dg-fly-failed pointer-events-auto relative z-20 col-span-2 md:col-span-3">
      <Glass className="h-full p-4 md:p-5">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-black/45">
            Failed
          </p>
          <p className="text-[11px] font-medium text-purple-700">3 open</p>
        </div>
        <ul className="mt-3 space-y-0.5">
          {FAILED.map(([email, amt]) => (
            <li key={email}>
              <button
                type="button"
                onMouseEnter={() => setActive(email)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(email)}
                onBlur={() => setActive(null)}
                className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm transition ${
                  active === email ? "bg-white/70" : "hover:bg-white/40"
                }`}
              >
                <span className="truncate font-medium text-[#1a1a1a]">
                  {email}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="tabular-nums text-black/45">{amt}</span>
                  {active === email ? (
                    <span className="text-[11px] font-semibold text-purple-700">
                      Retry
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Glass>
    </div>
  );
}

export function EmailCard() {
  const [clicked, setClicked] = useState(false);

  return (
    <div className="dg-fly-email pointer-events-auto relative z-20 col-span-2 md:col-span-4">
      <Glass className="h-full">
        <div className="flex items-center gap-2 border-b border-black/6 px-4 py-2.5">
          <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
          <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
          <span className="h-2 w-2 rounded-full bg-[#28c840]" />
          <span className="ml-1 truncate text-[11px] text-black/40">
            recovery@coolsaas.com
          </span>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#111] text-[10px] font-bold text-white">
              CS
            </div>
            <div>
              <p className="text-xs font-semibold">Cool SaaS</p>
              <p className="text-[10px] text-black/40">DeclineGuard</p>
            </div>
          </div>
          <p className="text-[15px] font-semibold tracking-tight text-[#111]">
            Your payment didn&apos;t go through
          </p>
          <p className="max-w-[16rem] text-xs leading-relaxed text-black/50">
            Update your card to keep your subscription — about a minute.
          </p>
          <button
            type="button"
            onClick={() => {
              setClicked(true);
              window.setTimeout(() => setClicked(false), 1600);
            }}
            className="inline-flex cursor-pointer rounded-full bg-[#111] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#2a2a2a] active:scale-[0.98]"
          >
            {clicked ? "Link sent" : "Update payment method"}
          </button>
        </div>
      </Glass>
    </div>
  );
}
