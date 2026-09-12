import type { CSSProperties, MouseEvent } from "react";
import EmailBlocksView from "./email-builder/EmailBlocksView";
import EmailStoreHeader from "./EmailStoreHeader";
import { useEmailFontLoader } from "./useEmailFontLoader";
import type { EmailBlock } from "@/lib/emailBuilder";
import {
  DEFAULT_EMAIL_FONT,
  emailFontFamily,
  type EmailFontId,
} from "@/lib/emailFonts";
import {
  ensureCtaLabelContrast,
  ensureShellTextHierarchy,
} from "../../../convex/lib/brandImport/colors";

export type EmailPreviewContent = {
  headline: string;
  body: string;
  cta: string;
};

export type EmailSocialLink = readonly [string, string];

export type EmailCtaStyle = {
  backgroundColor?: string | null;
  textColor?: string | null;
  borderRadiusPx?: number | null;
};

type Props = {
  content: EmailPreviewContent;
  /** When set, renders the block document instead of classic headline/body/cta. */
  blocks?: EmailBlock[] | null;
  linkColor?: string;
  emailPadding?: number;
  storeName: string;
  storeLogoUrl: string | null;
  primary: string;
  secondary: string;
  emailFont?: EmailFontId;
  ctaStyle?: EmailCtaStyle;
  emailBackgroundColor?: string | null;
  emailTextColor?: string | null;
  footerSupport: string;
  socialLinks: readonly EmailSocialLink[];
  showDeclineGuardBadge: boolean;
  /** When true, show a placeholder if no socials are configured (Customizations). */
  showSocialPlaceholder?: boolean;
  /** First name (or short label) used in the greeting. */
  customerFirstName?: string;
  previewVars?: {
    product: string;
    amount: string;
    firstName?: string;
  };
  className?: string;
};

