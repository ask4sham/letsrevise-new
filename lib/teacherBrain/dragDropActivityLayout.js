/**
 * Resolve drag-drop activity layout for Teacher Brain briefs.
 * Mirrors frontend `resolveDragDropPersistMode` without importing TS.
 */

function safeStr(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}

function isTextToImageModeToken(s) {
  const t = String(s).trim().toLowerCase().replace(/[\s_]+/g, "-");
  return t === "text-to-image" || t === "texttoimage" || t === "text-image";
}

function parseDragDropMatchMode(raw) {
  if (raw == null) return undefined;
  const s = String(raw).trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (s === "diagram") return "diagram";
  if (s === "text" || s === "standard") return "text";
  if (isTextToImageModeToken(s)) return "text-to-image";
  return undefined;
}

function readDragDropMatchModeFromBlock(block) {
  const activityLayout = block?.activityLayout ?? block?.activity_layout;
  if (activityLayout != null && safeStr(activityLayout)) return activityLayout;
  const layout = block?.dragDropLayout ?? block?.drag_drop_layout;
  if (layout != null && safeStr(layout)) return layout;
  return block?.matchMode ?? block?.match_mode;
}

function shouldLogLayout() {
  return (
    process.env.TEACHER_BRAIN_INJECTION_LOG === "1" ||
    (typeof process !== "undefined" && process.env?.NODE_ENV !== "production")
  );
}

/** @alias resolveDragDropActivityLayout */
function detectDragDropActivityLayout(block) {
  return resolveDragDropActivityLayout(block);
}

function readPairTargetImageUrl(row) {
  const v = row?.imageUrl ?? row?.image_url;
  return safeStr(v);
}

function hasDiagramInferenceSignals(block) {
  const img = safeStr(block?.imageUrl);
  const dz = Array.isArray(block?.dropZones) ? block.dropZones : [];
  return (
    img.length > 0 &&
    dz.some((z) => z && typeof z === "object" && safeStr(z.correctPairId))
  );
}

/**
 * @param {object} block
 * @returns {"textMatch"|"textToImage"|"imageDropZones"}
 */
function resolveDragDropActivityLayout(block) {
  const direct = parseDragDropMatchMode(readDragDropMatchModeFromBlock(block));
  let resolved = "textMatch";
  if (direct === "text-to-image") resolved = "textToImage";
  else if (direct === "diagram") resolved = "imageDropZones";
  else if (direct === "text") resolved = "textMatch";
  else {
    const pairs = Array.isArray(block?.pairs) ? block.pairs : [];
    if (pairs.some((p) => readPairTargetImageUrl(p))) resolved = "textToImage";
    else if (hasDiagramInferenceSignals(block)) resolved = "imageDropZones";
  }

  if (shouldLogLayout()) {
    console.log("[TeacherBrainLayout] detectDragDropActivityLayout", {
      activityLayout: block?.activityLayout ?? block?.activity_layout,
      dragDropLayout: block?.dragDropLayout ?? block?.drag_drop_layout,
      matchMode: block?.matchMode ?? block?.match_mode,
      resolved,
    });
  }

  return resolved;
}

module.exports = {
  resolveDragDropActivityLayout,
  detectDragDropActivityLayout,
  parseDragDropMatchMode,
};
