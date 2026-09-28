/**
 * Recovery layout theme asserts. Run: npx tsx scripts/email-theme-assert.ts
 */
import {
  LAYOUT_PRESET_IDS,
  LEGACY_LAYOUT_PRESET_ID_MAP,
  NEW_MERCHANT_THEME_DEFAULTS,
  RECOVERY_SEQUENCE_STEPS,
  SONOS_TOKENS,
  assertKnownLayoutPresetId,
  inferStylingMode,
  normalizeLayoutPresetId,
  resolveTheme,
  resolveThemeFromSettings,
} from "../convex/lib/emailTheme";
import {
  persistTextBlockHtml,
  persistTextCopySlot,
  renderBlocksHtml,
  sanitizeStoredHtml,
  stripEventHandlerAttrs as beStripEventHandlerAttrs,
} from "../convex/lib/emailBlocks";
import {
  BLOCK_KIT_SPEC,
  kitShellSpec,
  kitVisibleFingerprint,
  starterBlocksForKit,
} from "../convex/lib/recoveryBlockKits";
import { buildRecoveryEmail } from "../convex/lib/recoveryEmailTemplate";
import {
  BLOCK_KIT_SPEC as FE_BLOCK_KIT_SPEC,
  documentForKit,
} from "../src/lib/emailBlockKits";
import {
  inferStylingMode as feInferStylingMode,
  normalizeLayoutPresetId as feNormalizeLayoutPresetId,
  assertKnownLayoutPresetId as feAssertKnownLayoutPresetId,
  LAYOUT_PRESET_IDS as FE_LAYOUT_PRESET_IDS,
  RECOVERY_SEQUENCE_STEPS as FE_RECOVERY_SEQUENCE_STEPS,
} from "../src/lib/emailTheme";
import {
  sanitizeEditorHtml,
  stripEventHandlerAttrs,
  styleEmailAnchors,
} from "../src/lib/emailRichText";

const legacy = resolveThemeFromSettings({
  brandColor: "#112233",
  stylingMode: undefined,
  brandImportCompletedAt: null,
});

if (legacy.stylingMode !== "configured") {
  throw new Error(
    `P1 FAIL: expected stylingMode configured, got ${legacy.stylingMode}`,
  );
}
if (legacy.tokens.brandColor !== "#112233") {
  throw new Error(
    `P1 FAIL: expected brandColor #112233, got ${legacy.tokens.brandColor}`,
  );
}

if (inferStylingMode({ stylingMode: undefined }) !== "configured") {
  throw new Error("FAIL: unset stylingMode must infer configured");
}

if (NEW_MERCHANT_THEME_DEFAULTS.stylingMode !== "preset") {
  throw new Error("FAIL: new merchants must default stylingMode preset");
}
if (NEW_MERCHANT_THEME_DEFAULTS.layoutPresetId !== "sonos") {
  throw new Error(
    `FAIL: new merchants must default layoutPresetId sonos, got ${NEW_MERCHANT_THEME_DEFAULTS.layoutPresetId}`,
  );
}

if (normalizeLayoutPresetId("quiet-verify") !== "sonos") {
  throw new Error("FAIL: quiet-verify must map to sonos");
}
if (assertKnownLayoutPresetId("quiet-verify") !== "sonos") {
  throw new Error("FAIL: assertKnownLayoutPresetId(quiet-verify) must be sonos");
}

const expectedIds = [
  "sonos",
  "avocode",
  "benchmark",
  "fontbase",
  "nordvpn-structure",
] as const;
if (LAYOUT_PRESET_IDS.join(",") !== expectedIds.join(",")) {
  throw new Error(
    `FAIL: catalog ids ${LAYOUT_PRESET_IDS.join(",")} !== ${expectedIds.join(",")}`,
  );
}
for (const id of expectedIds) {
  if (assertKnownLayoutPresetId(id) !== id) {
    throw new Error(`FAIL: assertKnownLayoutPresetId rejected ${id}`);
  }
}

const sonosPreset = resolveTheme({
  stylingMode: "preset",
  layoutPresetId: "sonos",
});
if (sonosPreset.tokens.brandColor !== SONOS_TOKENS.brandColor) {
  throw new Error("FAIL: preset sonos must use Sonos catalog tokens");
}
if (sonosPreset.tokens.brandColor === "#3d5248") {
  throw new Error("FAIL: sonos must not fall back to Quiet Verify green");
}

