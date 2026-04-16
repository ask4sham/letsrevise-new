/**
 * Content Graph API — topic graph, lesson graph, coverage, rebuild.
 * Route contract: 4xx for bad input, 404 for not found, no stack traces in responses.
 */
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const contentGraphService = require("../services/contentGraphService");
const contentCoverageService = require("../services/contentCoverageService");
const curriculumGapDetectionService = require("../services/curriculumGapDetectionService");
const auth = require("../middleware/auth");
const requireContentManager = require("../middleware/requireContentManager");

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

/**
 * POST /api/content-graph/rebuild/spec/:specKey
 * Rebuild graph for all topics in the spec.
 * Returns { topicsRebuilt, lessonLinksCreated, flashcardLinksCreated }.
 */
router.post("/rebuild/spec/:specKey", auth, async (req, res) => {
  try {
    const { specKey } = req.params;
    if (!specKey) return res.status(400).json({ error: "specKey required" });

    const adminTaxonomyService = require("../services/adminTaxonomyService");
    const { queryCandidates } = require("../utils/topicKey");
    const Lesson = require("../models/Lesson");
    const TopicFlashcard = require("../models/TopicFlashcard");
    const TopicQuizQuestion = require("../models/TopicQuizQuestion");
    const ExamQuestion = require("../models/ExamQuestion");

    const taxonomy = await adminTaxonomyService.getMergedTaxonomyBySpecKey(specKey);
    if (!taxonomy || !Array.isArray(taxonomy.units)) {
      return res.status(404).json({ error: "Spec not found" });
    }

    const topicEntries = [];
    for (const unit of taxonomy.units) {
      for (const t of unit.topics || []) {
        const key = t.key || t.topicKey;
        if (!key) continue;
        const topicKey = key.includes(":") ? key : `${specKey}:${key}`;
        topicEntries.push({ topicKey });
      }
    }

    let topicsRebuilt = 0;
    let lessonLinksCreated = 0;
    let flashcardLinksCreated = 0;

    for (const { topicKey } of topicEntries) {
      const topicOnly = (topicKey || "").split(":").pop() || topicKey;
      const candidates = queryCandidates(specKey, topicOnly);

      const topicNode = await contentGraphService.resolveTopicNode(specKey, topicOnly);
      if (!topicNode) continue;

      const lessons = await Lesson.find({ topicKey: { $in: candidates } }).lean();
      const flashcards = await TopicFlashcard.find({
        topicKey: { $in: candidates },
        status: "published",
        isArchived: { $ne: true },
      }).lean();
      const quizQuestions = await TopicQuizQuestion.find({
        topicKey: { $in: candidates },
        status: "published",
        isArchived: { $ne: true },
      }).lean();
      const examQuestions = await ExamQuestion.find({
        topicKey: { $in: candidates },
        status: "published",
      }).lean();

      for (const l of lessons) await contentGraphService.linkLessonToTopic(l);
      for (const fc of flashcards) await contentGraphService.linkFlashcardToTopic(fc);
      for (const q of quizQuestions) await contentGraphService.linkQuizQuestionToTopic(q);
      for (const eq of examQuestions) await contentGraphService.linkQuestionToTopic(eq);

      topicsRebuilt += 1;
      lessonLinksCreated += lessons.length;
      flashcardLinksCreated += flashcards.length;
    }

    res.json({
      ok: true,
      specKey,
      topicsRebuilt,
      lessonLinksCreated,
      flashcardLinksCreated,
    });
  } catch (err) {
    console.error("[content-graph] rebuild/spec", err);
    res.status(500).json({ error: "Failed to rebuild spec graph" });
  }
});

/**
 * GET /api/content-graph/gaps/:specKey
 * Curriculum gap analysis for a spec. Admin only.
 */
router.get("/gaps/:specKey", auth, requireContentManager, async (req, res) => {
  try {
    const { specKey } = req.params;
    const gaps = await curriculumGapDetectionService.detectTopicGaps(specKey);
    const weakTopics = gaps.filter((g) => g.coverageStatus === "weak").length;
    const partialTopics = gaps.filter((g) => g.coverageStatus === "partial").length;
    const strongTopics = gaps.filter((g) => g.coverageStatus === "strong").length;
    const highPriorityCount = gaps.filter((g) => (g.priorityScore ?? 0) > 0).length;
    res.json({
      specKey,
      summary: {
        totalTopics: gaps.length,
        weakTopics,
        partialTopics,
        strongTopics,
        highestPriorityCount: highPriorityCount,
      },
      gaps,
    });
  } catch (err) {
    console.error("[content-graph] getSpecGaps", err);
    res.status(500).json({ error: "Failed to get spec gaps" });
  }
});

/**
 * GET /api/content-graph/gaps/:specKey/:topicKey
 * Single topic gap analysis. Admin only.
 */
router.get("/gaps/:specKey/:topicKey", auth, requireContentManager, async (req, res) => {
  try {
    const { specKey, topicKey } = req.params;
    const gap = await curriculumGapDetectionService.detectSingleTopicGap(specKey, topicKey);
    if (!gap) return res.status(404).json({ error: "Topic not found" });
    res.json(gap);
  } catch (err) {
    console.error("[content-graph] getTopicGap", err);
    res.status(500).json({ error: "Failed to get topic gap" });
  }
});

