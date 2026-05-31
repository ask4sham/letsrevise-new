/**
 * Shared text helpers for V4 teaching intelligence (read-only analysis).
 */

const { flattenPagesToBlocks, blockHaystack, inferConceptFromBlock } = require("../lessonBlockAnalysis");

function stripHtml(t) {
  return String(t || "").replace(/<[^>]+>/g, " ");
}

/** Normalise curated export quirks (truncation, mojibake arrows). */
function normalizeHaystack(hay) {
  return String(hay || "")
    .replace(/ÔåÆ|â†'|→/gi, "→")
    .replace(/ÔÇÖ|â€™/g, "'")
    .replace(/ÔÇ£|ÔÇ/g, '"')
    .toLowerCase();
}

function blockHaystackNormalized(block) {
  return normalizeHaystack(blockHaystack(block));
}

function wordCount(t) {
  return stripHtml(t).split(/\s+/).filter(Boolean).length;
}

function hasPattern(hay, patterns) {
  return patterns.some((p) => (typeof p === "string" ? hay.includes(p) : p.test(hay)));
}

module.exports = {
  flattenPagesToBlocks,
  blockHaystack,
  blockHaystackNormalized,
  normalizeHaystack,
  inferConceptFromBlock,
  stripHtml,
  wordCount,
  hasPattern,
};