if (RECOVERY_SEQUENCE_STEPS.join(",") !== "day0,day2,day5") {
  throw new Error(
    `FAIL: recovery steps must be day0/day2/day5, got ${RECOVERY_SEQUENCE_STEPS.join(",")}`,
  );
}

if (feNormalizeLayoutPresetId("sonos") !== "sonos") {
  throw new Error("FAIL: FE normalizeLayoutPresetId must accept sonos");
}
if (feNormalizeLayoutPresetId("quiet-verify") !== "sonos") {
  throw new Error("FAIL: FE quiet-verify must map to sonos");
}
if (feAssertKnownLayoutPresetId("sonos") !== "sonos") {
  throw new Error("FAIL: FE assertKnownLayoutPresetId must accept sonos");
}
if (feInferStylingMode({ stylingMode: undefined }) !== "configured") {
  throw new Error("FAIL: FE unset stylingMode must infer configured");
}
if (FE_LAYOUT_PRESET_IDS.join(",") !== expectedIds.join(",")) {
  throw new Error("FAIL: FE catalog ids must match BE");
}
if (FE_RECOVERY_SEQUENCE_STEPS.join(",") !== "day0,day2,day5") {
  throw new Error("FAIL: FE recovery steps must be day0|day2|day5");
}

let rejected = false;
try {
  assertKnownLayoutPresetId("soft-expire");
} catch {
  rejected = true;
}
if (!rejected) {
  throw new Error("FAIL: leftover product-email ids must not be catalog layouts");
}

const sharedColors = {
  primaryColor: "#112233",
  secondaryColor: "#667788",
  storeName: "Acme",
  customerName: "Maya",
  customerEmail: "maya@example.com",
  productName: "Pro Monthly",
  amountLabel: "€29.00",
  updatePaymentUrl: "https://app.lemonsqueezy.com/my-orders",
  ctaBackgroundColor: "#112233",
  ctaTextColor: "#ffffff",
  ctaBorderRadiusPx: 4,
  emailBackgroundColor: "#f7f5f2",
  emailTextColor: "#1a1a1a",
  linkColor: "#112233",
} as const;

const layoutTableSentinels = [
  "height:176px",
  "width:96px;height:64px",
  "width:64px;height:80px;background:#1a1a1a",
];

const structures = expectedIds.map((id) => {
  const built = buildRecoveryEmail({
    ...sharedColors,
    templateId: "gentle",
    layoutPresetId: id,
  });
  if (!built.html.includes(`data-email-kit="${id}"`)) {
    throw new Error(`FAIL: ${id} send HTML must mark data-email-kit`);
  }
  if (!built.html.includes('data-compose="blocks"')) {
    throw new Error(`FAIL: ${id} send must be blocks+theme, not layout-table HTML`);
  }
  if (!built.html.includes(kitVisibleFingerprint(id))) {
    throw new Error(`FAIL: ${id} kit defaults missing from send HTML`);
  }
  if (starterBlocksForKit(id, "gentle").length === 0) {
    throw new Error(`FAIL: ${id} starter kit must provide blocks`);
  }
  for (const sentinel of layoutTableSentinels) {
    if (built.html.includes(sentinel)) {
      throw new Error(`FAIL: ${id} send leaked layout-table HTML (${sentinel})`);
    }
  }
  return { id, html: built.html };
});

const uniqueHtml = new Set(structures.map((row) => row.html));
if (uniqueHtml.size !== expectedIds.length) {
  throw new Error("FAIL: layoutPresetId must seed five distinct block kits");
}

const sonosHtml = structures.find((row) => row.id === "sonos")!.html;
if (sonosHtml.includes(kitVisibleFingerprint("avocode"))) {
  throw new Error("FAIL: sonos kit must not use avocode starter blocks");
}

const day0 = buildRecoveryEmail({
  ...sharedColors,
  templateId: "gentle",
  layoutPresetId: "sonos",
});
const day2 = buildRecoveryEmail({
  ...sharedColors,
  templateId: "direct",
  layoutPresetId: "sonos",
});
if (day0.html === day2.html) {
  throw new Error("FAIL: day step must change kit copy without changing kit id");
}
if (!day2.html.includes('data-email-kit="sonos"')) {
  throw new Error("FAIL: day step must keep the same starter kit");
}

