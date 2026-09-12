export type HeroStoryBeat = 0 | 1 | 2 | 3;

/** Live recovery beat — a new decline that isn’t already in demo data. */
export const HERO_STORY = {
  customer: "Chris Holm",
  product: "Pro Plan",
  amountCents: 4900,
  currency: "eur",
} as const;

export const HERO_STORY_CAPTIONS: Record<
  Exclude<HeroStoryBeat, 0>,
  { kicker: string; title: string; sub: string }
> = {
  1: {
    kicker: "Live recovery",
    title: "A failed payment.",
    sub: `${HERO_STORY.customer} · ${HERO_STORY.product} · €49`,
  },
  2: {
    kicker: "Live recovery",
    title: "We send as you.",
    sub: "Day 0 email, from their domain — not ours.",
  },
  3: {
    kicker: "Live recovery",
    title: "They pay. You keep it.",
    sub: "€49 recovered · you keep €44",
  },
};

export function storyBeatFromProgress(t: number): HeroStoryBeat {
  if (t < 0.28) return 0;
  if (t < 1.12) return 1;
  if (t < 2.05) return 2;
  return 3;
}

export function formatStoryEuros(cents: number): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
