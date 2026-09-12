import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ChevronRight,
  Clock,
  Palette,
  Send,
  Users,
  Zap,
} from "lucide-react";
import {
  useMarketingDesktop,
  whenDesktop,
} from "@/components/homepage/marketing/MarketingDesktopContext";
import { cn } from "@/lib/utils";
import {
  deliveryStatusLabel,
  formatMoneyAmount,
  formatNextEmailAt,
  isFailureDeliveryIssue,
  isFailureOverdue,
  openFailureStatusLine,
  Panel,
  sequenceStageForFailure,
  PageHeader,
  type OpenFailureRow,
  type SequenceStage,
} from "./dashboardUi";
import type { RecoveriesQueueFilter } from "./RecoveriesPage";
import EmailPreviewBody, {
  socialLinksFromSettings,
} from "./EmailPreviewBody";
import {
  normalizeEmailFont,
  type EmailFontId,
} from "@/lib/emailFonts";
import PreviewSequenceExperience from "./PreviewSequenceExperience";
import CRTWarp from "@/components/homepage/crt-warp/CRTWarp";
import type { FingerCount } from "./SequencesWarrior";
import {
  applyCopyVars,
  resolveEmailCopy,
  type EmailCopyOverrides,
  type RecoveryTemplateId,
} from "@/lib/recoveryEmailCopy";

const STEPS = [
  {
    id: "day0" as const,
    number: 1,
    day: "Day 0",
    tone: "Gentle" as const,
    templateId: "gentle" as const,
    whenLabel: "After 2nd failed payment attempt",
    shortWhen: "After 2nd attempt",
  },
  {
    id: "day2" as const,
    number: 2,
    day: "Day 2",
    tone: "Direct" as const,
    templateId: "direct" as const,
    whenLabel: "After 2 days with no recovery",
    shortWhen: "2 days later",
  },
  {
    id: "day5" as const,
    number: 3,
    day: "Day 5",
    tone: "Urgent" as const,
    templateId: "urgent" as const,
    whenLabel: "After 5 days from Day 0",
    shortWhen: "3 days later",
  },
] as const;

type StepId = (typeof STEPS)[number]["id"];
type ToneName = (typeof STEPS)[number]["tone"];
type PeopleScope = "all" | SequenceStage;
type MobilePane = "people" | "preview";

const TONE_BADGE: Record<ToneName, string> = {
  Gentle: "bg-emerald-100 text-emerald-800",
  Direct: "bg-yellow-100 text-yellow-800",
  Urgent: "bg-red-100 text-red-800",
};

const TONE_DOT: Record<ToneName, string> = {
  Gentle: "bg-emerald-500",
  Direct: "bg-yellow-500",
  Urgent: "bg-red-500",
};

/** CRT-warp halo colors — mirrors the Overview “This calendar month” cards. */
const TONE_CRT: Record<ToneName, string> = {
  Gentle: "#10b981",
  Direct: "#eab308",
  Urgent: "#ef4444",
};
const TRIGGER_CRT = "#94a3b8";

/** Bottom inner-shadow on unselected funnel boxes; selected box has none. */
const FUNNEL_INNER_SHADOW =
  "shadow-[inset_0_-16px_20px_-16px_rgba(8,9,10,0.2)]";

const STAGE_LABEL: Record<SequenceStage, string> = {
  queued: "Queued",
  day0: "Email 1",
  day2: "Email 2",
  day5: "Email 3",
};

const STAGE_BADGE: Record<SequenceStage, string> = {
  queued: "bg-black/5 text-black/55",
  day0: "bg-emerald-100 text-emerald-800",
  day2: "bg-yellow-100 text-yellow-800",
  day5: "bg-red-100 text-red-800",
};

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
  templateId: string;
  emailsSentThisMonth?: number;
  openFailures: OpenFailureRow[] | undefined;
  supportEmail: string | null;
  socialX: string | null;
  socialLinkedin: string | null;
  socialYoutube: string | null;
  socialInstagram: string | null;
  emailCopy?: EmailCopyOverrides | null;
  showDeclineGuardBadge: boolean;
  onGoToRecoveries?: (filter?: RecoveriesQueueFilter) => void;
  onGoToCustomizations?: () => void;
  /** Keep the corner warrior in sync (rendered outside this page’s scroller). */
  onFingersChange?: (fingers: FingerCount) => void;
  previewBlocked?: boolean;
  previewBlockedReason?: string;
  onContactSupport?: () => void;
};