if (normalizeLayoutPresetId("soft-expire") !== "fontbase") {
  throw new Error(
    `FAIL: soft-expire must map to fontbase, got ${normalizeLayoutPresetId("soft-expire")}`,
  );
}
if (LEGACY_LAYOUT_PRESET_ID_MAP["soft-expire"] !== "fontbase") {
  throw new Error("FAIL: shared legacy map must send soft-expire → fontbase");
}

if (!day0.html.includes("data-ignore-note") || !day0.html.includes("already updated")) {
  throw new Error("FAIL: ignoreNote must appear in send HTML");
}

const withSocials = buildRecoveryEmail({
  ...sharedColors,
  templateId: "gentle",
  layoutPresetId: "sonos",
  socials: { x: "https://x.com/acme" },
});
if (!withSocials.html.includes("https://x.com/acme")) {
  throw new Error("FAIL: merchant socials must appear in send HTML");
}

const withBlocks = buildRecoveryEmail({
  ...sharedColors,
  templateId: "gentle",
  layoutPresetId: "sonos",
  copyOverrides: {
    gentle: {
      subject: "Subj",
      headline: "Headline",
      body: "plain body that must not flatten blocks",
      cta: "CTA",
      blocks: [
        {
          id: "b1",
          type: "text",
          html: "Merchant <strong>block</strong> body {{product}}",
          fontSize: 16,
          color: "default",
          align: "left",
          marginTop: 0,
          marginBottom: 8,
        },
      ],
    },
  },
});
if (!withBlocks.html.includes('data-compose="blocks"')) {
  throw new Error("FAIL: merchant blocks must compose via renderBlocksHtml");
}
if (!withBlocks.html.includes("<strong>block</strong>")) {
  throw new Error("FAIL: merchant blocks must compose as HTML inside theme chrome");
}
if (withBlocks.html.includes("&lt;strong&gt;block&lt;/strong&gt;")) {
  throw new Error("FAIL: blocks HTML must not be escaped as plain text");
}
if (!withBlocks.html.includes("Pro Monthly")) {
  throw new Error("FAIL: block placeholders must apply");
}

const withShell = buildRecoveryEmail({
  ...sharedColors,
  templateId: "gentle",
  layoutPresetId: "sonos",
  copyOverrides: {
    gentle: {
      subject: "Subj",
      headline: "Headline",
      body: "Body",
      cta: "CTA",
      shellBackground: "#abcdef",
      shellRadius: 16,
      shellBorder: true,
      shellBorderColor: "#112233",
      shellBorderWidth: 2,
      emailPadding: 40,
    },
  },
});
if (!withShell.html.includes("#abcdef")) {
  throw new Error("FAIL: shellBackground must apply to layout HTML");
}
if (!withShell.html.includes("border-radius:16px")) {
  throw new Error("FAIL: shellRadius must apply to layout HTML");
}
if (!withShell.html.includes("border:2px solid #112233")) {
  throw new Error("FAIL: shell border must apply to layout HTML");
}
if (!withShell.html.includes("padding:40px")) {
  throw new Error("FAIL: emailPadding must apply to layout HTML");
}

const xssBlockHtml =
  'Go <a href="javascript:alert(1)">js</a> ' +
  "<a href='data:text/html,pwn'>data</a> " +
  '<a href="http://insecure.example">http</a> ' +
  '<a href=javascript:alert(2)>unquoted</a> ' +
  '<strong onclick="alert(1)">bold</strong> ' +
  '<em onerror=alert(1)>emph</em> ' +
  '<a href="https://safe.example">ok</a>';

function hrefValues(html: string): string[] {
  const values: string[] = [];
  const re = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    values.push((match[1] ?? match[2] ?? match[3] ?? "").trim());
  }
  return values;
}

function assertSafeHrefs(html: string, label: string): void {
  for (const href of hrefValues(html)) {
    if (/^(?:javascript|data|http):/i.test(href)) {
      throw new Error(`FAIL: ${label} leaked unsafe href ${href}`);
    }
  }
  if (/\bon[a-z]+\s*=/i.test(html)) {
    throw new Error(`FAIL: ${label} leaked event-handler attribute`);
  }
}