/** Topic Evidence — admin-only learning evidence dashboard */
const topicEvidenceService = require("../services/topicEvidenceService");

/**
 * GET /api/content-graph/evidence/:specKey
 * Spec-level evidence for all topics.
 */
router.get("/evidence/:specKey", auth, requireContentManager, async (req, res) => {
  try {
    const { specKey } = req.params;
    const result = await topicEvidenceService.getSpecEvidence(specKey);
    res.json(result);
  } catch (err) {
    console.error("[content-graph] getSpecEvidence", err);
    res.status(500).json({ error: err?.message || "Failed to get spec evidence" });
  }
});

/**
 * GET /api/content-graph/evidence/:specKey/:topicKey
 * Single topic evidence.
 */
router.get("/evidence/:specKey/:topicKey", auth, requireContentManager, async (req, res) => {
  try {
    const { specKey, topicKey } = req.params;
    const result = await topicEvidenceService.getTopicEvidence(specKey, topicKey);
    res.json(result);
  } catch (err) {
    console.error("[content-graph] getTopicEvidence", err);
    res.status(500).json({ error: err?.message || "Failed to get topic evidence" });
  }
});

/** Topic Command Center — unified operational view per topic */
const topicIntelligenceService = require("../services/topicIntelligenceService");

/** Evidence Review Worklist — admin-only blocked/review_required topics */
const evidenceReviewWorklistService = require("../services/evidenceReviewWorklistService");

/**
 * GET /api/content-graph/evidence-review/:specKey
 * Evidence review worklist for a spec.
 */
router.get("/evidence-review/:specKey", auth, requireContentManager, async (req, res) => {
  try {
    const { specKey } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 0;
    const result = await evidenceReviewWorklistService.getEvidenceReviewWorklist(specKey, {
      limit: limit > 0 ? limit : undefined,
    });
    res.json(result);
  } catch (err) {
    console.error("[content-graph] getEvidenceReviewWorklist", err);
    res.status(500).json({ error: err?.message || "Failed to get evidence review worklist" });
  }
});

/**
 * GET /api/content-graph/evidence-review/:specKey/:topicKey
 * Single evidence review item.
 */
router.get("/evidence-review/:specKey/:topicKey", auth, requireContentManager, async (req, res) => {
  try {
    const { specKey, topicKey } = req.params;
    const result = await evidenceReviewWorklistService.getEvidenceReviewItem(specKey, topicKey);
    if (!result) return res.status(404).json({ error: "Topic not in review worklist" });
    res.json(result);
  } catch (err) {
    console.error("[content-graph] getEvidenceReviewItem", err);
    res.status(500).json({ error: err?.message || "Failed to get evidence review item" });
  }
});

/**
 * GET /api/content-graph/topic-command/:specKey/:topicKey
 * Topic Command Center — unified operational view for a topic. Admin only.
 */
router.get("/topic-command/:specKey/:topicKey", auth, requireContentManager, async (req, res) => {
  try {
    const { specKey, topicKey } = req.params;
    if (!specKey || !topicKey) {
      return res.status(400).json({ error: "specKey and topicKey required" });
    }
    const result = await topicIntelligenceService.getTopicCommandCenter(
      String(specKey).trim(),
      String(topicKey).trim()
    );
    res.json(result);
  } catch (err) {
    console.error("[content-graph] getTopicCommandCenter", err);
    res.status(500).json({ error: err?.message || "Failed to get topic command center" });
  }
});

/** Student Learning Evidence — admin-only aggregated learning outcomes per topic */
const studentTopicEvidenceService = require("../services/studentTopicEvidenceService");

/**
 * GET /api/content-graph/learning-evidence/:specKey
 * Spec-level learning evidence for all topics.
 */
router.get("/learning-evidence/:specKey", auth, requireContentManager, async (req, res) => {
  try {
    const { specKey } = req.params;
    const result = await studentTopicEvidenceService.getSpecLearningEvidence(specKey);
    res.json(result);
  } catch (err) {
    console.error("[content-graph] getSpecLearningEvidence", err);
    res.status(500).json({ error: err?.message || "Failed to get learning evidence" });
  }
});

/**
 * GET /api/content-graph/learning-evidence/:specKey/:topicKey
 * Single topic learning evidence.
 */
router.get("/learning-evidence/:specKey/:topicKey", auth, requireContentManager, async (req, res) => {
  try {
    const { specKey, topicKey } = req.params;
    const result = await studentTopicEvidenceService.getTopicLearningEvidence(specKey, topicKey);
    res.json(result);
  } catch (err) {
    console.error("[content-graph] getTopicLearningEvidence", err);
    res.status(500).json({ error: err?.message || "Failed to get learning evidence" });
  }
});

