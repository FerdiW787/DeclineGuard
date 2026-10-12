import type { ReactNode } from "react";

export function AuthBrandMark({ href = "/" }: { href?: string | null }) {
  const mark = (
    <img
      src="/brand/mark-on-light.png?v=white2"
      alt=""
      width={32}
      height={32}
      className="h-8 w-8 object-contain"
      decoding="async"
    />
  );

  if (!href) {
    return (
      <div className="mb-5 inline-flex justify-center" aria-hidden>
        {mark}
      </div>
    );
  }

  return (
    <a
      href={href}
      className="mb-5 inline-flex justify-center"
      aria-label="DeclineGuard home"
    >
      {mark}
    </a>
  );
}

export function AuthProgressDots({
  count,
  activeIndex,
}: {
  count: number;
  activeIndex: number;
}) {
  return (
    <div
      className="flex items-center justify-center gap-2"
      aria-label="Progress"
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`block size-1.5 rounded-full transition-colors ${
            i === activeIndex ? "bg-primary" : "bg-black/15"
          }`}
          aria-current={i === activeIndex ? "step" : undefined}
        />
      ))}
    </div>
  );
}

export function AuthHeading({ children }: { children: ReactNode }) {
  return (
    <h1 className="ln-h1 text-center text-[1.35rem] font-semibold leading-tight tracking-[-0.022em] text-foreground">
      {children}
    </h1>
  );
}

export function AuthSub({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 text-center text-[13px] leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

export function AuthBackLink({
  onClick,
  disabled,
  children = "Back",
}: {
  onClick: () => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      className="text-[13px] text-muted-foreground transition hover:text-foreground disabled:opacity-50"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function AuthLegal() {
  return (
    <p className="text-center text-[12px] leading-relaxed text-muted-foreground">
      By signing up, you agree to our{" "}
      <a href="/legal/terms" className="font-medium text-muted-foreground hover:text-foreground">
        Terms of Service
      </a>{" "}
      and{" "}
      <a href="/legal/dpa" className="font-medium text-muted-foreground hover:text-foreground">
        Data Processing Agreement
      </a>
      .
    </p>
  );
}

export function AuthSwitch({
  prompt,
  href,
  label,
}: {
  prompt: string;
  href: string;
  label: string;
}) {
  return (
    <p className="text-center text-[13px] text-muted-foreground">
      {prompt}{" "}
      <a
        href={href}
        className="font-medium text-foreground transition hover:opacity-70"
      >
        {label}
      </a>
    </p>
  );
}

