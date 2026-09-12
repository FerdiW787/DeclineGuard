import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "convex/react";
import gsap from "gsap";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/** Must match convex/functions/previewSequence.ts */
const PREVIEW_GAP_MS = 30_000;
/** Hold the setup spinner at least this long before success/fail. */
const SETUP_MIN_MS = 3_000;

const RING_R = 18;
const RING_C = 2 * Math.PI * RING_R;
const SPIN_DASH = RING_C * 0.28;
const CHECK_LEN = 36;

type SetupPhase = "setup" | "success" | "ready" | "failed";

type Props = {
  open: boolean;
  onClose: () => void;
  /** After preview slides away — open support with a report draft. */
  onContactSupport?: () => void;
};

const INBOX_TOAST_MS = 5_000;

type InboxToastKind = "email1" | "email2" | "email3" | "done";

type InboxToast = {
  id: string;
  kind: InboxToastKind;
};

function inboxToastCopy(kind: InboxToastKind): {
  title: string;
  body?: string;
} {
  switch (kind) {
    case "email1":
      return {
        title: "Check your inbox",
        body: "Email 1 should be there.",
      };
    case "email2":
      return {
        title: "Check your inbox",
        body: "Email 2 should be there.",
      };
    case "email3":
      return {
        title: "Check your inbox",
        body: "Email 3 should be there.",
      };
    case "done":
      return {
        title: "Preview is done",
        body: "You should have received all emails. If not, or you experienced any problems or mistakes, please contact our support.",
      };
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function PreviewInboxToast({
  toast,
  onDismiss,
  onContactSupport,
}: {
  toast: InboxToast;
  onDismiss: () => void;
  onContactSupport?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const copy = inboxToastCopy(toast.kind);
  const sticky = toast.kind === "done";

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const dismiss = () => onDismissRef.current();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;

    gsap.killTweensOf(el);
    if (barRef.current) gsap.killTweensOf(barRef.current);

    if (reduced) {
      gsap.set(el, { x: 0, opacity: 1 });
      if (!sticky) {
        const t = window.setTimeout(dismiss, INBOX_TOAST_MS);
        return () => window.clearTimeout(t);
      }
      return;
    }

    gsap.fromTo(
      el,
      { x: -36, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.42, ease: "power3.out" },
    );

    if (sticky) return;

    if (barRef.current) {
      gsap.fromTo(
        barRef.current,
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: INBOX_TOAST_MS / 1000,
          ease: "none",
          transformOrigin: "left center",
        },
      );
    }

    const t = window.setTimeout(() => {
      gsap.to(el, {
        x: -40,
        opacity: 0,
        duration: 0.38,
        ease: "power3.in",
        onComplete: dismiss,
      });
    }, INBOX_TOAST_MS);

    return () => {
      window.clearTimeout(t);
      gsap.killTweensOf(el);
      if (barRef.current) gsap.killTweensOf(barRef.current);
    };
  }, [toast.id, sticky]);

  return (
    <div
      ref={rootRef}
      className="pointer-events-auto w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
      role="status"
    >
      <div className="px-4 pt-3.5 pb-3">
        <p className="text-sm font-semibold tracking-tight text-black">
          {copy.title}
        </p>
        {copy.body ? (
          <p className="mt-1 text-[13px] leading-snug text-black/55">
            {copy.body}
          </p>
        ) : null}
        {sticky && onContactSupport ? (
          <button
            type="button"
            onClick={onContactSupport}
            className="dg-btn dg-btn-primary mt-3 cursor-pointer !px-3.5 !py-2 text-xs"
          >
            Contact Support
          </button>
        ) : null}
      </div>
      {!sticky ? (
        <div className="h-0.5 w-full bg-black/6">
          <div
            ref={barRef}
            className="h-full w-full origin-left bg-black/70"
            style={{ transform: "scaleX(0)" }}
          />
        </div>
      ) : null}
    </div>
  );
}

type FlowCard = {
  id: string;
  number: string | number;
  variant?: "trigger" | "default";
  eyebrow: string;
  title: string;
  detail: string;
};