function isDarkHex(hex: string | null | undefined): boolean {
  if (!hex) return false;
  const n = hex.trim().toLowerCase();
  if (n === "#ffffff" || n === "#fff") return false;
  const m = n.match(/^#([0-9a-f]{6})$/);
  if (!m?.[1]) return n !== "#ffffff";
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.35;
}

/** Shared recovery-email body used by Sequences + Customizations previews. */
export default function EmailPreviewBody({
  content,
  blocks,
  linkColor,
  emailPadding,
  storeName,
  storeLogoUrl,
  primary,
  secondary,
  emailFont = DEFAULT_EMAIL_FONT,
  ctaStyle,
  emailBackgroundColor,
  emailTextColor,
  footerSupport,
  socialLinks,
  showDeclineGuardBadge,
  showSocialPlaceholder = false,
  customerFirstName = "Maya",
  previewVars,
  className,
}: Props) {
  useEmailFontLoader(emailFont);
  const preventNav = (e: MouseEvent) => {
    e.preventDefault();
  };
  const shellBg = emailBackgroundColor?.trim() || "#ffffff";
  const dark = isDarkHex(shellBg);
  const hierarchy = ensureShellTextHierarchy(
    shellBg,
    emailTextColor?.trim() || "#0c0c0c",
    secondary?.trim() || "#6b6b70",
  );
  const shellText = hierarchy.bodyText;
  const mutedSecondary = hierarchy.mutedText;
  const links = linkColor?.trim() || (dark ? primary : mutedSecondary);
  const ctaBg = ctaStyle?.backgroundColor?.trim() || primary;
  const ctaText = ensureCtaLabelContrast(
    ctaBg,
    ctaStyle?.textColor?.trim() || "#ffffff",
  );
  const ctaRadius =
    typeof ctaStyle?.borderRadiusPx === "number"
      ? Math.max(0, Math.min(9999, ctaStyle.borderRadiusPx))
      : 12;
  const padStyle: CSSProperties = {
    fontFamily: emailFontFamily(emailFont),
    background: shellBg,
    color: shellText,
    ...(typeof emailPadding === "number"
      ? { paddingLeft: emailPadding, paddingRight: emailPadding }
      : {}),
  };
  const useBlocks = Array.isArray(blocks) && blocks.length > 0;
  const muted = dark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)";
  const faint = dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)";
  const rule = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";

  return (
    <div className={className} style={padStyle}>
      <EmailStoreHeader
        storeName={storeName}
        storeLogoUrl={storeLogoUrl}
        primary={primary}
        emailFont={emailFont}
        textColor={shellText}
      />

      <p
        className="text-[17px] font-semibold tracking-tight"
        style={{ color: shellText }}
      >
        Hi {customerFirstName},
      </p>

      {useBlocks ? (
        <div className="mt-4">
          <EmailBlocksView
            blocks={blocks}
            primary={primary}
            linkColor={links}
            mutedColor={mutedSecondary}
            bodyTextColor={shellText}
            ctaBackgroundColor={ctaBg}
            ctaTextColor={ctaText}
            ctaBorderRadiusPx={ctaRadius}
            vars={
              previewVars ?? {
                product: "Pro Monthly",
                amount: "€29",
                firstName: customerFirstName,
              }
            }
          />
        </div>
      ) : (
        <>
          <p className="mt-1.5 text-[15px]" style={{ color: mutedSecondary }}>
            {content.headline}
          </p>
          <p
            className="mt-6 text-[15px] leading-relaxed"
            style={{ color: dark ? "rgba(255,255,255,0.82)" : "rgba(0,0,0,0.8)" }}
          >
            {content.body}
          </p>
          <a
            href="#update-payment"
            onClick={preventNav}
            className="mt-6 inline-flex w-fit cursor-pointer px-5 py-2.5 text-xs font-semibold transition-opacity hover:opacity-90"
            style={{
              background: ctaBg,
              color: ctaText,
              borderRadius: ctaRadius,
            }}
          >
            {content.cta}
          </a>
          <p className="mt-5 text-[13px]" style={{ color: muted }}>
            Or{" "}
            <a
              href="#billing"
              onClick={preventNav}
              className="cursor-pointer underline transition-opacity hover:opacity-70"
              style={{ color: links }}
            >
              open the billing page
            </a>{" "}
            to update your card.
          </p>
        </>
      )}

      <hr className="my-8" style={{ borderColor: rule }} />

      <p
        className="font-display text-[1.65rem] font-bold leading-none tracking-[-0.03em]"
        style={{ color: shellText }}
      >
        {storeName}
      </p>
      <p className="mt-2.5 text-[12px] leading-relaxed" style={{ color: muted }}>
        Questions or feedback? Drop us a line at{" "}
        <a
          href={`mailto:${footerSupport}`}
          onClick={preventNav}
          className="cursor-pointer underline transition-opacity hover:opacity-70"
          style={{ color: links }}
        >
          {footerSupport}
        </a>
        .
      </p>
      {socialLinks.length > 0 ? (
        <p
          className="mt-4 flex flex-wrap gap-3.5 text-[12px] font-medium"
          style={{ color: dark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.7)" }}
        >
          {socialLinks.map(([label, href]) => (
            <a
              key={label}
              href={href || "#"}
              onClick={preventNav}
              className="cursor-pointer transition-opacity hover:opacity-70"
            >
              {label}
            </a>
          ))}
        </p>
      ) : showSocialPlaceholder ? (
        <p className="mt-4 text-[11px]" style={{ color: faint }}>
          Socials appear here when you add them.
        </p>
      ) : null}
      <p className="mt-5 text-[11px]" style={{ color: faint }}>
        © {new Date().getFullYear()} {storeName}
      </p>
      {showDeclineGuardBadge ? (
        <p
          className="mt-6 border-t pt-4 text-center text-[11px]"
          style={{ borderColor: rule, color: faint }}
        >
          Recovery sent by{" "}
          <span className="font-semibold" style={{ color: links }}>
            DeclineGuard
          </span>
        </p>
      ) : null}
    </div>
  );
}

/** Build labeled social rows from saved customization fields. */
export function socialLinksFromSettings(settings: {
  socialX?: string | null;
  socialLinkedin?: string | null;
  socialYoutube?: string | null;
  socialInstagram?: string | null;
}): EmailSocialLink[] {
  return (
    [
      ["X", settings.socialX ?? ""],
      ["LinkedIn", settings.socialLinkedin ?? ""],
      ["YouTube", settings.socialYoutube ?? ""],
      ["Instagram", settings.socialInstagram ?? ""],
    ] as const
  ).filter(([, href]) => href.trim().length > 0);
}
