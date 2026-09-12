import type { ReactNode } from "react";

type Props = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
  className?: string;
};

export function LinearCta({
  href,
  children,
  variant = "primary",
  className = "",
}: Props) {
  const base = variant === "primary" ? "ln-btn-primary" : "ln-btn-ghost";
  return (
    <a href={href} className={`${base} ${className}`}>
      {children}
    </a>
  );
}
