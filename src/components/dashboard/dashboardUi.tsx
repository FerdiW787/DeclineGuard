import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import {
  CheckCircle2,
  Mail,
  MailCheck,
  MailWarning,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

/** Monogram when Lemon Squeezy has no store avatar */
export function storeInitials(storeName: string): string {
  const parts = storeName
    .trim()
    .split(/[\s._-]+/)
    .filter((p) => p.length > 0);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    const word = parts[0]!;
    return word.slice(0, 2).toUpperCase();
  }
  const a = parts[0]![0] ?? "";
  const b = parts[1]![0] ?? "";
  return `${a}${b}`.toUpperCase();
}

/** Lemon Squeezy store avatar — initials monogram when no logo */
export function StoreAvatar({
  src,
  alt,
  size = "md",
  brandColor,
  className = "",
}: {
  src: string | null | undefined;
  alt: string;
  size?: "sm" | "md" | "lg" | "preview";
  /** Background for initials fallback (defaults to near-black) */
  brandColor?: string;
  className?: string;
}) {
  const box =
    size === "sm"
      ? "size-6"
      : size === "lg"
        ? "size-10"
        : size === "preview"
          ? "size-11"
          : "size-8";
  const px =
    size === "sm" ? 24 : size === "lg" ? 40 : size === "preview" ? 44 : 32;
  const text =
    size === "sm"
      ? "text-[9px]"
      : size === "lg"
        ? "text-[13px]"
        : size === "preview"
          ? "text-[15px]"
          : "text-[11px]";
  const radius =
    size === "sm"
      ? "rounded-sm"
      : size === "lg" || size === "preview"
        ? "rounded-[10px]"
        : "rounded-lg";

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        width={px}
        height={px}
        className={`${box} ${radius} shrink-0 object-cover ${className}`}
        decoding="async"
        referrerPolicy="no-referrer"
      />
    );
  }

  const style: CSSProperties | undefined = brandColor
    ? { background: brandColor }
    : undefined;

  return (
    <span
      className={`flex ${box} shrink-0 items-center justify-center ${radius} bg-[#111] font-bold tracking-tight text-white ${text} ${className}`}
      style={style}
      aria-hidden
      title={alt}
    >
      {storeInitials(alt)}
    </span>
  );
}

export function Panel({
  children,
  className = "",
  ...rest
}: {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-md border border-black/8 bg-white ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  wide = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Let the subtitle use the full header width (one line on desktop). */
  wide?: boolean;
}) {
  return (
    <header
      data-enter
      className="flex shrink-0 flex-wrap items-start justify-between gap-4"
    >
      <div className={wide ? "min-w-0 max-w-none" : "max-w-xl"}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a8f98]">
          {eyebrow}
        </p>
        <h2 className="font-display mt-2 text-3xl leading-[1.15] tracking-tight text-[#08090a] md:text-4xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-[#6b6f76]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export function formatMoneyAmount(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(0)} ${currency.toUpperCase()}`;
  }
}

/** Format a major-unit amount (e.g. chart totals already divided by 100). */
export function formatMoneyMajor(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${Math.round(amount).toLocaleString()} ${currency.toUpperCase()}`;
  }
}

/** Short status line for an open failure (not "failed the whole sequence"). */
export function openFailureStatusLine(row: {
  sequenceLabel: string;
  emailsSentCount: number;
}): string {
  // sequenceLabel now contains honest wait/attempt info from backend
  return row.sequenceLabel;
}

export function formatRelativeTime(ms: number, nowMs: number) {
  const delta = Math.max(0, nowMs - ms);
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
  });
}

export type ActivityEventType =
  | "payment_failed"
  | "recovered"
  | "email_sent"
  | "email_bounced"
  | "email_delivered"
  | "retry_requested";

export type EmailDeliveryStatus =
  | "queued"
  | "delivered"
  | "bounced"
  | "complained"
  | "failed";

export function activityUiType(
  type: ActivityEventType,
): "failed" | "recovered" | "email" | "bounce" | "delivered" | "retry" {
  switch (type) {
    case "payment_failed":
      return "failed";
    case "recovered":
      return "recovered";
    case "email_sent":
      return "email";
    case "email_bounced":
      return "bounce";
    case "email_delivered":
      return "delivered";
    case "retry_requested":
      return "retry";
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

/** Display copy for activity rows (also normalizes older · / "payment failed" titles). */
export function formatActivityTitle(
  title: string,
  type: ActivityEventType,
): string {
  let next = title.replace(/\s*·\s*/g, " / ");
  if (type === "payment_failed") {
    next = next.replace(/payment failed/gi, "Recovery failed");
  }
  return next;
}

export function ActivityIcon({
  type,
}: {
  type: "failed" | "recovered" | "email" | "bounce" | "delivered" | "retry";
}) {
  const wrap =
    type === "failed"
      ? "bg-amber-50 text-amber-800"
      : type === "recovered"
        ? "bg-emerald-50 text-emerald-800"
        : type === "bounce"
          ? "bg-rose-50 text-rose-800"
          : type === "delivered"
            ? "bg-sky-50 text-sky-800"
            : type === "retry"
              ? "bg-blue-50 text-blue-800"
              : "bg-violet-50 text-violet-800";
  const Icon =
    type === "failed"
      ? TriangleAlert
      : type === "recovered"
        ? CheckCircle2
        : type === "bounce"
          ? MailWarning
          : type === "delivered"
            ? MailCheck
            : type === "retry"
              ? RefreshCw
              : Mail;
  return (
    <span
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full ${wrap}`}
    >
      <Icon className="size-3.5" />
    </span>
  );
}

