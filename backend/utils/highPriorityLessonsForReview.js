/**
 * Phase 2: identify draft lessons that are good candidates for a manual curriculum AI check.
 * Uses only existing Lesson fields (views, specKey, topicKey, updatedAt, curriculumAiReview) — no new analytics.
 * Does NOT run AI; selection only.
 */
const mongoose = require("mongoose");
const Lesson = require("../models/Lesson");

function isCurriculumAiReviewEnabled() {
  return String(process.env.CURRICULUM_AI_REVIEW_ENABLED || "").toLowerCase() === "true";
}

function isRecommendInListEnabled() {
  return String(process.env.CURRICULUM_AI_REVIEW_RECOMMEND_IN_LIST || "").toLowerCase() === "true";
}

function isHighPriorityEndpointEnabled() {
  return String(process.env.CURRICULUM_AI_REVIEW_HIGH_PRIORITY_API || "").toLowerCase() === "true";
}

/** Draft / in_review and not published — matches curriculum AI review eligibility. */
function isEligibleDraftForCurriculumReview(lesson) {
  if (!lesson) return false;
  if (lesson.isPublished === true) return false;
  const st = String(lesson.status || (lesson.isPublished ? "published" : "draft")).toLowerCase();
  return st === "draft" || st === "in_review";
}

/** Legacy / backlog: needs a completed curriculum review for Phase 2 nudges. */
function needsCurriculumReviewAttention(lesson) {
  const cr = lesson.curriculumAiReview;
  if (!cr || !cr.status) return true;
  if (cr.status === "running" || cr.status === "queued") return false;
  if (cr.status === "failed") return true;
  if (cr.status !== "completed" || !cr.result) return true;
  return false;
}

/**
 * Heuristic score from lesson metadata only (higher = more important to review).
 */
function computeCurriculumPriorityScore(lesson) {
  const views = Math.max(0, Number(lesson.views) || 0);
  const viewPart = Math.min(42, Math.log10(views + 1) * 14);

  let taxPart = 0;
  if (lesson.specKey && typeof lesson.specKey === "string" && lesson.specKey.trim()) {
    taxPart += 12;
  }
  if (lesson.topicKey && typeof lesson.topicKey === "string" && lesson.topicKey.includes(":")) {
    taxPart += 18;
  } else if (lesson.topicKey && String(lesson.topicKey).trim()) {
    taxPart += 8;
  }

  let recPart = 8;
  const raw = lesson.updatedAt || lesson.createdAt;
  if (raw) {
    const t = new Date(raw).getTime();
    if (Number.isFinite(t)) {
      const days = (Date.now() - t) / 86400000;
      if (days <= 7) recPart = 30;
      else if (days <= 30) recPart = 24;
      else if (days <= 90) recPart = 16;
    }
  }

  return Math.round(Math.min(100, viewPart + taxPart + recPart));
}

function buildPriorityReasons(lesson) {
  const reasons = [];
  const views = Number(lesson.views) || 0;
  if (views >= 50) reasons.push("frequently_accessed");
  else if (views >= 10) reasons.push("moderate_traffic");

  if (lesson.specKey && lesson.topicKey && String(lesson.topicKey).includes(":")) {
    reasons.push("core_taxonomy_mapped");
  } else if (lesson.topicKey || lesson.specKey) {
    reasons.push("partial_taxonomy");
  }

  const raw = lesson.updatedAt || lesson.createdAt;
  if (raw) {
    const days = (Date.now() - new Date(raw).getTime()) / 86400000;
    if (days <= 14) reasons.push("recently_edited");
  }

  return reasons;
}

/**
 * Top `cap` lesson ids among `lessons` that should show "Recommended for curriculum check".
 * @param {Array<object>} lessons - plain lesson objects (e.g. teacher list)
 * @param {number} cap
 * @returns {Set<string>}
 */
function buildRecommendedCurriculumCheckSet(lessons, cap = 25) {
  const eligible = (lessons || []).filter(
    (l) => isEligibleDraftForCurriculumReview(l) && needsCurriculumReviewAttention(l)
  );
  const scored = eligible
    .map((l) => ({ l, score: computeCurriculumPriorityScore(l) }))
    .sort((a, b) => b.score - a.score);
  return new Set(scored.slice(0, Math.max(1, cap)).map((x) => String(x.l._id || x.l.id)));
}

/**
 * Load from DB and return ranked candidates for optional GET API / tooling.
 * @param {{ teacherId: string, limit?: number }} opts
 * @returns {Promise<Array<{ _id, title, subject, topicKey, specKey, views, updatedAt, priorityScore, reasons }>>}
 */
async function getHighPriorityLessonsForReview({ teacherId, limit = 50 }) {
  if (!teacherId || !mongoose.Types.ObjectId.isValid(String(teacherId))) {
    return [];
  }

  const cap = Math.min(Math.max(Number(limit) || 50, 1), 100);

  const lessons = await Lesson.find({ teacherId })
    .select(
      "_id title subject topic views specKey topicKey updatedAt createdAt status isPublished curriculumAiReview"
    )
    .lean();

  const eligible = lessons.filter(
    (l) => isEligibleDraftForCurriculumReview(l) && needsCurriculumReviewAttention(l)
  );

  const scored = eligible
    .map((l) => ({
      lesson: l,
      score: computeCurriculumPriorityScore(l),
      reasons: buildPriorityReasons(l),
    }))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, cap).map((x) => ({
    _id: x.lesson._id,
    title: x.lesson.title,
    subject: x.lesson.subject,
    topicKey: x.lesson.topicKey || null,
    specKey: x.lesson.specKey || null,
    views: x.lesson.views || 0,
    updatedAt: x.lesson.updatedAt || x.lesson.createdAt,
    priorityScore: x.score,
    reasons: x.reasons,
  }));
}

module.exports = {
  isCurriculumAiReviewEnabled,
  isRecommendInListEnabled,
  isHighPriorityEndpointEnabled,
  isEligibleDraftForCurriculumReview,
  needsCurriculumReviewAttention,
  computeCurriculumPriorityScore,
  buildRecommendedCurriculumCheckSet,
  getHighPriorityLessonsForReview,
};
