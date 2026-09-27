/**
 * Recovery layout theme asserts. Run: npx tsx scripts/email-theme-assert.ts
 */
import {
  LAYOUT_PRESET_IDS,
  NEW_MERCHANT_THEME_DEFAULTS,
  RECOVERY_SEQUENCE_STEPS,
  SONOS_TOKENS,
  assertKnownLayoutPresetId,
  inferStylingMode,
  normalizeLayoutPresetId,
  resolveTheme,
  resolveThemeFromSettings,
} from "../convex/lib/emailTheme";
import { buildRecoveryEmail } from "../convex/lib/recoveryEmailTemplate";
import { layoutStructureMarker } from "../convex/lib/recoveryLayoutHtml";
import {
  inferStylingMode as feInferStylingMode,
  normalizeLayoutPresetId as feNormalizeLayoutPresetId,
  assertKnownLayoutPresetId as feAssertKnownLayoutPresetId,
  LAYOUT_PRESET_IDS as FE_LAYOUT_PRESET_IDS,
  RECOVERY_SEQUENCE_STEPS as FE_RECOVERY_SEQUENCE_STEPS,
} from "../src/lib/emailTheme";

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

const structures = expectedIds.map((id) => {
  const built = buildRecoveryEmail({
    ...sharedColors,
    templateId: "gentle",
    layoutPresetId: id,
  });
  const marker = layoutStructureMarker(id);
  if (!built.html.includes(`data-layout="${id}"`)) {
    throw new Error(`FAIL: ${id} HTML missing data-layout`);
  }
  if (!built.html.includes(`data-structure="${marker.structure}"`)) {
    throw new Error(
      `FAIL: ${id} HTML missing data-structure=${marker.structure}`,
    );
  }
  return { id, structure: marker.structure, html: built.html };
});

const uniqueStructures = new Set(structures.map((row) => row.structure));
if (uniqueStructures.size !== expectedIds.length) {
  throw new Error("FAIL: layoutPresetId must produce five distinct structures");
}

const sonosHtml = structures.find((row) => row.id === "sonos")!.html;
const avocodeHtml = structures.find((row) => row.id === "avocode")!.html;
if (sonosHtml.includes('data-rail="avocode"')) {
  throw new Error("FAIL: sonos must not use avocode left-rail structure");
}
if (!avocodeHtml.includes('data-rail="avocode"')) {
  throw new Error("FAIL: avocode must include left rail");
}
if (!structures.find((row) => row.id === "benchmark")!.html.includes('data-masthead="benchmark"')) {
  throw new Error("FAIL: benchmark must include header band");
}
if (!structures.find((row) => row.id === "fontbase")!.html.includes('data-display="fontbase"')) {
  throw new Error("FAIL: fontbase must include typographic display");
}
if (
  !structures
    .find((row) => row.id === "nordvpn-structure")!
    .html.includes('data-topbar="nordvpn-structure"')
) {
  throw new Error("FAIL: nordvpn-structure must include dark top bar");
}

const day2 = buildRecoveryEmail({
  ...sharedColors,
  templateId: "direct",
  layoutPresetId: "sonos",
});
if (!day2.html.includes("Day 2")) {
  throw new Error("FAIL: day step must change copy (Day 2) without changing layout id");
}
if (!day2.html.includes('data-layout="sonos"')) {
  throw new Error("FAIL: day step must keep layout structure");
}

console.log(
  "asserts green: configured-legacy #112233, quiet-verify→sonos, 5 layout ids, FE normalize sonos, unset→configured, D0/D2/D5, structural HTML by layoutPresetId",
);
