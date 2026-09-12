type PosterSpec = {
  bg: string;
  card: string;
  header: string;
  kicker: string;
  title: string;
  body: string;
  cta: string;
  ctaBg: string;
  ctaFg: string;
  ink: string;
  muted: string;
};

const SPECS: PosterSpec[] = [
  {
    bg: "#ecece8",
    card: "#ffffff",
    header: "#111111",
    kicker: "DAY 0  ·  GENTLE",
    title: "Quick update on Pro Plan",
    body: "The €49 payment for Pro Plan didn't go through.",
    cta: "Update payment method",
    ctaBg: "#f0b429",
    ctaFg: "#08090a",
    ink: "#111111",
    muted: "#5c5f66",
  },
  {
    bg: "#e8e4dc",
    card: "#fffaf2",
    header: "#1a1208",
    kicker: "DAY 2  ·  DIRECT",
    title: "Still need an updated card",
    body: "Your Pro Plan payment is still pending.",
    cta: "Update billing",
    ctaBg: "#111111",
    ctaFg: "#ffffff",
    ink: "#1a1208",
    muted: "#6b6258",
  },
  {
    bg: "#f3e4e0",
    card: "#fff7f5",
    header: "#3b1210",
    kicker: "DAY 5  ·  URGENT",
    title: "Last chance to keep access",
    body: "Without an updated card, Pro Plan may pause.",
    cta: "Fix payment now",
    ctaBg: "#c2410c",
    ctaFg: "#ffffff",
    ink: "#3b1210",
    muted: "#7a4a42",
  },
  {
    bg: "#f4f4f1",
    card: "#ffffff",
    header: "#08090a",
    kicker: "MINIMAL",
    title: "Your payment didn’t go through",
    body: "€49 for Pro Plan is waiting on a new card.",
    cta: "Update card",
    ctaBg: "#08090a",
    ctaFg: "#f7f8f8",
    ink: "#08090a",
    muted: "#5c5f66",
  },
  {
    bg: "#111111",
    card: "#1a1a1a",
    header: "#f7f8f8",
    kicker: "BRAND  ·  DARK",
    title: "Keep Pro Plan running",
    body: "Chris, your €49 payment didn't go through.",
    cta: "Update card",
    ctaBg: "#f0b429",
    ctaFg: "#08090a",
    ink: "#f7f8f8",
    muted: "#a1a1aa",
  },
];

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawPoster(spec: PosterSpec): string {
  const width = 480;
  const height = 640;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = spec.bg;
  roundRect(ctx, 0, 0, width, height, 22);
  ctx.fill();

  ctx.fillStyle = spec.card;
  roundRect(ctx, 28, 28, 424, 584, 16);
  ctx.fill();

  ctx.font = "600 16px Inter, ui-sans-serif, system-ui";
  ctx.fillStyle = spec.header;
  ctx.fillText("Cool SaaS", 52, 78);

  ctx.font = "600 12px Inter, ui-sans-serif, system-ui";
  ctx.fillStyle = "#8a8f98";
  ctx.fillText(spec.kicker, 52, 128);

  ctx.font = "600 28px Inter, ui-sans-serif, system-ui";
  ctx.fillStyle = spec.ink;
  ctx.fillText(spec.title, 52, 180);

  ctx.font = "400 16px Inter, ui-sans-serif, system-ui";
  ctx.fillStyle = spec.muted;
  ctx.fillText(spec.body, 52, 228);
  ctx.fillText("Update your card — about a minute.", 52, 254);

  ctx.fillStyle = spec.ctaBg;
  roundRect(ctx, 52, 292, 228, 48, 12);
  ctx.fill();
  ctx.font = "600 15px Inter, ui-sans-serif, system-ui";
  ctx.fillStyle = spec.ctaFg;
  ctx.textAlign = "center";
  ctx.fillText(spec.cta, 166, 322);
  ctx.textAlign = "left";

  ctx.font = "400 12px Inter, ui-sans-serif, system-ui";
  ctx.fillStyle = "#9aa0a6";
  ctx.fillText("Sent as Cool SaaS · recovery email", 52, 560);

  return canvas.toDataURL("image/png");
}

export type EmailPosterItem = {
  image: string;
  title: string;
};

export function createEmailPosterItems(): EmailPosterItem[] {
  return SPECS.map((spec) => {
    const image = drawPoster(spec);
    return { image, title: spec.title };
  }).filter((item) => item.image.length > 0);
}
