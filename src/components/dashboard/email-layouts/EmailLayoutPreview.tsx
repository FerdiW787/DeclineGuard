import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { StoreAvatar } from "../dashboardUi";
import {
  applyLayoutCopyVars,
  recoveryDayLabel,
  recoveryDayNumber,
  resolveLayoutCopy,
  type EmailCopyOverride,
} from "@/lib/emailLayoutCopy";
import type { LayoutPresetId, RecoveryDayId } from "@/lib/emailLayoutPresets";
import type { EmailThemeTokens } from "@/lib/emailTheme";
import {
  DEFAULT_EMAIL_FONT,
  emailFontFamily,
  type EmailFontId,
} from "@/lib/emailFonts";
import { cn } from "@/lib/utils";

type PreviewVars = {
  product: string;
  amount: string;
  firstName?: string;
};

type Props = {
  layoutPresetId: LayoutPresetId;
  recoveryDay: RecoveryDayId;
  theme: EmailThemeTokens;
  storeName: string;
  storeLogoUrl?: string | null;
  copyOverride?: EmailCopyOverride;
  emailFont?: EmailFontId;
  footerSupport?: string;
  previewVars?: PreviewVars;
  showDeclineGuardBadge?: boolean;
  className?: string;
};

function preventNav(e: MouseEvent) {
  e.preventDefault();
}

export default function EmailLayoutPreview({
  layoutPresetId,
  recoveryDay,
  theme,
  storeName,
  storeLogoUrl = null,
  copyOverride,
  emailFont = DEFAULT_EMAIL_FONT,
  footerSupport,
  previewVars,
  showDeclineGuardBadge = false,
  className,
}: Props) {
  const vars = {
    product: previewVars?.product ?? "Pro Monthly",
    amount: previewVars?.amount ?? "€29",
    firstName: previewVars?.firstName ?? "Maya",
    storeName,
  };
  const raw = resolveLayoutCopy(layoutPresetId, recoveryDay, copyOverride);
  const copy = {
    eyebrow: applyLayoutCopyVars(raw.eyebrow, vars),
    headline: applyLayoutCopyVars(raw.headline, vars),
    body: applyLayoutCopyVars(raw.body, vars),
    cta: applyLayoutCopyVars(raw.cta, vars),
    secondaryLink: applyLayoutCopyVars(raw.secondaryLink, vars),
    support: raw.support.map((line) => applyLayoutCopyVars(line, vars)),
    status: applyLayoutCopyVars(raw.status, vars),
  };
  const support = footerSupport?.trim() || "support@yourstore.com";
  const day = recoveryDayNumber(recoveryDay);
  const dayLabel = recoveryDayLabel(recoveryDay);

  const shell: CSSProperties = {
    fontFamily: emailFontFamily(emailFont),
    background: theme.pageBackgroundColor,
    color: theme.pageTextColor,
  };

  const shared = {
    theme,
    storeName,
    storeLogoUrl,
    copy,
    vars,
    support,
    day,
    dayLabel,
    showDeclineGuardBadge,
  };

  const inner = (() => {
    switch (layoutPresetId) {
      case "calm-verify":
        return <CalmVerify {...shared} />;
      case "account-expired":
        return <AccountExpired {...shared} />;
      case "trial-ended":
        return <TrialEnded {...shared} />;
      case "upcoming-renewal":
        return <UpcomingRenewal {...shared} />;
      case "data-safe":
        return <DataSafe {...shared} />;
      default: {
        const _exhaustive: never = layoutPresetId;
        return _exhaustive;
      }
    }
  })();

  return (
    <div className={cn("text-left", className)} style={shell}>
      {inner}
    </div>
  );
}

type ChromeCopy = {
  eyebrow: string;
  headline: string;
  body: string;
  cta: string;
  secondaryLink: string;
  support: readonly string[];
  status: string;
};

type LayoutProps = {
  theme: EmailThemeTokens;
  storeName: string;
  storeLogoUrl: string | null;
  copy: ChromeCopy;
  vars: PreviewVars & { storeName: string };
  support: string;
  day: 0 | 2 | 5;
  dayLabel: string;
  showDeclineGuardBadge: boolean;
};