/** Curriculum Autopilot — admin-only automation */
const curriculumAutopilotService = require("../services/curriculumAutopilotService");
const autopilotPromptMetadata = require("../services/autopilotPromptMetadata");
const autopilotGatingService = require("../services/autopilotGatingService");

/** Autopilot Experiments */
const AutopilotPromptExperiment = require("../models/AutopilotPromptExperiment");
const autopilotOutcomesService = require("../services/autopilotOutcomesService");

/**
 * GET /api/content-graph/autopilot/experiments
 * List experiments.
 */
router.get("/autopilot/experiments", auth, requireContentManager, async (req, res) => {
  try {
    const { status } = req.query;
    const q = {};
    if (status) q.status = status;
    const items = await AutopilotPromptExperiment.find(q).sort({ createdAt: -1 }).lean();
    res.json({ experiments: items });
  } catch (err) {
    console.error("[content-graph] autopilot/experiments list", err);
    res.status(500).json({ error: err?.message || "Failed to list experiments" });
  }
});

/**
 * POST /api/content-graph/autopilot/experiments
 * Create experiment. Body: { experimentId, label, description?, specKey?, topicKey?, promptPacks, assignmentMode? }
 */
router.post("/autopilot/experiments", auth, requireContentManager, async (req, res) => {
  try {
    const { experimentId, label, description, specKey, topicKey, promptPacks, assignmentMode } = req.body || {};
    if (!experimentId || !label || !Array.isArray(promptPacks) || promptPacks.length < 2) {
      return res.status(400).json({ error: "experimentId, label, and at least 2 promptPacks required" });
    }
    const existing = await AutopilotPromptExperiment.findOne({ experimentId });
    if (existing) return res.status(400).json({ error: "experimentId already exists" });
    const doc = await AutopilotPromptExperiment.create({
      experimentId: String(experimentId).trim(),
      label: String(label).trim(),
      description: description ? String(description).trim() : "",
      specKey: specKey ? String(specKey).trim() : null,
      topicKey: topicKey ? String(topicKey).trim() : null,
      promptPacks: promptPacks.map((p) => ({
        promptPackId: String(p.promptPackId || "").trim(),
        promptPackVersion: String(p.promptPackVersion || "").trim(),
        weight: typeof p.weight === "number" ? p.weight : 1,
      })),
      assignmentMode: assignmentMode === "weighted_random" ? "weighted_random" : "round_robin",
      status: "active",
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error("[content-graph] autopilot/experiments create", err);
    res.status(500).json({ error: err?.message || "Failed to create experiment" });
  }
});

/**
 * GET /api/content-graph/autopilot/experiments/:id
 * Get single experiment.
 */
router.get("/autopilot/experiments/:id", auth, requireContentManager, async (req, res) => {
  try {
    const { id } = req.params;
    const q = mongoose.Types.ObjectId.isValid(id) && String(id).length === 24
      ? { $or: [{ _id: id }, { experimentId: id }] }
      : { experimentId: id };
    const doc = await AutopilotPromptExperiment.findOne(q).lean();
    if (!doc) return res.status(404).json({ error: "Experiment not found" });
    res.json(doc);
  } catch (err) {
    console.error("[content-graph] autopilot/experiments get", err);
    res.status(500).json({ error: err?.message || "Failed to get experiment" });
  }
});

/**
 * GET /api/content-graph/autopilot/experiments/:id/results
 * Get experiment performance results.
 */
router.get("/autopilot/experiments/:id/results", auth, requireContentManager, async (req, res) => {
  try {
    const { id } = req.params;
    const q = mongoose.Types.ObjectId.isValid(id) && String(id).length === 24 ? { $or: [{ _id: id }, { experimentId: id }] } : { experimentId: id };
    const exp = await AutopilotPromptExperiment.findOne(q).lean();
    if (!exp) return res.status(404).json({ error: "Experiment not found" });
    const results = await autopilotOutcomesService.getExperimentPerformance(exp.experimentId);
    if (!results) return res.status(404).json({ error: "Experiment not found" });
    res.json(results);
  } catch (err) {
    console.error("[content-graph] autopilot/experiments results", err);
    res.status(500).json({ error: err?.message || "Failed to get experiment results" });
  }
});

/**
 * PATCH /api/content-graph/autopilot/experiments/:id
 * Update experiment (status, label, description, etc).
 */
router.patch("/autopilot/experiments/:id", auth, requireContentManager, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, label, description } = req.body || {};
    const updates = {};
    if (status && ["active", "paused", "archived"].includes(status)) updates.status = status;
    if (label !== undefined) updates.label = String(label).trim();
    if (description !== undefined) updates.description = String(description).trim();
    const q = mongoose.Types.ObjectId.isValid(id) && String(id).length === 24 ? { $or: [{ _id: id }, { experimentId: id }] } : { experimentId: id };
    if (Object.keys(updates).length === 0) {
      const doc = await AutopilotPromptExperiment.findOne(q).lean();
      if (!doc) return res.status(404).json({ error: "Experiment not found" });
      return res.json(doc);
    }
    const doc = await AutopilotPromptExperiment.findOneAndUpdate(
      q,
      { $set: updates },
      { new: true }
    ).lean();
    if (!doc) return res.status(404).json({ error: "Experiment not found" });
    res.json(doc);
  } catch (err) {
    console.error("[content-graph] autopilot/experiments patch", err);
    res.status(500).json({ error: err?.message || "Failed to update experiment" });
  }
});

