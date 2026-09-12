import type { ReactNode } from "react";

type Size = "sm" | "md" | "lg";

type CtaProps = {
  children: ReactNode;
  href?: string;
  size?: Size;
  className?: string;
  wide?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
};

/** Primary CTA — black fill, yellow candy underlay on hover. */
export function PrimaryCta({
  children,
  href,
  size = "md",
  className = "",
  wide = false,
  onClick,
  type = "button",
}: CtaProps) {
  const variant = size === "sm" ? "dg-btn-nav" : "dg-btn-primary";
  const classes =
    `dg-btn ${variant}${wide ? " dg-btn-wide" : ""}${className ? ` ${className}` : ""}`.trim();

  if (href) {
    return (
      <a href={href} onClick={onClick} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <button type={type} onClick={onClick} className={classes}>
      {children}
    </button>
  );
}

type SecondaryProps = {
  children: ReactNode;
  href: string;
  className?: string;
};

/** Secondary CTA — light outline, purple candy underlay on hover. */
export function SecondaryCta({
  children,
  href,
  className = "",
}: SecondaryProps) {
  return (
    <a
      href={href}
      className={`dg-btn dg-btn-secondary${className ? ` ${className}` : ""}`}
    >
      {children}
    </a>
  );
}
