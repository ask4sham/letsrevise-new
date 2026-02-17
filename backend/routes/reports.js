/**
 * PR10: Readiness report for AQA GCSE Biology (teacher/admin).
 * PR12: Lesson attempts summary + teacher attempts summary.
 * PR14: Reteach plan (AI, cached, editable).
 */
const crypto = require("crypto");
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const axios = require("axios");
const Lesson = require("../models/Lesson");
const PracticeAttempt = require("../models/PracticeAttempt");
const ExamQuestion = require("../models/ExamQuestion");
const LessonUnlock = require("../models/LessonUnlock");
const User = require("../models/User");
const ReteachPlan = require("../models/ReteachPlan");
const Event = require("../models/Event");
const auth = require("../middleware/auth");
const { getLessonOwnerId } = require("../utils/lessonPayload");
const { getBiologyTopics, findTopicByKey, topicToKey } = require("../utils/topicTaxonomy");
const { attachExamQuestionsByTopic } = require("../utils/attachExamQuestionsByTopic");
const { computeLessonReadiness } = require("../utils/lessonReadiness");
const { canAccessContent } = require("../utils/canAccessContent");
const { deriveLessonCardDescription } = require("../utils/deriveLessonCardDescription");

function isAdmin(user) {
  return user?.userType === "admin" || user?.role === "admin" || user?.isAdmin === true;
}

function isTeacherOrAdmin(user) {
  const type = String(user?.userType || user?.role || "").toLowerCase();
  return type === "teacher" || type === "admin" || isAdmin(user);
}

/** PR14 + reuse for question-insights: run same aggregation, return { items, topics }. */
async function getQuestionInsightsForLesson(lessonOid, since, limit) {
  const questionInsightsPipeline = [
    { $match: { lessonId: lessonOid, createdAt: { $gte: since }, source: "practice", questionId: { $ne: null } } },
    {
      $group: {
        _id: "$questionId",
        attempts: { $sum: 1 },
        wrong: { $sum: { $cond: [{ $eq: ["$isCorrect", false] }, 1, 0] } },
        correct: { $sum: { $cond: [{ $eq: ["$isCorrect", true] }, 1, 0] } },
        highConfidenceWrong: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$isCorrect", false] }, { $eq: ["$confidence", 3] }] },
              1,
              0,
            ],
          },
        },
        avgConfidence: { $avg: "$confidence" },
      },
    },
    { $sort: { highConfidenceWrong: -1, wrong: -1, attempts: -1 } },
    { $limit: limit },
    { $lookup: { from: "examquestions", localField: "_id", foreignField: "_id", as: "eq" } },
    { $unwind: { path: "$eq", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        questionId: { $toString: "$_id" },
        question: "$eq.question",
        marks: "$eq.marks",
        topicKey: "$eq.topicKey",
        topic: "$eq.topic",
        type: "$eq.type",
        attempts: 1,
        wrong: 1,
        correct: 1,
        highConfidenceWrong: 1,
        avgConfidence: 1,
        accuracy: { $cond: [{ $eq: ["$attempts", 0] }, null, { $divide: ["$correct", "$attempts"] }] },
        wrongRate: { $cond: [{ $eq: ["$attempts", 0] }, null, { $divide: ["$wrong", "$attempts"] }] },
      },
    },
  ];
  const topicPipeline = [
    { $match: { lessonId: lessonOid, createdAt: { $gte: since }, source: "practice", questionId: { $ne: null } } },
    { $lookup: { from: "examquestions", localField: "questionId", foreignField: "_id", as: "eq" } },
    { $unwind: { path: "$eq", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { $ifNull: ["$eq.topicKey", "(unknown)"] },
        topicKey: { $first: "$eq.topicKey" },
        topic: { $first: "$eq.topic" },
        attempts: { $sum: 1 },
        wrong: { $sum: { $cond: [{ $eq: ["$isCorrect", false] }, 1, 0] } },
        correct: { $sum: { $cond: [{ $eq: ["$isCorrect", true] }, 1, 0] } },
        highConfidenceWrong: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$isCorrect", false] }, { $eq: ["$confidence", 3] }] },
              1,
              0,
            ],
          },
        },
      },
    },
    { $sort: { highConfidenceWrong: -1, wrong: -1 } },
    { $project: { _id: 0, topicKey: "$_id", topic: 1, attempts: 1, wrong: 1, correct: 1, highConfidenceWrong: 1 } },
  ];
  const [items, topicDocs] = await Promise.all([
    PracticeAttempt.aggregate(questionInsightsPipeline),
    PracticeAttempt.aggregate(topicPipeline),
  ]);
  const topics = topicDocs.map((t) => ({
    topicKey: t.topicKey ?? "(unknown)",
    topic: t.topic ?? t.topicKey ?? "(unknown)",
    attempts: t.attempts,
    wrong: t.wrong,
    correct: t.correct,
    highConfidenceWrong: t.highConfidenceWrong,
  }));
  return { items, topics };
}