const xssDirect = renderBlocksHtml(
  [
    {
      id: "xss",
      type: "text",
      html: xssBlockHtml,
      fontSize: 16,
      color: "default",
      align: "left",
      marginTop: 0,
      marginBottom: 0,
    },
  ],
  {
    primaryColor: "#112233",
    linkColor: "#112233",
    mutedColor: "#667788",
    ctaUrl: "https://app.lemonsqueezy.com/my-orders",
  },
);
assertSafeHrefs(xssDirect, "renderBlocksHtml");
if (!xssDirect.includes("https://safe.example")) {
  throw new Error("FAIL: allowlisted https href must survive sanitizer");
}
if (!xssDirect.includes("js") || !xssDirect.includes("bold")) {
  throw new Error("FAIL: unsafe anchors must unwrap to text content");
}

const xssComposed = buildRecoveryEmail({
  ...sharedColors,
  templateId: "gentle",
  layoutPresetId: "sonos",
  copyOverrides: {
    gentle: {
      subject: "Subj",
      headline: "Headline",
      body: "Body",
      cta: "CTA",
      blocks: [
        {
          id: "xss",
          type: "text",
          html: xssBlockHtml,
          fontSize: 16,
          color: "default",
          align: "left",
          marginTop: 0,
          marginBottom: 0,
        },
      ],
    },
  },
});
assertSafeHrefs(xssComposed.html, "composed send HTML");
if (!xssComposed.html.includes("https://safe.example")) {
  throw new Error("FAIL: composed HTML must keep allowlisted https href");
}

const gluedOnclick = '<a href="https://safe.example"onclick="alert(1)">ok</a>';
const gluedRendered = renderBlocksHtml(
  [
    {
      id: "glued",
      type: "text",
      html: gluedOnclick,
      fontSize: 16,
      color: "default",
      align: "left",
      marginTop: 0,
      marginBottom: 0,
    },
  ],
  {
    primaryColor: "#112233",
    linkColor: "#112233",
    mutedColor: "#667788",
    ctaUrl: "https://app.lemonsqueezy.com/my-orders",
  },
);
assertSafeHrefs(gluedRendered, "glued onclick render");
if (!gluedRendered.includes("https://safe.example") || !gluedRendered.includes("ok")) {
  throw new Error("FAIL: glued onclick must keep allowlisted href and inner text");
}
const gluedSaved = persistTextBlockHtml(gluedOnclick);
assertSafeHrefs(gluedSaved, "glued onclick save");
if (gluedSaved.includes("onclick") || gluedSaved.includes("alert(1)")) {
  throw new Error("FAIL: save path must strip glued onclick");
}

const danglingOpen =
  'Go <a href="https://safe.example"onclick="alert(1)" target="_blank">';
const danglingSaved = persistTextBlockHtml(danglingOpen);
assertSafeHrefs(danglingSaved, "dangling open save");
if (danglingSaved.includes("onclick") || danglingSaved.includes("target=")) {
  throw new Error("FAIL: dangling open save must rebuild without raw attrs");
}
if (!/^Go <a href="https:\/\/safe\.example\/?">$/.test(danglingSaved.trim())) {
  throw new Error(
    `FAIL: dangling https open tag must be rebuilt, not returned raw (got ${danglingSaved})`,
  );
}
const danglingSanitized = sanitizeStoredHtml(danglingOpen);
assertSafeHrefs(danglingSanitized, "dangling open sanitize");
if (danglingSanitized === danglingOpen || danglingSanitized.includes("onclick")) {
  throw new Error("FAIL: sanitizeStoredHtml must not return raw dangling open tag");
}

const danglingRendered = renderBlocksHtml(
  [
    {
      id: "dangling",
      type: "text",
      html: danglingOpen,
      fontSize: 16,
      color: "default",
      align: "left",
      marginTop: 0,
      marginBottom: 0,
    },
  ],
  {
    primaryColor: "#112233",
    linkColor: "#112233",
    mutedColor: "#667788",
    ctaUrl: "https://app.lemonsqueezy.com/my-orders",
  },
);
assertSafeHrefs(danglingRendered, "dangling open render");
if (danglingRendered.includes("onclick") || danglingRendered.includes("target=")) {
  throw new Error("FAIL: dangling open render must not keep raw attrs");
}