/**
 * GET /api/content-graph/autopilot/prompt-packs
 * Returns available prompt packs.
 */
router.get("/autopilot/prompt-packs", auth, requireContentManager, async (req, res) => {
  try {
    const packs = autopilotPromptMetadata.getAvailableAutopilotPromptPacks();
    res.json({ promptPacks: packs });
  } catch (err) {
    console.error("[content-graph] autopilot/prompt-packs", err);
    res.status(500).json({ error: err?.message || "Failed to fetch prompt packs" });
  }
});

/**
 * GET /api/content-graph/autopilot/gate/:specKey/:topicKey
 * Returns gate decision for a topic (admin only).
 */
router.get("/autopilot/gate/:specKey/:topicKey", auth, requireContentManager, async (req, res) => {
  try {
    const { specKey, topicKey } = req.params;
    if (!specKey || !topicKey) {
      return res.status(400).json({ error: "specKey and topicKey required" });
    }
    const gate = await autopilotGatingService.getAutopilotGate(
      String(specKey).trim(),
      String(topicKey).trim()
    );
    res.json(gate);
  } catch (err) {
    console.error("[content-graph] autopilot/gate", err);
    res.status(500).json({ error: err?.message || "Failed to fetch gate" });
  }
});

/**
 * POST /api/content-graph/autopilot/topic
 * Body: { specKey, topicKey, dryRun?, actions?, promptPackId?, promptPackVersion? }
 */
router.post("/autopilot/topic", auth, requireContentManager, async (req, res) => {
  try {
    const { specKey, topicKey, dryRun, actions, promptPackId, promptPackVersion } = req.body || {};
    if (!specKey || !topicKey) {
      return res.status(400).json({ error: "specKey and topicKey required" });
    }
    const adminUserId = req.user?._id?.toString?.() || req.user?.userId || req.user?.id;
    const result = await curriculumAutopilotService.runTopicAutopilot({
      specKey: String(specKey).trim(),
      topicKey: String(topicKey).trim(),
      actions: Array.isArray(actions) ? actions : undefined,
      dryRun: !!dryRun,
      adminUserId,
      promptPackId: promptPackId ? String(promptPackId).trim() : undefined,
      promptPackVersion: promptPackVersion ? String(promptPackVersion).trim() : undefined,
    });
    res.json(result);
  } catch (err) {
    console.error("[content-graph] autopilot/topic", err);
    const status = err?.message?.includes("Unknown prompt pack") || err?.message?.includes("promptPackId required") ? 400 : 500;
    res.status(status).json({ error: err?.message || "Autopilot failed" });
  }
});

/**
 * POST /api/content-graph/autopilot/spec
 * Body: { specKey, dryRun?, limit?, minPriorityScore?, promptPackId?, promptPackVersion? }
 */
router.post("/autopilot/spec", auth, requireContentManager, async (req, res) => {
  try {
    const { specKey, dryRun, limit, minPriorityScore, promptPackId, promptPackVersion } = req.body || {};
    if (!specKey) return res.status(400).json({ error: "specKey required" });
    const adminUserId = req.user?._id?.toString?.() || req.user?.userId || req.user?.id;
    const result = await curriculumAutopilotService.runSpecAutopilot({
      specKey: String(specKey).trim(),
      dryRun: !!dryRun,
      limit: typeof limit === "number" ? Math.max(0, limit) : 20,
      minPriorityScore: typeof minPriorityScore === "number" ? minPriorityScore : 0,
      adminUserId,
      promptPackId: promptPackId ? String(promptPackId).trim() : undefined,
      promptPackVersion: promptPackVersion ? String(promptPackVersion).trim() : undefined,
    });
    res.json(result);
  } catch (err) {
    console.error("[content-graph] autopilot/spec", err);
    const status = err?.message?.includes("Unknown prompt pack") || err?.message?.includes("promptPackId required") ? 400 : 500;
    res.status(status).json({ error: err?.message || "Autopilot failed" });
  }
});

/**
 * GET /api/content-graph/autopilot/spec/:specKey/preview
 * Returns planned actions only, no writes.
 */
router.get("/autopilot/spec/:specKey/preview", auth, requireContentManager, async (req, res) => {
  try {
    const { specKey } = req.params;
    const limit = parseInt(req.query.limit, 10) || 20;
    const minPriorityScore = parseFloat(req.query.minPriorityScore) || 0;
    const result = await curriculumAutopilotService.previewSpecAutopilot(
      specKey,
      limit,
      minPriorityScore
    );
    res.json(result);
  } catch (err) {
    console.error("[content-graph] autopilot/preview", err);
    res.status(500).json({ error: err?.message || "Preview failed" });
  }
});

/** Lean content engine (coverage → asset → quality → approval) — draft-only; no auto-publish */
const autopilotContentEngineRunner = require("../services/autopilots/autopilotRunner");

