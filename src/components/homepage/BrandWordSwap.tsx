import { useRef, type ReactElement } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

const PILL_COLORS: Record<string, { bg: string; mark: string }> = {
  personality: { bg: "#dcfce7", mark: "#16a34a" },
  charisma: { bg: "#fce7f3", mark: "#db2777" },
  brand: { bg: "#e8f1fe", mark: "#2b7fff" },
};

type Props = {
  texts: readonly string[];
  playing?: boolean;
};

function colorsFor(text: string) {
  return PILL_COLORS[text.toLowerCase()] ?? PILL_COLORS.personality;
}

function markKey(text: string) {
  return text.toLowerCase();
}

function MarkStar() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="ln-word-pill__svg">
      <path d="M8 1.15 9.85 5.7l4.95.42-3.78 3.18 1.16 4.84L8 11.72l-4.18 2.42 1.16-4.84L1.2 6.12l4.95-.42Z" />
    </svg>
  );
}

function MarkSparkle() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="ln-word-pill__svg">
      <path d="M8 .55 9.55 6.45 15.45 8 9.55 9.55 8 15.45 6.45 9.55.55 8 6.45 6.45Z" />
    </svg>
  );
}

function MarkHex() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="ln-word-pill__svg">
      <path d="M8 1.15 13.7 4.4v7.2L8 14.85 2.3 11.6V4.4Z" />
    </svg>
  );
}

const MARK_BY_WORD: Record<string, () => ReactElement> = {
  personality: MarkStar,
  charisma: MarkSparkle,
  brand: MarkHex,
};

export function BrandWordSwap({ texts, playing = true }: Props) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const first = texts[0] ?? "";

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root || !playing) return;

      const pill = root.querySelector<HTMLElement>("[data-pill]");
      const mark = root.querySelector<HTMLElement>("[data-mark]");
      const items = Array.from(
        root.querySelectorAll<HTMLElement>("[data-word]"),
      );
      const marks = Array.from(
        root.querySelectorAll<HTMLElement>("[data-mark-shape]"),
      );
      if (!pill || !mark || items.length < 2) return;

      const markFor = (text: string) =>
        marks.find((el) => el.dataset.markShape === markKey(text));

      const pillWidth = (word: HTMLElement) => {
        const styles = getComputedStyle(pill);
        const padX =
          parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
        const gap = parseFloat(styles.columnGap || styles.gap) || 0;
        return (
          word.scrollWidth + mark.getBoundingClientRect().width + gap + padX
        );
      };

      const applyTheme = (text: string, width: number) => {
        const theme = colorsFor(text);
        gsap.set(pill, { width: width, backgroundColor: theme.bg });
        gsap.set(mark, { color: theme.mark });
        gsap.set(marks, { autoAlpha: 0, rotate: -18, scale: 0.72 });
        const active = markFor(text);
        if (active) gsap.set(active, { autoAlpha: 1, rotate: 0, scale: 1 });
      };

      gsap.set(items.slice(1), { yPercent: 0, autoAlpha: 0 });
      gsap.set(items[0], { autoAlpha: 1, yPercent: 0, visibility: "visible" });
      applyTheme(items[0].textContent ?? "", pillWidth(items[0]));

      const tl = gsap.timeline({
        repeat: -1,
        defaults: { ease: "power3.inOut", duration: 0.55 },
      });

      items.forEach((item, i) => {
        const next = items[(i + 1) % items.length];
        if (!next) return;
        const outgoing = markFor(item.textContent ?? "");
        const incoming = markFor(next.textContent ?? "");
        const theme = colorsFor(next.textContent ?? "");

        tl.to(item, { yPercent: -110, autoAlpha: 0 }, "+=3.7");
        tl.fromTo(
          next,
          { yPercent: 110, autoAlpha: 0 },
          { yPercent: 0, autoAlpha: 1, immediateRender: false },
          "<",
        );
        if (outgoing) {
          tl.to(
            outgoing,
            { autoAlpha: 0, rotate: 22, scale: 0.7, duration: 0.45 },
            "<",
          );
        }
        if (incoming) {
          tl.fromTo(
            incoming,
            { autoAlpha: 0, rotate: -22, scale: 0.7 },
            {
              autoAlpha: 1,
              rotate: 0,
              scale: 1,
              duration: 0.55,
              immediateRender: false,
            },
            "<0.08",
          );
        }
        tl.to(
          pill,
          {
            width: pillWidth(next),
            backgroundColor: theme.bg,
            duration: 0.7,
            ease: "power3.inOut",
          },
          "<",
        );
        tl.to(
          mark,
          { color: theme.mark, duration: 0.7, ease: "power3.inOut" },
          "<",
        );
      });
    },
    { scope: rootRef, dependencies: [playing], revertOnUpdate: true },
  );

  return (
    <span ref={rootRef} className="ln-word-swap">
      <span data-pill className="ln-word-pill">
        <span data-mark className="ln-word-pill__mark">
          {texts.map((text, i) => {
            const key = markKey(text);
            const Shape = MARK_BY_WORD[key] ?? MarkStar;
            return (
              <span
                key={key}
                data-mark-shape={key}
                className="ln-word-pill__shape"
                style={i === 0 ? undefined : { visibility: "hidden" }}
              >
                <Shape />
              </span>
            );
          })}
        </span>
        <span className="ln-word-swap__words">
          <span className="ln-word-swap__sizer" aria-hidden>
            {first}
          </span>
          {texts.map((text, i) => (
            <span
              key={text}
              data-word
              className="ln-word-swap__item"
              style={i === 0 ? undefined : { visibility: "hidden" }}
            >
              {text}
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}