const kitHeadline = starterBlocksForKit("sonos", "gentle").find(
  (block) => block.type === "text" && block.copySlot === "headline",
);
if (!kitHeadline || kitHeadline.type !== "text") {
  throw new Error("FAIL: sonos starter kit must emit headline copySlot");
}
const savedHeadline = persistTextCopySlot(kitHeadline.copySlot);
if (savedHeadline !== "headline") {
  throw new Error("FAIL: copySlot headline must round-trip persistTextCopySlot");
}
for (const slot of ["eyebrow", "headline", "body"] as const) {
  const seeded = starterBlocksForKit("avocode", "direct").find(
    (block) => block.type === "text" && block.copySlot === slot,
  );
  if (!seeded || seeded.type !== "text") {
    throw new Error(`FAIL: avocode kit must emit copySlot ${slot}`);
  }
  if (persistTextCopySlot(seeded.copySlot) !== slot) {
    throw new Error(`FAIL: copySlot ${slot} stripped on persist`);
  }
  if (persistTextBlockHtml(seeded.html).length === 0 && seeded.html.length > 0) {
    throw new Error(`FAIL: persist must keep kit ${slot} html`);
  }
}
if (persistTextCopySlot("hero") !== undefined) {
  throw new Error("FAIL: unknown copySlot must not persist");
}

const feDanglingProbe =
  '…<a href="https://safe.example"onclick="alert(1)">';
const feStyled = styleEmailAnchors(feDanglingProbe, "#112233");
assertSafeHrefs(feStyled, "FE styleEmailAnchors dangling glued onclick");
if (!feStyled.includes("https://safe.example")) {
  throw new Error("FAIL: FE styleEmailAnchors must keep allowlisted https href");
}
if (feStyled.includes("onclick") || feStyled.includes("alert(1)")) {
  throw new Error("FAIL: FE styleEmailAnchors must drop glued onclick");
}
if (!/<a href="https:\/\/safe\.example\/?">/.test(feStyled)) {
  throw new Error(
    `FAIL: FE styleEmailAnchors must rebuild dangling open to href-only tag (got ${feStyled})`,
  );
}

const feStripped = stripEventHandlerAttrs(
  '<a href="https://safe.example"onclick="alert(1)">ok</a>',
);
if (/\bon[a-z]+\s*=/i.test(feStripped)) {
  throw new Error("FAIL: FE stripEventHandlerAttrs must drop glued onclick");
}
if (!feStripped.includes("https://safe.example") || !feStripped.includes("ok")) {
  throw new Error("FAIL: FE stripEventHandlerAttrs must keep href and inner text");
}

const feEditor = sanitizeEditorHtml(feDanglingProbe);
assertSafeHrefs(feEditor, "FE sanitizeEditorHtml dangling glued onclick");
if (!feEditor.includes("https://safe.example")) {
  throw new Error("FAIL: FE sanitizeEditorHtml must keep allowlisted https href");
}
if (feEditor.includes("onclick") || feEditor.includes("alert(1)")) {
  throw new Error("FAIL: FE sanitizeEditorHtml must drop glued onclick");
}

function renderTextHtml(html: string): string {
  return renderBlocksHtml(
    [
      {
        id: "probe",
        type: "text",
        html,
        fontSize: 16,
        color: "default",
        align: "left",
        marginTop: 0,
        marginBottom: 0,
      },
    ],
    {
      primaryColor: "#112233",
      linkColor: "#112233",
      mutedColor: "#667788",
      ctaUrl: "https://app.lemonsqueezy.com/my-orders",
    },
  );
}

const slashGlueCases = [
  { html: "<strong/onclick=alert(1)>x</strong>", text: "x", handler: "onclick" },
  { html: "<em/onmouseover=alert(2)>y</em>", text: "y", handler: "onmouseover" },
  { html: "<u/onclick=alert(3)>z</u>", text: "z", handler: "onclick" },
] as const;

