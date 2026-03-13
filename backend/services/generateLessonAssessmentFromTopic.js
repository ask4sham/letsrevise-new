/**
 * PR-A1: Generate assessment from Topic Quiz Bank (kind=assessment) into lesson (published-only, replace).
 * PR-CHEM-3: Query by topicKey $in(namespaced, legacy).
 */
const Lesson = require("../models/Lesson");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const { topicToKey } = require("../utils/topicTaxonomy");
const { parseTopicKey, queryCandidates, DEFAULT_SPEC_LEGACY } = require("../utils/topicKey");

/**
 * @param {Object} opts
 * @param {string} opts.lessonId
 * @param {ObjectId|string} opts.userId - for permission check (caller must be owner/admin)
 * @returns {Promise<{ addedCount: number; questionsCount: number; lesson: Object }>}
 */
async function generateLessonAssessmentFromTopic({ lessonId, userId }) {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw Object.assign(new Error("Lesson not found"), { statusCode: 404 });

  const topicKey =
    (lesson.topicKey && String(lesson.topicKey).trim()) ||
    (lesson.topic && topicToKey(lesson.topic)) ||
    "";
  if (!topicKey) {
    throw Object.assign(new Error("Lesson has no topicKey; cannot generate assessment."), { statusCode: 400 });
  }

  const ownerId = lesson.teacherId || lesson.createdBy;
  const specKey = (lesson.specKey && String(lesson.specKey).trim()) || parseTopicKey(topicKey).specKey || DEFAULT_SPEC_LEGACY;
  const topicOnly = parseTopicKey(topicKey).topicKey || topicKey.trim().toLowerCase();
  const candidates = queryCandidates(specKey, topicOnly);

  const bankQuestions = await TopicQuizQuestion.find({
    ownerId,
    topicKey: candidates.length ? { $in: candidates } : topicOnly,
    status: "published",
    kind: "assessment",
  })
    .sort({ createdAt: 1 })
    .lean();

  const questions = bankQuestions.map((q, i) => {
    const choices = Array.isArray(q.choices) ? q.choices : [];
    const correctIndex = Math.min(Math.max(0, Number(q.correctIndex)), Math.max(0, choices.length - 1));
    const correctAnswer = choices[correctIndex] || "";
    return {
      id: `aq_${Date.now()}_${i}`,
      type: "mcq",
      question: q.questionText || "",
      options: choices,
      correctAnswer,
      explanation: q.explanation || "",
      tags: Array.isArray(q.tags) ? q.tags : [],
      difficulty: 1,
      marks: 1,
    };
  });

  if (!lesson.assessment || typeof lesson.assessment !== "object") {
    lesson.assessment = { timeSeconds: 600, questions: [] };
  }
  lesson.assessment.questions = questions;
  lesson.markModified("assessment");
  await lesson.save();

  return {
    addedCount: questions.length,
    questionsCount: questions.length,
    lesson: lesson.toObject ? lesson.toObject() : lesson,
  };
}

module.exports = { generateLessonAssessmentFromTopic };
