/**
 * Default "cell" VisualModel for Biology when no topic mapping exists.
 * Used by: AI lesson generation fallback, diagram suggestions (Load suggestions).
 * DB lookup only — no env vars — works everywhere.
 */
const VisualModel = require("../models/VisualModel");

/**
 * @returns {Promise<string|null>} VisualModel._id as string, or null
 */
async function findDefaultCellVisualId() {
  const visual =
    (await VisualModel.findOne({ topic: /cell/i, isPublished: true }).lean()) ||
    (await VisualModel.findOne({ conceptKey: /cell/i, isPublished: true }).lean());
  return visual?._id?.toString() || null;
}

/**
 * @returns {Promise<Object|null>} Full visual doc for toSuggestionRow, or null
 */
async function findDefaultCellVisual() {
  const visual =
    (await VisualModel.findOne({ topic: /cell/i, isPublished: true }).lean()) ||
    (await VisualModel.findOne({ conceptKey: /cell/i, isPublished: true }).lean());
  return visual || null;
}

module.exports = {
  findDefaultCellVisualId,
  findDefaultCellVisual,
};