/**
 * POST /api/content-graph/autopilot/content-engine/run
 * Body: { phase, specKey?, dryRun?, limit?, minPriorityScore?, lessonLimit?, maxQualityItems?, approvalLimit? }
 */
router.post("/autopilot/content-engine/run", auth, requireContentManager, async (req, res) => {
  try {
    const {
      phase,
      specKey,
      dryRun,
      limit,
      minPriorityScore,
      lessonLimit,
      maxQualityItems,
      approvalLimit,
    } = req.body || {};
    if (!phase || typeof phase !== "string") {
      return res.status(400).json({ error: "phase required (coverage | asset | quality | approval)" });
    }
    const adminUserId = req.user?._id?.toString?.() || req.user?.userId || req.user?.id;
    if (!adminUserId) return res.status(401).json({ error: "User id required" });
    const teacherName =
      `${req.user?.firstName || ""} ${req.user?.lastName || ""}`.trim() || req.user?.email || "Admin";
    const result = await autopilotContentEngineRunner.runContentEngine({
      phase: String(phase).trim().toLowerCase(),
      specKey: specKey != null && specKey !== "" ? String(specKey).trim() : "all-specs",
      adminUserId,
      teacherName,
      dryRun: !!dryRun,
      limit: typeof limit === "number" ? limit : undefined,
      minPriorityScore: typeof minPriorityScore === "number" ? minPriorityScore : undefined,
      lessonLimit: typeof lessonLimit === "number" ? lessonLimit : undefined,
      maxQualityItems: typeof maxQualityItems === "number" ? maxQualityItems : undefined,
      approvalLimit: typeof approvalLimit === "number" ? approvalLimit : undefined,
    });
    res.json(result);
  } catch (err) {
    console.error("[content-graph] autopilot/content-engine/run", err);
    res.status(500).json({ error: err?.message || "Content engine run failed" });
  }
});

/**
 * POST /api/content-graph/autopilot/content-engine/run-pipeline
 * Runs all four phases in order (isolated failures).
 */
router.post("/autopilot/content-engine/run-pipeline", auth, requireContentManager, async (req, res) => {
  try {
    const {
      specKey,
      dryRun,
      limit,
      minPriorityScore,
      lessonLimit,
      maxQualityItems,
      approvalLimit,
    } = req.body || {};
    const adminUserId = req.user?._id?.toString?.() || req.user?.userId || req.user?.id;
    if (!adminUserId) return res.status(401).json({ error: "User id required" });
    const teacherName =
      `${req.user?.firstName || ""} ${req.user?.lastName || ""}`.trim() || req.user?.email || "Admin";
    const result = await autopilotContentEngineRunner.runSafePipeline({
      specKey: specKey != null && specKey !== "" ? String(specKey).trim() : "all-specs",
      adminUserId,
      teacherName,
      dryRun: !!dryRun,
      limit: typeof limit === "number" ? limit : undefined,
      minPriorityScore: typeof minPriorityScore === "number" ? minPriorityScore : undefined,
      lessonLimit: typeof lessonLimit === "number" ? lessonLimit : undefined,
      maxQualityItems: typeof maxQualityItems === "number" ? maxQualityItems : undefined,
      approvalLimit: typeof approvalLimit === "number" ? approvalLimit : undefined,
    });
    res.json(result);
  } catch (err) {
    console.error("[content-graph] autopilot/content-engine/run-pipeline", err);
    res.status(500).json({ error: err?.message || "Pipeline failed" });
  }
});

/** Autopilot Readiness Diagnostics */
const autopilotReadinessService = require("../services/autopilotReadinessService");

/**
 * GET /api/content-graph/autopilot/readiness/:specKey
 * Returns readiness for all topics in spec.
 */
router.get("/autopilot/readiness/:specKey", auth, requireContentManager, async (req, res) => {
  try {
    const { specKey } = req.params;
    const result = await autopilotReadinessService.getSpecAutopilotReadiness(specKey);
    res.json(result);
  } catch (err) {
    console.error("[content-graph] autopilot/readiness/spec", err);
    res.status(500).json({ error: err?.message || "Readiness check failed" });
  }
});

/**
 * GET /api/content-graph/autopilot/readiness/:specKey/:topicKey
 * Returns readiness for a single topic.
 */
router.get("/autopilot/readiness/:specKey/:topicKey", auth, requireContentManager, async (req, res) => {
  try {
    const { specKey, topicKey } = req.params;
    const result = await autopilotReadinessService.getTopicAutopilotReadiness(specKey, topicKey);
    if (!result) return res.status(404).json({ error: "Topic not found" });
    res.json(result);
  } catch (err) {
    console.error("[content-graph] autopilot/readiness/topic", err);
    res.status(500).json({ error: err?.message || "Readiness check failed" });
  }
});

/** Draft Question Library — bulk generation per SpecStatement */
const draftQuestionLibraryService = require("../services/draftQuestionLibraryService");

