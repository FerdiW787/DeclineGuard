import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  CreditCard,
  Mail,
  Settings,
  Store,
  UserRound,
  Webhook,
  X,
} from "lucide-react";
import { useClerkUser } from "@/components/auth/useClerkClient";
import CRTWarp from "@/components/homepage/crt-warp/CRTWarp";
import { AccountTab } from "./AccountTab";
import { BillingTab } from "./BillingTab";
import { EmailTab } from "./EmailTab";
import { GeneralTab } from "./GeneralTab";
import { StoreTab } from "./StoreTab";
import { WebhooksTab } from "./WebhooksTab";
import type { SettingsModuleProps, SettingsTabId } from "./settingsTypes";

gsap.registerPlugin(useGSAP);

const TABS: {
  id: SettingsTabId;
  label: string;
  icon: typeof Settings;
  account?: boolean;
}[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "store", label: "Store", icon: Store },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
  { id: "email", label: "Email", icon: Mail },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "account", label: "Account", icon: UserRound, account: true },
];

export default function SettingsModule({
  open,
  onClose,
  initialTab = "general",
  storeName,
  storeSlug,
  apiKeyLast4,
  testMode,
  planTier = "Free",
  planId = "free",
  lsSubscriptionStatus = null,
  recoveryFeePercent = 10,
  webhookSetup,
  webhookStatus,
  feesSummary,
  emailQuota,
  emailSetup,
  brandColor = "#0c0c0c",
  onSaveSender,
  onDisconnect,
  allowDisconnect = true,
  readOnlyNotice = null,
  showAccount = true,
}: SettingsModuleProps) {
  const user = useClerkUser();
  const accountEmail =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    "";
  const [tab, setTab] = useState<SettingsTabId>(initialTab);
  const [mounted, setMounted] = useState(open);
  const rootRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const readOnly = Boolean(readOnlyNotice);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useGSAP(
    () => {
      const backdrop = backdropRef.current;
      const panel = panelRef.current;
      if (!mounted || !backdrop || !panel) return;

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches;
      gsap.killTweensOf([backdrop, panel]);

      if (open) {
        if (reduced) {
          gsap.set(backdrop, { opacity: 1 });
          gsap.set(panel, { opacity: 1, y: 0, scale: 1 });
          return;
        }
        gsap.set(backdrop, { opacity: 0 });
        gsap.set(panel, { opacity: 0, y: 28, scale: 0.96 });
        gsap.to(backdrop, {
          opacity: 1,
          duration: 0.45,
          ease: "power2.out",
        });
        gsap.to(panel, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.52,
          ease: "power3.out",
          delay: 0.06,
        });
        return;
      }

      if (reduced) {
        setMounted(false);
        return;
      }
      gsap.to(backdrop, {
        opacity: 0,
        duration: 0.28,
        ease: "power2.in",
      });
      gsap.to(panel, {
        opacity: 0,
        y: 16,
        scale: 0.98,
        duration: 0.32,
        ease: "power3.in",
        onComplete: () => {
          if (!openRef.current) setMounted(false);
        },
      });
    },
    { dependencies: [open, mounted] },
  );

  if (!mounted) return null;

  const visibleTabs = TABS.filter((item) => !item.account || showAccount);

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[120] flex items-center justify-center px-4 py-6"
    >
      <button
        ref={backdropRef}
        type="button"
        className="absolute inset-0 bg-black/25 opacity-0"
        aria-label="Close settings"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="relative w-full max-w-5xl opacity-0 will-change-transform"
      >
        <div
          className="pointer-events-none absolute -inset-[0.7rem] overflow-hidden rounded-[20px]"
          aria-hidden
        >
          <CRTWarp
            className="h-full w-full"
            color={brandColor}
            backgroundColor={brandColor}
            speed={0}
            curvature={0.22}
            scanlineStrength={0.22}
            scanlineFrequency={180}
            waveAmplitude={0.28}
            waveFrequency={2.4}
            bloom={1.45}
            bloomRadius={1}
            noise={0.08}
            vignette={0.18}
            brightness={1.2}
            pixelation={1}
            rgbShift={0.012}
            mouseReact={false}
            mouseStrength={0}
            dpr={1}
            fps={24}
          />
        </div>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-module-title"
          className="relative flex h-[min(680px,86dvh)] overflow-hidden rounded-xl border border-black/8 bg-white shadow-[0_24px_80px_-24px_rgba(0,0,0,0.28)]"
        >
        <aside className="flex w-[200px] shrink-0 flex-col bg-[#f7f8f8]">
          <div className="px-4 py-4">
            <p
              id="settings-module-title"
              className="text-[13px] font-semibold text-[#08090a]"
            >
              Settings
            </p>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 px-2 pb-3">
            {visibleTabs.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
                    active
                      ? "bg-black/[0.06] font-semibold text-[#08090a]"
                      : "font-medium text-[#8a8f98] hover:bg-black/[0.04] hover:text-[#08090a]"
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="relative flex min-w-0 flex-1 flex-col bg-white">
          <button
            type="button"
            className="absolute right-3 top-3 rounded-lg p-1.5 text-[#8a8f98] transition hover:bg-black/[0.04] hover:text-[#08090a]"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 pr-12 md:px-8">
            {readOnlyNotice ? (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-950">
                {readOnlyNotice}
              </div>
            ) : null}
            {tab === "general" ? (
              <GeneralTab
                storeName={storeName}
                storeSlug={storeSlug}
                testMode={testMode}
                planTier={planTier}
              />
            ) : null}
            {tab === "store" ? (
              <StoreTab
                storeName={storeName}
                apiKeyLast4={apiKeyLast4}
                testMode={testMode}
                onDisconnect={onDisconnect}
                allowDisconnect={allowDisconnect}
                readOnly={readOnly}
              />
            ) : null}
            {tab === "webhooks" ? (
              <WebhooksTab
                webhookSetup={webhookSetup}
                webhookStatus={webhookStatus}
                readOnly={readOnly}
              />
            ) : null}
            {tab === "email" ? (
              <EmailTab
                storeName={storeName}
                emailSetup={emailSetup}
                onSaveSender={onSaveSender}
                readOnly={readOnly}
              />
            ) : null}
            {tab === "billing" ? (
              <BillingTab
                feesSummary={feesSummary}
                emailQuota={emailQuota}
                planTier={planTier}
                planId={planId}
                lsSubscriptionStatus={lsSubscriptionStatus}
                recoveryFeePercent={recoveryFeePercent}
              />
            ) : null}
            {tab === "account" && showAccount ? (
              <AccountTab email={accountEmail} readOnly={readOnly} />
            ) : null}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
