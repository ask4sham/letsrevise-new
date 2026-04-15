/**
 * Phase 3: lessons where student practice (PracticeAttempt) suggests reviewing curriculum content.
 * Reuses the same lesson-scoped aggregation pattern as GET /api/reports/teacher/attempts-summary.
 * Does NOT run AI — identification only.
 */
const mongoose = require("mongoose");
const PracticeAttempt = require("../models/PracticeAttempt");
const Lesson = require("../models/Lesson");

function isCurriculumAiReviewEnabled() {
  return String(process.env.CURRICULUM_AI_REVIEW_ENABLED || "").toLowerCase() === "true";
}

function isTagNeedsFromStudentsEnabled() {
  return String(process.env.CURRICULUM_AI_REVIEW_TAG_NEEDS_FROM_STUDENTS || "").toLowerCase() === "true";
}

function isWeakLessonsApiEnabled() {
  return String(process.env.CURRICULUM_AI_REVIEW_WEAK_LESSONS_API || "").toLowerCase() === "true";
}

/** Tunable via env (defaults match reports teacher/attempts-summary window). */
function getDefaultDays() {
  const n = Number(process.env.CURRICULUM_AI_REVIEW_WEAK_LESSONS_DAYS || 14);
  return Number.isFinite(n) && n >= 1 && n <= 60 ? n : 14;
}

function getMinAttempts() {
  const n = Number(process.env.CURRICULUM_AI_REVIEW_WEAK_MIN_ATTEMPTS || 5);
  return Number.isFinite(n) && n >= 1 ? Math.min(50, n) : 5;
}

/** Exported for unit tests — mirrors tagging rules in aggregation $match. */
function buildWeakReasonTags(accuracy, highConfWrong, attemptsPerStudent) {
  const reasons = [];
  if (accuracy < 0.55) reasons.push("low_accuracy");
  if (highConfWrong >= 3) reasons.push("high_confidence_wrong");
  if (attemptsPerStudent >= 2.5) reasons.push("repeat_attempts");
  return reasons;
}

/**
 * Build aggregation for lesson-scoped attempts for this teacher's lessons.
 */
function weakLessonsPipeline(lessonObjectIds, since, minAttempts, limit) {
  return [
    {
      $match: {
        lessonId: { $in: lessonObjectIds },
        createdAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: "$lessonId",
        attempts: { $sum: 1 },
        correct: { $sum: { $cond: [{ $eq: ["$isCorrect", true] }, 1, 0] } },
        highConfWrong: {
          $sum: {
            $cond: [
              {
                $and: [{ $eq: ["$confidence", 3] }, { $ne: ["$isCorrect", true] }],
              },
              1,
              0,
            ],
          },
        },
        students: { $addToSet: "$userId" },
      },
    },
    {
      $addFields: {
        accuracy: {
          $cond: [{ $eq: ["$attempts", 0] }, 0, { $divide: ["$correct", "$attempts"] }],
        },
        studentCount: {
          $size: {
            $filter: {
              input: "$students",
              as: "u",
              cond: { $ne: ["$$u", null] },
            },
          },
        },
      },
    },
    {
      $addFields: {
        attemptsPerStudent: {
          $cond: [
            { $gt: ["$studentCount", 0] },
            { $divide: ["$attempts", "$studentCount"] },
            "$attempts",
          ],
        },
      },
    },
    { $match: { attempts: { $gte: minAttempts } } },
    {
      $match: {
        $or: [
          { $expr: { $lt: ["$accuracy", 0.55] } },
          { highConfWrong: { $gte: 3 } },
          { $expr: { $gte: ["$attemptsPerStudent", 2.5] } },
        ],
      },
    },
    {
      $addFields: {
        weakScore: {
          $add: [
            { $multiply: [{ $subtract: [1, "$accuracy"] }, 100] },
            { $multiply: ["$highConfWrong", 6] },
            {
              $multiply: [
                { $max: [{ $subtract: ["$attemptsPerStudent", 1] }, 0] },
                10,
              ],
            },
          ],
        },
      },
    },
    { $sort: { weakScore: -1 } },
    { $limit: Math.min(Math.max(limit, 1), 100) },
  ];
}

/**
 * @param {string|mongoose.Types.ObjectId} teacherId
 * @param {{ days?: number, limit?: number }} opts
 * @returns {Promise<Set<string>>}
 */
async function getWeakLessonIdSetForTeacher(teacherId, opts = {}) {
  const days = opts.days != null ? opts.days : getDefaultDays();
  const limit = opts.limit != null ? opts.limit : 50;
  const minAttempts = getMinAttempts();

  const lessons = await Lesson.find({ teacherId }).select("_id").lean();
  const ids = lessons.map((l) => l._id);
  if (ids.length === 0) return new Set();

  const since = new Date();
  since.setDate(since.getDate() - Math.min(Math.max(Number(days) || 14, 1), 60));

  const pipeline = weakLessonsPipeline(ids, since, minAttempts, limit);
  const agg = await PracticeAttempt.aggregate(pipeline);
  return new Set(agg.map((r) => String(r._id)));
}

/**
 * Ranked list for GET /api/lessons/needs-curriculum-review
 * @param {{ teacherId: string, limit?: number, days?: number }} opts
 */
async function getWeakLessonsForCurriculumReview({ teacherId, limit = 30, days } = {}) {
  if (!teacherId || !mongoose.Types.ObjectId.isValid(String(teacherId))) {
    return [];
  }

  const d = days != null ? days : getDefaultDays();
  const lim = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const minAttempts = getMinAttempts();

  const lessons = await Lesson.find({ teacherId }).select("_id title subject status isPublished").lean();
  const ids = lessons.map((l) => l._id);
  const meta = new Map(lessons.map((l) => [String(l._id), l]));

  if (ids.length === 0) return [];

  const since = new Date();
  since.setDate(since.getDate() - Math.min(Math.max(Number(d) || 14, 1), 60));

  const pipeline = weakLessonsPipeline(ids, since, minAttempts, lim);
  const agg = await PracticeAttempt.aggregate(pipeline);

  return agg.map((r) => {
    const lid = String(r._id);
    const m = meta.get(lid);
    const acc = Number(r.accuracy) || 0;
    const aps = Number(r.attemptsPerStudent) || 0;
    const hcw = Number(r.highConfWrong) || 0;
    const reasons = buildWeakReasonTags(acc, hcw, aps);
    return {
      _id: r._id,
      title: m?.title ?? "—",
      subject: m?.subject ?? "",
      status: m?.status ?? "draft",
      isPublished: Boolean(m?.isPublished),
      attempts: r.attempts,
      accuracy: Math.round(acc * 1000) / 1000,
      accuracyPercent: Math.round(acc * 100),
      highConfidenceWrong: hcw,
      attemptsPerStudent: Math.round(aps * 100) / 100,
      weakScore: Math.round(r.weakScore || 0),
      reasons,
      windowDays: Math.min(Math.max(Number(d) || 14, 1), 60),
      since: since.toISOString(),
    };
  });
}

module.exports = {
  isCurriculumAiReviewEnabled,
  isTagNeedsFromStudentsEnabled,
  isWeakLessonsApiEnabled,
  getWeakLessonIdSetForTeacher,
  getWeakLessonsForCurriculumReview,
  getDefaultDays,
  getMinAttempts,
  buildWeakReasonTags,
};
