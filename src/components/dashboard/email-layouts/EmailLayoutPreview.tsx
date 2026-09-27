import type { CSSProperties, MouseEvent } from "react";
import EmailStoreHeader from "../EmailStoreHeader";
import { StoreAvatar } from "../dashboardUi";
import {
  applyLayoutCopyVars,
  resolveLayoutCopy,
  type EmailCopyOverride,
} from "@/lib/emailLayoutCopy";
import type { LayoutPresetId, LifecycleEmailType } from "@/lib/emailLayoutPresets";
import { isDarkHex, type EmailThemeTokens } from "@/lib/emailTheme";
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
  emailType: LifecycleEmailType;
  theme: EmailThemeTokens;
  storeName: string;
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
  emailType,
  theme,
  storeName,
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
  const raw = resolveLayoutCopy(layoutPresetId, emailType, copyOverride);
  const copy = {
    eyebrow: applyLayoutCopyVars(raw.eyebrow, vars),
    headline: applyLayoutCopyVars(raw.headline, vars),
    body: applyLayoutCopyVars(raw.body, vars),
    cta: applyLayoutCopyVars(raw.cta, vars),
    secondaryLink: applyLayoutCopyVars(raw.secondaryLink, vars),
    support: raw.support.map((line) => applyLayoutCopyVars(line, vars)),
    status: applyLayoutCopyVars(raw.status, vars),
  };
  const dark = isDarkHex(theme.emailBackgroundColor);
  const rule = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";
  const faint = dark ? "rgba(255,255,255,0.32)" : "rgba(0,0,0,0.32)";
  const support = footerSupport?.trim() || "support@yourstore.com";

  const shell: CSSProperties = {
    fontFamily: emailFontFamily(emailFont),
    background: theme.emailBackgroundColor,
    color: theme.emailTextColor,
  };

  const inner = (() => {
    switch (layoutPresetId) {
      case "quiet-verify":
        return (
          <QuietVerify
            theme={theme}
            storeName={storeName}
            emailFont={emailFont}
            copy={copy}
          />
        );
      case "soft-expire":
        return (
          <SoftExpire
            theme={theme}
            storeName={storeName}
            emailFont={emailFont}
            copy={copy}
            vars={vars}
          />
        );
      case "safe-pause":
        return (
          <SafePause
            theme={theme}
            storeName={storeName}
            emailFont={emailFont}
            copy={copy}
          />
        );
      case "soft-renew":
        return (
          <SoftRenew
            theme={theme}
            storeName={storeName}
            emailFont={emailFont}
            copy={copy}
            vars={vars}
          />
        );
      case "alert-expire":
        return (
          <AlertExpire
            theme={theme}
            storeName={storeName}
            emailFont={emailFont}
            copy={copy}
          />
        );
      default: {
        const _exhaustive: never = layoutPresetId;
        return _exhaustive;
      }
    }
  })();

  return (
    <div className={cn("text-left", className)} style={shell}>
      {inner}
      <hr className="my-8" style={{ borderColor: rule }} />
      <p className="text-[12px] leading-relaxed" style={{ color: theme.mutedTextColor }}>
        Questions?{" "}
        <a
          href={`mailto:${support}`}
          onClick={preventNav}
          className="underline"
          style={{ color: theme.linkColor }}
        >
          {support}
        </a>
      </p>
      <p className="mt-4 text-[11px]" style={{ color: faint }}>
        © {new Date().getFullYear()} {storeName}
      </p>
      {showDeclineGuardBadge ? (
        <p
          className="mt-6 border-t pt-4 text-center text-[11px]"
          style={{ borderColor: rule, color: faint }}
        >
          Recovery sent by{" "}
          <span className="font-semibold" style={{ color: theme.linkColor }}>
            DeclineGuard
          </span>
        </p>
      ) : null}
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

function Cta({
  theme,
  label,
}: {
  theme: EmailThemeTokens;
  label: string;
}) {
  return (
    <a
      href="#action"
      onClick={preventNav}
      className="inline-flex w-fit cursor-pointer px-5 py-2.5 text-[13px] font-semibold transition-opacity hover:opacity-90"
      style={{
        background: theme.ctaBackgroundColor,
        color: theme.ctaTextColor,
        borderRadius: theme.ctaBorderRadiusPx,
      }}
    >
      {label}
    </a>
  );
}

function QuietVerify({
  theme,
  storeName,
  emailFont,
  copy,
}: {
  theme: EmailThemeTokens;
  storeName: string;
  emailFont: EmailFontId;
  copy: ChromeCopy;
}) {
  return (
    <div className="px-6 py-10 text-center sm:px-10">
      <div className="flex justify-center">
        <StoreAvatar
          src={theme.logoUrl ?? null}
          alt={storeName}
          size="preview"
          brandColor={theme.brandColor}
        />
      </div>
      <p
        className="mt-6 text-[11px] font-medium uppercase tracking-[0.16em]"
        style={{ color: theme.mutedTextColor }}
      >
        {copy.eyebrow}
      </p>
      <h2
        className="mt-3 text-[22px] font-semibold tracking-[-0.03em]"
        style={{
          color: theme.emailTextColor,
          fontFamily: emailFontFamily(emailFont),
        }}
      >
        {copy.headline}
      </h2>
      <p
        className="mx-auto mt-3 max-w-[20rem] text-[14px] leading-relaxed"
        style={{ color: theme.mutedTextColor }}
      >
        {copy.body}
      </p>
      <div className="mt-7 flex justify-center">
        <Cta theme={theme} label={copy.cta} />
      </div>
      <p className="mt-5 text-[12px]">
        <a
          href="#secondary"
          onClick={preventNav}
          className="underline"
          style={{ color: theme.linkColor }}
        >
          {copy.secondaryLink}
        </a>
      </p>
    </div>
  );
}

function SoftExpire({
  theme,
  storeName,
  emailFont,
  copy,
  vars,
}: {
  theme: EmailThemeTokens;
  storeName: string;
  emailFont: EmailFontId;
  copy: ChromeCopy;
  vars: PreviewVars & { storeName: string };
}) {
  const cardBorder = isDarkHex(theme.emailBackgroundColor)
    ? "rgba(255,255,255,0.12)"
    : "rgba(0,0,0,0.08)";
  return (
    <div className="px-5 py-7 sm:px-7">
      <EmailStoreHeader
        storeName={storeName}
        storeLogoUrl={theme.logoUrl ?? null}
        primary={theme.brandColor}
        emailFont={emailFont}
        textColor={theme.emailTextColor}
        className="mb-6"
      />
      <p
        className="text-[11px] font-medium uppercase tracking-[0.14em]"
        style={{ color: theme.mutedTextColor }}
      >
        {copy.eyebrow}
      </p>
      <h2
        className="mt-2 text-[20px] font-semibold tracking-[-0.03em]"
        style={{ color: theme.emailTextColor }}
      >
        {copy.headline}
      </h2>
      <div
        className="mt-5 rounded-xl px-4 py-3"
        style={{ border: `1px solid ${cardBorder}` }}
      >
        <p className="text-[12px] font-medium" style={{ color: theme.mutedTextColor }}>
          What’s ending
        </p>
        <p className="mt-1 text-[14px] font-semibold" style={{ color: theme.emailTextColor }}>
          {vars.product}
        </p>
        <p className="mt-0.5 text-[12px]" style={{ color: theme.mutedTextColor }}>
          {vars.amount}
        </p>
      </div>
      <p className="mt-5 text-[14px] leading-relaxed" style={{ color: theme.mutedTextColor }}>
        {copy.body}
      </p>
      <div className="mt-6">
        <Cta theme={theme} label={copy.cta} />
      </div>
      <p className="mt-4 text-[12px]">
        <a
          href="#secondary"
          onClick={preventNav}
          className="underline"
          style={{ color: theme.linkColor }}
        >
          {copy.secondaryLink}
        </a>
      </p>
    </div>
  );
}

function SafePause({
  theme,
  storeName,
  emailFont,
  copy,
}: {
  theme: EmailThemeTokens;
  storeName: string;
  emailFont: EmailFontId;
  copy: ChromeCopy;
}) {
  const chipBg = isDarkHex(theme.emailBackgroundColor)
    ? "rgba(255,255,255,0.08)"
    : "rgba(47,58,42,0.08)";
  const noteBg = isDarkHex(theme.emailBackgroundColor)
    ? "rgba(255,255,255,0.06)"
    : "rgba(47,58,42,0.05)";
  return (
    <div className="px-5 py-7 sm:px-7">
      <EmailStoreHeader
        storeName={storeName}
        storeLogoUrl={theme.logoUrl ?? null}
        primary={theme.brandColor}
        emailFont={emailFont}
        textColor={theme.emailTextColor}
        className="mb-6"
      />
      <span
        className="inline-flex rounded-full px-3 py-1 text-[11px] font-semibold"
        style={{ background: chipBg, color: theme.brandColor }}
      >
        {copy.status}
      </span>
      <h2
        className="mt-4 text-[20px] font-semibold tracking-[-0.03em]"
        style={{ color: theme.emailTextColor }}
      >
        {copy.headline}
      </h2>
      <p className="mt-3 text-[14px] leading-relaxed" style={{ color: theme.mutedTextColor }}>
        {copy.body}
      </p>
      <div className="mt-5 rounded-xl px-4 py-3" style={{ background: noteBg }}>
        <p className="text-[12px] font-medium" style={{ color: theme.emailTextColor }}>
          Nothing here is gone
        </p>
        <ul className="mt-2 space-y-1 text-[12px]" style={{ color: theme.mutedTextColor }}>
          {copy.support.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <div className="mt-6">
        <Cta theme={theme} label={copy.cta} />
      </div>
      <p className="mt-4 text-[12px]">
        <a
          href="#secondary"
          onClick={preventNav}
          className="underline"
          style={{ color: theme.linkColor }}
        >
          {copy.secondaryLink}
        </a>
      </p>
    </div>
  );
}

function SoftRenew({
  theme,
  storeName,
  emailFont,
  copy,
  vars,
}: {
  theme: EmailThemeTokens;
  storeName: string;
  emailFont: EmailFontId;
  copy: ChromeCopy;
  vars: PreviewVars & { storeName: string };
}) {
  const rowBorder = isDarkHex(theme.emailBackgroundColor)
    ? "rgba(255,255,255,0.1)"
    : "rgba(0,0,0,0.07)";
  return (
    <div className="px-5 py-7 sm:px-7">
      <EmailStoreHeader
        storeName={storeName}
        storeLogoUrl={theme.logoUrl ?? null}
        primary={theme.brandColor}
        emailFont={emailFont}
        textColor={theme.emailTextColor}
        className="mb-6"
      />
      <p
        className="text-[11px] font-medium uppercase tracking-[0.14em]"
        style={{ color: theme.mutedTextColor }}
      >
        {copy.eyebrow}
      </p>
      <h2
        className="mt-2 text-[20px] font-semibold tracking-[-0.03em]"
        style={{ color: theme.emailTextColor }}
      >
        {copy.headline}
      </h2>
      <p className="mt-3 text-[14px] leading-relaxed" style={{ color: theme.mutedTextColor }}>
        {copy.body}
      </p>
      <div className="mt-5 border-y py-3" style={{ borderColor: rowBorder }}>
        <p className="text-[12px] font-medium" style={{ color: theme.mutedTextColor }}>
          What’s included
        </p>
        <ul className="mt-2 space-y-1.5 text-[13px]" style={{ color: theme.emailTextColor }}>
          {copy.support.map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden style={{ color: theme.mutedTextColor }}>
                ·
              </span>
              {line}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-3">
        <p className="text-[12px]" style={{ color: theme.mutedTextColor }}>
          {vars.product}
        </p>
        <p className="text-[15px] font-semibold" style={{ color: theme.emailTextColor }}>
          {vars.amount}
        </p>
      </div>
      <div className="mt-6">
        <Cta theme={theme} label={copy.cta} />
      </div>
      <p className="mt-4 text-[12px]">
        <a
          href="#secondary"
          onClick={preventNav}
          className="underline"
          style={{ color: theme.linkColor }}
        >
          {copy.secondaryLink}
        </a>
      </p>
    </div>
  );
}

function AlertExpire({
  theme,
  storeName,
  emailFont,
  copy,
}: {
  theme: EmailThemeTokens;
  storeName: string;
  emailFont: EmailFontId;
  copy: ChromeCopy;
}) {
  return (
    <div>
      <div className="h-1.5 w-full" style={{ background: theme.brandColor }} />
      <div className="px-5 py-7 sm:px-7">
        <EmailStoreHeader
          storeName={storeName}
          storeLogoUrl={theme.logoUrl ?? null}
          primary={theme.brandColor}
          emailFont={emailFont}
          textColor={theme.emailTextColor}
          className="mb-6"
        />
        <p
          className="text-[11px] font-medium uppercase tracking-[0.14em]"
          style={{ color: theme.mutedTextColor }}
        >
          {copy.eyebrow}
        </p>
        <h2
          className="mt-2 text-[20px] font-semibold tracking-[-0.03em]"
          style={{ color: theme.emailTextColor }}
        >
          {copy.headline}
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed" style={{ color: theme.mutedTextColor }}>
          {copy.body}
        </p>
        <ol className="mt-5 space-y-2">
          {copy.support.map((line, i) => (
            <li key={line} className="flex gap-3 text-[13px]">
              <span
                className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                style={{
                  background: theme.brandColor,
                  color: theme.ctaTextColor,
                }}
              >
                {i + 1}
              </span>
              <span style={{ color: theme.emailTextColor }}>{line}</span>
            </li>
          ))}
        </ol>
        <div className="mt-6">
          <Cta theme={theme} label={copy.cta} />
        </div>
        <p className="mt-4 text-[12px]">
          <a
            href="#secondary"
            onClick={preventNav}
            className="underline"
            style={{ color: theme.linkColor }}
          >
            {copy.secondaryLink}
          </a>
        </p>
      </div>
    </div>
  );
}
