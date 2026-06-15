/**
 * P2.1 — Diagram Asset Library feature flag.
 * Default OFF — set DIAGRAM_ASSET_LIBRARY=1 to enable prototype routes.
 */

function isDiagramAssetLibraryEnabled() {
  return String(process.env.DIAGRAM_ASSET_LIBRARY || "0").trim() === "1";
}

module.exports = {
  isDiagramAssetLibraryEnabled,
};