/**
 * POST /api/content-graph/draft-library/topic
 * Body: { specKey, topicKey, dryRun?, promptPackId?, promptPackVersion?, limitFlashcards?, limitExamQuestions? }
 */
router.post("/draft-library/topic", auth, requireContentManager, async (req, res) => {
  try {
    const { specKey, topicKey, dryRun, promptPackId, promptPackVersion, limitFlashcards, limitExamQuestions } = req.body || {};
    if (!specKey || !topicKey) {
      return res.status(400).json({ error: "specKey and topicKey required" });
    }
    const adminUserId = req.user?._id?.toString?.() || req.user?.userId || req.user?.id;
    const result = await draftQuestionLibraryService.generateDraftLibraryForTopic({
      specKey: String(specKey).trim(),
      topicKey: String(topicKey).trim(),
      adminUserId,
      dryRun: !!dryRun,
      promptPackId: promptPackId ? String(promptPackId).trim() : undefined,
      promptPackVersion: promptPackVersion ? String(promptPackVersion).trim() : undefined,
      limitFlashcards: typeof limitFlashcards === "number" ? limitFlashcards : undefined,
      limitExamQuestions: typeof limitExamQuestions === "number" ? limitExamQuestions : undefined,
    });
    res.json(result);
  } catch (err) {
    console.error("[content-graph] draft-library/topic", err);
    res.status(500).json({ error: err?.message || "Draft library generation failed" });
  }
});

/**
 * POST /api/content-graph/draft-library/spec
 * Body: { specKey, topicKeys?, limitPerTopic?, dryRun?, promptPackId?, promptPackVersion?, limitFlashcards?, limitExamQuestions? }
 */
router.post("/draft-library/spec", auth, requireContentManager, async (req, res) => {
  try {
    const { specKey, topicKeys, limitPerTopic, dryRun, promptPackId, promptPackVersion, limitFlashcards, limitExamQuestions } = req.body || {};
    if (!specKey) return res.status(400).json({ error: "specKey required" });
    const adminUserId = req.user?._id?.toString?.() || req.user?.userId || req.user?.id;
    const result = await draftQuestionLibraryService.generateDraftLibraryForSpec({
      specKey: String(specKey).trim(),
      topicKeys: Array.isArray(topicKeys) ? topicKeys.map((k) => String(k).trim()) : undefined,
      limitPerTopic: typeof limitPerTopic === "number" ? limitPerTopic : undefined,
      adminUserId,
      dryRun: !!dryRun,
      promptPackId: promptPackId ? String(promptPackId).trim() : undefined,
      promptPackVersion: promptPackVersion ? String(promptPackVersion).trim() : undefined,
      limitFlashcards: typeof limitFlashcards === "number" ? limitFlashcards : undefined,
      limitExamQuestions: typeof limitExamQuestions === "number" ? limitExamQuestions : undefined,
    });
    res.json(result);
  } catch (err) {
    console.error("[content-graph] draft-library/spec", err);
    res.status(500).json({ error: err?.message || "Draft library generation failed" });
  }
});

/** Autopilot Approval Queue */
const autopilotApprovalService = require("../services/autopilotApprovalService");

/**
 * GET /api/content-graph/autopilot/drafts
 * Query params: specKey, topicKey, itemType, status, generatorMode (e.g. draft_library)
 */
router.get("/autopilot/drafts", auth, requireContentManager, async (req, res) => {
  try {
    const filters = {};
    if (req.query.specKey) filters.specKey = String(req.query.specKey).trim();
    if (req.query.topicKey) filters.topicKey = String(req.query.topicKey).trim();
    if (req.query.itemType) filters.itemType = String(req.query.itemType).trim();
    if (req.query.status) filters.status = String(req.query.status).trim();
    if (req.query.generatorMode) filters.generatorMode = String(req.query.generatorMode).trim();
    const { summary, items } = await autopilotApprovalService.getAutopilotDraftSummary(filters);
    res.json({ summary, items });
  } catch (err) {
    console.error("[content-graph] autopilot/drafts", err);
    res.status(500).json({ error: err?.message || "Failed to fetch drafts" });
  }
});

/**
 * POST /api/content-graph/autopilot/approve
 * Body: { itemType, itemId }
 */
router.post("/autopilot/approve", auth, requireContentManager, async (req, res) => {
  try {
    const { itemType, itemId } = req.body || {};
    if (!itemType || !itemId) {
      return res.status(400).json({ error: "itemType and itemId required" });
    }
    const reviewerId = req.user?._id?.toString?.() || req.user?.userId || req.user?.id;
    const result = await autopilotApprovalService.approveAutopilotItem({ itemType, itemId, reviewerId });
    if (!result) return res.status(404).json({ error: "Item not found or not eligible for approval" });
    res.json({ ok: true, item: result });
  } catch (err) {
    console.error("[content-graph] autopilot/approve", err);
    res.status(500).json({ error: err?.message || "Approval failed" });
  }
});

/**
 * POST /api/content-graph/autopilot/reject
 * Body: { itemType, itemId, reason? }
 */
