/**
 * Content Graph API — topic graph, lesson graph, coverage, rebuild.
 * Route contract: 4xx for bad input, 404 for not found, no stack traces in responses.
 */
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const contentGraphService = require("../services/contentGraphService");
const contentCoverageService = require("../services/contentCoverageService");
const auth = require("../middleware/auth");

function isValidObjectId(id) {
  return id && mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === String(id);
}

/**
 * GET /api/content-graph/topic/:specKey/:topicKey
 * Topic node, linked content, edge counts.
 */
router.get("/topic/:specKey/:topicKey", auth, async (req, res) => {
  try {
    const { specKey, topicKey } = req.params;
    const graph = await contentGraphService.getTopicGraph(specKey, topicKey);
    if (!graph) return res.status(404).json({ error: "Topic not found" });
    const byType = {};
    for (const n of graph.linkedNodes || []) {
      byType[n.nodeType] = (byType[n.nodeType] || 0) + 1;
    }
    res.json({
      topicNode: graph.topicNode,
      linkedNodes: graph.linkedNodes,
      edgeCount: graph.edgeCount,
      countsByType: byType,
    });
  } catch (err) {
    console.error("[content-graph] getTopicGraph", err);
    res.status(500).json({ error: "Failed to get topic graph" });
  }
});

/**
 * GET /api/content-graph/lesson/:lessonId
 * Lesson node, linked topics.
 */
router.get("/lesson/:lessonId", auth, async (req, res) => {
  try {
    const { lessonId } = req.params;
    if (!isValidObjectId(lessonId)) return res.status(400).json({ error: "Invalid lessonId" });
    const graph = await contentGraphService.getLessonGraph(lessonId);
    if (!graph) return res.status(404).json({ error: "Lesson not found" });
    res.json({
      lessonNode: graph.lessonNode,
      topicNodes: graph.topicNodes,
      lesson: graph.lesson,
    });
  } catch (err) {
    console.error("[content-graph] getLessonGraph", err);
    res.status(500).json({ error: "Failed to get lesson graph" });
  }
});

/**
 * GET /api/content-graph/spec-coverage/:specKey
 * All topics in spec with coverage. For admin Content Coverage page.
 */
router.get("/spec-coverage/:specKey", auth, async (req, res) => {
  try {
    const { specKey } = req.params;
    const specCoverage = await contentCoverageService.getSpecCoverage(specKey);
    if (!specCoverage) return res.status(404).json({ error: "Spec not found" });
    res.json(specCoverage);
  } catch (err) {
    console.error("[content-graph] getSpecCoverage", err);
    res.status(500).json({ error: "Failed to get spec coverage" });
  }
});

/**
 * GET /api/content-graph/coverage/:specKey/:topicKey
 * Stable shape: specKey, topicKey, counts, score, status, weakAreas. Flat fields kept for backward compat.
 */
router.get("/coverage/:specKey/:topicKey", auth, async (req, res) => {
  try {
    const { specKey, topicKey } = req.params;
    const coverage = await contentCoverageService.getTopicCoverage(specKey, topicKey);
    if (!coverage) return res.status(404).json({ error: "Topic not found" });
    const normalized = contentCoverageService.normalizeCoverageResponse(coverage);
    res.json({
      ...normalized,
      lessonCount: coverage.lessonCount,
      flashcardCount: coverage.flashcardCount,
      quizCount: coverage.quizCount,
      examQuestionCount: coverage.examQuestionCount,
      issueCount: coverage.issueCount,
      coverageScore: coverage.coverageScore,
    });
  } catch (err) {
    console.error("[content-graph] getTopicCoverage", err);
    res.status(500).json({ error: "Failed to get coverage" });
  }
});

/**
 * POST /api/content-graph/rebuild/lesson/:lessonId
 * Rebuild graph nodes and edges for a single lesson.
 */