/**
 * GET /api/reports/aqa-gcse-biology/readiness?scope=me|teacherId=<id>
 * scope=me (default): lessons owned by req.user
 * scope=teacherId=<id>: admin only, that teacher's lessons
 */
router.get("/aqa-gcse-biology/readiness", auth, async (req, res) => {
  try {
    const scope = (req.query.scope || "me").toString().trim().toLowerCase();
    let teacherId = req.user._id;

    if (scope.startsWith("teacherid=")) {
      if (!isAdmin(req.user)) {
        return res.status(403).json({ error: "Admin only" });
      }
      const idParam = scope.replace(/^teacherid=/, "").trim();
      if (!mongoose.Types.ObjectId.isValid(idParam)) {
        return res.status(400).json({ error: "Invalid teacherId" });
      }
      teacherId = new mongoose.Types.ObjectId(idParam);
    }

    const taxonomy = getBiologyTopics();
    const units = Array.isArray(taxonomy?.units) ? taxonomy.units : [];

    const lessons = await Lesson.find({ teacherId })
      .select("topic isPublished status reviewedAt reviewedBy pages examQuestions")
      .lean();

    const coveredTopicKeys = new Set();
    const coveredTopicKeysByUnit = new Map(); // unit -> Set of topic keys (published only)
    const byUnitMap = new Map();

    for (const u of units) {
      const unitName = u.unit || "";
      const topics = Array.isArray(u.topics) ? u.topics : [];
      byUnitMap.set(unitName, {
        unit: unitName,
        topicsTotal: topics.length,
        topicsCovered: 0,
        requiredPracticalsTotal: topics.filter((t) => t.requiredPractical).length,
        requiredPracticalsCovered: 0,
        readiness: { READY: 0, NEEDS_REVIEW: 0, DRAFT: 0 },
      });
      coveredTopicKeysByUnit.set(unitName, new Set());
    }

    function findUnitForTopicKey(topicKey) {
      if (!topicKey) return null;
      const k = String(topicKey).toLowerCase();
      for (const u of units) {
        const found = (u.topics || []).find((t) => (t.key || "").toLowerCase() === k);
        if (found) return u.unit;
      }
      return null;
    }

    let lessonsPublished = 0;
    let lessonsDraft = 0;
    let ready = 0;
    let needsReview = 0;

    for (const lesson of lessons) {
      const isPub = lesson.isPublished === true || String(lesson.status || "").toLowerCase() === "published";
      if (isPub) lessonsPublished += 1;
      else lessonsDraft += 1;

      const topicKey = topicToKey(lesson.topic);
      const r = computeLessonReadiness(lesson);

      if (r.status === "READY") ready += 1;
      else if (r.status === "NEEDS_REVIEW") needsReview += 1;

      const unitName = findUnitForTopicKey(topicKey);
      if (unitName) {
        const entry = byUnitMap.get(unitName);
        if (entry) entry.readiness[r.status] = (entry.readiness[r.status] || 0) + 1;
      }

      if (!isPub || !topicKey) continue;
      coveredTopicKeys.add(topicKey);
      if (unitName) {
        const set = coveredTopicKeysByUnit.get(unitName);
        if (set) set.add(topicKey.toLowerCase());
      }
    }

    for (const u of units) {
      const entry = byUnitMap.get(u.unit);
      if (!entry) continue;
      const coveredSet = coveredTopicKeysByUnit.get(u.unit);
      if (coveredSet) {
        entry.topicsCovered = coveredSet.size;
        const unitTopics = Array.isArray(u.topics) ? u.topics : [];
        entry.requiredPracticalsCovered = unitTopics.filter(
          (t) => t.requiredPractical && coveredSet.has((t.key || "").toLowerCase())
        ).length;
      }
    }

    const byUnit = Array.from(byUnitMap.values());
    const uncoveredTopicsByUnit = units.map((u) => {
      const unitTopics = Array.isArray(u.topics) ? u.topics : [];
      const uncovered = unitTopics.filter((t) => !coveredTopicKeys.has((t.key || "").toLowerCase()));
      return {
        unit: u.unit || "",
        topics: uncovered.map((t) => ({
          key: t.key,
          topic: t.topic,
          requiredPractical: !!t.requiredPractical,
          tier: t.tier,
        })),
      };
    });

    return res.json({
      ok: true,
      subject: taxonomy?.subject || "Biology",
      examBoard: taxonomy?.examBoard || "AQA",
      level: taxonomy?.level || "GCSE",
      totals: {
        lessonsPublished,
        lessonsDraft,
        ready,
        needsReview,
      },
      byUnit,
      uncoveredTopicsByUnit,
    });
  } catch (err) {
    console.error("GET readiness report error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * PR12: GET /api/reports/lessons/:lessonId/attempts-summary?days=7
 * Auth required. Owner teacher or admin only.
 */
router.get("/lessons/:lessonId/attempts-summary", auth, async (req, res) => {
  try {
    if (!isTeacherOrAdmin(req.user)) {
      return res.status(403).json({ error: "Teacher or admin only" });
    }
    const { lessonId } = req.params;
    const days = Math.min(30, Math.max(1, parseInt(String(req.query.days || "7"), 10) || 7));
    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ error: "Invalid lessonId" });
    }
    const lesson = await Lesson.findById(lessonId).select("teacherId").lean();
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }
    const ownerId = getLessonOwnerId(lesson);
    const userId = String(req.user._id);
    if (ownerId !== userId && !isAdmin(req.user)) {
      return res.status(403).json({ error: "Not the lesson owner" });
    }
    const since = new Date();
    since.setDate(since.getDate() - days);
    const attempts = await PracticeAttempt.find({
      lessonId: new mongoose.Types.ObjectId(lessonId),
      createdAt: { $gte: since },
    }).lean();
    const total = attempts.length;
    const uniqueStudents = new Set(attempts.map((a) => String(a.userId))).size;
    const correct = attempts.filter((a) => a.isCorrect).length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const bySource = { checkpoint: 0, practice: 0 };
    const confidenceCounts = { 1: 0, 2: 0, 3: 0 };
    const confidenceCorrectCounts = { 1: 0, 2: 0, 3: 0 };
    const confidenceWrongCounts = { 1: 0, 2: 0, 3: 0 };
    attempts.forEach((a) => {
      if (a.source === "checkpoint") bySource.checkpoint += 1;
      if (a.source === "practice") bySource.practice += 1;
      const c = a.confidence === 1 || a.confidence === 2 || a.confidence === 3 ? a.confidence : 2;
      confidenceCounts[c] = (confidenceCounts[c] || 0) + 1;
      if (a.isCorrect) confidenceCorrectCounts[c] = (confidenceCorrectCounts[c] || 0) + 1;
      else confidenceWrongCounts[c] = (confidenceWrongCounts[c] || 0) + 1;
    });
    return res.json({
      ok: true,
      lessonId,
      days,
      totalAttempts: total,
      uniqueStudents,
      accuracy,
      bySource,
      confidenceCounts,
      confidenceCorrectCounts,
      confidenceWrongCounts,
    });
  } catch (err) {
    console.error("GET attempts-summary error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * PR12: GET /api/reports/teacher/attempts-summary?days=7
 * Auth required. Teacher or admin. Aggregates all lessons owned by teacher.
 */
router.get("/teacher/attempts-summary", auth, async (req, res) => {
  try {
    if (!isTeacherOrAdmin(req.user)) {
      return res.status(403).json({ error: "Teacher or admin only" });
    }
    const teacherId = req.user._id;
    const days = Math.min(30, Math.max(1, parseInt(String(req.query.days || "7"), 10) || 7));
    const since = new Date();
    since.setDate(since.getDate() - days);
    const lessonIds = await Lesson.find({ teacherId }).select("_id").lean();
    const ids = lessonIds.map((l) => l._id);
    if (ids.length === 0) {
      return res.json({
        ok: true,
        days,
        topLessonsByAttempts: [],
        lowestAccuracyLessons: [],
        confidenceCounts: { 1: 0, 2: 0, 3: 0 },
        confidenceCorrectCounts: { 1: 0, 2: 0, 3: 0 },
        confidenceWrongCounts: { 1: 0, 2: 0, 3: 0 },
      });
    }
    const attempts = await PracticeAttempt.find({
      lessonId: { $in: ids },
      createdAt: { $gte: since },
    }).lean();
    const byLesson = new Map();
    const confidenceCounts = { 1: 0, 2: 0, 3: 0 };
    const confidenceCorrectCounts = { 1: 0, 2: 0, 3: 0 };
    const confidenceWrongCounts = { 1: 0, 2: 0, 3: 0 };
    attempts.forEach((a) => {
      const lid = String(a.lessonId);
      if (!byLesson.has(lid)) {
        byLesson.set(lid, { total: 0, correct: 0 });
      }
      const rec = byLesson.get(lid);
      rec.total += 1;
      if (a.isCorrect) rec.correct += 1;
      const c = a.confidence === 1 || a.confidence === 2 || a.confidence === 3 ? a.confidence : 2;
      confidenceCounts[c] = (confidenceCounts[c] || 0) + 1;
      if (a.isCorrect) confidenceCorrectCounts[c] = (confidenceCorrectCounts[c] || 0) + 1;
      else confidenceWrongCounts[c] = (confidenceWrongCounts[c] || 0) + 1;
    });
    const lessons = await Lesson.find({ _id: { $in: ids } }).select("_id title topic").lean();
    const lessonMap = new Map(lessons.map((l) => [String(l._id), l]));
    const withMeta = Array.from(byLesson.entries()).map(([lid, rec]) => ({
      lessonId: lid,
      title: lessonMap.get(lid)?.title ?? "—",
      topic: lessonMap.get(lid)?.topic ?? "",
      ...rec,
      accuracy: rec.total > 0 ? Math.round((rec.correct / rec.total) * 100) : 0,
    }));
    const topLessonsByAttempts = withMeta.sort((a, b) => b.total - a.total).slice(0, 10);
    const lowestAccuracyLessons = withMeta.filter((l) => l.total >= 1).sort((a, b) => a.accuracy - b.accuracy).slice(0, 10);
    return res.json({
      ok: true,
      days,
      topLessonsByAttempts,
      lowestAccuracyLessons,
      confidenceCounts,
      confidenceCorrectCounts,
      confidenceWrongCounts,
    });
  } catch (err) {
    console.error("GET teacher/attempts-summary error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * PR13: GET /api/reports/lessons/:lessonId/question-insights?days=7&limit=10
 * Auth required. Lesson owner or admin only. Practice-only (questionId present).
 * Returns top wrong questions (misconception-first) + topic hot-spots.
 */
router.get("/lessons/:lessonId/question-insights", auth, async (req, res) => {
  try {
    if (!isTeacherOrAdmin(req.user)) {
      return res.status(403).json({ error: "Teacher or admin only" });
    }
    const { lessonId } = req.params;
    const days = Math.min(30, Math.max(1, parseInt(String(req.query.days || "7"), 10) || 7));
    let limit = parseInt(String(req.query.limit || "10"), 10);
    if (Number.isNaN(limit) || limit < 1) limit = 10;
    if (limit > 50) limit = 50;

    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ error: "Invalid lessonId" });
    }
    const lesson = await Lesson.findById(lessonId).select("teacherId").lean();
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }
    const ownerId = getLessonOwnerId(lesson);
    const userId = String(req.user._id);
    if (ownerId !== userId && !isAdmin(req.user)) {
      return res.status(403).json({ error: "Not the lesson owner" });
    }

    const since = new Date();
    since.setDate(since.getDate() - days);
    const lessonOid = new mongoose.Types.ObjectId(lessonId);
    const { items, topics } = await getQuestionInsightsForLesson(lessonOid, since, limit);

    return res.json({
      ok: true,
      days,
      since: since.toISOString(),
      lessonId: String(lessonId),
      items,
      topics,
    });
  } catch (err) {
    console.error("GET question-insights error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/** PR14: Ensure teacher owner or admin for lesson report actions. Returns true if allowed to proceed. */
function requireLessonReportAccess(req, res, lessonId) {
  if (!isTeacherOrAdmin(req.user)) {
    res.status(403).json({ error: "Teacher or admin only" });
    return false;
  }
  if (!mongoose.Types.ObjectId.isValid(lessonId)) {
    res.status(400).json({ error: "Invalid lessonId" });
    return false;
  }
  return true;
}

/**
 * PR16: Internal generator for reteach plan. Returns { planDoc, cached } or { error }.
 * Used by POST /reteach-plan and POST /one-click-fix.
 * PR16.1: DISABLE_OPENAI=1 for deterministic tests (returns NOT_CONFIGURED without calling OpenAI).
 */
async function generateReteachPlanInternal(lessonId, lesson, userId, opts = {}) {
  if (process.env.DISABLE_OPENAI === "1") {
    return { error: "NOT_CONFIGURED", message: "AI generation not configured" };
  }
  let days = parseInt(String(opts.days ?? "14"), 10);
  if (days !== 7 && days !== 14 && days !== 30) days = 14;
  let limit = parseInt(String(opts.limit ?? "10"), 10);
  if (Number.isNaN(limit) || limit < 5) limit = 5;
  if (limit > 20) limit = 20;
  const force = opts.force === true;

  const since = new Date();
  since.setDate(since.getDate() - days);
  const lessonOid = new mongoose.Types.ObjectId(lessonId);
  const { items, topics } = await getQuestionInsightsForLesson(lessonOid, since, limit);

  const minimalItems = items.slice(0, limit).map((i) => ({
    questionId: i.questionId,
    wrong: i.wrong,
    highConfidenceWrong: i.highConfidenceWrong,
    avgConfidence: i.avgConfidence,
    topicKey: i.topicKey,
  }));
  const sourceHash = crypto
    .createHash("sha256")
    .update(JSON.stringify({ lessonId, days, limit, minimalItems }))
    .digest("hex");

  if (!force) {
    const existing = await ReteachPlan.findOne({ lessonId: lessonOid, days, sourceHash }).lean();
    if (existing) {
      return { planDoc: existing, cached: true };
    }
  }

  const RECENT_MS = 2 * 60 * 1000;
  const recent = await ReteachPlan.findOne({
    lessonId: lessonOid,
    generatedAt: { $gte: new Date(Date.now() - RECENT_MS) },
  }).lean();
  if (force && recent) {
    return { error: "RATE_LIMIT", message: "Please wait a moment before generating again." };
  }

  if (!process.env.OPENAI_API_KEY) {
    return { error: "NOT_CONFIGURED", message: "AI generation not configured" };
  }

  const top2Topics = topics.slice(0, 2);
  const prompt = `You are a GCSE Biology teaching assistant. Generate a short reteach plan in markdown for the teacher.

Lesson context: topic "${lesson.topic || ""}", tier "${lesson.tier || ""}", exam board "${lesson.board || ""}", subject "${lesson.subject || ""}", level "${lesson.level || ""}".

Data from recent practice attempts (do not copy exam question text verbatim; refer generically):
Top misconceptions (questionId, wrong count, high-confidence wrong, avg confidence, topic): ${JSON.stringify(minimalItems.slice(0, 3))}
Topic hot-spots: ${JSON.stringify(top2Topics.map((t) => ({ topicKey: t.topicKey, topic: t.topic, wrong: t.wrong, highConfidenceWrong: t.highConfidenceWrong })))}

Output markdown with exactly these sections (use ## for headings):
1) What students are getting wrong
2) Likely misconception
3) Reteach script (5–10 minutes)
4) Quick check questions (3)
5) Homework / next steps

Keep tone age-appropriate for GCSE. Reference the top 3 misconception areas and top 2 topics. Do not include copyrighted exam text; refer generically (e.g. "questions on photosynthesis").`;

  const apiKey = process.env.OPENAI_API_KEY;
  const model = (process.env.OPENAI_MODEL || "gpt-4o-mini").toString();
  const chatResp = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model,
      messages: [
        { role: "system", content: "You output only valid markdown. No preamble." },
        { role: "user", content: prompt },
      ],
      max_tokens: 1500,
      temperature: 0.5,
    },
    {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      timeout: 30000,
    }
  );
  const content = (chatResp.data?.choices?.[0]?.message?.content || "").trim().slice(0, 8000);

  const plan = await ReteachPlan.create({
    lessonId: lessonOid,
    days,
    limit,
    generatedBy: userId,
    sourceHash,
    content: content || "(No content generated.)",
    pinned: false,
  });
  return { planDoc: plan.toObject ? plan.toObject() : plan, cached: false };
}

/**
 * PR14: POST /api/reports/lessons/:lessonId/reteach-plan
 * Body: { days?: 7|14|30, limit?: number (5..20), force?: boolean }
 * Generate or return cached AI reteach plan. Teacher owner or admin only.
 */
router.post("/lessons/:lessonId/reteach-plan", auth, async (req, res) => {
  try {
    const { lessonId } = req.params;
    if (requireLessonReportAccess(req, res, lessonId) !== true) return;
    const lesson = await Lesson.findById(lessonId).select("teacherId topic board tier subject level").lean();
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }
    const ownerId = getLessonOwnerId(lesson);
    const userId = String(req.user._id);
    if (ownerId !== userId && !isAdmin(req.user)) {
      return res.status(403).json({ error: "Not the lesson owner" });
    }

    let days = parseInt(String(req.body?.days ?? "14"), 10);
    if (days !== 7 && days !== 14 && days !== 30) days = 14;
    let limit = parseInt(String(req.body?.limit ?? "10"), 10);
    if (Number.isNaN(limit) || limit < 5) limit = 5;
    if (limit > 20) limit = 20;
    const force = req.body?.force === true;

    const result = await generateReteachPlanInternal(lessonId, lesson, req.user._id, { days, limit, force });
    if (result.error) {
      if (result.error === "NOT_CONFIGURED") return res.status(501).json({ error: result.message });
      if (result.error === "RATE_LIMIT") return res.status(429).json({ error: result.message });
      return res.status(500).json({ error: "Server error" });
    }
    const plan = result.planDoc;
    return res.json({
      ok: true,
      plan: {
        content: plan.content,
        pinned: plan.pinned,
        generatedAt: plan.generatedAt,
        days: plan.days,
        sourceHash: plan.sourceHash,
        editedAt: plan.editedAt,
      },
    });
  } catch (err) {
    console.error("POST reteach-plan error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * PR14: GET /api/reports/lessons/:lessonId/reteach-plan?days=14
 * Returns the most recent reteach plan for this lesson (optionally for given days). Teacher/admin owner only.
 */
router.get("/lessons/:lessonId/reteach-plan", auth, async (req, res) => {
  try {
    const { lessonId } = req.params;
    if (requireLessonReportAccess(req, res, lessonId) !== true) return;
    const lesson = await Lesson.findById(lessonId).select("teacherId").lean();
    if (!lesson) return res.status(404).json({ error: "Lesson not found" });
    const ownerId = getLessonOwnerId(lesson);
    const userId = String(req.user._id);
    if (ownerId !== userId && !isAdmin(req.user)) {
      return res.status(403).json({ error: "Not the lesson owner" });
    }
    const daysParam = req.query.days != null ? parseInt(String(req.query.days), 10) : null;
    const lessonOid = new mongoose.Types.ObjectId(lessonId);
    const baseQuery = { lessonId: lessonOid };
    if (daysParam === 7 || daysParam === 14 || daysParam === 30) baseQuery.days = daysParam;
    // Prefer pinned plan, then latest by generatedAt
    let plan = await ReteachPlan.findOne({ ...baseQuery, pinned: true }).sort({ generatedAt: -1 }).lean();
    if (!plan) plan = await ReteachPlan.findOne(baseQuery).sort({ generatedAt: -1 }).lean();
    if (!plan) {
      return res.status(404).json({ error: "No reteach plan found." });
    }
    return res.json({
      ok: true,
      plan: {
        content: plan.content,
        pinned: plan.pinned,
        generatedAt: plan.generatedAt,
        days: plan.days,
        sourceHash: plan.sourceHash,
        editedAt: plan.editedAt,
        studentSummary: plan.studentSummary ?? "",
        classroomNotes: plan.classroomNotes ?? "",
      },
    });
  } catch (err) {
    console.error("GET reteach-plan error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * PR14/PR15: PATCH /api/reports/lessons/:lessonId/reteach-plan
 * Body: { content?, pinned?, studentSummary?, classroomNotes? }. Updates most recent plan.
 */
router.patch("/lessons/:lessonId/reteach-plan", auth, async (req, res) => {
  try {
    const { lessonId } = req.params;
    if (requireLessonReportAccess(req, res, lessonId) !== true) return;
    const lesson = await Lesson.findById(lessonId).select("teacherId").lean();
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }
    const ownerId = getLessonOwnerId(lesson);
    const userId = String(req.user._id);
    if (ownerId !== userId && !isAdmin(req.user)) {
      return res.status(403).json({ error: "Not the lesson owner" });
    }

    const plan = await ReteachPlan.findOne({ lessonId: new mongoose.Types.ObjectId(lessonId) })
      .sort({ generatedAt: -1 })
      .exec();
    if (!plan) {
      return res.status(404).json({ error: "No reteach plan found. Generate one first." });
    }

    if (req.body?.content !== undefined) {
      const raw = String(req.body.content || "").trim();
      plan.content = raw.slice(0, 8000);
      plan.editedAt = new Date();
      plan.editedBy = req.user._id;
    }
    if (req.body?.pinned !== undefined) {
      plan.pinned = req.body.pinned === true;
    }
    if (req.body?.studentSummary !== undefined) {
      plan.studentSummary = String(req.body.studentSummary || "").trim().slice(0, 1000);
      plan.editedAt = new Date();
      plan.editedBy = req.user._id;
    }
    if (req.body?.classroomNotes !== undefined) {
      plan.classroomNotes = String(req.body.classroomNotes || "").trim().slice(0, 4000);
      plan.editedAt = new Date();
      plan.editedBy = req.user._id;
    }
    await plan.save();

    return res.json({
      ok: true,
      plan: {
        content: plan.content,
        pinned: plan.pinned,
        generatedAt: plan.generatedAt,
        days: plan.days,
        sourceHash: plan.sourceHash,
        editedAt: plan.editedAt,
        studentSummary: plan.studentSummary ?? "",
        classroomNotes: plan.classroomNotes ?? "",
      },
    });
  } catch (err) {
    console.error("PATCH reteach-plan error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * PR16: POST /api/reports/lessons/:lessonId/one-click-fix
 * One-click: attach questions by topic + regenerate reteach plan. Teacher owner or admin only.
 * Body: { days?, topicKey?, attachByTopic?, attachLimit?, regeneratePlan?, planLimit? }
 */
router.post("/lessons/:lessonId/one-click-fix", auth, async (req, res) => {
  try {
    const { lessonId } = req.params;
    if (requireLessonReportAccess(req, res, lessonId) !== true) return;
    const lesson = await Lesson.findById(lessonId)
      .select("teacherId topic board tier subject level status isPublished organisationId examQuestions")
      .lean();
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }
    const ownerId = getLessonOwnerId(lesson);
    const userId = String(req.user._id);
    if (ownerId !== userId && !isAdmin(req.user)) {
      return res.status(403).json({ error: "Not the lesson owner" });
    }

    let days = parseInt(String(req.body?.days ?? "7"), 10);
    if (!Number.isFinite(days) || days < 1) days = 7;
    if (days > 30) days = 30;
    const attachByTopic = req.body?.attachByTopic !== false;
    let attachLimit = parseInt(String(req.body?.attachLimit ?? "10"), 10);
    if (!Number.isFinite(attachLimit) || attachLimit < 1) attachLimit = 10;
    if (attachLimit > 20) attachLimit = 20;
    const regeneratePlan = req.body?.regeneratePlan !== false;
    let planLimit = parseInt(String(req.body?.planLimit ?? "10"), 10);
    if (!Number.isFinite(planLimit) || planLimit < 1) planLimit = 10;
    if (planLimit > 20) planLimit = 20;

    let topicKey = req.body?.topicKey != null ? String(req.body.topicKey).trim() : null;
    if (topicKey === "") topicKey = null;
    if (topicKey != null) {
      const found = findTopicByKey(topicKey.toLowerCase());
      if (!found) {
        return res.status(400).json({
          error: "Invalid topicKey",
          message: "topicKey is not in the Biology taxonomy.",
        });
      }
      topicKey = found.key;
    } else {
      const derived = topicToKey(lesson.topic || "");
      if (!derived) {
        if (attachByTopic) {
          return res.status(400).json({
            error: "Invalid topic",
            message: "Lesson topic isn't mapped to Biology taxonomy. Provide topicKey in body or set lesson topic.",
          });
        }
        topicKey = null;
      } else {
        const found = findTopicByKey(derived);
        if (!found && attachByTopic) {
          return res.status(400).json({
            error: "Invalid topic",
            message: "Lesson topic isn't mapped to Biology taxonomy. Provide topicKey in body or set lesson topic.",
          });
        }
        topicKey = found ? found.key : null;
      }
    }

    let attach = { requested: attachLimit, added: 0, addedIds: [] };
    if (attachByTopic && topicKey) {
      try {
        const attachResult = await attachExamQuestionsByTopic(lesson, { topicKey, limit: attachLimit });
        attach = {
          requested: attachResult.requested,
          added: attachResult.added,
          addedIds: attachResult.addedIds || [],
        };
        if (attachResult.added > 0) {
          const freshLesson = await Lesson.findById(lessonId).select("examQuestions").lean();
          if (freshLesson) Object.assign(lesson, freshLesson);
        }
      } catch (attachErr) {
        if (attachErr.code === "INVALID_TOPIC_KEY" || attachErr.code === "INVALID_TOPIC") {
          return res.status(400).json({ error: attachErr.code === "INVALID_TOPIC_KEY" ? "Invalid topicKey" : "Invalid topic", message: attachErr.message });
        }
        throw attachErr;
      }
    }

    let plan = { status: "SKIPPED", id: null, pinned: false, updatedAt: null, cached: false };
    if (regeneratePlan) {
      const planResult = await generateReteachPlanInternal(lessonId, lesson, req.user._id, { days, limit: planLimit });
      if (planResult?.error === "NOT_CONFIGURED") {
        plan = { ...plan, status: "NOT_CONFIGURED" };
      } else if (planResult?.error === "RATE_LIMIT") {
        plan = { ...plan, status: "RATE_LIMIT" };
      } else if (planResult?.planDoc) {
        const p = planResult.planDoc;
        plan = {
          status: planResult.cached ? "CACHED" : "UPDATED",
          id: p._id ? String(p._id) : null,
          pinned: !!p.pinned,
          updatedAt: p.updatedAt != null && typeof p.updatedAt.toISOString === "function" ? p.updatedAt.toISOString() : (p.editedAt || p.generatedAt) ? new Date(p.editedAt || p.generatedAt).toISOString() : null,
          cached: !!planResult.cached,
        };
      } else {
        plan = { ...plan, status: "ERROR" };
      }
    }

    const displayTopic = topicKey ? findTopicByKey(topicKey)?.topic ?? topicKey : null;
    const responseBody = {
      ok: true,
      lessonId,
      topicKey: topicKey || undefined,
      topic: displayTopic ?? undefined,
      attach: { requested: attach.requested, added: attach.added, addedIds: attach.addedIds },
      plan,
    };
    Event.create({
      type: "ONE_CLICK_FIX",
      userId: req.user._id,
      lessonId: lesson._id,
      meta: {
        topicKey: topicKey || undefined,
        days,
        attachLimit,
        planLimit,
        attachAdded: attach.added,
        planStatus: plan.status,
        planCached: !!plan.cached,
      },
    }).catch(() => {});
    return res.status(200).json(responseBody);
  } catch (err) {
    console.error("POST one-click-fix error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * PR13.3: GET /api/reports/students/me/recommendations?days=14&limit=6
 * Auth required. Returns for req.user. Student-facing: top struggle topics + recommended lessons.
 */
router.get("/students/me/recommendations", auth, async (req, res) => {
  try {
    const days = Math.min(30, Math.max(1, parseInt(String(req.query.days || "14"), 10) || 14));
    let limit = parseInt(String(req.query.limit || "6"), 10);
    if (Number.isNaN(limit) || limit < 1) limit = 6;
    if (limit > 20) limit = 20;

    const userId = req.user._id;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const attempts = await PracticeAttempt.find({
      userId,
      source: "practice",
      questionId: { $ne: null },
      createdAt: { $gte: since },
    })
      .select("questionId isCorrect confidence")
      .lean();

    if (attempts.length === 0) {
      return res.json({ ok: true, days, topics: [], lessons: [] });
    }

    const questionIds = [...new Set(attempts.map((a) => String(a.questionId)).filter(Boolean))];
    const examQuestions = await ExamQuestion.find({ _id: { $in: questionIds } })
      .select("topicKey")
      .lean();
    const qidToTopicKey = new Map();
    examQuestions.forEach((q) => {
      const key = q.topicKey != null && String(q.topicKey).trim() !== "" ? String(q.topicKey).trim().toLowerCase() : null;
      if (key) qidToTopicKey.set(String(q._id), key);
    });

    const byTopic = new Map();
    for (const a of attempts) {
      const topicKey = qidToTopicKey.get(String(a.questionId));
      if (!topicKey) continue;
      if (!byTopic.has(topicKey)) {
        byTopic.set(topicKey, { wrong: 0, correct: 0, highConfidenceWrong: 0 });
      }
      const rec = byTopic.get(topicKey);
      if (a.isCorrect) rec.correct += 1;
      else {
        rec.wrong += 1;
        if (a.confidence === 3) rec.highConfidenceWrong += 1;
      }
    }

    const topics = Array.from(byTopic.entries()).map(([topicKey, rec]) => ({
      topicKey,
      topic: findTopicByKey(topicKey)?.topic ?? topicKey,
      score: rec.highConfidenceWrong * 3 + rec.wrong * 1 - rec.correct * 0.5,
      wrong: rec.wrong,
      highConfidenceWrong: rec.highConfidenceWrong,
    }));
    topics.sort((a, b) => b.score - a.score);
    const topTopicKeys = topics.slice(0, 10).map((t) => t.topicKey);

    if (topTopicKeys.length === 0) {
      return res.json({ ok: true, days, topics, lessons: [] });
    }

    const topicDisplayNames = topTopicKeys
      .map((k) => findTopicByKey(k)?.topic)
      .filter(Boolean);
    if (topicDisplayNames.length === 0) {
      return res.json({ ok: true, days, topics, lessons: [] });
    }

    const lessonQuery = {
      subject: /^Biology$/i,
      level: /GCSE/i,
      $or: [{ board: /AQA/i }, { board: "AQA" }, { board: { $exists: false } }],
      status: "published",
      isPublished: true,
      topic: { $in: topicDisplayNames },
    };

    const rawLessons = await Lesson.find(lessonQuery)
      .select("_id title topic subject level board description isFreePreview status isPublished teacherName pages")
      .sort({ topic: 1, createdAt: -1 })
      .limit(limit * 3)
      .lean();

    const perTopic = new Map();
    for (const l of rawLessons) {
      const t = String(l.topic || "").trim();
      if (!perTopic.has(t)) perTopic.set(t, []);
      const arr = perTopic.get(t);
      if (arr.length < 2) arr.push(l);
    }
    const lessonList = [];
    const seenIds = new Set();
    for (const topicKey of topTopicKeys) {
      const displayName = findTopicByKey(topicKey)?.topic;
      if (!displayName) continue;
      const arr = perTopic.get(displayName) || [];
      for (const l of arr) {
        if (lessonList.length >= limit) break;
        const idStr = String(l._id);
        if (seenIds.has(idStr)) continue;
        seenIds.add(idStr);
        lessonList.push(l);
      }
      if (lessonList.length >= limit) break;
    }

    const lessonIds = lessonList.map((l) => l._id);
    let unlockSet = new Set();
    if (userId) {
      const unlocks = await LessonUnlock.find({ userId, lessonId: { $in: lessonIds } })
        .select("lessonId")
        .lean();
      unlockSet = new Set(unlocks.map((r) => String(r.lessonId)));
    }

    const fullUser = await User.findById(userId)
      .select("userType subscriptionV2 subscription purchasedLessons")
      .lean();

    const lessons = await Promise.all(
      lessonList.map(async (l) => {
        const isFreePreview = Boolean(l.isFreePreview);
        const status = l.status || (l.isPublished ? "published" : "draft");
        const isPublished = String(status).toLowerCase() === "published";
        const decision = fullUser
          ? await canAccessContent(fullUser, {
              _id: l._id,
              id: l._id?.toString(),
              isFreePreview,
              isPublished,
            }, { unlockSet })
          : { allowed: false, reason: "UNAUTHENTICATED" };
        const description = deriveLessonCardDescription(l);
        return {
          id: String(l._id),
          _id: l._id,
          title: l.title ?? "Untitled",
          topic: l.topic ?? "",
          description: description || "",
          subject: l.subject ?? "",
          level: l.level ?? "",
          examBoard: l.board ?? "",
          teacherName: l.teacherName ?? "Teacher",
          locked: !decision.allowed,
          reason: decision.reason,
          isFreePreview: isFreePreview,
          hasAccess: decision.allowed,
        };
      })
    );

    return res.json({ ok: true, days, topics, lessons });
  } catch (err) {
    console.error("GET /reports/students/me/recommendations error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
