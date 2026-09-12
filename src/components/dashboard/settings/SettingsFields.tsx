import { useState, type ReactNode } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[15px] font-semibold tracking-tight text-[#08090a]">
          {title}
        </h3>
        {description ? (
          <p className="mt-1 text-[13px] leading-relaxed text-[#8a8f98]">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function SettingsCard({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-black/6 overflow-hidden rounded-lg border border-black/8 bg-white">
      {children}
    </div>
  );
}

export function SettingsRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5">
      <div className="min-w-0 max-w-[28rem]">
        <p className="text-[13px] font-medium text-[#08090a]">{title}</p>
        {description ? (
          <p className="mt-0.5 text-[12px] leading-relaxed text-[#8a8f98]">
            {description}
          </p>
        ) : null}
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}

export function CopyField({
  label,
  value,
  secret = false,
}: {
  label: string;
  value: string;
  secret?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const display =
    secret && !revealed ? "•".repeat(Math.min(value.length, 32)) : value;

  return (
    <div className="px-4 py-3.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8a8f98]">
        {label}
      </p>
      <div className="mt-1.5 flex items-stretch gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-black/8 bg-[#f7f8f8] px-3 py-2.5 text-[13px] text-[#08090a]/80">
          {display}
        </code>
        {secret ? (
          <button
            type="button"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-black/8 bg-white text-[#6b6f76] transition hover:bg-black/[0.04]"
            aria-label={revealed ? "Hide secret" : "Show secret"}
            onClick={() => setRevealed((v) => !v)}
          >
            {revealed ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        ) : null}
        <button
          type="button"
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-black/8 bg-white px-3 text-xs font-semibold text-[#6b6f76] transition hover:bg-black/[0.04]"
          onClick={() => {
            void navigator.clipboard.writeText(value).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            });
          }}
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-emerald-600" />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export function fieldInputClass() {
  return "mt-1.5 w-full rounded-lg border border-black/8 bg-[#f7f8f8] px-3 py-2.5 text-sm text-[#08090a] outline-none ring-black/10 placeholder:text-[#8a8f98] focus:ring-2";
}
