import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
  size?: "sm" | "lg";
  className?: string;
};

export function LinearCta({
  href,
  children,
  variant = "primary",
  size = "lg",
  className = "",
}: Props) {
  return (
    <Button
      asChild
      variant={variant === "primary" ? "default" : "outline"}
      size={size}
      className={cn(className)}
    >
      <a href={href}>{children}</a>
    </Button>
  );
}