for (const probe of slashGlueCases) {
  const beSaved = persistTextBlockHtml(probe.html);
  const beRendered = renderTextHtml(probe.html);
  const feSanitized = sanitizeEditorHtml(probe.html);
  const feStyled = styleEmailAnchors(probe.html, "#112233");
  const feStripped = stripEventHandlerAttrs(probe.html);
  for (const [label, out] of [
    ["BE save", beSaved],
    ["BE render", beRendered],
    ["FE sanitizeEditorHtml", feSanitized],
    ["FE styleEmailAnchors", feStyled],
    ["FE stripEventHandlerAttrs", feStripped],
  ] as const) {
    assertSafeHrefs(out, `${label} ${probe.handler} slash-glue`);
    if (!out.includes(probe.text)) {
      throw new Error(`FAIL: ${label} must keep text from ${probe.html}`);
    }
    if (out.includes(probe.handler) || /alert\(\d+\)/.test(out)) {
      throw new Error(`FAIL: ${label} leaked slash-glued ${probe.handler} (got ${out})`);
    }
    if (out.includes(`/${probe.handler}`)) {
      throw new Error(`FAIL: ${label} kept slash-glued /${probe.handler}`);
    }
  }
}

const slashAttrAnchor = '<a/href="https://safe.example">x</a>';
const slashAttrSpan = '<span/style="color:red">x</span>';
for (const [label, strip] of [
  ["FE", stripEventHandlerAttrs],
  ["BE", beStripEventHandlerAttrs],
] as const) {
  const aOut = strip(slashAttrAnchor);
  if (/<ahref=/i.test(aOut) || !/<a href="https:\/\/safe\.example">x<\/a>/.test(aOut)) {
    throw new Error(
      `FAIL: ${label} strip must turn <a/href> into <a href="https://safe.example">x</a> (got ${aOut})`,
    );
  }
  const spanOut = strip(slashAttrSpan);
  if (/<spanstyle=/i.test(spanOut) || !/<span style="color:red">x<\/span>/.test(spanOut)) {
    throw new Error(
      `FAIL: ${label} strip must turn <span/style> into <span style="color:red">x</span> (got ${spanOut})`,
    );
  }
}
const aSaved = persistTextBlockHtml(slashAttrAnchor);
const aFe = sanitizeEditorHtml(slashAttrAnchor);
for (const [label, out] of [
  ["BE save", aSaved],
  ["FE sanitizeEditorHtml", aFe],
] as const) {
  if (/<ahref=/i.test(out)) {
    throw new Error(`FAIL: ${label} glued <ahref= from slash-href`);
  }
  if (!out.includes("x") || !out.includes("https://safe.example")) {
    throw new Error(`FAIL: ${label} must keep slash-href text and https href`);
  }
}

