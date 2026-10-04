import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

function toButtonSize(size: Size): "sm" | "lg" {
  return size === "sm" ? "sm" : "lg";
}

/** Primary CTA — radix-nova default (token-driven primary). */
export function PrimaryCta({
  children,
  href,
  size = "md",
  className = "",
  wide = false,
  onClick,
  type = "button",
}: CtaProps) {
  const classes = cn(wide && "w-full", className);

  if (href) {
    return (
      <Button asChild variant="default" size={toButtonSize(size)} className={classes}>
        <a href={href} onClick={onClick}>
          {children}
        </a>
      </Button>
    );
  }

  return (
    <Button
      type={type}
      variant="default"
      size={toButtonSize(size)}
      className={classes}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

type SecondaryProps = {
  children: ReactNode;
  href: string;
  className?: string;
};

/** Secondary CTA — radix-nova outline. */
export function SecondaryCta({
  children,
  href,
  className = "",
}: SecondaryProps) {
  return (
    <Button asChild variant="outline" size="lg" className={className}>
      <a href={href}>{children}</a>
    </Button>
  );
}
