/**
 * Activity spacing — concept distance between teaching, retrieval, and activities.
 */

const {
  flattenPagesToBlocks,
  isTeachBlock,
  isInteractionBlock,
  inferConceptFromBlock,
  ACTIVITY_TYPES,
} = require("./lessonBlockAnalysis");

const DEFAULT_MAX_DISTANCE = 4;

/**
 * @param {object[]} pages
 * @param {{ maxDistance?: number }} [opts]
 */
function analyzeActivitySpacing(pages, opts = {}) {
  const maxDistance = opts.maxDistance ?? DEFAULT_MAX_DISTANCE;
  const blocks = flattenPagesToBlocks(pages);
  const warnings = [];
  const distances = [];

  const teachByConcept = Object.create(null);

  blocks.forEach((block, index) => {
    if (!isTeachBlock(block)) return;
    const concept = inferConceptFromBlock(block);
    if (!concept) return;
    if (teachByConcept[concept] == null) teachByConcept[concept] = index;
  });

  blocks.forEach((block, index) => {
    const type = String(block.type || "").toLowerCase();
    const isActivity = ACTIVITY_TYPES.has(type);
    const isCheck = type === "checkpoint" || String(block.role || "").toLowerCase() === "checkpoint";
    if (!isActivity && !isCheck) return;

    const concept = inferConceptFromBlock(block);
    if (!concept || teachByConcept[concept] == null) return;

    const teachIndex = teachByConcept[concept];
    const conceptDistance = index - teachIndex;
    const kind = isActivity ? "firstActivity" : "firstRetrieval";

    distances.push({
      concept,
      conceptDistance,
      teachBlockIndex: teachIndex,
      interactionBlockIndex: index,
      kind,
    });

    if (conceptDistance > maxDistance) {
      warnings.push({
        concept,
        conceptDistance,
        teachBlockIndex: teachIndex,
        interactionBlockIndex: index,
        message: `${kind} for "${concept}" is ${conceptDistance} blocks after teaching (max ${maxDistance})`,
      });
    }
  });

  return {
    distances,
    warnings,
    valid: warnings.length === 0,
    maxDistance,
  };
}

/**
 * @param {object[]} pages
 */
function scoreActivityPlacement(pages) {
  const analysis = analyzeActivitySpacing(pages);
  if (!analysis.distances.length) return 50;
  const avg =
    analysis.distances.reduce((s, d) => s + Math.min(d.conceptDistance, DEFAULT_MAX_DISTANCE), 0) /
    analysis.distances.length;
  const penalty = analysis.warnings.length * 12;
  return Math.max(0, Math.min(100, Math.round(100 - avg * 8 - penalty)));
}

module.exports = {
  DEFAULT_MAX_DISTANCE,
  analyzeActivitySpacing,
  scoreActivityPlacement,
};