function Cta({
  theme,
  label,
  fullWidth = false,
  uppercase = false,
}: {
  theme: EmailThemeTokens;
  label: string;
  fullWidth?: boolean;
  uppercase?: boolean;
}) {
  return (
    <a
      href="#action"
      onClick={preventNav}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center px-6 py-3 text-[13px] font-semibold no-underline transition-opacity hover:opacity-90",
        fullWidth && "w-full",
        uppercase && "tracking-[0.04em]",
      )}
      style={{
        background: theme.ctaBackgroundColor,
        color: theme.ctaTextColor,
        borderRadius: theme.ctaBorderRadiusPx,
        boxSizing: "border-box",
      }}
    >
      {uppercase ? label.toUpperCase() : label}
    </a>
  );
}

function Wordmark({
  storeName,
  storeLogoUrl,
  theme,
  size = "md",
}: {
  storeName: string;
  storeLogoUrl: string | null;
  theme: EmailThemeTokens;
  size?: "sm" | "md" | "lg";
}) {
  const text =
    size === "lg"
      ? "text-[20px] tracking-[0.28em]"
      : size === "sm"
        ? "text-[11px] tracking-[0.22em]"
        : "text-[13px] tracking-[0.24em]";
  return (
    <div className="flex items-center justify-center gap-2">
      {storeLogoUrl ? (
        <img
          src={storeLogoUrl}
          alt={storeName}
          width={size === "sm" ? 22 : 28}
          height={size === "sm" ? 22 : 28}
          className="shrink-0 object-contain"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      ) : null}
      <p
        className={cn("font-semibold uppercase", text)}
        style={{ color: theme.emailTextColor }}
      >
        {storeName}
      </p>
    </div>
  );
}

function SocialRow({
  color,
  compact = false,
}: {
  color: string;
  compact?: boolean;
}) {
  const marks = ["f", "o", "x", "▶"] as const;
  return (
    <div
      className={cn(
        "flex items-center justify-center",
        compact ? "gap-4" : "gap-5",
      )}
      aria-hidden
    >
      {marks.map((mark) => (
        <span
          key={mark}
          className="flex size-6 items-center justify-center text-[11px] font-semibold"
          style={{ color }}
        >
          {mark}
        </span>
      ))}
    </div>
  );
}

function DeclineGuardNote({
  theme,
  color,
}: {
  theme: EmailThemeTokens;
  color: string;
}) {
  return (
    <p className="mt-5 text-center text-[11px]" style={{ color }}>
      Recovery sent by{" "}
      <span className="font-semibold" style={{ color: theme.linkColor }}>
        DeclineGuard
      </span>
    </p>
  );
}

/**
 * Template A — calm-verify
 * Structure from 01-sonos-verify-your-email.png
 * Centered wordmark, full-bleed hero, pill CTA, social + help + legal.
 */