router.post("/autopilot/reject", auth, requireContentManager, async (req, res) => {
  try {
    const { itemType, itemId, reason } = req.body || {};
    if (!itemType || !itemId) {
      return res.status(400).json({ error: "itemType and itemId required" });
    }
    const reviewerId = req.user?._id?.toString?.() || req.user?.userId || req.user?.id;
    const result = await autopilotApprovalService.rejectAutopilotItem({ itemType, itemId, reviewerId, reason });
    if (!result) return res.status(404).json({ error: "Item not found or not eligible for rejection" });
    res.json({ ok: true, item: result });
  } catch (err) {
    console.error("[content-graph] autopilot/reject", err);
    res.status(500).json({ error: err?.message || "Rejection failed" });
  }
});

/**
 * POST /api/content-graph/autopilot/approve-bulk
 * Body: { items: [{ itemType, itemId }] }
 */
router.post("/autopilot/approve-bulk", auth, requireContentManager, async (req, res) => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items array required" });
    }
    const reviewerId = req.user?._id?.toString?.() || req.user?.userId || req.user?.id;
    const result = await autopilotApprovalService.bulkApproveAutopilotItems({ items, reviewerId });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[content-graph] autopilot/approve-bulk", err);
    res.status(500).json({ error: err?.message || "Bulk approval failed" });
  }
});

/**
 * POST /api/content-graph/autopilot/reject-bulk
 * Body: { items: [{ itemType, itemId }], reason? }
 */
router.post("/autopilot/reject-bulk", auth, requireContentManager, async (req, res) => {
  try {
    const { items, reason } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items array required" });
    }
    const reviewerId = req.user?._id?.toString?.() || req.user?.userId || req.user?.id;
    const result = await autopilotApprovalService.bulkRejectAutopilotItems({ items, reviewerId, reason });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[content-graph] autopilot/reject-bulk", err);
    res.status(500).json({ error: err?.message || "Bulk rejection failed" });
  }
});

/** Autopilot Run History */
const AutopilotRun = require("../models/AutopilotRun");

/**
 * GET /api/content-graph/autopilot/runs
 * Query params: specKey, topicKey, runType, dryRun, status, limit
 */
router.get("/autopilot/runs", auth, requireContentManager, async (req, res) => {
  try {
    const q = {};
    if (req.query.specKey) q.specKey = String(req.query.specKey).trim();
    if (req.query.topicKey) q.topicKey = { $regex: new RegExp(req.query.topicKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") };
    if (req.query.contentEnginePhase) q.contentEnginePhase = String(req.query.contentEnginePhase).trim();
    if (req.query.runType) q.runType = String(req.query.runType).trim();
    if (req.query.dryRun !== undefined && req.query.dryRun !== "") q.dryRun = req.query.dryRun === "true";
    if (req.query.status) q.status = String(req.query.status).trim();
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const items = await AutopilotRun.find(q).select("-topicResults").sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ items });
  } catch (err) {
    console.error("[content-graph] autopilot/runs", err);
    res.status(500).json({ error: err?.message || "Failed to fetch runs" });
  }
});

/**
 * GET /api/content-graph/autopilot/runs/:id
 */
router.get("/autopilot/runs/:id", auth, requireContentManager, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid run id" });
    }
    const run = await AutopilotRun.findById(id).lean();
    if (!run) return res.status(404).json({ error: "Run not found" });
    res.json(run);
  } catch (err) {
    console.error("[content-graph] autopilot/runs/:id", err);
    res.status(500).json({ error: err?.message || "Failed to fetch run" });
  }
});

/** Autopilot Outcomes */
/**
 * GET /api/content-graph/autopilot/outcomes
 * Query params: specKey, topicKey, days, limit
 */
router.get("/autopilot/outcomes", auth, requireContentManager, async (req, res) => {
  try {
    const filters = {};
    if (req.query.specKey) filters.specKey = String(req.query.specKey).trim();
    if (req.query.topicKey) filters.topicKey = String(req.query.topicKey).trim();
    if (req.query.days != null) filters.days = parseInt(req.query.days, 10);
    if (req.query.limit != null) filters.limit = parseInt(req.query.limit, 10);
    const result = await autopilotOutcomesService.getAutopilotOutcomeSummary(filters);
    res.json(result);
  } catch (err) {
    console.error("[content-graph] autopilot/outcomes", err);
    res.status(500).json({ error: err?.message || "Failed to fetch outcomes" });
  }
});

/**
 * GET /api/content-graph/autopilot/outcomes/prompt-packs
 * Query params: specKey, topicKey, days, limit
 */
router.get("/autopilot/outcomes/prompt-packs", auth, requireContentManager, async (req, res) => {
  try {
    const filters = {};
    if (req.query.specKey) filters.specKey = String(req.query.specKey).trim();
    if (req.query.topicKey) filters.topicKey = String(req.query.topicKey).trim();
    if (req.query.days != null) filters.days = parseInt(req.query.days, 10);
    if (req.query.limit != null) filters.limit = parseInt(req.query.limit, 10);
    const result = await autopilotOutcomesService.getOutcomesByPromptPack(filters);
    res.json(result);
  } catch (err) {
    console.error("[content-graph] autopilot/outcomes/prompt-packs", err);
    res.status(500).json({ error: err?.message || "Failed to fetch prompt pack outcomes" });
  }
});

