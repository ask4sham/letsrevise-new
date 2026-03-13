/**
 * PR-EDGE-1: Orchestrator for auto-generating lesson content from topic banks.
 * Calls flashcards, quiz, assessment, past papers generators in sequence (published-only, replace semantics).
 * Does not throw on missing topicKey — returns 0 counts.
 * PR-CHEM-3: Pass specKey into flashcard seed so query supports namespaced + legacy.
 */
const Lesson = require("../models/Lesson");
const { topicToKey } = require("../utils/topicTaxonomy");
const { parseTopicKey, DEFAULT_SPEC_LEGACY } = require("../utils/topicKey");
const { fetchTopicFlashcardsForSeed } = require("../utils/seedLessonFlashcardsFromTopic");
const { generateLessonQuizFromTopic } = require("../services/generateLessonQuizFromTopic");
const { generateLessonAssessmentFromTopic } = require("../services/generateLessonAssessmentFromTopic");
const { generateLessonPastPapersFromTopic } = require("../services/generateLessonPastPapersFromTopic");

/**
 * @param {Object} opts
 * @param {string} opts.lessonId
 * @param {ObjectId|string} opts.userId - for permission check (caller must be owner/admin; service assumes already checked)
 * @param {string} [opts.mode="all"] - reserved for future use (e.g. "flashcardsOnly")
 * @returns {Promise<{ ok: boolean; lessonId: string; topicKey: string; results: Object; lesson: Object }>}
 */
async function autoGenerateLessonFromBanks({ lessonId, userId, mode = "all" }) {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw Object.assign(new Error("Lesson not found"), { statusCode: 404 });

  const topicKey =
    (lesson.topicKey && String(lesson.topicKey).trim()) ||
    (lesson.topic && topicToKey(lesson.topic)) ||
    "";

  const results = {
    flashcardsAdded: 0,
    quizAdded: 0,
    assessmentAdded: 0,
    pastPapersAdded: 0,
  };

  if (!topicKey) {
    return {
      ok: true,
      lessonId: String(lesson._id),
      topicKey: "",
      results,
      lesson: lesson.toObject ? lesson.toObject() : lesson,
    };
  }

  // Flashcards
  try {
    const specKey = (lesson.specKey && String(lesson.specKey).trim()) || parseTopicKey(topicKey).specKey || DEFAULT_SPEC_LEGACY;
    const bankCards = await fetchTopicFlashcardsForSeed(lesson.teacherId, topicKey, 20, { publishedOnly: true, specKey });
    lesson.flashcards = bankCards;
    await lesson.save();
    results.flashcardsAdded = bankCards.length;
  } catch (e) {
    console.warn("[autoGenerateLessonFromBanks] Flashcards failed:", e?.message || e);
  }

  // Quiz
  try {
    const qRes = await generateLessonQuizFromTopic({ lessonId, userId, opts: { publishedOnly: true } });
    results.quizAdded = qRes.addedCount || 0;
  } catch (e) {
    console.warn("[autoGenerateLessonFromBanks] Quiz failed:", e?.message || e);
  }

  // Assessment
  try {
    const aRes = await generateLessonAssessmentFromTopic({ lessonId, userId });
    results.assessmentAdded = aRes.addedCount || 0;
  } catch (e) {
    console.warn("[autoGenerateLessonFromBanks] Assessment failed:", e?.message || e);
  }

  // Past papers
  try {
    const ppRes = await generateLessonPastPapersFromTopic({ lessonId, userId });
    results.pastPapersAdded = ppRes.addedCount || 0;
  } catch (e) {
    console.warn("[autoGenerateLessonFromBanks] Past papers failed:", e?.message || e);
  }

  const updated = await Lesson.findById(lessonId).lean();
  return {
    ok: true,
    lessonId: String(lesson._id),
    topicKey,
    results,
    lesson: updated,
  };
}

module.exports = { autoGenerateLessonFromBanks };
