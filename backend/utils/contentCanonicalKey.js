/**
 * Content Graph: Canonical key helpers for deterministic node identity.
 * Used by contentGraphService for upserts.
 */
const mongoose = require("mongoose");

/** Format ObjectId for canonical key (handles string or ObjectId). */
function toIdStr(val) {
  if (!val) return "";
  if (mongoose.Types.ObjectId.isValid(val)) return String(val);
  return String(val);
}

/** Taxonomy node: taxonomy:specKey:topicKey. */
function taxonomyCanonicalKey(specKey, topicKey) {
  const s = (specKey || "").trim();
  const t = (topicKey || "").trim();
  if (!s || !t) return "";
  return `taxonomy:${s}:${t}`;
}

/** Lesson node: lesson:<lessonId>. */
function lessonCanonicalKey(lessonId) {
  const id = toIdStr(lessonId);
  return id ? `lesson:${id}` : "";
}

/** Flashcard node: flashcard:<flashcardId>. */
function flashcardCanonicalKey(flashcardId) {
  const id = toIdStr(flashcardId);
  return id ? `flashcard:${id}` : "";
}

/** Exam question node: examQuestion:<questionId>. */
function examQuestionCanonicalKey(questionId) {
  const id = toIdStr(questionId);
  return id ? `examQuestion:${id}` : "";
}

/** Quiz question node: quizQuestion:<questionId>. */
function quizQuestionCanonicalKey(questionId) {
  const id = toIdStr(questionId);
  return id ? `quizQuestion:${id}` : "";
}

module.exports = {
  taxonomyCanonicalKey,
  lessonCanonicalKey,
  flashcardCanonicalKey,
  examQuestionCanonicalKey,
  quizQuestionCanonicalKey,
  toIdStr,
};
