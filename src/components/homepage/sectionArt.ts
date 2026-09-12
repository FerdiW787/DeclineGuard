/** Homepage section illustrations — same engraving style as hero warrior. */
export const sectionArt = {
  guardian: "/mascot/sections/guardian.png",
  product: "/mascot/sections/product.png",
  trust: "/mascot/sections/trust.png",
  howItWorks: "/mascot/sections/how-it-works.png",
  faq: "/mascot/sections/faq.png",
  finalCta: "/mascot/sections/final-cta.png",
} as const;

export type SectionArtId = keyof typeof sectionArt;
