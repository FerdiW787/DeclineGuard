/**
 * Recovery layout theme asserts. Run: npx tsx scripts/email-theme-assert.ts
 */
import {
  LAYOUT_PRESET_IDS,
  LEGACY_LAYOUT_PRESET_ID_MAP,
  NEW_MERCHANT_THEME_DEFAULTS,
  QUIET_COLUMN_TOKENS,
  RECOVERY_SEQUENCE_STEPS,
  assertKnownLayoutPresetId,
  inferStylingMode,
  normalizeLayoutPresetId,
  resolveSendTheme,
  resolveTheme,
  resolveThemeFromSettings,
} from "../convex/lib/emailTheme";
import {
  KIT_EXPERIMENT_MIN_SEQUENCES,
  nextRotationKit,
  pickWinningKit,
  resolveSendKit,
  shouldPromoteKitExperiment,
} from "../convex/lib/kitExperiment";
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
  DEFAULT_LAYOUT_PRESET_ID as FE_DEFAULT_LAYOUT_PRESET_ID,
  NEW_MERCHANT_THEME_DEFAULTS as FE_NEW_MERCHANT_THEME_DEFAULTS,
  LAYOUT_PRESET_IDS as FE_LAYOUT_PRESET_IDS,
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
if (NEW_MERCHANT_THEME_DEFAULTS.layoutPresetId !== "quiet-column") {
  throw new Error(
    `FAIL: new merchants must default layoutPresetId quiet-column, got ${NEW_MERCHANT_THEME_DEFAULTS.layoutPresetId}`,
  );
}

if (normalizeLayoutPresetId("quiet-verify") !== "quiet-column") {
  throw new Error("FAIL: quiet-verify must map to quiet-column");
}
if (assertKnownLayoutPresetId("quiet-verify") !== "quiet-column") {
  throw new Error(
    "FAIL: assertKnownLayoutPresetId(quiet-verify) must be quiet-column",
  );
}

