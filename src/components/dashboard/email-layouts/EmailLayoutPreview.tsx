import type { CSSProperties, MouseEvent } from "react";
import EmailStoreHeader from "../EmailStoreHeader";
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
  emailType,
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

  const shared = {
    theme,
    storeName,
    storeLogoUrl,
    emailFont,
    copy,
    vars,
  };

  const inner = (() => {
    switch (layoutPresetId) {
      case "poster-notice":
        return <PosterNotice {...shared} />;
      case "amount-due":
        return <AmountDue {...shared} />;
      case "plain-letter":
        return <PlainLetter {...shared} />;
      case "what-happened":
        return <WhatHappened {...shared} />;
      case "quiet-column":
        return <QuietColumn {...shared} />;
      case "italic-lead":
        return <ItalicLead {...shared} />;
      case "status-word":
        return <StatusWord {...shared} />;
      case "deck-headline":
        return <DeckHeadline {...shared} />;
      case "hold-open":
        return <HoldOpen {...shared} />;
      case "folio-mark":
        return <FolioMark {...shared} />;
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

type LayoutProps = {
  theme: EmailThemeTokens;
  storeName: string;
  storeLogoUrl: string | null;
  emailFont: EmailFontId;
  copy: ChromeCopy;
  vars: PreviewVars & { storeName: string };
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

function BillingLink({
  theme,
  label,
  align = "left",
}: {
  theme: EmailThemeTokens;
  label: string;
  align?: "left" | "center";
}) {
  return (
    <p className={cn("text-[12px]", align === "center" && "text-center")}>
      <a
        href="#secondary"
        onClick={preventNav}
        className="underline"
        style={{ color: theme.linkColor }}
      >
        {label}
      </a>
    </p>
  );
}

function Header({
  theme,
  storeName,
  storeLogoUrl,
  emailFont,
  showName = true,
}: {
  theme: EmailThemeTokens;
  storeName: string;
  storeLogoUrl: string | null;
  emailFont: EmailFontId;
  showName?: boolean;
}) {
  return (
    <EmailStoreHeader
      storeName={storeName}
      storeLogoUrl={storeLogoUrl}
      primary={theme.brandColor}
      emailFont={emailFont}
      textColor={theme.emailTextColor}
      showName={showName}
      className="mb-6"
    />
  );
}

function PosterNotice({ theme, copy }: LayoutProps) {
  return (
    <div className="px-10 py-16 text-center">
      <h2
        className="text-[34px] font-semibold leading-tight tracking-[-0.03em]"
        style={{ color: theme.emailTextColor }}
      >
        {copy.headline}
      </h2>
      <p
        className="mx-auto mt-3.5 max-w-[22rem] text-[16px] leading-relaxed"
        style={{ color: theme.mutedTextColor }}
      >
        {copy.body}
      </p>
      <div className="mt-9 flex justify-center">
        <Cta theme={theme} label={copy.cta} />
      </div>
      <div className="mt-4">
        <BillingLink theme={theme} label={copy.secondaryLink} align="center" />
      </div>
    </div>
  );
}

function AmountDue({ theme, storeName, storeLogoUrl, emailFont, copy, vars }: LayoutProps) {
  return (
    <div className="px-8 py-10">
      <Header
        theme={theme}
        storeName={storeName}
        storeLogoUrl={storeLogoUrl}
        emailFont={emailFont}
      />
      <p className="text-[11px]" style={{ color: theme.mutedTextColor }}>
        Amount due
      </p>
      <p
        className="mt-1.5 text-[42px] font-semibold leading-none tracking-tight"
        style={{ color: theme.emailTextColor }}
      >
        {vars.amount}
      </p>
      <p className="mt-1 text-[14px]" style={{ color: theme.mutedTextColor }}>
        {vars.product}
      </p>
      <h2
        className="mt-7 text-[20px] font-semibold tracking-[-0.02em]"
        style={{ color: theme.emailTextColor }}
      >
        {copy.headline}
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed" style={{ color: theme.mutedTextColor }}>
        Update the card to keep access on — about a minute.
      </p>
      <div className="mt-6">
        <Cta theme={theme} label={copy.cta} />
      </div>
      <div className="mt-3.5">
        <BillingLink theme={theme} label={copy.secondaryLink} />
      </div>
    </div>
  );
}

function PlainLetter({ theme, storeName, storeLogoUrl, emailFont, copy }: LayoutProps) {
  return (
    <div className="px-9 py-10">
      <Header
        theme={theme}
        storeName={storeName}
        storeLogoUrl={storeLogoUrl}
        emailFont={emailFont}
      />
      <h2
        className="text-[22px] font-semibold tracking-[-0.02em]"
        style={{ color: theme.emailTextColor }}
      >
        {copy.headline}
      </h2>
      <p className="mt-4 text-[16px] leading-relaxed" style={{ color: theme.emailTextColor }}>
        {copy.body}
      </p>
      <p className="mt-4 text-[16px] leading-relaxed" style={{ color: theme.mutedTextColor }}>
        Updating the card keeps the same plan on. Nothing else changes.
      </p>
      <p className="mt-5 text-[16px]" style={{ color: theme.emailTextColor }}>
        Thanks,
      </p>
      <div className="mt-7">
        <Cta theme={theme} label={copy.cta} />
      </div>
      <div className="mt-3.5">
        <BillingLink theme={theme} label={copy.secondaryLink} />
      </div>
    </div>
  );
}

function ItalicLead({ theme, copy }: LayoutProps) {
  return (
    <div className="px-10 py-12">
      <h2
        className="text-[28px] font-normal italic leading-snug tracking-[-0.02em]"
        style={{ color: theme.emailTextColor }}
      >
        {copy.headline}
      </h2>
      <p className="mt-4 text-[15px] leading-relaxed" style={{ color: theme.mutedTextColor }}>
        Update the card to keep access on — about a minute.
      </p>
      <div className="mt-7">
        <Cta theme={theme} label={copy.cta} />
      </div>
      <div className="mt-3.5">
        <BillingLink theme={theme} label={copy.secondaryLink} />
      </div>
    </div>
  );
}

function StatusWord({ theme, storeName, storeLogoUrl, emailFont, copy, vars }: LayoutProps) {
  return (
    <div className="px-8 py-9">
      <Header
        theme={theme}
        storeName={storeName}
        storeLogoUrl={storeLogoUrl}
        emailFont={emailFont}
      />
      <p
        className="text-[40px] font-semibold leading-none tracking-tight"
        style={{ color: theme.emailTextColor }}
      >
        Failed
      </p>
      <p className="mt-1.5 text-[14px]" style={{ color: theme.mutedTextColor }}>
        {vars.product}
      </p>
      <h2
        className="mt-6 text-[20px] font-semibold tracking-[-0.02em]"
        style={{ color: theme.emailTextColor }}
      >
        {copy.headline}
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed" style={{ color: theme.mutedTextColor }}>
        The charge of {vars.amount} didn’t go through.
      </p>
      <div className="mt-6">
        <Cta theme={theme} label={copy.cta} />
      </div>
      <div className="mt-3.5">
        <BillingLink theme={theme} label={copy.secondaryLink} />
      </div>
    </div>
  );
}

function DeckHeadline({ theme, copy }: LayoutProps) {
  return (
    <div className="px-11 py-12">
      <p className="text-[11px]" style={{ color: theme.mutedTextColor }}>
        Card update needed
      </p>
      <h2
        className="mt-2.5 text-[36px] font-semibold leading-tight tracking-[-0.03em]"
        style={{ color: theme.emailTextColor }}
      >
        {copy.headline}
      </h2>
      <p className="mt-3.5 text-[15px] leading-relaxed" style={{ color: theme.mutedTextColor }}>
        Takes about a minute to keep access on.
      </p>
      <div className="mt-7">
        <Cta theme={theme} label={copy.cta} />
      </div>
      <div className="mt-3.5">
        <BillingLink theme={theme} label={copy.secondaryLink} />
      </div>
    </div>
  );
}

function HoldOpen({ theme, storeName, storeLogoUrl, emailFont, copy }: LayoutProps) {
  return (
    <div className="px-9 py-10">
      <Header
        theme={theme}
        storeName={storeName}
        storeLogoUrl={storeLogoUrl}
        emailFont={emailFont}
      />
      <p
        className="text-[24px] leading-snug tracking-[-0.02em]"
        style={{ color: theme.emailTextColor }}
      >
        Access is still on.
      </p>
      <h2
        className="mt-3.5 text-[18px] font-semibold tracking-[-0.02em]"
        style={{ color: theme.emailTextColor }}
      >
        {copy.headline}
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed" style={{ color: theme.mutedTextColor }}>
        {copy.body}
      </p>
      <div className="mt-6">
        <Cta theme={theme} label={copy.cta} />
      </div>
      <div className="mt-3.5">
        <BillingLink theme={theme} label={copy.secondaryLink} />
      </div>
    </div>
  );
}

function FolioMark({ theme, storeName, storeLogoUrl, emailFont, copy }: LayoutProps) {
  return (
    <div className="px-8 py-9">
      <Header
        theme={theme}
        storeName={storeName}
        storeLogoUrl={storeLogoUrl}
        emailFont={emailFont}
      />
      <p className="text-right text-[11px]" style={{ color: theme.mutedTextColor }}>
        Notice
      </p>
      <h2
        className="mt-5 text-[22px] font-semibold tracking-[-0.02em]"
        style={{ color: theme.emailTextColor }}
      >
        {copy.headline}
      </h2>
      <p className="mt-2.5 text-[15px] leading-relaxed" style={{ color: theme.mutedTextColor }}>
        {copy.body}
      </p>
      <div className="mt-6">
        <Cta theme={theme} label={copy.cta} />
      </div>
      <div className="mt-3.5">
        <BillingLink theme={theme} label={copy.secondaryLink} />
      </div>
    </div>
  );
}

function WhatHappened({ theme, storeName, storeLogoUrl, emailFont, copy }: LayoutProps) {
  return (
    <div className="px-7 py-8">
      <Header
        theme={theme}
        storeName={storeName}
        storeLogoUrl={storeLogoUrl}
        emailFont={emailFont}
      />
      <h2
        className="text-[22px] font-semibold tracking-[-0.02em]"
        style={{ color: theme.emailTextColor }}
      >
        {copy.headline}
      </h2>
      <p
        className="mt-6 text-[11px] uppercase tracking-[0.12em]"
        style={{ color: theme.mutedTextColor }}
      >
        What happened
      </p>
      <p className="mt-1.5 text-[15px] leading-relaxed" style={{ color: theme.emailTextColor }}>
        {copy.body}
      </p>
      <hr
        className="my-5"
        style={{
          borderColor: isDarkHex(theme.emailBackgroundColor)
            ? "rgba(255,255,255,0.12)"
            : "rgba(0,0,0,0.08)",
        }}
      />
      <p
        className="text-[11px] uppercase tracking-[0.12em]"
        style={{ color: theme.mutedTextColor }}
      >
        What to do
      </p>
      <p className="mt-1.5 text-[15px] leading-relaxed" style={{ color: theme.emailTextColor }}>
        Open billing and update the card.
      </p>
      <div className="mt-6">
        <Cta theme={theme} label={copy.cta} />
      </div>
      <div className="mt-3.5">
        <BillingLink theme={theme} label={copy.secondaryLink} />
      </div>
    </div>
  );
}

function QuietColumn({ theme, copy }: LayoutProps) {
  return (
    <div className="px-12 py-14">
      <h2
        className="text-[32px] font-semibold leading-snug tracking-[-0.03em]"
        style={{ color: theme.emailTextColor }}
      >
        {copy.headline}
      </h2>
      <p className="mt-4 max-w-[24rem] text-[17px] leading-relaxed" style={{ color: theme.mutedTextColor }}>
        {copy.body}
      </p>
      <div className="mt-8">
        <Cta theme={theme} label={copy.cta} />
      </div>
      <div className="mt-4">
        <BillingLink theme={theme} label={copy.secondaryLink} />
      </div>
    </div>
  );
}