/**
 * GET /api/content-graph/autopilot/outcomes/spec/:specKey
 */
router.get("/autopilot/outcomes/spec/:specKey", auth, requireContentManager, async (req, res) => {
  try {
    const { specKey } = req.params;
    const filters = {};
    if (req.query.days != null) filters.days = parseInt(req.query.days, 10);
    if (req.query.limit != null) filters.limit = parseInt(req.query.limit, 10);
    const result = await autopilotOutcomesService.getAutopilotOutcomeBySpec(specKey, filters);
    res.json(result);
  } catch (err) {
    console.error("[content-graph] autopilot/outcomes/spec", err);
    res.status(500).json({ error: err?.message || "Failed to fetch spec outcomes" });
  }
});

/**
 * GET /api/content-graph/autopilot/outcomes/spec/:specKey/topic/:topicKey
 */
router.get("/autopilot/outcomes/spec/:specKey/topic/:topicKey", auth, requireContentManager, async (req, res) => {
  try {
    const { specKey, topicKey } = req.params;
    const filters = {};
    if (req.query.days != null) filters.days = parseInt(req.query.days, 10);
    if (req.query.limit != null) filters.limit = parseInt(req.query.limit, 10);
    const result = await autopilotOutcomesService.getAutopilotOutcomeByTopic(specKey, topicKey, filters);
    res.json(result);
  } catch (err) {
    console.error("[content-graph] autopilot/outcomes/topic", err);
    res.status(500).json({ error: err?.message || "Failed to fetch topic outcomes" });
  }
});

/** Autopilot Feedback (Prompt Quality) */
const autopilotFeedbackService = require("../services/autopilotFeedbackService");

/**
 * GET /api/content-graph/autopilot/feedback
 * Query params: specKey, topicKey, days, limit
 */
router.get("/autopilot/feedback", auth, requireContentManager, async (req, res) => {
  try {
    const filters = {};
    if (req.query.specKey) filters.specKey = String(req.query.specKey).trim();
    if (req.query.topicKey) filters.topicKey = String(req.query.topicKey).trim();
    if (req.query.days != null) filters.days = parseInt(req.query.days, 10);
    if (req.query.limit != null) filters.limit = parseInt(req.query.limit, 10);
    const result = await autopilotFeedbackService.getAutopilotFeedbackSummary(filters);
    res.json(result);
  } catch (err) {
    console.error("[content-graph] autopilot/feedback", err);
    res.status(500).json({ error: err?.message || "Failed to fetch feedback" });
  }
});

/**
 * GET /api/content-graph/autopilot/feedback/prompt-packs
 * Query params: specKey, topicKey, days, limit
 */
router.get("/autopilot/feedback/prompt-packs", auth, requireContentManager, async (req, res) => {
  try {
    const filters = {};
    if (req.query.specKey) filters.specKey = String(req.query.specKey).trim();
    if (req.query.topicKey) filters.topicKey = String(req.query.topicKey).trim();
    if (req.query.days != null) filters.days = parseInt(req.query.days, 10);
    if (req.query.limit != null) filters.limit = parseInt(req.query.limit, 10);
    const result = await autopilotFeedbackService.getFeedbackByPromptPack(filters);
    res.json(result);
  } catch (err) {
    console.error("[content-graph] autopilot/feedback/prompt-packs", err);
    res.status(500).json({ error: err?.message || "Failed to fetch prompt pack feedback" });
  }
});

/**
 * GET /api/content-graph/autopilot/feedback/spec/:specKey
 */
router.get("/autopilot/feedback/spec/:specKey", auth, requireContentManager, async (req, res) => {
  try {
    const { specKey } = req.params;
    const filters = {};
    if (req.query.days != null) filters.days = parseInt(req.query.days, 10);
    if (req.query.limit != null) filters.limit = parseInt(req.query.limit, 10);
    const result = await autopilotFeedbackService.getAutopilotFeedbackBySpec(specKey, filters);
    res.json(result);
  } catch (err) {
    console.error("[content-graph] autopilot/feedback/spec", err);
    res.status(500).json({ error: err?.message || "Failed to fetch spec feedback" });
  }
});

/**
 * GET /api/content-graph/autopilot/feedback/spec/:specKey/topic/:topicKey
 */
router.get("/autopilot/feedback/spec/:specKey/topic/:topicKey", auth, requireContentManager, async (req, res) => {
  try {
    const { specKey, topicKey } = req.params;
    const filters = {};
    if (req.query.days != null) filters.days = parseInt(req.query.days, 10);
    const result = await autopilotFeedbackService.getAutopilotFeedbackByTopic(specKey, topicKey, filters);
    res.json(result);
  } catch (err) {
    console.error("[content-graph] autopilot/feedback/topic", err);
    res.status(500).json({ error: err?.message || "Failed to fetch topic feedback" });
  }
});

module.exports = router;
