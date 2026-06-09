/**
 * Canonical Text-to-Image drop-box geometry — single source of truth.
 * Spec: shared/ttiBoxGeometry.v1.json
 */
const spec = require("../shared/ttiBoxGeometry.v1.json");

const V1 = "tti-box-geometry-v1";
const LEGACY = "legacy";

/** @typedef {"tti-box-geometry-v1"|"legacy"} TtiBoxGeometryVersion */

/**
 * @param {unknown} value
 * @returns {TtiBoxGeometryVersion}
 */
function normalizeTtiBoxGeometryVersion(value) {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === LEGACY || v === "tti-box-geometry-legacy") return LEGACY;
  return V1;
}

/**
 * @param {TtiBoxGeometryVersion} [version]
 */
function getTtiBoxGeometrySpec(version = V1) {
  return version === LEGACY ? spec.legacy : spec;
}

/**
 * @param {"square-display"|"portrait"} layout
 * @param {TtiBoxGeometryVersion} [version]
 */
function getTtiBoxGeometryLayout(layout, version = V1) {
  const root = getTtiBoxGeometrySpec(version);
  return layout === "portrait" ? root.portrait : root.squareDisplay;
}

/**
 * Runtime overlay geometry — for legacy printed-box assets and overlay calibration.
 * @param {TtiBoxGeometryVersion} [version]
 * @returns {string[]}
 */
function formatTtiBoxGeometryContractLines(version = V1) {
  const root = getTtiBoxGeometrySpec(version);
  const sq = root.squareDisplay;
  const pt = root.portrait;
  return [
    `Canonical geometry version: ${version === LEGACY ? "legacy (pre-v1 assets)" : spec.version}.`,
    `Student display artboard: ${spec.displayArtboard.width}×${spec.displayArtboard.height} px (.display.png).`,
    `On the 600×600 display: four identical empty boxes, each exactly ${sq.box.widthPx}×${sq.box.heightPx} px.`,
    `Box centre X on 600×600 display: ${sq.box.centerXPx} px (${sq.box.centerXPct}%).`,
    `Box centre Y (A/B/C/D) on 600×600 display: ${sq.zones.map((z) => `${z.letter} ${z.centerYPx} px (${z.centerYPct}%)`).join("; ")}.`,
    `Minimum gap between box outer edges on 600×600 display: ~62 px.`,
    `Portrait source artboard (900×1350): boxes exactly ${pt.box.widthPx}×${pt.box.heightPx} px, centre X ${pt.box.centerXPct}%.`,
    `Portrait box centre Y: ${pt.zones.map((z) => `${z.letter} ${z.centerYPct}%`).join("; ")}.`,
    "All four boxes MUST be identical in size and align with the runtime overlay.",
    "Do NOT draw concept-card answer text inside the image.",
  ];
}

/**
 * Image-generation contract — marker letters + reserved blank space only (no printed rectangles).
 * Uses canonical geometry for marker Y positions and overlay reservation size.
 * @param {TtiBoxGeometryVersion} [version]
 * @returns {string[]}
 */
function formatTtiImageMarkerContractLines(version = V1) {
  const root = getTtiBoxGeometrySpec(version);
  const sq = root.squareDisplay;
  const pt = root.portrait;
  return [
    `Canonical marker placement version: ${version === LEGACY ? "legacy (pre-v1 assets)" : spec.version}.`,
    `Student display artboard: ${spec.displayArtboard.width}×${spec.displayArtboard.height} px (.display.png).`,
    `Marker centre X on 600×600 display: ${sq.box.centerXPx} px (${sq.box.centerXPct}%).`,
    `Marker centre Y (A/B/C/D) on 600×600 display: ${sq.zones.map((z) => `${z.letter} ${z.centerYPx} px (${z.centerYPct}%)`).join("; ")}.`,
    `At each marker, reserve clean blank white space ${sq.box.widthPx}×${sq.box.heightPx} px for the app runtime overlay — do NOT draw a rectangle or border around it.`,
    `Minimum vertical gap between reserved overlay areas on 600×600 display: ~62 px.`,
    `Portrait source artboard (900×1350): marker centre X ${pt.box.centerXPct}%; marker Y: ${pt.zones.map((z) => `${z.letter} ${z.centerYPct}%`).join("; ")}.`,
    `Reserved overlay area per marker on portrait artboard: ${pt.box.widthPx}×${pt.box.heightPx} px of empty white space beside each marker letter.`,
    "The application draws all drop-zone rectangles, dotted overlays, and placed concept cards at runtime.",
    "Do NOT draw concept-card answer text inside the image.",
  ];
}

module.exports = {
  TTI_BOX_GEOMETRY_V1: spec,
  TTI_BOX_GEOMETRY_VERSION_V1: V1,
  TTI_BOX_GEOMETRY_VERSION_LEGACY: LEGACY,
  normalizeTtiBoxGeometryVersion,
  getTtiBoxGeometrySpec,
  getTtiBoxGeometryLayout,
  formatTtiBoxGeometryContractLines,
  formatTtiImageMarkerContractLines,
};
