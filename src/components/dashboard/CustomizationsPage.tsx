import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
} from "react";
import {
  type EmailCustomizationValues,
  type EmailCustomizeHandle,
} from "./EmailCustomizePanel";
import EmailPreviewBody, {
  socialLinksFromSettings,
} from "./EmailPreviewBody";
import KitGallerySlider from "./KitGallerySlider";
import {
  applyCopyVars,
  resolveFullEmailDocument,
  type EmailCopyOverrides,
  type RecoveryTemplateId,
} from "@/lib/recoveryEmailCopy";
import {
  documentForKit,
  kitLogoAlign,
  kitShowsGreeting,
  kitShowsStoreName,
} from "@/lib/emailBlockKits";
import { normalizeEmailFont, type EmailFontId } from "@/lib/emailFonts";
import {
  LAYOUT_PRESET_IDS,
  LAYOUT_PRESET_STRUCTURE_META,
  type LayoutPresetId,
} from "@/lib/emailLayoutPresets";
import { formatMoneyAmount, type OpenFailureRow } from "./dashboardUi";
import type { StylingMode } from "@/lib/emailTheme";

export type { EmailCustomizeHandle };

type Props = {
  storeName: string;
  storeLogoUrl: string | null;
  brandColor: string;
  secondaryColor: string;
  emailFont?: EmailFontId | null;
  ctaBackgroundColor?: string | null;
  ctaTextColor?: string | null;
  ctaBorderRadiusPx?: number | null;
  linkColor?: string | null;
  emailBackgroundColor?: string | null;
  emailTextColor?: string | null;
  fromName: string | null;
  replyToEmail: string | null;
  supportEmail: string | null;
  socialX: string | null;
  socialLinkedin: string | null;
  socialYoutube: string | null;
  socialInstagram: string | null;
  emailCopy: EmailCopyOverrides | null;
  showDeclineGuardBadge: boolean;
  openFailures?: OpenFailureRow[] | undefined;
  fromAddressHint?: string | null;
  brandDomain?: string | null;
  onGoToSequences?: () => void;
  onPersistTheme?: (patch: {
    stylingMode?: StylingMode;
    layoutPresetId?: string;
  }) => void;
  serverTheme?: {
    stylingMode?: string | null;
    layoutPresetId?: string | null;
  } | null;
  onSave: (values: EmailCustomizationValues) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
  onUploadImage?: (file: File) => Promise<string>;
  onFocusModeChange?: (focused: boolean) => void;
};

const CustomizationsPage = forwardRef<EmailCustomizeHandle, Props>(
  function CustomizationsPage(
    {
      storeName,
      storeLogoUrl,
      brandColor,
      secondaryColor,
      emailFont,
      ctaBackgroundColor,
      ctaTextColor,
      ctaBorderRadiusPx,
      linkColor,
      emailBackgroundColor,
      emailTextColor,
      fromName,
      replyToEmail,
      supportEmail,
      socialX,
      socialLinkedin,
      socialYoutube,
      socialInstagram,
      emailCopy,
      showDeclineGuardBadge,
      openFailures,
      fromAddressHint,
      onDirtyChange,
      onFocusModeChange,
    },
    ref,
  ) {
    useImperativeHandle(
      ref,
      () => ({
        save: async () => true,
        discard: () => undefined,
        isDirty: () => false,
      }),
      [],
    );

    useEffect(() => {
      onDirtyChange?.(false);
      onFocusModeChange?.(false);
      return () => onFocusModeChange?.(false);
    }, [onDirtyChange, onFocusModeChange]);

    const previewSample = useMemo(() => {
      const source =
        openFailures?.find((row) => row.productName?.trim()) ??
        openFailures?.[0] ??
        null;
      const product = source?.productName?.trim() || "Pro Monthly";
      const amount = source
        ? formatMoneyAmount(source.amountCents, source.currency)
        : "€29";
      const customer =
        source?.customerName?.trim()?.split(/\s+/)[0] ||
        source?.customerEmail?.split("@")[0] ||
        "Maya";
      return { product, amount, customer };
    }, [openFailures]);

    const copyVars = {
      product: previewSample.product,
      amount: previewSample.amount,
      firstName: previewSample.customer,
    };

    const kitDocs = useMemo(() => {
      const docs = {} as Record<
        LayoutPresetId,
        Record<RecoveryTemplateId, ReturnType<typeof documentForKit>>
      >;
      for (const kitId of LAYOUT_PRESET_IDS) {
        docs[kitId] = {
          gentle: documentForKit(
            "gentle",
            kitId,
            resolveFullEmailDocument("gentle", emailCopy),
          ),
          direct: documentForKit(
            "direct",
            kitId,
            resolveFullEmailDocument("direct", emailCopy),
          ),
          urgent: documentForKit(
            "urgent",
            kitId,
            resolveFullEmailDocument("urgent", emailCopy),
          ),
        };
      }
      return docs;
    }, [emailCopy]);

    const socialLinks = socialLinksFromSettings({
      socialX,
      socialLinkedin,
      socialYoutube,
      socialInstagram,
    });
    const footerSupport =
      supportEmail?.trim() ||
      replyToEmail?.trim() ||
      "support@yourstore.com";
    const fromNameLine = fromName?.trim() || storeName;
    const fromAddress =
      fromAddressHint?.match(/<([^>]+)>/)?.[1] ??
      fromAddressHint?.match(/\S+@\S+/)?.[0] ??
      fromAddressHint?.trim() ??
      "";
    const senderLine = fromAddress
      ? `${fromNameLine} · ${fromAddress}`
      : fromNameLine;
    const font = normalizeEmailFont(emailFont);

    return (
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
        <h2 className="sr-only">Recovery email kits</h2>
        <KitGallerySlider
          kitLabel={(kitId) => LAYOUT_PRESET_STRUCTURE_META[kitId].label}
          renderEmail={(kitId, day) => {
            const doc = kitDocs[kitId][day];
            return (
              <KitEmailCard
                kitId={kitId}
                day={day}
                subject={applyCopyVars(doc.subject, copyVars)}
                senderLine={senderLine}
                showDeclineGuardBadge={showDeclineGuardBadge}
                storeName={storeName}
                storeLogoUrl={storeLogoUrl}
                brandColor={brandColor}
                secondaryColor={secondaryColor}
                emailFont={font}
                ctaBackgroundColor={ctaBackgroundColor}
                ctaTextColor={ctaTextColor}
                ctaBorderRadiusPx={ctaBorderRadiusPx}
                linkColor={linkColor}
                emailBackgroundColor={emailBackgroundColor}
                emailTextColor={emailTextColor}
                footerSupport={footerSupport}
                socialLinks={socialLinks}
                customerFirstName={previewSample.customer}
                copyVars={copyVars}
                headline={doc.headline}
                body={doc.body}
                cta={doc.cta}
                blocks={doc.blocks}
                emailPadding={doc.emailPadding}
                docLinkColor={doc.linkColor}
              />
            );
          }}
        />
      </div>
    );
  },
);

