"use strict";

/**
 * Quiz Topic Grounding V1 — Synthesiser / import ingestion filter (no repair, no padding).
 * AUTHOR → VALIDATE/FILTER → SAVE
 */

const {
  filterQuizQuestionsByTopicGrounding,
  buildGroundingContext,
} = require("./quizTopicGrounding");

const SYNTHESISER_SOURCE = "letsrevise-lesson-synthesiser";
const SYNTHESISER_GENERATOR = "lesson-synthesiser-v1";

function normalizeStemForSync(q) {
  return String(q?.question || q?.prompt || q?.stem || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Reliable Synthesiser provenance — metadata.synthesiser set by API adapter or JSON import.
 */
function isSynthesiserLessonProvenance(doc) {
  const syn = doc?.metadata?.synthesiser;
  if (!syn || typeof syn !== "object") return false;
  const source = String(syn.source || "").trim();
  const generator = String(syn.generator || "").trim();
  return source === SYNTHESISER_SOURCE || generator === SYNTHESISER_GENERATOR;
}

function syncPageQuizBlocksToFilteredQuiz(pages, keptStems) {
  if (!Array.isArray(pages) || !keptStems) return;
  for (const page of pages) {
    for (const block of page?.blocks || []) {
      if (block?.type !== "pageQuiz" || !Array.isArray(block.questions)) continue;
      block.questions = block.questions.filter((q) => {
        const stem = normalizeStemForSync(q);
        return stem && keptStems.has(stem);
      });
    }
  }
}

/**
 * Filter lesson.quiz.questions and mirror the same kept stems on pageQuiz blocks.
 * Does not invoke repair, stem packs, or count padding.
 *
 * @param {object} doc - lesson create/save document (mutated in place)
 * @param {object} [opts] - optional overrides for grounding context
 * @returns {{ groundingApplied: boolean, groundingLimited?: boolean, groundingRemovedCount?: number, profileKey?: string|null }}
 */
function groundLessonQuizBeforePersist(doc, opts = {}) {
  const questions = Array.isArray(doc?.quiz?.questions) ? doc.quiz.questions : [];
  if (!questions.length) {
    return { groundingApplied: false, groundingRemovedCount: 0 };
  }

  const ctx = buildGroundingContext({
    topicKey: opts.topicKey ?? doc.topicKey,
    specKey: opts.specKey ?? doc.specKey,
    topic: opts.topic ?? doc.topic ?? doc.title,
    pages: opts.pages ?? doc.pages,
    vocabulary: opts.vocabulary ?? doc.metadata?.contentKeywords,
    objectives: opts.objectives,
  });

  const filtered = filterQuizQuestionsByTopicGrounding(questions, ctx);
  const keptStems = new Set(
    filtered.questions.map((q) => normalizeStemForSync(q)).filter(Boolean)
  );

  if (!doc.quiz || typeof doc.quiz !== "object") {
    doc.quiz = { timeSeconds: 600, questions: [] };
  }
  doc.quiz.questions = filtered.questions;
  syncPageQuizBlocksToFilteredQuiz(doc.pages, keptStems);

  return {
    groundingApplied: true,
    groundingLimited: filtered.groundingLimited === true,
    groundingRemovedCount: filtered.removed.length,
    profileKey: filtered.profileKey || null,
  };
}

module.exports = {
  SYNTHESISER_SOURCE,
  SYNTHESISER_GENERATOR,
  isSynthesiserLessonProvenance,
  groundLessonQuizBeforePersist,
  syncPageQuizBlocksToFilteredQuiz,
  normalizeStemForSync,
};