const FLOW_CARDS: FlowCard[] = [
  {
    id: "trigger",
    number: "!",
    variant: "trigger",
    eyebrow: "Starts when",
    title: "Payment fails / renewal declines",
    detail: "Lemon Squeezy webhook — Email 1 sends after 2nd attempt.",
  },
  {
    id: "email1",
    number: 1,
    eyebrow: "Day 0 · Gentle",
    title: "Email 1",
    detail: "Sent after 2nd failed attempt with your branding.",
  },
  {
    id: "email2",
    number: 2,
    eyebrow: "Day 2 · Direct",
    title: "Email 2",
    detail: "Follow-up after 30 seconds in preview.",
  },
  {
    id: "email3",
    number: 3,
    eyebrow: "Day 5 · Urgent",
    title: "Email 3",
    detail: "Final notice after another 30 seconds.",
  },
  {
    id: "stop",
    number: "✓",
    eyebrow: "Sequence stops",
    title: "No more automatic emails",
    detail: "Preview complete — check your inbox.",
  },
];

function fusedStepPath(width: number, height: number): string {
  const nl = 2;
  const num = 40;
  const rn = 11;
  const rc = 16;
  const cl = nl + num;
  const i = 1;
  const w = width;
  const h = height;

  return [
    `M ${nl + rn} ${i}`,
    `H ${w - rc - i}`,
    `A ${rc} ${rc} 0 0 1 ${w - i} ${rc + i}`,
    `V ${h - rc - i}`,
    `A ${rc} ${rc} 0 0 1 ${w - rc - i} ${h - i}`,
    `H ${cl + rc}`,
    `A ${rc} ${rc} 0 0 1 ${cl + i} ${h - rc - i}`,
    `V ${num}`,
    `H ${nl + rn}`,
    `A ${rn} ${rn} 0 0 1 ${nl + i} ${num - rn}`,
    `V ${rn + i}`,
    `A ${rn} ${rn} 0 0 1 ${nl + rn} ${i}`,
    "Z",
  ].join(" ");
}