function KitEmailCard({
  kitId,
  day,
  subject,
  senderLine,
  showDeclineGuardBadge,
  storeName,
  storeLogoUrl,
  brandColor,
  secondaryColor,
  emailFont,
  ctaBackgroundColor,
  ctaTextColor,
  ctaBorderRadiusPx,
  linkColor,
  emailBackgroundColor,
  emailTextColor,
  footerSupport,
  socialLinks,
  customerFirstName,
  copyVars,
  headline,
  body,
  cta,
  blocks,
  emailPadding,
  docLinkColor,
}: {
  kitId: LayoutPresetId;
  day: RecoveryTemplateId;
  subject: string;
  senderLine: string;
  showDeclineGuardBadge: boolean;
  storeName: string;
  storeLogoUrl: string | null;
  brandColor: string;
  secondaryColor: string;
  emailFont: EmailFontId;
  ctaBackgroundColor?: string | null;
  ctaTextColor?: string | null;
  ctaBorderRadiusPx?: number | null;
  linkColor?: string | null;
  emailBackgroundColor?: string | null;
  emailTextColor?: string | null;
  footerSupport: string;
  socialLinks: ReturnType<typeof socialLinksFromSettings>;
  customerFirstName: string;
  copyVars: { product: string; amount: string; firstName: string };
  headline: string;
  body: string;
  cta: string;
  blocks: ReturnType<typeof documentForKit>["blocks"];
  emailPadding: number | undefined;
  docLinkColor: string | undefined;
}) {
  return (
    <div
      data-email-kit={kitId}
      data-email-day={day}
      className="dg-keep-light max-h-[min(36rem,calc(100dvh-10rem))] overflow-x-hidden overflow-y-auto rounded-md border border-black/8 bg-white shadow-[0_18px_40px_-24px_rgba(0,0,0,0.28)]"
    >
      <div className="border-b border-black/6 bg-[#fafafa] px-4 py-2.5">
        <p className="truncate text-[10px] font-medium uppercase tracking-[0.08em] text-black/40">
          From
        </p>
        <p className="truncate text-[12px] font-medium text-black/70">
          {senderLine}
          {showDeclineGuardBadge ? " · DeclineGuard" : ""}
        </p>
        <p className="mt-2 truncate text-[10px] font-medium uppercase tracking-[0.08em] text-black/40">
          Subject
        </p>
        <p className="mt-0.5 truncate text-[13px] font-semibold text-black">
          {subject}
        </p>
      </div>
      <EmailPreviewBody
        content={{ headline, body, cta }}
        blocks={blocks}
        linkColor={linkColor?.trim() || docLinkColor}
        emailPadding={emailPadding}
        logoAlign={kitLogoAlign(kitId)}
        showStoreName={kitShowsStoreName(kitId)}
        showGreeting={kitShowsGreeting(kitId)}
        storeName={storeName}
        storeLogoUrl={storeLogoUrl}
        primary={brandColor}
        secondary={secondaryColor}
        emailFont={emailFont}
        ctaStyle={{
          backgroundColor: ctaBackgroundColor,
          textColor: ctaTextColor,
          borderRadiusPx: ctaBorderRadiusPx,
        }}
        emailBackgroundColor={emailBackgroundColor}
        emailTextColor={emailTextColor}
        footerSupport={footerSupport}
        socialLinks={socialLinks}
        showDeclineGuardBadge={showDeclineGuardBadge}
        customerFirstName={customerFirstName}
        previewVars={copyVars}
        className="px-5 py-6 md:px-6"
      />
    </div>
  );
}

export default CustomizationsPage;
