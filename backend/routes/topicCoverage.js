/**
 * PR-COVERAGE-1: Teacher topic coverage — counts per taxonomy topic for Flashcards, Quiz, Exam, Past Paper Qs.
 * GET /api/teacher/topic-coverage?specKey=aqa-gcse-biology
 * Optimized: single aggregation per collection, compound indexes, optional cache, timing logs.
 */
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const { assertValidSpecKey } = require("../utils/specTopicValidation");
const { getTaxonomyBySpecKey } = require("../utils/topicTaxonomy");
const { buildTopicKey, queryCandidates } = require("../utils/topicKey");

const TopicFlashcard = require("../models/TopicFlashcard");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const ExamQuestion = require("../models/ExamQuestion");
const PastPaperQuestion = require("../models/PastPaperQuestion");

const auth = require("../middleware/auth");
const { sendInternalError } = require("../utils/safeErrorResponse");

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map(); // key -> { at, data }

function isTeacherOrAdmin(req) {
  if (!req.user) return false;
  const t = (req.user.userType || req.user.role || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user.isAdmin === true;
}

function getUserId(req) {
  return req.user?._id || req.user?.id || req.user?.userId;
}

function toObjectId(userId) {
  if (userId == null) return null;
  if (userId instanceof mongoose.Types.ObjectId) return userId;
  try {
    return new mongoose.Types.ObjectId(String(userId));
  } catch {
    return null;
  }
}

/**
 * Single aggregation: $match topicKey in candidateKeys + owner field + isArchived, $group by topicKey.
 * ownerField: "ownerId" | "teacherId" so the right index is used (no $or).
 */
async function aggregateCountsByTopicKey(Model, candidateKeys, userOid, ownerField, extraMatch = {}) {
  if (!userOid || !Array.isArray(candidateKeys) || candidateKeys.length === 0) {
    return new Map();
  }
  const match = {
    topicKey: { $in: candidateKeys },
    [ownerField]: userOid,
    isArchived: { $ne: true },
    ...extraMatch,
  };
  const rows = await Model.aggregate([
    { $match: match },
    { $group: { _id: "$topicKey", count: { $sum: 1 } } },
  ]);
  const map = new Map();
  for (const r of rows) map.set(r._id, r.count);
  return map;
}

router.get("/", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  const totalLabel = "topicCoverage:total";
  console.time(totalLabel);
  try {
    const specKey = String(req.query.specKey || "").trim();
    if (!specKey) return res.status(400).json({ error: "specKey is required" });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const cacheKey = `${specKey}:${userId}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      console.timeEnd(totalLabel);
      return res.json(cached.data);
    }

    let taxonomy;
    console.time("topicCoverage:taxonomy");
    try {
      assertValidSpecKey(specKey);
      taxonomy = getTaxonomyBySpecKey(specKey);
    } catch (taxErr) {
      console.timeEnd("topicCoverage:taxonomy");
      if (taxErr.code === "INVALID_SPEC_KEY") {
        return res.status(400).json({ error: taxErr.message });
      }
      if (taxErr.code === "ENOENT" || (taxErr.message && String(taxErr.message).includes("ENOENT"))) {
        return res.status(503).json({ error: "Content coverage is temporarily unavailable. Taxonomy data could not be loaded." });
      }
      throw taxErr;
    }
    console.timeEnd("topicCoverage:taxonomy");

    const units = taxonomy?.units || [];
    const topics = [];
    for (const unit of units) {
      for (const t of unit.topics || []) {
        topics.push({
          unit: unit.unit,
          topic: t.topic,
          topicKey: t.key,
          namespacedTopicKey: buildTopicKey(specKey, t.key),
        });
      }
    }

    const candidateKeysAll = Array.from(
      new Set(topics.flatMap((t) => queryCandidates(specKey, t.topicKey)))
    );
    const userOid = toObjectId(userId);

    console.time("topicCoverage:aggregations");
    const [flashMap, quizMcqMap, quizShortMap, examMap, pastPaperQMap] = await Promise.all([
      aggregateCountsByTopicKey(TopicFlashcard, candidateKeysAll, userOid, "ownerId"),
      aggregateCountsByTopicKey(TopicQuizQuestion, candidateKeysAll, userOid, "ownerId", { type: "mcq" }),
      aggregateCountsByTopicKey(TopicQuizQuestion, candidateKeysAll, userOid, "ownerId", { type: "short-answer" }),
      aggregateCountsByTopicKey(ExamQuestion, candidateKeysAll, userOid, "teacherId"),
      aggregateCountsByTopicKey(PastPaperQuestion, candidateKeysAll, userOid, "ownerId"),
    ]);
    console.timeEnd("topicCoverage:aggregations");

    console.time("topicCoverage:merge");
    const sumFrom = (m, candidates) => candidates.reduce((acc, k) => acc + (m.get(k) || 0), 0);

    const unitsOut = units.map((unit) => {
      const topicsOut = (unit.topics || []).map((t) => {
        const namespaced = buildTopicKey(specKey, t.key);
        const candidates = queryCandidates(specKey, t.key);

        const counts = {
          flashcards: sumFrom(flashMap, candidates),
          quiz_mcq: sumFrom(quizMcqMap, candidates),
          quiz_short: sumFrom(quizShortMap, candidates),
          examQuestions: sumFrom(examMap, candidates),
          pastPaperQuestions: sumFrom(pastPaperQMap, candidates),
        };

        const outOf = 5;
        const score =
          (counts.flashcards > 0 ? 1 : 0) +
          (counts.quiz_mcq > 0 ? 1 : 0) +
          (counts.quiz_short > 0 ? 1 : 0) +
          (counts.examQuestions > 0 ? 1 : 0) +
          (counts.pastPaperQuestions > 0 ? 1 : 0);

        return {
          topic: t.topic,
          topicKey: t.key,
          namespacedTopicKey: namespaced,
          counts,
          coverage: { any: score > 0, score, outOf },
        };
      });

      return { unit: unit.unit, topics: topicsOut };
    });

    const allTopicRows = unitsOut.flatMap((u) => u.topics);
    const totals = {
      topics: allTopicRows.length,
      topicsWithAny: allTopicRows.filter((x) => x.coverage.any).length,
      topicsFullyCovered: allTopicRows.filter((x) => x.coverage.score === x.coverage.outOf).length,
    };

    console.timeEnd("topicCoverage:merge");
    console.timeEnd(totalLabel);

    const payload = { specKey, units: unitsOut, totals };
    cache.set(cacheKey, { at: Date.now(), data: payload });
    return res.json(payload);
  } catch (err) {
    console.timeEnd(totalLabel);
    console.error("[topicCoverage]", err);
    return sendInternalError("topic-coverage/get", err, res);
  }
});

module.exports = router;
