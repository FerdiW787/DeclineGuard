import BrandLogo from "@/components/BrandLogo";
import { LayoutDashboard, Shield } from "lucide-react";

export const ADMIN_DASH_DEST_KEY = "dg.adminDashboardChoice";

type TakeoverSnapshot = {
  status?: string;
  adminUserId?: string | null;
} | null;

export function adminNeedsDestinationChoice(args: {
  role: string | undefined;
  activeTakeover: TakeoverSnapshot | undefined;
  currentUserId: string | undefined;
}): boolean {
  if (args.role !== "admin") return false;
  if (
    args.activeTakeover?.status === "active" &&
    args.activeTakeover.adminUserId != null &&
    args.activeTakeover.adminUserId === args.currentUserId
  ) {
    return false;
  }
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).get("dest") === "merchant") {
    return false;
  }
  return sessionStorage.getItem(ADMIN_DASH_DEST_KEY) !== "merchant";
}

export function rememberMerchantDashboardChoice() {
  sessionStorage.setItem(ADMIN_DASH_DEST_KEY, "merchant");
  const url = new URL(window.location.href);
  if (url.searchParams.has("dest")) {
    url.searchParams.delete("dest");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }
}

type Props = {
  onChooseMerchant: () => void;
};

/**
 * When an Admin hits /a/dashboard (and isn’t in a takeover), let them pick
 * merchant product dashboard vs Admin console.
 */
export default function AdminDestinationGate({ onChooseMerchant }: Props) {
  return (
    <div className="ln-surface relative flex min-h-dvh flex-col bg-[#f7f8f8] text-[#08090a]">
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <BrandLogo size="sm" />
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8a8f98]">
          Admin
        </p>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 pb-16 pt-4 sm:px-10">
        <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#8a8f98]">
          Where to?
        </p>
        <h1 className="ln-h1 mt-2 max-w-xl text-[clamp(1.85rem,4vw,2.6rem)] font-medium leading-[1.05] tracking-[-0.03em]">
          Choose a destination
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-[#6b6f76]">
          You’re signed in as Admin. Open the merchant product dashboard, or go
          to the Admin console.
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onChooseMerchant}
            className="group flex flex-col items-start gap-4 rounded-xl border border-black/8 bg-white px-5 py-6 text-left transition hover:border-black/14 hover:bg-[#f7f8f8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08090a]"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#08090a] text-[#f7f8f8] transition group-hover:bg-[#2a2b2e]">
              <LayoutDashboard className="size-5" strokeWidth={1.75} />
            </span>
            <span>
              <span className="block text-lg tracking-tight text-[#08090a]">
                Merchant dashboard
              </span>
              <span className="mt-1 block text-[13px] leading-snug text-[#6b6f76]">
                Your own DeclineGuard product view — stores, recoveries, setup.
              </span>
            </span>
          </button>

          <a
            href="/a/admin"
            className="group flex flex-col items-start gap-4 rounded-xl border border-black/8 bg-white px-5 py-6 text-left transition hover:border-black/14 hover:bg-[#f7f8f8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#08090a]"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#08090a] text-[#f7f8f8] transition group-hover:bg-[#2a2b2e]">
              <Shield className="size-5" strokeWidth={1.75} />
            </span>
            <span>
              <span className="block text-lg tracking-tight text-[#08090a]">
                Admin console
              </span>
              <span className="mt-1 block text-[13px] leading-snug text-[#6b6f76]">
                Staff inbox, accounts, freezes, and live support tools.
              </span>
            </span>
          </a>
        </div>
      </main>
    </div>
  );
}
