/**
 * Student recommendations service — struggle topics + recommended lessons.
 * Extracted from reports/students/me/recommendations.
 */
const PracticeAttempt = require("../models/PracticeAttempt");
const Lesson = require("../models/Lesson");
const LessonUnlock = require("../models/LessonUnlock");
const User = require("../models/User");
const { findTopicByKey } = require("../utils/topicTaxonomy");
const { parseTopicKey } = require("../utils/topicKey");
const { canAccessContent } = require("../utils/canAccessContent");
const { deriveLessonCardDescription } = require("../utils/deriveLessonCardDescription");

/**
 * Get student recommendations (struggle topics + lessons).
 * @param {string|import("mongoose").Types.ObjectId} userId
 * @param {{ days?: number, limit?: number }} [opts]
 * @returns {Promise<{ ok: boolean, days: number, topics: Array, lessons: Array }>}
 */
async function getRecommendations(userId, opts = {}) {
  const days = Math.min(30, Math.max(1, opts.days ?? 14));
  let limit = opts.limit ?? 6;
  if (Number.isNaN(limit) || limit < 1) limit = 6;
  if (limit > 20) limit = 20;

  const since = new Date();
  since.setDate(since.getDate() - days);

  const attempts = await PracticeAttempt.find({
    studentId: userId,
    createdAt: { $gte: since },
  })
    .select("topicKey outcome confidence")
    .lean();

  if (attempts.length === 0) {
    return { ok: true, days, topics: [], lessons: [] };
  }

  const byTopic = new Map();
  for (const a of attempts) {
    const rawKey = (a.topicKey != null && String(a.topicKey).trim()) || "";
    const slug = parseTopicKey(rawKey).topicKey || rawKey;
    const topicKey = slug ? slug.toLowerCase() : "";
    if (!topicKey) continue;
    if (!byTopic.has(topicKey)) {
      byTopic.set(topicKey, { wrong: 0, correct: 0, highConfidenceWrong: 0 });
    }
    const rec = byTopic.get(topicKey);
    if (a.outcome === "correct") rec.correct += 1;
    else if (a.outcome === "wrong") {
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
    return { ok: true, days, topics, lessons: [] };
  }

  const topicDisplayNames = topTopicKeys
    .map((k) => findTopicByKey(k)?.topic)
    .filter(Boolean);
  if (topicDisplayNames.length === 0) {
    return { ok: true, days, topics, lessons: [] };
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
        ? await canAccessContent(
            fullUser,
            {
              _id: l._id,
              id: l._id?.toString(),
              isFreePreview,
              isPublished,
            },
            { unlockSet }
          )
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
        isFreePreview,
        hasAccess: decision.allowed,
      };
    })
  );

  return { ok: true, days, topics, lessons };
}

module.exports = { getRecommendations };