function CalmVerify({
  theme,
  storeName,
  storeLogoUrl,
  copy,
  support,
  showDeclineGuardBadge,
}: LayoutProps) {
  const faint = "rgba(12,12,12,0.38)";
  return (
    <div style={{ background: theme.pageBackgroundColor }}>
      <div
        className="mx-auto max-w-[28rem] overflow-hidden bg-white"
        style={{ background: theme.emailBackgroundColor }}
      >
        <div className="px-8 pb-6 pt-10">
          <Wordmark
            storeName={storeName}
            storeLogoUrl={storeLogoUrl}
            theme={theme}
            size="lg"
          />
        </div>
        <div
          className="flex h-44 items-end justify-center"
          style={{
            background: `linear-gradient(180deg, ${theme.brandColor}14 0%, ${theme.brandColor}28 100%)`,
          }}
          aria-hidden
        >
          <div
            className="mb-8 size-20 rounded-full"
            style={{ background: `${theme.brandColor}22` }}
          />
        </div>
        <div className="px-8 pb-10 pt-10 text-center">
          <h2
            className="text-[26px] font-semibold tracking-[-0.03em]"
            style={{ color: theme.emailTextColor }}
          >
            {copy.headline}
          </h2>
          <p
            className="mx-auto mt-4 max-w-[22rem] text-[14px] leading-relaxed"
            style={{ color: theme.mutedTextColor }}
          >
            {copy.body}
          </p>
          <div className="mt-8">
            <Cta theme={theme} label={copy.cta} fullWidth />
          </div>
        </div>
        <div className="px-8 pb-6">
          <SocialRow color={theme.emailTextColor} />
        </div>
        <div
          className="mx-8 flex items-center justify-between border-y py-4"
          style={{ borderColor: "rgba(0,0,0,0.08)" }}
        >
          <p className="text-[13px]" style={{ color: theme.emailTextColor }}>
            Questions? We’re here to help.
          </p>
          <span aria-hidden style={{ color: theme.mutedTextColor }}>
            ›
          </span>
        </div>
        <div className="px-8 py-6 text-center">
          <p className="text-[11px] leading-relaxed" style={{ color: faint }}>
            © {new Date().getFullYear()} {storeName}. All rights reserved.
          </p>
          <p className="mt-2 text-[11px] leading-relaxed" style={{ color: faint }}>
            This email was sent to a customer of {storeName}. Please do not reply.
          </p>
          <p className="mt-3 text-[11px]" style={{ color: faint }}>
            Privacy statement · Terms
          </p>
          {showDeclineGuardBadge ? (
            <DeclineGuardNote theme={theme} color={faint} />
          ) : null}
          <p className="sr-only">{support}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Template B — account-expired
 * Structure from 02-nordvpn-your-account-has-expired.png
 * Header + tagline, left-aligned copy, dark hero, rounded CTA, sign-off.
 */
function AccountExpired({
  theme,
  storeName,
  storeLogoUrl,
  copy,
  vars,
  support,
  day,
  showDeclineGuardBadge,
}: LayoutProps) {
  const faint = "rgba(12,12,12,0.4)";
  const tens = String(Math.floor(day / 10));
  const ones = String(day % 10);
  return (
    <div className="px-3 py-4" style={{ background: theme.pageBackgroundColor }}>
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <StoreAvatar
            src={storeLogoUrl}
            alt={storeName}
            size="sm"
            brandColor={theme.brandColor}
          />
          <p
            className="truncate text-[13px] font-semibold"
            style={{ color: theme.pageTextColor }}
          >
            {storeName}
          </p>
        </div>
        <p
          className="hidden text-right text-[10px] leading-snug sm:block"
          style={{ color: theme.mutedTextColor }}
        >
          Payment recovery. Keep access.
        </p>
      </div>
      <div
        className="overflow-hidden rounded-sm px-6 py-8"
        style={{ background: theme.emailBackgroundColor }}
      >
        <h2
          className="text-[28px] font-semibold leading-tight tracking-[-0.03em]"
          style={{ color: theme.emailTextColor }}
        >
          {copy.headline}
        </h2>
        <p className="mt-3 text-[14px]" style={{ color: theme.mutedTextColor }}>
          {copy.status || copy.eyebrow}
        </p>
        <div
          className="mt-6 flex h-36 items-center justify-center gap-3"
          style={{ background: "#111111" }}
          aria-hidden
        >
          <FlipDigit value={tens} />
          <FlipDigit value={ones} />
        </div>
        <p
          className="mt-6 text-[14px] leading-relaxed"
          style={{ color: theme.emailTextColor }}
        >
          {copy.body}
        </p>
        <p
          className="mt-3 text-[13px] leading-relaxed"
          style={{ color: theme.mutedTextColor }}
        >
          {vars.product} · {vars.amount}
        </p>
        <div className="mt-7">
          <Cta theme={theme} label={copy.cta} />
        </div>
        <p
          className="mt-8 text-[13px] leading-relaxed"
          style={{ color: theme.emailTextColor }}
        >
          Best regards,
          <br />
          The {storeName} team
        </p>
      </div>
      <div className="px-2 py-5 text-center">
        <SocialRow color={theme.mutedTextColor} compact />
        <p className="mt-4 text-[11px] leading-relaxed" style={{ color: faint }}>
          {storeName} sends this recovery email after a failed payment.
        </p>
        <p className="mt-2 text-[11px]">
          <a
            href="#secondary"
            onClick={preventNav}
            className="underline"
            style={{ color: theme.linkColor }}
          >
            {copy.secondaryLink}
          </a>
        </p>
        {showDeclineGuardBadge ? (
          <DeclineGuardNote theme={theme} color={faint} />
        ) : null}
        <p className="sr-only">{support}</p>
      </div>
    </div>
  );
}

function FlipDigit({ value }: { value: string }) {
  return (
    <span
      className="flex h-20 w-16 items-center justify-center rounded-md text-[44px] font-semibold tabular-nums text-white"
      style={{ background: "#1a1a1a" }}
    >
      {value}
    </span>
  );
}

/**
 * Template C — trial-ended
 * Structure from 03-avocode-trial-ended.png
 * Small mark, calendar icon, centered card, pill CTA, questions footer.
 */
function TrialEnded({
  theme,
  storeName,
  storeLogoUrl,
  copy,
  support,
  day,
  showDeclineGuardBadge,
}: LayoutProps) {
  const faint = "rgba(17,24,39,0.4)";
  return (
    <div className="px-4 py-6" style={{ background: theme.pageBackgroundColor }}>
      <div className="mb-5 flex justify-center">
        <Wordmark
          storeName={storeName}
          storeLogoUrl={storeLogoUrl}
          theme={{ ...theme, emailTextColor: theme.pageTextColor }}
          size="sm"
        />
      </div>
      <div
        className="px-8 pb-10 pt-12 text-center"
        style={{ background: theme.emailBackgroundColor }}
      >
        <CalendarMark day={day} accent={theme.ctaBackgroundColor} />
        <h2
          className="mt-8 text-[26px] font-semibold tracking-[-0.03em]"
          style={{ color: theme.emailTextColor }}
        >
          {copy.headline}
        </h2>
        <p
          className="mx-auto mt-4 max-w-[22rem] text-[14px] leading-relaxed"
          style={{ color: theme.mutedTextColor }}
        >
          {copy.body}
        </p>
        <div className="mt-8 flex justify-center">
          <Cta theme={theme} label={copy.cta} uppercase />
        </div>
      </div>
      <div
        className="border-t px-6 py-5 text-center"
        style={{
          background: theme.emailBackgroundColor,
          borderColor: "rgba(0,0,0,0.06)",
        }}
      >
        <p className="text-[13px]" style={{ color: theme.mutedTextColor }}>
          Questions? Mail us at{" "}
          <a
            href={`mailto:${support}`}
            onClick={preventNav}
            style={{ color: theme.emailTextColor }}
          >
            {support}
          </a>
        </p>
      </div>
      <div className="px-6 py-4 text-center">
        <p className="text-[11px]" style={{ color: faint }}>
          News about our product ·{" "}
          <span style={{ color: theme.mutedTextColor }}>Updates</span>
        </p>
        {showDeclineGuardBadge ? (
          <DeclineGuardNote theme={theme} color={faint} />
        ) : null}
      </div>
    </div>
  );
}

function CalendarMark({ day, accent }: { day: number; accent: string }) {
  return (
    <div
      className="mx-auto w-24 overflow-hidden rounded-md border bg-white"
      style={{ borderColor: "rgba(0,0,0,0.08)" }}
      aria-hidden
    >
      <div className="h-3" style={{ background: "#f3f4f6" }} />
      <div className="flex h-16 items-center justify-center">
        <span
          className="text-[32px] font-semibold tabular-nums"
          style={{ color: accent }}
        >
          {day}
        </span>
      </div>
    </div>
  );
}

/**
 * Template D — upcoming-renewal
 * Structure from 04-fontbase-upcoming-renewal.png
 * Dark frame, overlapping mark, date lockup, centered type.
 */
function UpcomingRenewal({
  theme,
  storeName,
  storeLogoUrl,
  copy,
  support,
  dayLabel,
  showDeclineGuardBadge,
}: LayoutProps) {
  const faint = "rgba(250,250,250,0.55)";
  return (
    <div className="px-4 pb-8 pt-6" style={{ background: theme.pageBackgroundColor }}>
      <div className="relative mx-auto max-w-[28rem]">
        <div className="flex justify-center">
          <div
            className="relative z-10 flex size-12 items-center justify-center rounded-full"
            style={{ background: theme.emailBackgroundColor }}
          >
            <StoreAvatar
              src={storeLogoUrl}
              alt={storeName}
              size="sm"
              brandColor={theme.brandColor}
            />
          </div>
        </div>
        <div
          className="-mt-6 px-8 pb-12 pt-14 text-center"
          style={{ background: theme.emailBackgroundColor }}
        >
          <h2
            className="text-[28px] font-semibold tracking-[-0.03em]"
            style={{ color: theme.emailTextColor }}
          >
            {copy.headline}
          </h2>
          <p
            className="mx-auto mt-5 max-w-[22rem] text-[14px] leading-relaxed"
            style={{ color: theme.mutedTextColor }}
          >
            {copy.body}
          </p>
          <p
            className="mt-8 text-[32px] font-semibold tracking-[-0.03em]"
            style={{ color: theme.emailTextColor }}
          >
            {dayLabel}
          </p>
          <p
            className="mx-auto mt-6 max-w-[22rem] text-[14px] leading-relaxed"
            style={{ color: theme.mutedTextColor }}
          >
            You can always update billing or manage your subscription from the
            dashboard.{" "}
            <a
              href="#secondary"
              onClick={preventNav}
              className="underline"
              style={{ color: theme.linkColor }}
            >
              {copy.secondaryLink}
            </a>
          </p>
          <div className="mt-8 flex justify-center">
            <Cta theme={theme} label={copy.cta} />
          </div>
        </div>
      </div>
      <div className="mt-6 px-4 text-center">
        <p className="text-[11px] leading-relaxed" style={{ color: faint }}>
          {storeName}
          <br />
          Recovery email · {support}
        </p>
        {showDeclineGuardBadge ? (
          <DeclineGuardNote theme={theme} color={faint} />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Template E — data-safe
 * Structure from 05-benchmark-dont-worry-your-data-is-safe.png
 * Greeting, CTA, two instruction cards, sign-off, P.S., social.
 */
function DataSafe({
  theme,
  storeName,
  storeLogoUrl,
  copy,
  vars,
  support,
  showDeclineGuardBadge,
}: LayoutProps) {
  const faint = "rgba(12,12,12,0.4)";
  const cardBg = "#f7f8f8";
  const iconColor = theme.ctaBackgroundColor;
  return (
    <div
      className="px-8 py-10"
      style={{ background: theme.emailBackgroundColor }}
    >
      <div className="mb-8 flex justify-center">
        <Wordmark
          storeName={storeName}
          storeLogoUrl={storeLogoUrl}
          theme={theme}
          size="md"
        />
      </div>
      <p className="text-[16px]" style={{ color: theme.emailTextColor }}>
        Hi {vars.firstName || "there"},
      </p>
      <p
        className="mt-4 text-[14px] leading-relaxed"
        style={{ color: theme.mutedTextColor }}
      >
        {copy.body}
      </p>
      <div className="mt-6">
        <Cta theme={theme} label={copy.cta} />
      </div>
      <HelpCard
        background={cardBg}
        icon={<CardIcon color={iconColor} />}
        title="How to update a card"
        lines={[
          "1. Open billing from the button above",
          "2. Enter the new card and save",
          "3. We’ll retry the payment for you",
        ]}
        theme={theme}
      />
      <HelpCard
        background={cardBg}
        icon={<NoteIcon color={iconColor} />}
        title="Other payment methods"
        lines={[
          `Contact ${storeName} support and they’ll help get the account current.`,
        ]}
        theme={theme}
      />
      <p
        className="mt-8 text-[14px] leading-relaxed"
        style={{ color: theme.emailTextColor }}
      >
        All the best,
        <br />
        Your friends at {storeName}
      </p>
      <p
        className="mt-6 text-[13px] leading-relaxed"
        style={{ color: theme.mutedTextColor }}
      >
        P.S. Questions?
        <br />
        Please give us the opportunity to help.{" "}
        <a
          href={`mailto:${support}`}
          onClick={preventNav}
          className="underline"
          style={{ color: theme.linkColor }}
        >
          Contact our support team →
        </a>
      </p>
      <div className="mt-10 text-center">
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: faint }}
        >
          Find us on social
        </p>
        <div className="mt-3">
          <SocialRow color={theme.mutedTextColor} compact />
        </div>
        {showDeclineGuardBadge ? (
          <DeclineGuardNote theme={theme} color={faint} />
        ) : null}
      </div>
    </div>
  );
}

function HelpCard({
  background,
  icon,
  title,
  lines,
  theme,
}: {
  background: string;
  icon: ReactNode;
  title: string;
  lines: readonly string[];
  theme: EmailThemeTokens;
}) {
  return (
    <div className="mt-5 rounded-sm px-5 py-6 text-center" style={{ background }}>
      <div className="flex justify-center">{icon}</div>
      <p
        className="mt-3 text-[15px] font-semibold"
        style={{ color: theme.emailTextColor }}
      >
        {title}
      </p>
      <div className="mt-3 space-y-1 text-[13px]" style={{ color: theme.mutedTextColor }}>
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  );
}

function CardIcon({ color }: { color: string }) {
  return (
    <svg width="36" height="24" viewBox="0 0 36 24" fill="none" aria-hidden>
      <rect
        x="1"
        y="3"
        width="34"
        height="18"
        rx="3"
        stroke={color}
        strokeWidth="1.5"
      />
      <path d="M1 9h34" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

function NoteIcon({ color }: { color: string }) {
  return (
    <svg width="36" height="24" viewBox="0 0 36 24" fill="none" aria-hidden>
      <rect
        x="4"
        y="4"
        width="28"
        height="16"
        rx="2"
        stroke={color}
        strokeWidth="1.5"
      />
      <path d="M10 12h16" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
