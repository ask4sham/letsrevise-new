/**
 * PR-Q2: Generate quiz from Topic Quiz Bank into lesson (published-only, replace).
 * PR-CHEM-3: Query by topicKey $in(namespaced, legacy).
 */
const Lesson = require("../models/Lesson");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const { topicToKey } = require("../utils/topicTaxonomy");
const { parseTopicKey, queryCandidates, DEFAULT_SPEC_LEGACY, buildTopicKey } = require("../utils/topicKey");
const { resolveQuestionBankNamespacedTopicKey } = require("../utils/resolveTopicRuntimeKeys");

/**
 * @param {Object} opts
 * @param {string} opts.lessonId
 * @param {ObjectId|string} opts.userId - for permission check (caller must be owner/admin)
 * @param {Object} [opts.options] - { publishedOnly: true } (always true)
 * @returns {Promise<{ addedCount: number; questionsCount: number; lesson: Object }>}
 */
async function generateLessonQuizFromTopic({ lessonId, userId, opts = {} }) {
  const publishedOnly = opts.publishedOnly !== false;

  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw Object.assign(new Error("Lesson not found"), { statusCode: 404 });

  const topicKey =
    (lesson.topicKey && String(lesson.topicKey).trim()) ||
    (lesson.topic && topicToKey(lesson.topic)) ||
    "";
  if (!topicKey) {
    throw Object.assign(new Error("Lesson has no topicKey; cannot generate quiz."), { statusCode: 400 });
  }

  const ownerId = lesson.teacherId || lesson.createdBy;
  const specKey = (lesson.specKey && String(lesson.specKey).trim()) || parseTopicKey(topicKey).specKey || DEFAULT_SPEC_LEGACY;
  const topicOnly = parseTopicKey(topicKey).topicKey || topicKey.trim().toLowerCase();
  const namespaced = topicKey.includes(":") ? topicKey.trim() : buildTopicKey(specKey, topicOnly);
  const bankNs = resolveQuestionBankNamespacedTopicKey(specKey, namespaced);
  const bankParsed = parseTopicKey(bankNs);
  const bankSpec = bankParsed.specKey || specKey;
  const bankTopicOnly = bankParsed.topicKey || topicOnly;
  const candidates = queryCandidates(bankSpec, bankTopicOnly);

  const bankQuestions = await TopicQuizQuestion.find({
    ownerId,
    topicKey: candidates.length ? { $in: candidates } : bankNs,
    kind: "quiz",
    status: publishedOnly ? "published" : { $in: ["draft", "published"] },
  })
    .sort({ createdAt: 1 })
    .lean();

  /** General lesson-level quiz (not page-scoped). Student view: END bucket on multi-page; matches Edit merge. */
  const END_OF_LESSON_PAGE_ID = "END";

  const questions = bankQuestions.map((q, i) => {
    const choices = Array.isArray(q.choices) ? q.choices : [];
    const correctIndex = Math.min(Math.max(0, Number(q.correctIndex)), Math.max(0, choices.length - 1));
    const correctAnswer = choices[correctIndex] || "";
    return {
      id: `q_${Date.now()}_${i}`,
      type: "mcq",
      question: q.questionText || "",
      options: choices,
      correctAnswer,
      explanation: q.explanation || "",
      tags: Array.isArray(q.tags) ? q.tags : [],
      difficulty: 1,
      marks: 1,
      pageId: END_OF_LESSON_PAGE_ID,
    };
  });

  if (!lesson.quiz || typeof lesson.quiz !== "object") {
    lesson.quiz = { timeSeconds: 600, questions: [] };
  }
  lesson.quiz.questions = questions;
  lesson.markModified("quiz");
  await lesson.save();

  return {
    addedCount: questions.length,
    questionsCount: questions.length,
    lesson: lesson.toObject ? lesson.toObject() : lesson,
  };
}

module.exports = { generateLessonQuizFromTopic };