router.post("/rebuild/lesson/:lessonId", auth, async (req, res) => {
  try {
    const { lessonId } = req.params;
    if (!isValidObjectId(lessonId)) return res.status(400).json({ error: "Invalid lessonId" });
    const Lesson = require("../models/Lesson");
    const TopicFlashcard = require("../models/TopicFlashcard");
    const TopicQuizQuestion = require("../models/TopicQuizQuestion");
    const ExamQuestion = require("../models/ExamQuestion");
    const { queryCandidates } = require("../utils/topicKey");

    const lesson = await Lesson.findById(lessonId).lean();
    if (!lesson) return res.status(404).json({ error: "Lesson not found" });

    const specKey = lesson.specKey || require("../utils/topicKey").parseTopicKey(lesson.topicKey || "").specKey || "aqa-gcse-biology";
    const topicKey = lesson.topicKey || "";
    const result = await contentGraphService.linkLessonToTopic(lesson);
    if (!result) return res.status(500).json({ error: "Failed to link lesson" });

    const candidates = queryCandidates(specKey, (topicKey || "").split(":").pop() || topicKey);
    const flashcards = await TopicFlashcard.find({ topicKey: { $in: candidates }, status: "published", isArchived: { $ne: true } }).lean();
    const quizQuestions = await TopicQuizQuestion.find({ topicKey: { $in: candidates }, status: "published", isArchived: { $ne: true } }).lean();
    const examQuestions = await ExamQuestion.find({ topicKey: { $in: candidates }, status: "published" }).lean();

    for (const fc of flashcards) await contentGraphService.linkFlashcardToTopic(fc);
    for (const q of quizQuestions) await contentGraphService.linkQuizQuestionToTopic(q);
    for (const eq of examQuestions) await contentGraphService.linkQuestionToTopic(eq);

    res.json({ ok: true, lessonId, lessonNode: result.lessonNode?._id });
  } catch (err) {
    console.error("[content-graph] rebuild/lesson", err);
    res.status(500).json({ error: "Failed to rebuild lesson graph" });
  }
});

/**
 * POST /api/content-graph/rebuild/topic
 * Body: { specKey, topicKey }
 * Rebuild graph for a topic (taxonomy node + all linked content).
 */
router.post("/rebuild/topic", auth, async (req, res) => {
  try {
    const { specKey, topicKey } = req.body || {};
    if (!specKey || !topicKey) return res.status(400).json({ error: "specKey and topicKey required" });

    const { queryCandidates } = require("../utils/topicKey");
    const Lesson = require("../models/Lesson");
    const TopicFlashcard = require("../models/TopicFlashcard");
    const TopicQuizQuestion = require("../models/TopicQuizQuestion");
    const ExamQuestion = require("../models/ExamQuestion");

    const topicOnly = (topicKey || "").split(":").pop() || topicKey;
    const candidates = queryCandidates(specKey, topicOnly);

    const topicNode = await contentGraphService.resolveTopicNode(specKey, topicOnly);
    if (!topicNode) return res.status(404).json({ error: "Topic not found" });

    const lessons = await Lesson.find({ topicKey: { $in: candidates } }).lean();
    const flashcards = await TopicFlashcard.find({ topicKey: { $in: candidates }, status: "published", isArchived: { $ne: true } }).lean();
    const quizQuestions = await TopicQuizQuestion.find({ topicKey: { $in: candidates }, status: "published", isArchived: { $ne: true } }).lean();
    const examQuestions = await ExamQuestion.find({ topicKey: { $in: candidates }, status: "published" }).lean();

    for (const l of lessons) await contentGraphService.linkLessonToTopic(l);
    for (const fc of flashcards) await contentGraphService.linkFlashcardToTopic(fc);
    for (const q of quizQuestions) await contentGraphService.linkQuizQuestionToTopic(q);
    for (const eq of examQuestions) await contentGraphService.linkQuestionToTopic(eq);

    res.json({
      ok: true,
      topicNode: topicNode._id,
      lessonCount: lessons.length,
      flashcardCount: flashcards.length,
      quizCount: quizQuestions.length,
      examCount: examQuestions.length,
    });
  } catch (err) {
    console.error("[content-graph] rebuild/topic", err);
    res.status(500).json({ error: "Failed to rebuild topic graph" });
  }
});

module.exports = router;
