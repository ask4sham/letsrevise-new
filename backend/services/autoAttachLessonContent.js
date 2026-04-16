/**
 * Auto-attach starter content (flashcards, lesson quiz) when a lesson has topicKey.
 * Bank-first, fill-only-when-empty, deterministic selection (seed = lessonId).
 * Draft-first: attached content is draft/for review; does not auto-publish.
 */
const Lesson = require("../models/Lesson");
const TopicFlashcard = require("../models/TopicFlashcard");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const { topicToKey } = require("../utils/topicTaxonomy");
const { parseTopicKey, queryCandidates, DEFAULT_SPEC_LEGACY, buildTopicKey } = require("../utils/topicKey");
const { resolveQuestionBankNamespacedTopicKey } = require("../utils/resolveTopicRuntimeKeys");
const { fetchTopicFlashcardsForSeed } = require("../utils/seedLessonFlashcardsFromTopic");

const FLASHCARD_LIMIT = 20;
const QUIZ_MCQ_TARGET = 10;
const QUIZ_SHORT_TARGET = 5;

/**
 * Deterministic hash for seeding (string -> number).
 * @param {string} s
 * @returns {number}
 */
function hashString(s) {
  if (!s || typeof s !== "string") return 0;
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/**
 * Deterministic order: sort array by hash(seed + itemId), then take first limit.
 * @param {Array<{ _id: any }>} items
 * @param {string} seed
 * @param {number} limit
 * @returns {Array}
 */
function deterministicTake(items, seed, limit) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const withScore = items.map((item) => ({
    item,
    score: hashString(seed + String(item._id != null ? item._id : item.id)),
  }));
  withScore.sort((a, b) => a.score - b.score);
  return withScore.slice(0, limit).map((x) => x.item);
}

/**
 * @param {Object} opts
 * @param {string} opts.lessonId
 * @param {string} [opts.topicKey] - optional override (otherwise from lesson)
 * @param {ObjectId|string} [opts.userId] - for permission (caller must be owner/admin; service assumes checked)
 * @returns {Promise<{ ok: boolean; lessonId: string; topicKey: string; results: { flashcardsAttached: number; quizAttached: number }; lesson: Object }>}
 */
async function autoAttachLessonContent({ lessonId, topicKey: topicKeyOverride, userId }) {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw Object.assign(new Error("Lesson not found"), { statusCode: 404 });

  const topicKey =
    (topicKeyOverride && String(topicKeyOverride).trim()) ||
    (lesson.topicKey && String(lesson.topicKey).trim()) ||
    (lesson.topic && topicToKey(lesson.topic)) ||
    "";

  const results = { flashcardsAttached: 0, quizAttached: 0 };

  if (!topicKey) {
    return {
      ok: true,
      lessonId: String(lesson._id),
      topicKey: "",
      results,
      lesson: lesson.toObject ? lesson.toObject() : lesson,
    };
  }

  const seed = String(lessonId);
  const ownerId = lesson.teacherId || lesson.createdBy;
  const specKey =
    (lesson.specKey && String(lesson.specKey).trim()) ||
    parseTopicKey(topicKey).specKey ||
    DEFAULT_SPEC_LEGACY;
  const topicOnly = parseTopicKey(topicKey).topicKey || topicKey.trim().toLowerCase();
  const namespaced = topicKey.includes(":") ? topicKey.trim() : buildTopicKey(specKey, topicOnly);
  const bankNs = resolveQuestionBankNamespacedTopicKey(specKey, namespaced);
  const bankParsed = parseTopicKey(bankNs);
  const bankSpec = bankParsed.specKey || specKey;
  const bankTopicOnly = bankParsed.topicKey || topicOnly;
  const candidates = queryCandidates(bankSpec, bankTopicOnly);
  const topicQuery = candidates.length ? { $in: candidates } : bankNs;

  // 1) Flashcards: only if lesson has none
  const existingFlashcards = Array.isArray(lesson.flashcards) ? lesson.flashcards : [];
  if (existingFlashcards.length === 0) {
    try {
      const bankCards = await fetchTopicFlashcardsForSeed(ownerId, bankNs, 50, {
        publishedOnly: true,
        specKey: bankSpec,
      });
      const selected = deterministicTake(bankCards, seed + "flash", FLASHCARD_LIMIT);
      if (selected.length > 0) {
        lesson.flashcards = selected.map((c) => ({
          id: c.id || String(c._id),
          front: c.front || "",
          back: c.back || "",
          difficulty: 1,
          tags: [],
        }));
        results.flashcardsAttached = lesson.flashcards.length;
      }
    } catch (e) {
      console.warn("[autoAttachLessonContent] Flashcards failed:", e?.message || e);
    }
  }

  // 2) Quiz: only if lesson.quiz.questions is empty
  const existingQuiz = lesson.quiz && Array.isArray(lesson.quiz.questions) ? lesson.quiz.questions : [];
  if (existingQuiz.length === 0) {
    try {
      const bankQuestions = await TopicQuizQuestion.find({
        ownerId,
        topicKey: topicQuery,
        kind: "quiz",
        status: "published",
      })
        .lean();

      const mcq = bankQuestions.filter((q) => (q.type || "mcq") === "mcq");
      const short = bankQuestions.filter((q) => (q.type || "mcq") === "short-answer");
      const selectedMcq = deterministicTake(mcq, seed + "mcq", QUIZ_MCQ_TARGET);
      const selectedShort = deterministicTake(short, seed + "short", QUIZ_SHORT_TARGET);

      const toLessonQuestion = (q, i, prefix) => {
        const choices = Array.isArray(q.choices) ? q.choices : [];
        const correctIndex = Math.min(
          Math.max(0, Number(q.correctIndex)),
          Math.max(0, choices.length - 1)
        );
        const correctAnswer = choices[correctIndex] || "";
        const type = (q.type || "mcq") === "short-answer" ? "short" : "mcq";
        return {
          id: `${prefix}_${i}`,
          type,
          question: q.questionText || "",
          options: type === "mcq" ? choices : undefined,
          correctAnswer: type === "mcq" ? correctAnswer : (q.acceptableAnswers && q.acceptableAnswers[0]) || "",
          explanation: q.explanation || "",
          tags: Array.isArray(q.tags) ? q.tags : [],
          difficulty: 1,
          marks: 1,
        };
      };

      const questions = [
        ...selectedMcq.map((q, i) => toLessonQuestion(q, i, "q_mcq")),
        ...selectedShort.map((q, i) => toLessonQuestion(q, i, "q_short")),
      ];

      if (questions.length > 0) {
        if (!lesson.quiz || typeof lesson.quiz !== "object") {
          lesson.quiz = { timeSeconds: 600, questions: [] };
        }
        lesson.quiz.questions = questions;
        lesson.markModified("quiz");
        results.quizAttached = questions.length;
      }
    } catch (e) {
      console.warn("[autoAttachLessonContent] Quiz failed:", e?.message || e);
    }
  }

  await lesson.save();
  const updated = await Lesson.findById(lessonId).lean();

  return {
    ok: true,
    lessonId: String(lesson._id),
    topicKey,
    results,
    lesson: updated,
  };
}

module.exports = { autoAttachLessonContent };
