/**
 * PR8: Diagram suggestions for a lesson (read-only). Used by GET /lessons/:id/diagram-suggestions.
 */
const VisualModel = require("../models/VisualModel");
const { findDefaultCellVisual } = require("./defaultCellVisual");
const { topicToKey } = require("./topicTaxonomy");

/** TopicKey → VisualModel conceptKeys (must match ai.js BIOLOGY_DIAGRAM_MAP). */
const BIOLOGY_DIAGRAM_MAP = {
  "cell-structure": ["cell-animal", "cell-plant"],
  "animal-plant-cells": ["cell-animal", "cell-plant"],
  enzymes: ["enzyme-lock-key"],
  "digestive-system": ["digestive-system-organs"],
  photosynthesis: ["photosynthesis"],
  respiration: ["respiration"],
  "transport-in-plants": ["transport-plants"],
  "transport-summary": ["transport-plants"],
  "circulatory-system": ["circulatory-system"],
  heart: ["circulatory-system"],
  "nervous-system": ["nervous-system"],
  "nervous-system-structure": ["nervous-system"],
  homeostasis: ["homeostasis"],
  ecology: ["ecology-pyramid"],
  evolution: ["evolution-tree"],
};

function tokensFromTopic(topic) {
  if (!topic || typeof topic !== "string") return [];
  return topic
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((s) => s.length > 2);
}

function toSuggestionRow(doc) {
  const firstVariant = Array.isArray(doc.variants) && doc.variants[0] ? doc.variants[0] : null;
  return {
    id: String(doc._id),
    conceptKey: doc.conceptKey || "",
    title: doc.topic || doc.conceptKey || "",
    subject: doc.subject || "Biology",
    level: firstVariant?.level ?? undefined,
    examBoard: undefined,
    imageUrl: firstVariant?.src ?? undefined,
    isPublished: !!doc.isPublished,
  };
}

/**
 * Get diagram suggestions for a lesson (deterministic).
 * @param {Object} lesson - Lesson with topic, topicKey (optional), etc.
 * @param {{ limit?: number }} options - limit default 8
 * @returns {Promise<{ topicKey: string, topic: string, suggestions: Array }>}
 */
async function getDiagramSuggestionsForLesson(lesson, { limit = 8 } = {}) {
  const topic = lesson?.topic ? String(lesson.topic).trim() : "";
  const topicKey = (lesson?.topicKey && String(lesson.topicKey).trim()) || topicToKey(topic);
  const conceptKeys = topicKey ? BIOLOGY_DIAGRAM_MAP[topicKey.toLowerCase()] : undefined;

  const suggestions = [];
  const seenIds = new Set();

  if (Array.isArray(conceptKeys) && conceptKeys.length > 0) {
    const docs = await VisualModel.find({
      conceptKey: { $in: conceptKeys },
      isPublished: true,
    })
      .select("_id conceptKey topic subject variants isPublished")
      .lean();
    for (const key of conceptKeys) {
      const doc = docs.find((d) => String(d.conceptKey).toLowerCase() === String(key).toLowerCase());
      if (doc && !seenIds.has(String(doc._id))) {
        seenIds.add(String(doc._id));
        suggestions.push(toSuggestionRow(doc));
      }
    }
  }

  if (suggestions.length < limit) {
    const tokens = tokensFromTopic(topic).slice(0, 3);
    if (tokens.length > 0) {
      const orConditions = tokens.flatMap((t) => [
        { conceptKey: new RegExp(escapeRegex(t), "i") },
        { topic: new RegExp(escapeRegex(t), "i") },
      ]);
      const fallback = await VisualModel.find({
        subject: "Biology",
        isPublished: true,
        $or: orConditions,
      })
        .select("_id conceptKey topic subject variants isPublished")
        .sort({ topic: 1 })
        .limit(limit - suggestions.length)
        .lean();
      for (const doc of fallback) {
        if (seenIds.has(String(doc._id))) continue;
        seenIds.add(String(doc._id));
        suggestions.push(toSuggestionRow(doc));
        if (suggestions.length >= limit) break;
      }
    }
  }

  // When still empty for Biology, return at least one option (default cell) so "Load suggestions" is never blank
  const isBiology = (lesson?.subject || "").toLowerCase() === "biology";
  if (suggestions.length === 0 && isBiology) {
    const defaultDoc = await findDefaultCellVisual();
    if (defaultDoc && !seenIds.has(String(defaultDoc._id))) {
      suggestions.push(toSuggestionRow(defaultDoc));
    }
  }

  return {
    topicKey: topicKey || "",
    topic: topic || "",
    suggestions: suggestions.slice(0, limit),
  };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  getDiagramSuggestionsForLesson,
  BIOLOGY_DIAGRAM_MAP,
};