function initialStepFromTemplate(templateId: string): StepId {
  if (templateId === "direct") return "day2";
  if (templateId === "urgent") return "day5";
  return "day0";
}

function previewStepForStage(stage: SequenceStage): StepId {
  if (stage === "day2" || stage === "day5") return stage;
  return "day0";
}

export default function SequencesPage({
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
  templateId,
  openFailures,
  supportEmail,
  socialX,
  socialLinkedin,
  socialYoutube,
  socialInstagram,
  emailCopy = null,
  showDeclineGuardBadge,
  onGoToRecoveries,
  onGoToCustomizations,
  onFingersChange,
  previewBlocked = false,
  onContactSupport,
}: Props) {
  const desk = useMarketingDesktop();
  const [nowMs] = useState(() => Date.now());
  const [activeStep, setActiveStep] = useState<StepId>(() =>
    initialStepFromTemplate(templateId),
  );
  const [peopleScope, setPeopleScope] = useState<PeopleScope>("all");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<MobilePane>("people");
  const [previewOpen, setPreviewOpen] = useState(false);

  const activeIndex = STEPS.findIndex((s) => s.id === activeStep);
  const step = STEPS[activeIndex] ?? STEPS[0]!;
  const stepCopy = resolveEmailCopy(
    step.templateId as RecoveryTemplateId,
    emailCopy,
  );
  const fingers = step.number as FingerCount;

  useEffect(() => {
    onFingersChange?.(fingers);
  }, [fingers, onFingersChange]);
  const footerSupport = supportEmail ?? "support@yourstore.com";
  const socialLinks = socialLinksFromSettings({
    socialX,
    socialLinkedin,
    socialYoutube,
    socialInstagram,
  });

  const pipeline = useMemo(() => {
    const rows = openFailures ?? [];
    const byStage: Record<SequenceStage, OpenFailureRow[]> = {
      queued: [],
      day0: [],
      day2: [],
      day5: [],
    };
    let overdueCount = 0;
    let atRiskCents = 0;

    for (const row of rows) {
      byStage[sequenceStageForFailure(row)].push(row);
      if (isFailureOverdue(row, nowMs)) overdueCount += 1;
      atRiskCents += row.amountCents;
    }

    for (const key of Object.keys(byStage) as SequenceStage[]) {
      byStage[key].sort((a, b) => {
        const aOver = isFailureOverdue(a, nowMs) ? 1 : 0;
        const bOver = isFailureOverdue(b, nowMs) ? 1 : 0;
        if (aOver !== bOver) return bOver - aOver;
        return b.amountCents - a.amountCents;
      });
    }

    const people = [
      ...byStage.queued,
      ...byStage.day0,
      ...byStage.day2,
      ...byStage.day5,
    ];

    return {
      byStage,
      people,
      overdueCount,
      atRiskCents,
      openTotal: rows.length,
    };
  }, [openFailures, nowMs]);

  const peopleInView =
    peopleScope === "all" ? pipeline.people : pipeline.byStage[peopleScope];
  const selectedFailure =
    peopleInView.find((row) => row._id === selectedPersonId) ??
    pipeline.people.find((row) => row._id === selectedPersonId) ??
    pipeline.byStage[activeStep][0] ??
    pipeline.people[0] ??
    null;

  const previewSample = useMemo(() => {
    const source =
      selectedFailure ??
      openFailures?.find((r) => r.productName?.trim()) ??
      openFailures?.[0] ??
      null;
    const product = source?.productName?.trim() || "Pro Monthly";
    const amount = source
      ? formatMoneyAmount(source.amountCents, source.currency)
      : "€29";
    const customer =
      selectedFailure?.customerName?.trim()?.split(/\s+/)[0] ||
      selectedFailure?.customerEmail.split("@")[0] ||
      "Maya";
    return { product, amount, customer, fromCase: selectedFailure != null };
  }, [selectedFailure, openFailures]);

  const previewSubject = applyCopyVars(stepCopy.subject, {
    product: previewSample.product,
    amount: previewSample.amount,
    firstName: previewSample.customer,
  });
  const previewHeadline = applyCopyVars(stepCopy.headline, {
    product: previewSample.product,
    amount: previewSample.amount,
    firstName: previewSample.customer,
  });
  const previewBody = applyCopyVars(stepCopy.body, {
    product: previewSample.product,
    amount: previewSample.amount,
    firstName: previewSample.customer,
  });

  function selectStage(scope: PeopleScope) {
    setPeopleScope(scope);
    if (scope !== "all") {
      setActiveStep(previewStepForStage(scope));
    }
  }

  function selectPerson(row: OpenFailureRow) {
    const stage = sequenceStageForFailure(row);
    setSelectedPersonId(row._id);
    setActiveStep(previewStepForStage(stage));
    setMobilePane("preview");
  }

  const atRiskLabel =
    openFailures === undefined || pipeline.people.length === 0
      ? null
      : formatMoneyAmount(
          pipeline.atRiskCents,
          pipeline.people[0]?.currency ?? "eur",
        );

  const peopleTitle =
    peopleScope === "all"
      ? "Everyone in sequence"
      : peopleScope === "queued"
        ? "Waiting to start"
        : `On ${STAGE_LABEL[peopleScope]}`;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pb-10 pt-3",
        "lg:min-h-0 lg:overflow-visible lg:px-6 lg:pt-5 lg:pb-5",
        whenDesktop(desk, "min-h-0 overflow-visible px-6 pt-5 pb-5"),
      )}
    >
      <PageHeader
        eyebrow="Sequences"
        title="Live recovery sequence"
        description="Three branded emails fire after a decline. Watch people move through each stage, preview the email, and jump into Recoveries to act."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {onGoToCustomizations ? (
              <button
                type="button"
                onClick={onGoToCustomizations}
                className="dg-btn shrink-0 cursor-pointer !gap-1.5 !px-3 !py-1.5 text-[11px]"
              >
                <Palette className="size-3.5" />
                Customize brand
              </button>
            ) : null}
            <button
              type="button"
              disabled={previewBlocked}
              onClick={() => {
                if (previewBlocked) return;
                setPreviewOpen(true);
              }}
              className="dg-btn dg-btn-primary shrink-0 cursor-pointer !gap-1.5 !px-3.5 !py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="size-3.5" />
              Send preview to me
            </button>
          </div>
        }
      />

      {/* ── Mobile pane toggle ── */}
      <div className="flex shrink-0 gap-1 rounded-md border border-black/8 bg-white p-1 lg:hidden">
        {(
          [
            { id: "people" as const, label: "People" },
            { id: "preview" as const, label: "Preview" },
          ]
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setMobilePane(item.id)}
            className={`flex-1 rounded-[6px] px-3 py-1.5 text-[12px] font-semibold ${
              mobilePane === item.id
                ? "bg-[#08090a] text-white"
                : "text-[#6b6f76]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        className={cn(
          "min-h-0 flex-1 gap-5",
          "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] lg:min-h-0 lg:overflow-visible",
          whenDesktop(
            desk,
            "grid grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] min-h-0 overflow-visible",
          ),
        )}
      >
        {/* ── Funnel tabs sitting on top of the people panel ── */}
        <div
          className={cn(
            "flex min-h-0 flex-col",
            mobilePane === "people" ? "flex" : "hidden lg:flex",
          )}
        >
          <div
            data-enter
            className="relative z-10 grid shrink-0 grid-cols-2 gap-3 overflow-x-clip overflow-y-visible pt-[0.45rem] sm:flex sm:items-stretch sm:justify-between sm:gap-0"
          >
            <FunnelBox
              active={peopleScope === "queued"}
              crt={TRIGGER_CRT}
              onClick={() => selectStage("queued")}
            >
              <div className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-black text-white">
                  <Zap className="size-3.5" strokeWidth={2.4} />
                </span>
                <span className="text-[13px] font-semibold text-[#08090a]">
                  Trigger
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-display text-[1.8rem] leading-none tracking-tight tabular-nums text-[#08090a]">
                  {openFailures === undefined
                    ? "…"
                    : pipeline.byStage.queued.length}
                </span>
                <span className="text-[11px] font-medium text-[#8a8f98]">
                  queued
                </span>
              </div>
              <p className="mt-1.5 truncate text-[11px] text-[#8a8f98]">
                Payment fails
              </p>
            </FunnelBox>
            <FunnelConnector />

            {STEPS.map((s, i) => {
              const count = pipeline.byStage[s.id].length;
              const overdue = pipeline.byStage[s.id].filter((r) =>
                isFailureOverdue(r, nowMs),
              ).length;
              return (
                <Fragment key={s.id}>
                <FunnelBox
                  active={peopleScope === s.id}
                  crt={TONE_CRT[s.tone]}
                  onClick={() => selectStage(s.id)}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        TONE_DOT[s.tone],
                      )}
                      aria-hidden
                    />
                    <span className="text-[13px] font-semibold text-[#08090a]">
                      Email {s.number}
                    </span>
                    <span
                      className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TONE_BADGE[s.tone]}`}
                    >
                      {s.tone}
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-display text-[1.8rem] leading-none tracking-tight tabular-nums text-[#08090a]">
                      {openFailures === undefined ? "…" : count}
                    </span>
                    <span className="text-[11px] font-medium text-[#8a8f98]">
                      on this step
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#8a8f98]">
                      <Clock className="size-3" />
                      {s.shortWhen}
                    </span>
                    {overdue > 0 ? (
                      <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-800">
                        {overdue} overdue
                      </span>
                    ) : null}
                  </div>
                </FunnelBox>
                {i < STEPS.length - 1 ? <FunnelConnector /> : null}
                </Fragment>
              );
            })}
          </div>

          {/* ── People on the selected stage ── */}
          <Panel
            data-enter
            className="flex min-h-0 flex-1 flex-col !rounded-t-none p-5 md:p-6"
          >
          <div className="mb-4 flex shrink-0 flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8a8f98]">
                People
              </p>
              <h3 className="font-display mt-1 text-2xl tracking-tight text-[#08090a]">
                {peopleTitle}
              </h3>
              <p className="mt-1 text-[12px] leading-relaxed text-[#6b6f76]">
                {openFailures === undefined
                  ? "Loading people…"
                  : peopleInView.length === 0
                    ? peopleScope === "all"
                      ? "Nobody in this drip right now"
                      : "No one on this step"
                    : `${peopleInView.length} ${
                        peopleInView.length === 1 ? "person" : "people"
                      }${
                        peopleScope === "all" && atRiskLabel
                          ? ` · ${atRiskLabel} at risk`
                          : ""
                      }${
                        peopleScope === "all" && pipeline.overdueCount > 0
                          ? ` · ${pipeline.overdueCount} overdue`
                          : ""
                      }`}
              </p>
            </div>
            {peopleScope !== "all" ? (
              <button
                type="button"
                onClick={() => setPeopleScope("all")}
                className="shrink-0 rounded-full border border-black/8 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#6b6f76] transition hover:border-black/20 hover:text-[#08090a]"
              >
                Show everyone
              </button>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {openFailures === undefined ? (
              <p className="mt-6 text-sm text-[#8a8f98]">Loading people…</p>
            ) : peopleInView.length === 0 ? (
              <div className="mt-6 flex flex-col items-center rounded-md bg-black/[0.03] px-4 py-12 text-center">
                <Users className="size-7 text-[#8a8f98]" />
                <p className="mt-3 text-sm font-semibold text-[#08090a]">
                  {peopleScope === "all"
                    ? "No one in this sequence"
                    : "This step is empty"}
                </p>
                <p className="mt-1 max-w-[18rem] text-[12px] leading-relaxed text-[#6b6f76]">
                  New declines land here automatically and move through Email 1 →
                  3 until they pay or the drip ends.
                </p>
              </div>
            ) : (
              <ul className="space-y-1">
                {peopleInView.map((row) => {
                  const stage = sequenceStageForFailure(row);
                  const amount = formatMoneyAmount(
                    row.amountCents,
                    row.currency,
                  );
                  const displayName =
                    row.customerName?.trim() || row.customerEmail;
                  const overdue = isFailureOverdue(row, nowMs);
                  const deliveryIssue = isFailureDeliveryIssue(row);
                  const selected = row._id === selectedFailure?._id;
                  const nextLabel = formatNextEmailAt(row.nextEmailAt);
                  return (
                    <li key={row._id}>
                      <button
                        type="button"
                        onClick={() => selectPerson(row)}
                        aria-pressed={selected}
                        className={cn(
                          "dg-interactive group flex w-full items-start justify-between gap-2.5 rounded-md border px-2.5 py-2.5 text-left",
                          selected
                            ? "border-black/12 bg-[#f7f8f8]"
                            : "border-transparent",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <p className="truncate text-sm font-semibold text-[#08090a]">
                              {displayName}
                            </p>
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${STAGE_BADGE[stage]}`}
                            >
                              {STAGE_LABEL[stage]}
                            </span>
                            {overdue ? (
                              <PersonBadge tone="warn">Overdue</PersonBadge>
                            ) : null}
                            {deliveryIssue ? (
                              <PersonBadge tone="danger">
                                {deliveryStatusLabel(
                                  row.lastEmailDeliveryStatus,
                                )}
                              </PersonBadge>
                            ) : null}
                            {row.testMode ? (
                              <PersonBadge tone="neutral">Test</PersonBadge>
                            ) : null}
                          </div>
                          <p className="mt-0.5 truncate text-[11px] text-black/40">
                            {[
                              row.productName?.trim() || null,
                              peopleScope === "all"
                                ? openFailureStatusLine(row)
                                : null,
                              nextLabel
                                ? overdue
                                  ? `Was due ${nextLabel}`
                                  : `Next ${nextLabel}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          {row.customerName?.trim() ? (
                            <p className="truncate text-[11px] text-black/35">
                              {row.customerEmail}
                            </p>
                          ) : null}
                        </div>
                        <span className="flex shrink-0 items-center gap-1 pt-0.5">
                          <span className="text-sm font-semibold tabular-nums text-black/70">
                            {amount}
                          </span>
                          <ChevronRight
                            className={cn(
                              "size-4 shrink-0 transition-all",
                              selected
                                ? "text-[#08090a]"
                                : "text-black/25 group-hover:translate-x-0.5 group-hover:text-black/55",
                            )}
                            aria-hidden
                          />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {onGoToRecoveries ? (
            <button
              type="button"
              onClick={() =>
                onGoToRecoveries(peopleScope === "all" ? "all" : peopleScope)
              }
              className="dg-link-arrow-host mt-4 inline-flex shrink-0 cursor-pointer items-center gap-1 text-xs font-semibold text-[#08090a] underline-offset-2 hover:underline"
            >
              Manage in Recoveries
              <ArrowRight className="dg-link-arrow size-3.5" />
            </button>
          ) : null}
          </Panel>
        </div>

        {/* ── Email preview for the focused step / person ── */}
        <div
          data-enter
          className={cn(
            "min-h-0 min-w-0 flex-col overflow-y-auto",
            mobilePane === "preview" ? "flex" : "hidden lg:flex",
          )}
        >
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8a8f98]">
                {previewSample.fromCase
                  ? "Preview for this person"
                  : "Live preview"}
              </p>
              <h3 className="font-display mt-1 flex flex-wrap items-center gap-2 text-xl tracking-tight text-[#08090a]">
                Email {step.number}
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TONE_BADGE[step.tone]}`}
                >
                  {step.tone}
                </span>
              </h3>
            </div>
            <p className="text-right text-[12px] leading-tight text-[#6b6f76]">
              {step.whenLabel}
            </p>
          </div>
          <div className="mx-auto w-full max-w-[512px]">
            <div className="dg-keep-light overflow-hidden rounded-md border border-black/8 bg-white">
              <div className="border-b border-black/6 bg-[#fafafa] px-5 py-3">
                <p className="truncate text-[10px] font-medium uppercase tracking-[0.08em] text-black/40">
                  From
                </p>
                <p className="truncate text-[12px] font-medium text-black/70">
                  {storeName}
                  {showDeclineGuardBadge ? " · DeclineGuard" : ""}
                </p>
                <p className="mt-2 truncate text-[10px] font-medium uppercase tracking-[0.08em] text-black/40">
                  Subject
                </p>
                <p className="mt-0.5 truncate text-[13px] font-semibold text-black">
                  {previewSubject}
                </p>
              </div>
              <EmailPreviewBody
                content={{
                  headline: previewHeadline,
                  body: previewBody,
                  cta: stepCopy.cta,
                }}
                blocks={stepCopy.blocks}
                linkColor={linkColor?.trim() || stepCopy.linkColor}
                emailPadding={stepCopy.emailPadding}
                storeName={storeName}
                storeLogoUrl={storeLogoUrl}
                primary={brandColor}
                secondary={secondaryColor}
                emailFont={normalizeEmailFont(emailFont)}
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
                customerFirstName={previewSample.customer}
                previewVars={{
                  product: previewSample.product,
                  amount: previewSample.amount,
                  firstName: previewSample.customer,
                }}
                className="px-6 py-8 md:px-8"
              />
            </div>
          </div>
          <p className="mt-3 text-[11px] text-[#8a8f98]">
            {previewSample.fromCase
              ? `Personalized with ${previewSample.customer}’s case. Card-fix links live in Recoveries.`
              : "Sample personalization. Card-fix links and people live in Recoveries."}
          </p>
        </div>
      </div>

      {previewOpen ? (
        <PreviewSequenceExperience
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          onContactSupport={onContactSupport}
        />
      ) : null}
    </div>
  );
}

/** Static CRT-warp halo behind a funnel box — mirrors Overview’s ScoreStat glow. */
function HaloCrt({ color }: { color: string }) {
  return (
    <CRTWarp
      className="h-full w-full"
      color={color}
      backgroundColor={color}
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
  );
}

/**
 * A funnel tab that sits flush on top of the people panel: rounded top only,
 * a CRT-warp halo rim, and a bottom inner-shadow when unselected (the selected
 * box is flat so it reads as connected to the panel below).
 */
function FunnelBox({
  active,
  crt,
  onClick,
  children,
}: {
  active: boolean;
  crt: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="dg-interactive group relative min-w-0 cursor-pointer text-left sm:w-[14rem] sm:max-w-[14rem] sm:flex-none"
    >
      {/* CRT glow: hidden while unselected, slides out from the top on hover,
          and stays put once selected. The container keeps a FIXED size so the
          WebGL canvas never resizes mid-animation — we only animate transform +
          opacity (compositor-only) to avoid flicker/stutter. */}
      <span
        className={cn(
          "pointer-events-none absolute inset-x-0 -top-[0.5rem] bottom-2 overflow-hidden rounded-t-[13px] transition-[opacity,transform] duration-300 ease-out will-change-[transform,opacity]",
          active
            ? "translate-y-0 opacity-70"
            : "translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-60",
        )}
        aria-hidden
      >
        <HaloCrt color={crt} />
      </span>
      <span
        className={cn(
          "relative z-10 block h-full rounded-t-[13px] border border-b-0 border-black/8 bg-white px-4 py-4 transition-shadow duration-300",
          active ? "" : FUNNEL_INNER_SHADOW,
        )}
      >
        {children}
      </span>
    </button>
  );
}

/**
 * Dotted connector that docks onto the box on its left and points an arrow at
 * the box on its right — the visual “flows into the next email” link. Only
 * shown once the funnel is a horizontal row (sm+).
 */
function FunnelConnector() {
  return (
    <div
      className="relative z-20 hidden min-w-5 flex-1 items-center self-center sm:flex"
      aria-hidden
    >
      <span className="h-0 flex-1 border-t-2 border-dotted border-black/25" />
      <ArrowRight
        className="-ml-1 size-4 shrink-0 text-black/35"
        strokeWidth={2.5}
      />
    </div>
  );
}

function PersonBadge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "warn" | "danger" | "neutral";
}) {
  const cls =
    tone === "warn"
      ? "bg-amber-50 text-amber-900"
      : tone === "danger"
        ? "bg-rose-50 text-rose-800"
        : "bg-black/5 text-black/55";
  return (
    <span
      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}
    >
      {children}
    </span>
  );
}
