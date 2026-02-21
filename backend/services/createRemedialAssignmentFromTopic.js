/**
 * PR-EDGE-5.2: Create a remedial lesson + quiz/assessment assignment from topicKey.
 * Reuses generateLessonQuizFromTopic / generateLessonAssessmentFromTopic.
 */
const Lesson = require("../models/Lesson");
const QuizAssignment = require("../models/QuizAssignment");
const { findTopicByKey } = require("../utils/topicTaxonomy");
const { generateLessonQuizFromTopic } = require("./generateLessonQuizFromTopic");
const { generateLessonAssessmentFromTopic } = require("./generateLessonAssessmentFromTopic");

/**
 * @param {Object} opts
 * @param {ObjectId|string} opts.owner - teacher user _id
 * @param {string} opts.topicKey - canonical topic key (e.g. cell-structure)
 * @param {string} opts.kind - "quiz" | "assessment"
 * @param {Date|string} [opts.dueAt] - optional
 * @returns {Promise<{ lessonId, assignmentId, shareId, shareUrl, generated: { addedCount, questionsCount } }>}
 */
async function createRemedialAssignmentFromTopic({ owner, topicKey, kind, dueAt }) {
  const key = (topicKey || "").trim().toLowerCase();
  if (!key) {
    const err = new Error("topicKey is required");
    err.statusCode = 400;
    throw err;
  }
  if (kind !== "quiz" && kind !== "assessment") {
    const err = new Error("kind must be quiz or assessment");
    err.statusCode = 400;
    throw err;
  }

  const topicInfo = findTopicByKey(key);
  const topicName = topicInfo?.topic || key.replace(/-/g, " ");
  const kindLabel = kind === "quiz" ? "Quiz" : "Assessment";
  const title = `Remedial: ${topicName} (${kindLabel})`;

  const ownerId = owner?._id ?? owner;

  const lesson = await Lesson.create({
    title,
    description: `Remedial ${kindLabel} for ${topicName}`,
    content: "Remedial practice — no lesson content.",
    teacherId: ownerId,
    teacherName: "",
    subject: "Biology",
    level: "GCSE",
    topic: topicName,
    status: "draft",
    quiz: kind === "quiz" ? { timeSeconds: 600, questions: [] } : undefined,
    assessment: kind === "assessment" ? { timeSeconds: 600, questions: [] } : undefined,
  });

  let addedCount = 0;
  let questionsCount = 0;

  if (kind === "quiz") {
    const result = await generateLessonQuizFromTopic({
      lessonId: lesson._id,
      userId: ownerId,
      opts: { publishedOnly: true },
    });
    addedCount = result.addedCount || 0;
    questionsCount = result.questionsCount || 0;
  } else {
    const result = await generateLessonAssessmentFromTopic({
      lessonId: lesson._id,
      userId: ownerId,
    });
    addedCount = result.addedCount || 0;
    questionsCount = result.questionsCount || 0;
  }

  if (addedCount === 0) {
    await Lesson.findByIdAndDelete(lesson._id);
    const err = new Error(`No published ${kind} questions in bank for this topic. Publish some questions first.`);
    err.statusCode = 400;
    throw err;
  }

  let shareId = QuizAssignment.generateShareId();
  let exists = await QuizAssignment.findOne({ shareId });
  while (exists) {
    shareId = QuizAssignment.generateShareId();
    exists = await QuizAssignment.findOne({ shareId });
  }

  const assignment = await QuizAssignment.create({
    ownerId,
    kind,
    lessonId: lesson._id,
    title: `${kindLabel}: ${topicName}`,
    shareId,
    isActive: true,
    dueAt: dueAt ? new Date(dueAt) : null,
  });

  return {
    lessonId: String(lesson._id),
    assignmentId: String(assignment._id),
    shareId: assignment.shareId,
    shareUrl: `/q/${assignment.shareId}`,
    generated: {
      addedCount,
      questionsCount,
    },
  };
}

module.exports = { createRemedialAssignmentFromTopic };
