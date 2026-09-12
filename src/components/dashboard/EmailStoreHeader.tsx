import { StoreAvatar } from "./dashboardUi";
import {
  DEFAULT_EMAIL_FONT,
  emailFontFamily,
  type EmailFontId,
} from "@/lib/emailFonts";

type Props = {
  storeName: string;
  storeLogoUrl: string | null;
  primary: string;
  emailFont?: EmailFontId;
  textColor?: string;
  className?: string;
};

/** Logo + store name row at the top of recovery email previews. */
export default function EmailStoreHeader({
  storeName,
  storeLogoUrl,
  primary,
  emailFont = DEFAULT_EMAIL_FONT,
  textColor = "#0c0c0c",
  className,
}: Props) {
  return (
    <div
      className={`mb-8 flex items-center gap-3 ${className ?? ""}`}
      style={{ fontFamily: emailFontFamily(emailFont) }}
    >
      <StoreAvatar
        src={storeLogoUrl}
        alt={storeName}
        size="preview"
        brandColor={primary}
      />
      <p
        className="min-w-0 truncate text-[17px] font-semibold tracking-tight"
        style={{ color: textColor }}
      >
        {storeName}
      </p>
    </div>
  );
}