export function formatFailedAt(ms: number): string {
  return new Date(ms).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatNextEmailAt(ms: number | null): string | null {
  if (ms == null) return null;
  return new Date(ms).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function deliveryStatusLabel(
  status: EmailDeliveryStatus | null,
): string | null {
  if (!status) return null;
  switch (status) {
    case "queued":
      return "Queued";
    case "delivered":
      return "Delivered";
    case "bounced":
      return "Bounced";
    case "complained":
      return "Spam";
    case "failed":
      return "Send failed";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function deliveryStatusClass(
  status: EmailDeliveryStatus | null,
): string {
  if (!status) return "";
  switch (status) {
    case "bounced":
    case "complained":
    case "failed":
      return "text-rose-700";
    case "delivered":
      return "text-emerald-700";
    case "queued":
      return "text-black/45";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export type OpenFailureRow = {
  _id: string;
  customerEmail: string;
  customerName: string | null;
  productName: string | null;
  amountCents: number;
  currency: string;
  failedAt: number;
  updatePaymentUrl: string | null;
  sequenceLabel: string;
  emailsSentCount: number;
  testMode: boolean;
  nextEmailAt: number | null;
  declineReason: string | null;
  lastEmailDeliveryStatus: EmailDeliveryStatus | null;
  day0SentAt?: number | null;
  day2SentAt?: number | null;
  day5SentAt?: number | null;
};

/** Where an open failure sits in the Day 0 → 2 → 5 drip. */
export type SequenceStage = "queued" | "day0" | "day2" | "day5";

export function sequenceStageForFailure(row: {
  day0SentAt?: number | null;
  day2SentAt?: number | null;
  day5SentAt?: number | null;
  sequenceLabel?: string;
}): SequenceStage {
  if (row.day5SentAt != null) return "day5";
  if (row.day2SentAt != null) return "day2";
  if (row.day0SentAt != null) return "day0";

  const label = row.sequenceLabel?.toLowerCase() ?? "";
  if (label.includes("queued")) return "queued";
  if (label.includes("email 3") || label.includes("day 5 sent")) return "day5";
  if (
    label.includes("email 2") ||
    label.includes("day 2 sent") ||
    label.includes("day 5 pending")
  ) {
    return "day2";
  }
  if (
    label.includes("email 1") ||
    label.includes("day 0") ||
    label.includes("day 2 pending")
  ) {
    return "day0";
  }
  return "queued";
}

export function isFailureOverdue(
  row: { nextEmailAt: number | null },
  nowMs: number,
): boolean {
  return row.nextEmailAt != null && row.nextEmailAt < nowMs;
}

export function isFailureDeliveryIssue(row: {
  lastEmailDeliveryStatus: EmailDeliveryStatus | null;
}): boolean {
  const s = row.lastEmailDeliveryStatus;
  return s === "bounced" || s === "complained" || s === "failed";
}

export type RecoveredWinRow = {
  _id: string;
  customerEmail: string;
  customerName: string | null;
  productName: string | null;
  amountCents: number;
  currency: string;
  failedAt: number;
  recoveredAt: number;
  testMode: boolean;
};

export type ActivityRow = {
  _id: string;
  type: ActivityEventType;
  title: string;
  detail: string | null;
  customerEmail: string | null;
  amountCents: number | null;
  currency: string | null;
  occurredAt: number;
};
