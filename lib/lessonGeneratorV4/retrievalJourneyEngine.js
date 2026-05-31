/**
 * Retrieval journey engine — spiral retrieval across concepts.
 */

const {
  flattenPagesToBlocks,
  blockHaystack,
  normalizeHaystack,
  inferConceptFromBlock,
} = require("./blockText");

/**
 * @param {object[]} pages
 * @param {object} [blueprint]
 */
function analyzeRetrievalJourney(pages, blueprint = {}) {
  const blocks = flattenPagesToBlocks(pages);
  const checkpoints = [];

  const fullLessonHay = normalizeHaystack(blocks.map((b) => blockHaystack(b)).join(" "));

  blocks.forEach((block, index) => {
    const type = String(block.type || "").toLowerCase();
    if (type !== "checkpoint" && String(block.role || "").toLowerCase() !== "checkpoint") return;
    const hay = blockHaystack(block) || fullLessonHay;
    let concepts = detectConceptsInText(hay, blueprint);
    if (!concepts.length && blueprint.concepts?.length) {
      concepts = [blueprint.concepts[checkpoints.length % blueprint.concepts.length].id];
    }
    checkpoints.push({ index, concepts, hay });
  });

  const spiralSteps = [];
  const seenConcepts = new Set();
  let progressionScore = 0;
  let isolatedCount = 0;

  checkpoints.forEach((cp, i) => {
    const newConcepts = cp.concepts.filter((c) => !seenConcepts.has(c));
    const cumulative = [...seenConcepts, ...newConcepts];
    cp.concepts.forEach((c) => seenConcepts.add(c));
    const isIsolated = i > 0 && newConcepts.length === 1 && cumulative.length === newConcepts.length;
    if (isIsolated) isolatedCount++;
    const buildsOnPrior =
      i > 0 && cp.concepts.some((c) => checkpoints[i - 1].concepts.includes(c));
    if (buildsOnPrior || cumulative.length > cp.concepts.length) progressionScore += 20;

    spiralSteps.push({
      checkpoint: i + 1,
      concepts: cp.concepts,
      cumulativeConcepts: [...cumulative],
      buildsOnPrior,
      isolated: isIsolated,
    });
  });

  const conceptIds = (blueprint.concepts || []).map((c) => c.id);
  const covered = new Set();
  checkpoints.forEach((cp) => cp.concepts.forEach((c) => covered.add(c)));
  const underCovered = conceptIds.filter((id) => !covered.has(id));

  const spacing =
    checkpoints.length < 2
      ? 0
      : checkpoints
          .slice(1)
          .map((cp, i) => cp.index - checkpoints[i].index)
          .reduce((a, b) => a + b, 0) /
        (checkpoints.length - 1);

  const gaps = [];
  if (checkpoints.length < 3) gaps.push("Too few checkpoints for spiral retrieval");
  if (isolatedCount > checkpoints.length / 2) gaps.push("Checkpoints feel isolated, not spiralling");
  if (underCovered.length) gaps.push(`Concepts not retrieved: ${underCovered.join(", ")}`);

  const retrievalJourneyScore = Math.min(
    100,
    Math.round(
      Math.min(checkpoints.length * 18, 50) +
        progressionScore +
        (checkpoints.length >= 3 ? 25 : 0) +
        (spacing <= 12 && spacing >= 1 ? 15 : 8) -
        isolatedCount * 6
    )
  );

  return {
    spiralSteps,
    retrievalProgression: progressionScore,
    retrievalSpacing: Math.round(spacing * 10) / 10,
    retrievalCoverage: conceptIds.length
      ? Math.round((covered.size / conceptIds.length) * 100)
      : checkpoints.length > 0
        ? 70
        : 0,
    underCovered,
    gaps,
    retrievalJourneyScore,
  };
}

function detectConceptsInText(hay, blueprint) {
  const found = [];
  for (const c of blueprint.concepts || []) {
    const name = String(c.name || "").toLowerCase();
    const id = c.id;
    if (name && hay.includes(name.split(" ")[0])) found.push(id);
    else if (hay.includes(id.replace(/_/g, " "))) found.push(id);
  }
  if (!found.length) {
    const single = inferConceptFromBlock({ content: hay });
    if (single) found.push(single);
  }
  return [...new Set(found)];
}

module.exports = {
  analyzeRetrievalJourney,
};
