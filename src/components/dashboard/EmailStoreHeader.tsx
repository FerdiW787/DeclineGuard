import { StoreAvatar } from "./dashboardUi";
import {
  DEFAULT_EMAIL_FONT,
  emailFontFamily,
  type EmailFontId,
} from "@/lib/emailFonts";
import { cn } from "@/lib/utils";

type Props = {
  storeName: string;
  storeLogoUrl: string | null;
  primary: string;
  emailFont?: EmailFontId;
  textColor?: string;
  className?: string;
  /** Sonos is logo-only + centered; the other RGE kits sit left with a name. */
  align?: "left" | "center" | "right";
  showName?: boolean;
};

/** Logo + store name row at the top of recovery email previews. */
export default function EmailStoreHeader({
  storeName,
  storeLogoUrl,
  primary,
  emailFont = DEFAULT_EMAIL_FONT,
  textColor = "#0c0c0c",
  className,
  align = "left",
  showName = true,
}: Props) {
  return (
    <div
      className={cn(
        "mb-8 flex items-center gap-3",
        align === "center" && "justify-center",
        align === "right" && "justify-end",
        className,
      )}
      style={{ fontFamily: emailFontFamily(emailFont) }}
    >
      <StoreAvatar
        src={storeLogoUrl}
        alt={storeName}
        size="preview"
        brandColor={primary}
      />
      {showName ? (
        <p
          className="min-w-0 truncate text-[17px] font-semibold tracking-tight"
          style={{ color: textColor }}
        >
          {storeName}
        </p>
      ) : (
        <span className="sr-only">{storeName}</span>
      )}
    </div>
  );
}