const credsHref = '<a href="https://user:pass@safe.example">creds</a>';
const credsSaved = persistTextBlockHtml(credsHref);
const credsRendered = renderTextHtml(credsHref);
const credsFe = sanitizeEditorHtml(credsHref);
for (const [label, out] of [
  ["BE save", credsSaved],
  ["BE render", credsRendered],
  ["FE sanitizeEditorHtml", credsFe],
] as const) {
  if (out.includes("user:pass") || /href\s*=\s*["']https:\/\/user:pass/i.test(out)) {
    throw new Error(`FAIL: ${label} must reject credentialed https via allowHttpsUrl`);
  }
  if (!out.includes("creds")) {
    throw new Error(`FAIL: ${label} must unwrap credentialed https to text`);
  }
}

type ShapeBlock = {
  type: string;
  html?: string;
  label?: string;
  fontSize?: number;
  color?: string;
  hexColor?: string | undefined;
  bold?: boolean | undefined;
  align?: string;
  copySlot?: string | undefined;
  marginTop: number;
  marginBottom: number;
};

function kitShape(
  block: {
    type: string;
    html?: string;
    label?: string;
    fontSize?: number;
    color?: string;
    hexColor?: string;
    bold?: boolean;
    align?: string;
    copySlot?: string;
    marginTop: number;
    marginBottom: number;
  },
): ShapeBlock {
  return {
    type: block.type,
    html: block.html,
    label: block.label,
    fontSize: block.fontSize,
    color: block.color,
    hexColor: block.hexColor,
    bold: block.bold,
    align: block.align,
    copySlot: block.copySlot,
    marginTop: block.marginTop,
    marginBottom: block.marginBottom,
  };
}

const kitDays = ["gentle", "direct", "urgent"] as const;
for (const id of expectedIds) {
  const beShell = kitShellSpec(id);
  const feShell = FE_BLOCK_KIT_SPEC[id];
  if (
    beShell.emailPadding !== feShell.emailPadding ||
    beShell.shellBorder !== feShell.shellBorder ||
    beShell.shellBorderWidth !== feShell.shellBorderWidth ||
    beShell.shellRadius !== feShell.shellRadius ||
    beShell.align !== feShell.align ||
    beShell.ctaAlign !== feShell.ctaAlign ||
    beShell.eyebrowSize !== feShell.eyebrowSize ||
    beShell.headlineSize !== feShell.headlineSize ||
    beShell.bodySize !== feShell.bodySize
  ) {
    throw new Error(`FAIL: ${id} BE kit shell spec must match FE BLOCK_KIT_SPEC`);
  }
  if (BLOCK_KIT_SPEC[id].emailPadding !== feShell.emailPadding) {
    throw new Error(`FAIL: ${id} exported BLOCK_KIT_SPEC must match FE`);
  }
  for (const day of kitDays) {
    const be = starterBlocksForKit(id, day);
    const fe = documentForKit(day, id).blocks;
    if (be.length !== fe.length) {
      throw new Error(
        `FAIL: ${id}/${day} block count BE ${be.length} !== FE ${fe.length}`,
      );
    }
    for (let i = 0; i < be.length; i++) {
      const beShape = kitShape(be[i]!);
      const feShape = kitShape(fe[i]!);
      if (JSON.stringify(beShape) !== JSON.stringify(feShape)) {
        throw new Error(
          `FAIL: ${id}/${day} block[${i}] shape mismatch\nBE ${JSON.stringify(beShape)}\nFE ${JSON.stringify(feShape)}`,
        );
      }
    }
    const billing = be.find(
      (block) => block.type === "text" && block.html.includes("#update-payment"),
    );
    if (!billing || billing.type !== "text") {
      throw new Error(`FAIL: ${id}/${day} starter kit must include billing #update-payment`);
    }
    const slots = new Set(
      be
        .filter((block) => block.type === "text" && block.copySlot)
        .map((block) => (block.type === "text" ? block.copySlot : undefined)),
    );
    if (!slots.has("eyebrow") || !slots.has("headline") || !slots.has("body")) {
      throw new Error(`FAIL: ${id}/${day} must map copySlot eyebrow/headline/body`);
    }
  }
}

const sonosSeeded = structures.find((row) => row.id === "sonos")!.html;
if (!sonosSeeded.includes("padding:40px 48px")) {
  throw new Error("FAIL: empty-block sonos send must use kit emailPadding 48");
}
if (!sonosSeeded.includes("border:0")) {
  throw new Error("FAIL: empty-block sonos send must use kit shellBorder false");
}
const nordSeeded = structures.find((row) => row.id === "nordvpn-structure")!.html;
if (!nordSeeded.includes("border:4px solid")) {
  throw new Error("FAIL: empty-block nordvpn send must use kit shellBorderWidth 4");
}
const benchSeeded = structures.find((row) => row.id === "benchmark")!.html;
if (!benchSeeded.includes("border-radius:12px")) {
  throw new Error("FAIL: empty-block benchmark send must use kit shellRadius 12");
}

if (!day0.html.includes("A quick update") || !day0.html.includes("Your payment didn’t go through")) {
  throw new Error("FAIL: day0 sonos must seed FE gentle eyebrow/headline");
}
if (!day2.html.includes("Still pending") || !day2.html.includes("Still need an updated card")) {
  throw new Error("FAIL: day2 sonos must seed FE direct eyebrow/headline");
}
const day5 = buildRecoveryEmail({
  ...sharedColors,
  templateId: "urgent",
  layoutPresetId: "sonos",
});
if (!day5.html.includes("Last chance") || !day5.html.includes("Fix payment now")) {
  throw new Error("FAIL: day5 sonos must seed FE urgent copy");
}
if (day0.html.includes("Or <a") === false && !day0.html.includes("Or ")) {
  throw new Error("FAIL: sonos billing prefix Or must render");
}
if (!day0.html.includes("Open the billing page") || !day0.html.includes("to continue.")) {
  throw new Error("FAIL: sonos billing link must match FE suffix");
}

console.log(
  "asserts green: configured-legacy #112233, quiet-verify→sonos, 5 kit ids, FE normalize sonos, unset→configured, D0/D2/D5, blocks+theme send, no layout-table body, shared soft-expire map, socials, ignoreNote, shell chrome, block href/attr sanitizer, FE/BE starter kit parity, copySlot persist, glued onclick + dangling open, FE sanitizer parity, slash-glue on* + allowHttpsUrl closed-a, slash-attr space after tag",
);