function FlowStepCard({
  number,
  variant = "default",
  children,
  onNode,
  onCard,
}: {
  number: string | number;
  variant?: "trigger" | "default";
  children: ReactNode;
  onNode?: (el: HTMLSpanElement | null) => void;
  onCard?: (el: HTMLDivElement | null) => void;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const localRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = localRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const strokeClass =
    variant === "trigger" ? "text-black/30" : "text-black/18";

  return (
    <div
      ref={(el) => {
        localRef.current = el;
        onCard?.(el);
      }}
      className="relative flex w-full items-start opacity-0"
      data-flow-card
    >
      {size.w > 0 && size.h > 0 ? (
        <svg
          className={`pointer-events-none absolute inset-0 ${strokeClass}`}
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          fill="none"
          aria-hidden
        >
          <path
            d={fusedStepPath(size.w, size.h)}
            className="fill-white"
            stroke="currentColor"
            strokeWidth="2"
            vectorEffect="nonScalingStroke"
          />
        </svg>
      ) : null}
      <div className="relative z-10 flex w-full items-start">
        <div className="flex w-11 shrink-0 justify-center">
          <span
            ref={onNode}
            className="flex size-10 shrink-0 items-center justify-center text-sm font-bold tabular-nums text-black"
          >
            {number}
          </span>
        </div>
        <div className="relative -ml-0.5 min-w-0 flex-1 py-3.5 pr-4 pl-5">
          {variant === "trigger" ? (
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-l from-black/[0.04] to-transparent"
              aria-hidden
            />
          ) : null}
          <div className="relative z-10">{children}</div>
        </div>
      </div>
    </div>
  );
}

function BootGlyph({ phase }: { phase: SetupPhase }) {
  const spinWrapRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const checkRef = useRef<SVGPathElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const spinTweenRef = useRef<gsap.core.Tween | null>(null);

  useLayoutEffect(() => {
    const el = spinWrapRef.current;
    if (!el || phase !== "setup") return;
    spinTweenRef.current?.kill();
    gsap.set(el, { rotation: 0, transformOrigin: "50% 50%" });
    spinTweenRef.current = gsap.to(el, {
      rotation: 360,
      duration: 0.9,
      ease: "none",
      repeat: -1,
    });
    return () => {
      spinTweenRef.current?.kill();
      spinTweenRef.current = null;
    };
  }, [phase]);

  useLayoutEffect(() => {
    if (phase === "failed") {
      spinTweenRef.current?.kill();
      spinTweenRef.current = null;
      const wrap = spinWrapRef.current;
      const ring = ringRef.current;
      const check = checkRef.current;
      if (wrap) gsap.set(wrap, { rotation: 0 });
      if (ring) {
        gsap.set(ring, {
          attr: { "stroke-dasharray": `${SPIN_DASH} ${RING_C - SPIN_DASH}` },
          opacity: 0.35,
        });
      }
      if (check) gsap.set(check, { opacity: 0 });
      return;
    }

    if (phase !== "success" && phase !== "ready") return;
    const wrap = spinWrapRef.current;
    const ring = ringRef.current;
    const check = checkRef.current;
    const icon = iconRef.current;
    if (!wrap || !ring || !check || !icon) return;

    if (phase === "ready") {
      gsap.set(wrap, { rotation: 0 });
      gsap.set(ring, { attr: { "stroke-dasharray": `${RING_C} 0` }, opacity: 1 });
      gsap.set(check, { strokeDashoffset: 0, opacity: 1 });
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    spinTweenRef.current?.kill();
    spinTweenRef.current = null;

    if (reduced) {
      gsap.set(wrap, { rotation: 0 });
      gsap.set(ring, { attr: { "stroke-dasharray": `${RING_C} 0` }, opacity: 1 });
      gsap.set(check, { strokeDashoffset: 0, opacity: 1 });
      return;
    }

    const currentRot = Number(gsap.getProperty(wrap, "rotation")) || 0;
    const tl = gsap.timeline();
    tl.fromTo(
      wrap,
      { rotation: currentRot },
      { rotation: currentRot + 120, duration: 0.5, ease: "power3.out" },
    );
    tl.to(
      ring,
      {
        attr: { "stroke-dasharray": `${RING_C} 0` },
        opacity: 1,
        duration: 0.52,
        ease: "power2.inOut",
      },
      "-=0.38",
    );
    tl.fromTo(
      check,
      { strokeDashoffset: CHECK_LEN, opacity: 0 },
      {
        strokeDashoffset: 0,
        opacity: 1,
        duration: 0.45,
        ease: "power2.out",
      },
      "-=0.18",
    );
    tl.fromTo(
      icon,
      { scale: 1 },
      {
        scale: 1.05,
        duration: 0.24,
        ease: "power2.out",
        yoyo: true,
        repeat: 1,
      },
      "-=0.3",
    );
    return () => {
      tl.kill();
    };
  }, [phase]);

  return (
    <div
      ref={iconRef}
      className="relative h-12 w-12 will-change-transform"
      role="status"
      aria-live="polite"
    >
      <div
        ref={spinWrapRef}
        className="absolute inset-0 flex items-center justify-center"
      >
        <svg viewBox="0 0 48 48" className="h-11 w-11" aria-hidden>
          <circle
            ref={ringRef}
            cx="24"
            cy="24"
            r={RING_R}
            fill="none"
            stroke="#0c0c0c"
            strokeWidth="3.25"
            strokeLinecap="round"
            strokeDasharray={`${SPIN_DASH} ${RING_C - SPIN_DASH}`}
          />
        </svg>
      </div>
      <svg
        viewBox="0 0 48 48"
        className="pointer-events-none absolute inset-0 m-auto h-11 w-11"
        aria-hidden
      >
        <path
          ref={checkRef}
          d="M14.5 24.5 L21 31 L33.5 17.5"
          fill="none"
          stroke="#0c0c0c"
          strokeWidth="3.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={CHECK_LEN}
          strokeDashoffset={CHECK_LEN}
          opacity={0}
        />
      </svg>
      <span className="sr-only">
        {phase === "setup"
          ? "Setting up"
          : phase === "failed"
            ? "Failed"
            : "Ready"}
      </span>
    </div>
  );
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${s}s`;
}

/**
 * Full-screen preview sequence theater: slide up → setup morph → flow reveal
 * synced to the real 30s email drip.
 */
export default function PreviewSequenceExperience({
  open,
  onClose,
  onContactSupport,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLParagraphElement>(null);
  const glyphWrapRef = useRef<HTMLDivElement>(null);
  const spineHostRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const cardEls = useRef<Array<HTMLDivElement | null>>([]);
  const movedRef = useRef(false);

  const [setupPhase, setSetupPhase] = useState<SetupPhase>("setup");
  const [titleAtTop, setTitleAtTop] = useState(false);
  const [flowActive, setFlowActive] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<Id<"previewSequences"> | null>(
    null,
  );
  const [now, setNow] = useState(() => Date.now());
  const [spine, setSpine] = useState<{ top: number; height: number } | null>(
    null,
  );
  const [fillHeight, setFillHeight] = useState(0);
  const [countdown, setCountdown] = useState<{
    ms: number;
    top: number;
  } | null>(null);
  const [shownLabel, setShownLabel] = useState("Setting Up Preview Sequence");
  const [toastQueue, setToastQueue] = useState<InboxToast[]>([]);
  const [activeToast, setActiveToast] = useState<InboxToast | null>(null);
  const toastedKindsRef = useRef<Set<InboxToastKind>>(new Set());

  const startPreview = useMutation(api.functions.previewSequence.start);
  const cancelPreview = useMutation(api.functions.previewSequence.cancel);
  const preview = useQuery(api.functions.previewSequence.getLatest);
  const startedRef = useRef(false);
  const email1ShownAtRef = useRef<number | null>(null);
  const setupStartedAtRef = useRef(0);
  const setupDecisionTimerRef = useRef<number | null>(null);
  const pendingDecisionRef = useRef<"success" | "failed" | null>(null);
  const setupPhaseRef = useRef(setupPhase);
  setupPhaseRef.current = setupPhase;
  const emailLineRef = useRef<HTMLParagraphElement>(null);
  const errorLineRef = useRef<HTMLParagraphElement>(null);
  const exitBtnRef = useRef<HTMLButtonElement>(null);
  const labelAnimLock = useRef(false);

  function clearSetupDecisionTimer() {
    if (setupDecisionTimerRef.current != null) {
      window.clearTimeout(setupDecisionTimerRef.current);
      setupDecisionTimerRef.current = null;
    }
  }

  function scheduleSetupDecision(
    next: "success" | "failed",
    message?: string,
  ) {
    if (setupPhaseRef.current !== "setup") return;
    // Failed wins over a pending success.
    if (pendingDecisionRef.current === "failed" && next === "success") return;
    if (pendingDecisionRef.current === next && next === "success") return;

    pendingDecisionRef.current = next;
    if (next === "failed") {
      setError(message ?? "Something went wrong.");
    } else if (message) {
      setError(message);
    }

    clearSetupDecisionTimer();
    const elapsed = Date.now() - setupStartedAtRef.current;
    const wait = Math.max(0, SETUP_MIN_MS - elapsed);
    setupDecisionTimerRef.current = window.setTimeout(() => {
      setupDecisionTimerRef.current = null;
      setSetupPhase(next === "failed" ? "failed" : "success");
    }, wait);
  }

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || !open) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    gsap.killTweensOf(panel);
    if (reduced) {
      gsap.set(panel, { y: 0 });
      return;
    }
    gsap.set(panel, { y: "100%" });
    const tween = gsap.to(panel, {
      y: 0,
      duration: 0.55,
      ease: "power3.out",
    });
    return () => {
      tween.kill();
    };
  }, [open]);

  // Center the hero before/during setup (vertical only — horizontal is flex)
  useLayoutEffect(() => {
    if (!open || titleAtTop || movedRef.current) return;
    const hero = heroRef.current;
    if (!hero) return;
    gsap.set(hero, {
      top: "50%",
      yPercent: -50,
      x: 0,
      xPercent: 0,
    });
  }, [open, titleAtTop]);

  useEffect(() => {
    if (!open || startedRef.current) return;
    startedRef.current = true;
    movedRef.current = false;
    pendingDecisionRef.current = null;
    clearSetupDecisionTimer();
    setupStartedAtRef.current = Date.now();
    labelAnimLock.current = false;
    setShownLabel("Setting Up Preview Sequence");
    setSetupPhase("setup");
    setTitleAtTop(false);
    setFlowActive(false);
    setVisibleCount(0);
    setError(null);

    void (async () => {
      try {
        const id = await startPreview({});
        setPreviewId(id);
        // Stay on setup until Email 1 sends (or fails), min ~3s.
      } catch (err) {
        scheduleSetupDecision(
          "failed",
          err instanceof Error ? err.message : "Could not start preview.",
        );
      }
    })();
  }, [open, startPreview]);

  // During setup: wait for first email, or surface send failure (after min 3s).
  useEffect(() => {
    if (!open || setupPhase !== "setup" || !previewId) return;
    if (!preview || preview._id !== previewId) return;

    if (preview.status === "failed") {
      scheduleSetupDecision(
        "failed",
        preview.lastError ?? "Email send failed.",
      );
      return;
    }
    if (preview.status === "cancelled") {
      scheduleSetupDecision("failed", "Preview was cancelled.");
      return;
    }
    if (preview.step1SentAt != null) {
      scheduleSetupDecision("success");
    }
  }, [open, setupPhase, previewId, preview]);

  useEffect(() => {
    if (setupPhase !== "success") return;
    const t = window.setTimeout(() => setSetupPhase("ready"), 1400);
    return () => window.clearTimeout(t);
  }, [setupPhase]);

  // If a later email fails after we already started the flow, keep showing error.
  useEffect(() => {
    if (!open || !preview || preview._id !== previewId) return;
    if (preview.status !== "failed" || !preview.lastError) return;
    if (setupPhase === "failed") return;
    setError(preview.lastError);
    if (setupPhase === "setup") {
      scheduleSetupDecision("failed", preview.lastError);
      return;
    }
    if (setupPhase === "success") {
      setSetupPhase("failed");
      setFlowActive(false);
    }
  }, [open, preview, previewId, setupPhase]);

  useLayoutEffect(() => {
    if (setupPhase !== "ready" || movedRef.current) return;
    const glyph = glyphWrapRef.current;
    const hero = heroRef.current;
    if (!hero) return;
    movedRef.current = true;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;

    if (reduced) {
      setTitleAtTop(true);
      window.setTimeout(() => setFlowActive(true), 180);
      return;
    }

    const tl = gsap.timeline({
      onComplete: () => {
        // Snap to whole pixels / drop transforms so type stays crisp.
        gsap.set(hero, { clearProps: "transform" });
        hero.style.top = "36px";
        hero.style.transform = "none";
        if (glyph) gsap.set(glyph, { display: "none", height: 0 });
        setTitleAtTop(true);
        // Let the title settle before cards appear so they don't shove it up.
        window.setTimeout(() => setFlowActive(true), 220);
      },
    });

    gsap.set(hero, {
      top: "50%",
      yPercent: -50,
      x: 0,
      xPercent: 0,
      force3D: true,
    });

    // Fade the glyph first (absolute, so title doesn't jump), then fly title up.
    // Keep type size constant — animating fontSize causes blur.
    tl.to({}, { duration: 0.25 });
    if (glyph) {
      tl.to(glyph, {
        opacity: 0,
        scale: 0.85,
        duration: 0.28,
        ease: "power2.in",
      });
      tl.set(glyph, { display: "none", height: 0, marginBottom: 0 });
    }
    tl.to(hero, {
      top: 36,
      yPercent: 0,
      x: 0,
      xPercent: 0,
      duration: 0.75,
      ease: "power3.inOut",
      force3D: true,
    });

    return () => {
      tl.kill();
    };
  }, [setupPhase]);

  useEffect(() => {
    if (!flowActive) return;
    setVisibleCount(1);
    const t1 = window.setTimeout(() => {
      email1ShownAtRef.current = Date.now();
      setVisibleCount(2);
    }, 560);
    return () => window.clearTimeout(t1);
  }, [flowActive]);

  useEffect(() => {
    if (!flowActive || !preview) return;
    if (preview.step2SentAt != null) {
      setVisibleCount((c) => Math.max(c, 3));
    }
    if (preview.step3SentAt != null) {
      setVisibleCount((c) => Math.max(c, 4));
      const t = window.setTimeout(() => setVisibleCount(5), 520);
      return () => window.clearTimeout(t);
    }
    if (preview.status === "completed") {
      setVisibleCount(5);
    }
    if (preview.status === "failed" && preview.lastError) {
      setError(preview.lastError);
    }
  }, [flowActive, preview]);

  useLayoutEffect(() => {
    if (!flowActive || visibleCount === 0) return;
    const idx = visibleCount - 1;
    const card = cardEls.current[idx];
    if (!card) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    if (reduced) {
      gsap.set(card, { opacity: 1, y: 0 });
      return;
    }
    gsap.fromTo(
      card,
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.55, ease: "power3.out" },
    );
  }, [flowActive, visibleCount]);

  useEffect(() => {
    if (!flowActive) return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [flowActive]);

  useLayoutEffect(() => {
    if (!flowActive) return;
    const host = spineHostRef.current;
    if (!host) return;

    const measure = () => {
      const first = nodeRefs.current[0];
      const lastVisible = nodeRefs.current[Math.max(0, visibleCount - 1)];
      if (!first || !lastVisible) return;

      const hostRect = host.getBoundingClientRect();
      const firstRect = first.getBoundingClientRect();
      const lastRect = lastVisible.getBoundingClientRect();
      const top = firstRect.top + firstRect.height / 2 - hostRect.top;
      const end = lastRect.top + lastRect.height / 2 - hostRect.top;

      const nextNode = nodeRefs.current[visibleCount];
      const trackBottom = nextNode
        ? nextNode.getBoundingClientRect().top +
          nextNode.getBoundingClientRect().height / 2 -
          hostRect.top
        : end;

      setSpine({
        top,
        height: Math.max(0, Math.max(end, trackBottom) - top),
      });

      let fill = Math.max(0, end - top);
      let cd: { ms: number; top: number } | null = null;

      if (
        visibleCount >= 2 &&
        preview?.step2SentAt == null &&
        nodeRefs.current[1] &&
        nodeRefs.current[2]
      ) {
        const a = nodeRefs.current[1].getBoundingClientRect();
        const b = nodeRefs.current[2].getBoundingClientRect();
        const aMid = a.top + a.height / 2 - hostRect.top;
        const bMid = b.top + b.height / 2 - hostRect.top;
        const startAt =
          preview?.step1SentAt ?? email1ShownAtRef.current ?? now;
        const elapsed = now - startAt;
        const p = Math.min(1, Math.max(0, elapsed / PREVIEW_GAP_MS));
        fill = aMid - top + (bMid - aMid) * p;
        cd = {
          ms: Math.max(0, PREVIEW_GAP_MS - elapsed),
          top: aMid + (bMid - aMid) * 0.5,
        };
      }

      if (
        visibleCount >= 3 &&
        preview?.step2SentAt != null &&
        preview.step3SentAt == null &&
        nodeRefs.current[2] &&
        nodeRefs.current[3]
      ) {
        const a = nodeRefs.current[2].getBoundingClientRect();
        const b = nodeRefs.current[3].getBoundingClientRect();
        const aMid = a.top + a.height / 2 - hostRect.top;
        const bMid = b.top + b.height / 2 - hostRect.top;
        const elapsed = now - preview.step2SentAt;
        const p = Math.min(1, Math.max(0, elapsed / PREVIEW_GAP_MS));
        fill = aMid - top + (bMid - aMid) * p;
        cd = {
          ms: Math.max(0, PREVIEW_GAP_MS - elapsed),
          top: aMid + (bMid - aMid) * 0.5,
        };
      }

      setFillHeight(fill);
      setCountdown(cd);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, [flowActive, visibleCount, preview, now]);

  useEffect(() => {
    if (open) return;
    startedRef.current = false;
    movedRef.current = false;
    email1ShownAtRef.current = null;
    pendingDecisionRef.current = null;
    clearSetupDecisionTimer();
    labelAnimLock.current = false;
    toastedKindsRef.current = new Set();
    setShownLabel("Setting Up Preview Sequence");
    setSetupPhase("setup");
    setTitleAtTop(false);
    setFlowActive(false);
    setVisibleCount(0);
    setPreviewId(null);
    setError(null);
    setCountdown(null);
    setToastQueue([]);
    setActiveToast(null);
  }, [open]);

  function enqueueInboxToast(kind: InboxToastKind) {
    if (toastedKindsRef.current.has(kind)) return;
    toastedKindsRef.current.add(kind);
    setToastQueue((q) => [...q, { id: `${kind}-${Date.now()}`, kind }]);
  }

  // Inbox toasts: Email 1/2/3 when each send lands, then a sticky done toast.
  useEffect(() => {
    if (!open || !flowActive || !preview || preview._id !== previewId) return;
    if (preview.step1SentAt != null) enqueueInboxToast("email1");
    if (preview.step2SentAt != null) enqueueInboxToast("email2");
    if (preview.step3SentAt != null) enqueueInboxToast("email3");
    if (preview.status === "completed") enqueueInboxToast("done");
  }, [
    open,
    flowActive,
    previewId,
    preview?.step1SentAt,
    preview?.step2SentAt,
    preview?.step3SentAt,
    preview?.status,
    preview?._id,
  ]);

  useEffect(() => {
    if (activeToast || toastQueue.length === 0) return;
    setActiveToast(toastQueue[0] ?? null);
    setToastQueue((q) => q.slice(1));
  }, [activeToast, toastQueue]);

  async function handleClose(afterClose?: () => void) {
    const panel = panelRef.current;
    if (previewId && preview?.status === "running") {
      try {
        await cancelPreview({ previewId });
      } catch {
        // Still close UI
      }
    }
    if (panel) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches;
      if (!reduced) {
        await new Promise<void>((resolve) => {
          gsap.killTweensOf(panel);
          gsap.to(panel, {
            y: "100%",
            duration: 0.45,
            ease: "power3.in",
            onComplete: () => resolve(),
          });
        });
      }
    }
    onClose();
    afterClose?.();
  }

  function handleContactSupportFromToast() {
    void handleClose(() => onContactSupport?.());
  }

  const label =
    setupPhase === "setup"
      ? "Setting Up Preview Sequence"
      : setupPhase === "failed"
        ? "Something Went Wrong..."
        : "Preview Ready";

  const done =
    preview?.status === "completed" ||
    preview?.status === "cancelled" ||
    visibleCount >= 5;

  const showEmailLine =
    Boolean(preview?.toEmail) &&
    setupPhase !== "setup" &&
    setupPhase !== "failed";

  // Smooth title copy changes (never hard-swap).
  useEffect(() => {
    if (label === shownLabel || labelAnimLock.current) return;
    const el = titleRef.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    if (!el || reduced) {
      setShownLabel(label);
      return;
    }
    labelAnimLock.current = true;
    gsap.to(el, {
      opacity: 0,
      y: -6,
      duration: 0.22,
      ease: "power2.in",
      onComplete: () => {
        setShownLabel(label);
        gsap.fromTo(
          el,
          { opacity: 0, y: 8 },
          {
            opacity: 1,
            y: 0,
            duration: 0.34,
            ease: "power2.out",
            onComplete: () => {
              labelAnimLock.current = false;
            },
          },
        );
      },
    });
  }, [label, shownLabel]);

  // Fade in “Sending to…” when it appears.
  useLayoutEffect(() => {
    if (!showEmailLine) return;
    const el = emailLineRef.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    if (reduced) {
      gsap.set(el, { opacity: 1, y: 0 });
      return;
    }
    gsap.fromTo(
      el,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" },
    );
  }, [showEmailLine]);

  // Fade in error + exit on failure.
  useLayoutEffect(() => {
    if (setupPhase !== "failed") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    const targets = [errorLineRef.current, exitBtnRef.current].filter(
      (n): n is HTMLParagraphElement | HTMLButtonElement => n != null,
    );
    if (targets.length === 0) return;
    if (reduced) {
      gsap.set(targets, { opacity: 1, y: 0 });
      return;
    }
    gsap.fromTo(
      targets,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, ease: "power2.out" },
    );
  }, [setupPhase, error]);

  const exitDoneBtnRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!done || error) return;
    const el = exitDoneBtnRef.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    if (reduced) {
      gsap.set(el, { opacity: 1, y: 0 });
      return;
    }
    gsap.fromTo(
      el,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
    );
  }, [done, error]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Preview sequence"
    >
      <div ref={panelRef} className="absolute inset-0 flex flex-col bg-white">
        <div
          ref={heroRef}
          className={`absolute inset-x-0 z-20 flex justify-center ${
            titleAtTop ? "pointer-events-none" : "will-change-transform"
          }`}
        >
          <div className="relative flex flex-col items-center gap-3 px-6">
          <div
            ref={glyphWrapRef}
            className={
              titleAtTop
                ? "pointer-events-none absolute opacity-0"
                : "relative mb-2"
            }
          >
            <BootGlyph
              phase={
                setupPhase === "ready"
                  ? "success"
                  : setupPhase === "failed"
                    ? "failed"
                    : setupPhase
              }
            />
          </div>
          <p
            ref={titleRef}
            className="font-display text-center text-3xl tracking-tight text-black [backface-visibility:hidden]"
          >
            {shownLabel}
          </p>
          {error && setupPhase === "failed" ? (
            <p
              ref={errorLineRef}
              className="mt-1 max-w-md text-center text-sm leading-relaxed text-black/55"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          {showEmailLine ? (
            <p
              ref={emailLineRef}
              className="max-w-sm text-center text-xs text-black/45 [backface-visibility:hidden]"
            >
              Sending to {preview?.toEmail}
            </p>
          ) : null}
          {setupPhase === "failed" ? (
            <button
              ref={exitBtnRef}
              type="button"
              onClick={() => void handleClose()}
              className="dg-btn dg-btn-primary mt-4 cursor-pointer !px-5 !py-2.5 text-sm"
            >
              Exit Preview
            </button>
          ) : null}
          </div>
        </div>

        {flowActive ? (
          <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col px-5 pt-24 pb-10 sm:pt-28">
            <div
              ref={spineHostRef}
              className="relative mx-auto flex w-full flex-1 flex-col justify-between gap-3"
            >
              {spine && fillHeight > 0 ? (
                <div
                  className="pointer-events-none absolute left-[21px] w-0.5 overflow-hidden rounded-full bg-black"
                  style={{ top: spine.top, height: fillHeight }}
                  aria-hidden
                >
                  {countdown ? (
                    <div
                      className="absolute inset-x-0 h-16 animate-[previewFlow_1.1s_linear_infinite] bg-gradient-to-b from-transparent via-white/55 to-transparent"
                      aria-hidden
                    />
                  ) : null}
                </div>
              ) : null}

              {countdown ? (
                <div
                  className="pointer-events-none absolute right-0 z-20 -translate-y-1/2 text-right"
                  style={{ top: countdown.top }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                    Next in
                  </p>
                  <p className="font-display text-2xl tabular-nums tracking-tight text-black">
                    {formatCountdown(countdown.ms)}
                  </p>
                </div>
              ) : null}

              {FLOW_CARDS.map((card, i) => {
                const show = i < visibleCount;
                return (
                  <div
                    key={card.id}
                    className={`relative ${show ? "" : "h-[4.75rem]"}`}
                  >
                    {show ? (
                      <FlowStepCard
                        number={card.number}
                        variant={card.variant}
                        onNode={(el) => {
                          nodeRefs.current[i] = el;
                        }}
                        onCard={(el) => {
                          cardEls.current[i] = el;
                        }}
                      >
                        <p
                          className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${
                            card.variant === "trigger"
                              ? "text-black/45"
                              : "text-black/40"
                          }`}
                        >
                          {card.eyebrow}
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {card.title}
                        </p>
                        <p className="mt-0.5 text-[12px] text-black/50">
                          {card.detail}
                        </p>
                      </FlowStepCard>
                    ) : (
                      <div className="flex items-start" aria-hidden>
                        <div className="flex w-11 justify-center pt-0.5">
                          <span
                            ref={(el) => {
                              nodeRefs.current[i] = el;
                            }}
                            className="size-10"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {done && !error ? (
              <div className="mt-8 flex justify-center">
                <button
                  ref={exitDoneBtnRef}
                  type="button"
                  onClick={() => void handleClose()}
                  className="dg-btn dg-btn-primary cursor-pointer !px-5 !py-2.5 text-sm"
                >
                  Exit Preview
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeToast ? (
          <div className="pointer-events-none absolute bottom-6 left-4 z-30 sm:bottom-8 sm:left-6">
            <PreviewInboxToast
              toast={activeToast}
              onDismiss={() => setActiveToast(null)}
              onContactSupport={
                onContactSupport
                  ? () => handleContactSupportFromToast()
                  : undefined
              }
            />
          </div>
        ) : null}
      </div>

      <style>{`
        @keyframes previewFlow {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(220%); }
        }
      `}</style>
    </div>,
    document.body,
  );
}