const expectedIds = [
  "poster-notice",
  "amount-due",
  "plain-letter",
  "what-happened",
  "quiet-column",
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

const quietPreset = resolveTheme({
  stylingMode: "preset",
  layoutPresetId: "quiet-column",
});
if (quietPreset.tokens.brandColor !== QUIET_COLUMN_TOKENS.brandColor) {
  throw new Error("FAIL: preset quiet-column must use catalog tokens");
}
if (quietPreset.tokens.brandColor === "#3d5248") {
  throw new Error("FAIL: quiet-column must not fall back to Quiet Verify green");
}

if (RECOVERY_SEQUENCE_STEPS.join(",") !== "day0,day2,day5") {
  throw new Error(
    `FAIL: recovery steps must be day0/day2/day5, got ${RECOVERY_SEQUENCE_STEPS.join(",")}`,
  );
}

if (feNormalizeLayoutPresetId("quiet-column") !== "quiet-column") {
  throw new Error("FAIL: FE normalizeLayoutPresetId must accept quiet-column");
}
if (FE_DEFAULT_LAYOUT_PRESET_ID !== "quiet-column") {
  throw new Error(
    `FAIL: FE default kit must be quiet-column, got ${FE_DEFAULT_LAYOUT_PRESET_ID}`,
  );
}
if (FE_NEW_MERCHANT_THEME_DEFAULTS.layoutPresetId !== "quiet-column") {
  throw new Error("FAIL: FE new merchants must default layoutPresetId quiet-column");
}
if (feNormalizeLayoutPresetId("quiet-verify") !== "quiet-column") {
  throw new Error("FAIL: FE quiet-verify must map to quiet-column");
}
if (feNormalizeLayoutPresetId("sonos") !== "quiet-column") {
  throw new Error("FAIL: FE sonos must map to quiet-column");
}
if (feNormalizeLayoutPresetId("calm-verify") !== "quiet-column") {
  throw new Error("FAIL: FE calm-verify must map to quiet-column");
}
if (feAssertKnownLayoutPresetId("quiet-column") !== "quiet-column") {
  throw new Error("FAIL: FE assertKnownLayoutPresetId must accept quiet-column");
}
if (feInferStylingMode({ stylingMode: "configured" }) !== "configured") {
  throw new Error("FAIL: FE configured stylingMode must stay configured");
}
if (FE_LAYOUT_PRESET_IDS.join(",") !== expectedIds.join(",")) {
  throw new Error("FAIL: FE catalog ids must match BE");
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

const quietHtml = structures.find((row) => row.id === "quiet-column")!.html;
if (quietHtml.includes(kitVisibleFingerprint("amount-due"))) {
  throw new Error("FAIL: quiet-column kit must not use amount-due starter blocks");
}

const day0 = buildRecoveryEmail({
  ...sharedColors,
  templateId: "gentle",
  layoutPresetId: "quiet-column",
});
const day2 = buildRecoveryEmail({
  ...sharedColors,
  templateId: "direct",
  layoutPresetId: "quiet-column",
});
if (day0.html === day2.html) {
  throw new Error("FAIL: day step must change kit copy without changing kit id");
}
if (!day2.html.includes('data-email-kit="quiet-column"')) {
  throw new Error("FAIL: day step must keep the same starter kit");
}

if (normalizeLayoutPresetId("soft-expire") !== "plain-letter") {
  throw new Error(
    `FAIL: soft-expire must map to plain-letter, got ${normalizeLayoutPresetId("soft-expire")}`,
  );
}
if (LEGACY_LAYOUT_PRESET_ID_MAP["soft-expire"] !== "plain-letter") {
  throw new Error("FAIL: shared legacy map must send soft-expire → plain-letter");
}
if (LEGACY_LAYOUT_PRESET_ID_MAP.sonos !== "quiet-column") {
  throw new Error("FAIL: sonos must map to quiet-column");
}
if (LEGACY_LAYOUT_PRESET_ID_MAP.avocode !== "amount-due") {
  throw new Error("FAIL: avocode must map to amount-due");
}
if (LEGACY_LAYOUT_PRESET_ID_MAP.benchmark !== "what-happened") {
  throw new Error("FAIL: benchmark must map to what-happened");
}
if (LEGACY_LAYOUT_PRESET_ID_MAP.fontbase !== "plain-letter") {
  throw new Error("FAIL: fontbase must map to plain-letter");
}
if (LEGACY_LAYOUT_PRESET_ID_MAP["nordvpn-structure"] !== "poster-notice") {
  throw new Error("FAIL: nordvpn-structure must map to poster-notice");
}

if (resolveSendKit({ experimentStatus: "won", winnerKitId: "amount-due" }) !== "amount-due") {
  throw new Error("FAIL: won experiment must send the winner kit");
}
if (
  resolveSendKit({
    experimentStatus: "won",
    winnerKitId: "amount-due",
    assignedKitId: "plain-letter",
  }) !== "plain-letter"
) {
  throw new Error("FAIL: won+assigned must send the assigned arm");
}
if (
  resolveSendKit({
    experimentStatus: "active",
    assignedKitId: "plain-letter",
    winnerKitId: "amount-due",
  }) !== "plain-letter"
) {
  throw new Error("FAIL: active experiment must send the assigned arm");
}
if (resolveSendKit({}) !== "quiet-column") {
  throw new Error("FAIL: missing assignment must fall back to quiet-column");
}
if (nextRotationKit(0).kitId !== "poster-notice") {
  throw new Error("FAIL: rotation must start at poster-notice");
}
if (KIT_EXPERIMENT_MIN_SEQUENCES !== 20) {
  throw new Error("FAIL: promote floor must be 20 sequences per kit");
}
if (
  shouldPromoteKitExperiment(
    expectedIds.map((kitId) => ({
      kitId,
      sequencesStarted: 19,
      recoveries: 1,
    })),
  )
) {
  throw new Error("FAIL: must not promote before every kit reaches N=20");
}
if (
  !shouldPromoteKitExperiment(
    expectedIds.map((kitId) => ({
      kitId,
      sequencesStarted: 20,
      recoveries: kitId === "quiet-column" ? 5 : 4,
    })),
  )
) {
  throw new Error("FAIL: must promote when every kit has ≥ 20 sequences");
}
if (
  pickWinningKit([
    { kitId: "amount-due", sequencesStarted: 20, recoveries: 4 },
    { kitId: "quiet-column", sequencesStarted: 20, recoveries: 4 },
    { kitId: "poster-notice", sequencesStarted: 20, recoveries: 3 },
    { kitId: "plain-letter", sequencesStarted: 20, recoveries: 2 },
    { kitId: "what-happened", sequencesStarted: 20, recoveries: 1 },
  ]) !== "quiet-column"
) {
  throw new Error("FAIL: tied rate + recoveries must break to quiet-column");
}
const sendConfigured = resolveSendTheme("quiet-column", {
  brandColor: "#112233",
});
if (sendConfigured.stylingMode !== "configured") {
  throw new Error("FAIL: send theme must use configured scrape tokens");
}
if (sendConfigured.tokens.brandColor !== "#112233") {
  throw new Error("FAIL: send theme must apply scrape brandColor");
}

if (!day0.html.includes("data-ignore-note") || !day0.html.includes("already updated")) {
  throw new Error("FAIL: ignoreNote must appear in send HTML");
}

const withSocials = buildRecoveryEmail({
  ...sharedColors,
  templateId: "gentle",
  layoutPresetId: "quiet-column",
  socials: { x: "https://x.com/acme" },
});
if (!withSocials.html.includes("https://x.com/acme")) {
  throw new Error("FAIL: merchant socials must appear in send HTML");
}

const withBlocks = buildRecoveryEmail({
  ...sharedColors,
  templateId: "gentle",
  layoutPresetId: "quiet-column",
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
  throw new Error("FAIL: send must still compose via renderBlocksHtml");
}
if (withBlocks.html.includes("Merchant <strong>block</strong>")) {
  throw new Error("FAIL: merchant blocks must be ignored on send");
}
if (!withBlocks.html.includes(kitVisibleFingerprint("quiet-column"))) {
  throw new Error("FAIL: send must use assigned kit blocks, not merchant blocks");
}
if (!withBlocks.html.includes("Headline")) {
  throw new Error("FAIL: merchant headline must overlay kit copySlot");
}
if (!withBlocks.html.includes("plain body that must not flatten blocks")) {
  throw new Error("FAIL: merchant body must overlay kit copySlot");
}
if (!withBlocks.html.includes("CTA")) {
  throw new Error("FAIL: merchant cta must overlay kit button");
}
if (withBlocks.subject !== "Subj") {
  throw new Error("FAIL: merchant subject must apply on send");
}

const withShell = buildRecoveryEmail({
  ...sharedColors,
  templateId: "gentle",
  layoutPresetId: "quiet-column",
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
if (withShell.html.includes("#abcdef")) {
  throw new Error("FAIL: merchant shellBackground must not override kit chrome");
}
if (!withShell.html.includes("padding:40px 64px")) {
  throw new Error("FAIL: send must use kit emailPadding, not merchant chrome");
}
if (!withShell.html.includes("border:0")) {
  throw new Error("FAIL: send must use kit shellBorder, not merchant chrome");
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
  layoutPresetId: "quiet-column",
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

const kitHeadline = starterBlocksForKit("quiet-column", "gentle").find(
  (block) => block.type === "text" && block.copySlot === "headline",
);
if (!kitHeadline || kitHeadline.type !== "text") {
  throw new Error("FAIL: quiet-column starter kit must emit headline copySlot");
}
const savedHeadline = persistTextCopySlot(kitHeadline.copySlot);
if (savedHeadline !== "headline") {
  throw new Error("FAIL: copySlot headline must round-trip persistTextCopySlot");
}
for (const slot of ["headline", "body"] as const) {
  const seeded = starterBlocksForKit("amount-due", "direct").find(
    (block) => block.type === "text" && block.copySlot === slot,
  );
  if (!seeded || seeded.type !== "text") {
    throw new Error(`FAIL: amount-due kit must emit copySlot ${slot}`);
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
if (
  !/<a href="https:\/\/safe\.example\/?"(?:\s+style="[^"]*")?>/.test(feStyled) ||
  /onclick|target=/i.test(feStyled)
) {
  throw new Error(
    `FAIL: FE styleEmailAnchors must rebuild dangling open without raw attrs (got ${feStyled})`,
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
const slashAttrOnclick =
  '<a/href="https://safe.example"onclick="alert(1)">x</a>';
const slashAttrSpan = '<span/style="color:red">x</span>';
const slashAttrSpanHex = '<span/style="color:#f00">x</span>';
for (const [label, strip] of [
  ["FE", stripEventHandlerAttrs],
  ["BE", beStripEventHandlerAttrs],
] as const) {
  const aOut = strip(slashAttrAnchor);
  if (/<ahref=/i.test(aOut) || !/<a href="https:\/\/safe\.example\/?">x<\/a>/.test(aOut)) {
    throw new Error(
      `FAIL: ${label} strip must turn <a/href> into <a href="https://safe.example">x</a> (got ${aOut})`,
    );
  }
  const aClick = strip(slashAttrOnclick);
  if (/onclick|alert\(1\)|<ahref=/i.test(aClick) || !aClick.includes("https://safe.example")) {
    throw new Error(
      `FAIL: ${label} strip must keep a/href and drop onclick (got ${aClick})`,
    );
  }
  const spanOut = strip(slashAttrSpan);
  if (/<spanstyle=/i.test(spanOut) || /style="color:red"/i.test(spanOut)) {
    throw new Error(
      `FAIL: ${label} strip must not passthrough non-hex span/style (got ${spanOut})`,
    );
  }
  if (!/<span>x<\/span>/.test(spanOut)) {
    throw new Error(
      `FAIL: ${label} strip must rebuild span/style="color:red" as <span>x</span> (got ${spanOut})`,
    );
  }
  const spanHex = strip(slashAttrSpanHex);
  if (!/<span style="color:#ff0000">x<\/span>/.test(spanHex)) {
    throw new Error(
      `FAIL: ${label} strip must keep hex-only span color (got ${spanHex})`,
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

const invalidHrefCases = [
  { html: '<a href="javascript:alert(1)">js</a>', text: "js" },
  { html: '<a href="http://insecure.example">http</a>', text: "http" },
  { html: "<a href=bare>bare</a>", text: "bare" },
] as const;
for (const probe of invalidHrefCases) {
  const beSaved = persistTextBlockHtml(probe.html);
  const beRendered = renderTextHtml(probe.html);
  const feSanitized = sanitizeEditorHtml(probe.html);
  const feStyled = styleEmailAnchors(probe.html, "#112233");
  const feStrip = stripEventHandlerAttrs(probe.html);
  const beStrip = beStripEventHandlerAttrs(probe.html);
  if (!feStrip.startsWith("<a>") || !feStrip.includes(`>${probe.text}</a>`)) {
    throw new Error(
      `FAIL: FE strip must keep bare <a> for invalid href (got ${feStrip})`,
    );
  }
  if (!beStrip.startsWith("<a>") || !beStrip.includes(`>${probe.text}</a>`)) {
    throw new Error(
      `FAIL: BE strip must keep bare <a> for invalid href (got ${beStrip})`,
    );
  }
  for (const [label, out] of [
    ["BE save", beSaved],
    ["BE render", beRendered],
    ["FE sanitizeEditorHtml", feSanitized],
    ["FE styleEmailAnchors", feStyled],
  ] as const) {
    assertSafeHrefs(out, `${label} invalid href`);
    if (!out.includes(probe.text)) {
      throw new Error(`FAIL: ${label} must keep text from ${probe.html}`);
    }
    if (out.includes("</a>")) {
      throw new Error(`FAIL: ${label} left orphan </a> for ${probe.html} (got ${out})`);
    }
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
  height?: number;
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
    height?: number;
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
    height: block.height,
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
    if (!slots.has("headline") || !slots.has("body")) {
      throw new Error(`FAIL: ${id}/${day} must map copySlot headline/body`);
    }
  }
}

const quietSeeded = structures.find((row) => row.id === "quiet-column")!.html;
if (!quietSeeded.includes("padding:40px 64px")) {
  throw new Error("FAIL: empty-block quiet-column send must use kit emailPadding 64");
}
if (!quietSeeded.includes("border:0")) {
  throw new Error("FAIL: empty-block quiet-column send must use kit shellBorder false");
}
const posterSeeded = structures.find((row) => row.id === "poster-notice")!.html;
if (!posterSeeded.includes("font-size:34px")) {
  throw new Error("FAIL: poster-notice send must use kit headline size 34");
}
const amountSeeded = structures.find((row) => row.id === "amount-due")!.html;
if (!amountSeeded.includes("Amount due")) {
  throw new Error("FAIL: amount-due send must include money-first chrome");
}

if (!day0.html.includes("Your payment didn’t go through")) {
  throw new Error("FAIL: day0 quiet-column must seed FE gentle headline");
}
if (!day2.html.includes("Still need an updated card")) {
  throw new Error("FAIL: day2 quiet-column must seed FE direct headline");
}
const day5 = buildRecoveryEmail({
  ...sharedColors,
  templateId: "urgent",
  layoutPresetId: "quiet-column",
});
if (!day5.html.includes("Last chance") || !day5.html.includes("Fix payment now")) {
  throw new Error("FAIL: day5 quiet-column must seed FE urgent copy");
}
if (!day0.html.includes("Open the billing page")) {
  throw new Error("FAIL: quiet-column billing link must render");
}

console.log(
  "asserts green: configured-legacy #112233, Set A ids, quiet-verify→quiet-column, A/B resolve, won+assigned sticky, unset→configured, D0/D2/D5, blocks+theme send, merchant short copy overlay, merchant blocks ignored, no layout-table body, FE/BE default+legacy, socials, ignoreNote, kit chrome, sanitizer, FE/BE kit parity",
);
