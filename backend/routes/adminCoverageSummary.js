/**
 * Read-only admin coverage: published counts per canonical taxonomy topic (launch readiness).
 * GET /api/admin/coverage/topic-summary?specKey=aqa-gcse-biology
 * Admin or content_manager only. No writes.
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const requireContentManager = require("../middleware/requireContentManager");
const { assertValidSpecKey } = require("../utils/specTopicValidation");
const { isTopicGroup } = require("../utils/topicTaxonomy");
const { getMergedTaxonomyBySpecKey } = require("../services/adminTaxonomyService");
const { buildTopicKey, queryCandidates } = require("../utils/topicKey");
const Lesson = require("../models/Lesson");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const TopicFlashcard = require("../models/TopicFlashcard");
const ExamQuestion = require("../models/ExamQuestion");
const { sendInternalError } = require("../utils/safeErrorResponse");

function sumFromMap(map, candidates) {
  return candidates.reduce((acc, k) => acc + (map.get(k) || 0), 0);
}

async function aggregatePublishedByTopicKey(Model, candidateKeysAll, matchExtra) {
  if (!candidateKeysAll.length) return new Map();
  const rows = await Model.aggregate([
    { $match: { topicKey: { $in: candidateKeysAll }, ...matchExtra } },
    { $group: { _id: "$topicKey", count: { $sum: 1 } } },
  ]);
  const map = new Map();
  for (const r of rows) map.set(r._id, r.count);
  return map;
}

router.get("/coverage/topic-summary", auth, requireContentManager, async (req, res) => {
  try {
    const specKey = String(req.query.specKey || "").trim();
    if (!specKey) return res.status(400).json({ error: "specKey is required" });

    let taxonomy;
    try {
      assertValidSpecKey(specKey);
      taxonomy = await getMergedTaxonomyBySpecKey(specKey);
    } catch (e) {
      if (e.code === "INVALID_SPEC_KEY") {
        return res.status(400).json({ error: e.message || "Invalid specKey" });
      }
      throw e;
    }
    if (!taxonomy || !Array.isArray(taxonomy.units)) {
      return res.status(503).json({ error: "Taxonomy unavailable for this spec" });
    }

    const topics = [];
    for (const unit of taxonomy.units || []) {
      for (const t of unit.topics || []) {
        if (!t.key) continue;
        if (isTopicGroup(t)) continue;
        topics.push({
          topicLabel: t.topic || t.key,
          topicSlug: String(t.key).trim(),
          namespacedTopicKey: buildTopicKey(specKey, t.key),
        });
      }
    }

    const candidateKeysAll = Array.from(
      new Set(topics.flatMap((t) => queryCandidates(specKey, t.topicSlug)))
    );

    const [lessonMap, quizMap, examMap, flashMap] = await Promise.all([
      aggregatePublishedByTopicKey(Lesson, candidateKeysAll, {
        isPublished: true,
        status: "published",
      }),
      aggregatePublishedByTopicKey(TopicQuizQuestion, candidateKeysAll, {
        status: "published",
        kind: "quiz",
        isArchived: { $ne: true },
      }),
      aggregatePublishedByTopicKey(ExamQuestion, candidateKeysAll, {
        status: "published",
        isArchived: { $ne: true },
      }),
      aggregatePublishedByTopicKey(TopicFlashcard, candidateKeysAll, {
        status: "published",
        isArchived: { $ne: true },
      }),
    ]);

    const rows = topics.map((t) => {
      const candidates = queryCandidates(specKey, t.topicSlug);
      const publishedLessonCount = sumFromMap(lessonMap, candidates);
      const publishedQuizCount = sumFromMap(quizMap, candidates);
      const publishedExamCount = sumFromMap(examMap, candidates);
      const publishedFlashcardCount = sumFromMap(flashMap, candidates);

      let status;
      if (
        publishedLessonCount >= 1 &&
        publishedQuizCount >= 1 &&
        publishedExamCount >= 1 &&
        publishedFlashcardCount >= 1
      ) {
        status = "ready";
      } else if (publishedLessonCount >= 1) {
        status = "partial";
      } else {
        status = "missing";
      }

      const missingParts = [];
      if (publishedLessonCount < 1) missingParts.push("lesson");
      if (publishedQuizCount < 1) missingParts.push("quiz");
      if (publishedExamCount < 1) missingParts.push("exam");
      if (publishedFlashcardCount < 1) missingParts.push("flashcards");

      return {
        specKey,
        topicKey: t.namespacedTopicKey,
        topicLabel: t.topicLabel,
        publishedLessonCount,
        publishedQuizCount,
        publishedExamCount,
        publishedFlashcardCount,
        status,
        missingSummary: missingParts.length ? missingParts.join(", ") : null,
      };
    });

    return res.json(rows);
  } catch (err) {
    console.error("[admin/coverage/topic-summary]", err);
    return sendInternalError("admin/coverage/topic-summary", err, res);
  }
});

module.exports = router;
