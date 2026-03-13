/**
 * PR-PAST-PAPERS-UI-2: GET questions for a paper (teacher-owned), POST link questions.
 */
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const PastPaper = require("../models/PastPaper");
const PastPaperQuestion = require("../models/PastPaperQuestion");
const ExamQuestion = require("../models/ExamQuestion");
const auth = require("../middleware/auth");
const { assertValidSpecKey, assertValidSpecTopic } = require("../utils/specTopicValidation");
const { buildTopicKey, parseTopicKey } = require("../utils/topicKey");
const { pastPaperQuestionFingerprint } = require("../utils/pastPaperQuestionDedupe");
const { normalizeMetadata } = require("../utils/metadataValidation");

function getActorId(req) {
  return req.user?._id || req.user?.id;
}

/**
 * GET /api/past-paper-questions/mine?pastPaperId=<id>
 * Returns PastPaperQuestions for the given paper; validates that the paper is owned by the user.
 */
router.get("/mine", auth, async (req, res) => {
  try {
    const actorId = getActorId(req);
    if (!actorId) return res.status(401).json({ error: "Unauthorized" });

    const pastPaperId = req.query.pastPaperId;
    if (!pastPaperId) return res.status(400).json({ error: "pastPaperId is required" });

    const paper = await PastPaper.findOne({ _id: pastPaperId, ownerId: actorId }).lean();
    if (!paper) return res.status(404).json({ error: "Past paper not found or not owned by you" });

    const filter = { pastPaperId, ownerId: actorId };
    const { difficulty, difficultyMin, difficultyMax, skill } = req.query || {};
    if ((difficultyMin != null && String(difficultyMin).trim() !== "") || (difficultyMax != null && String(difficultyMax).trim() !== "")) {
      const range = {};
      const dMin = parseInt(String(difficultyMin).trim(), 10);
      const dMax = parseInt(String(difficultyMax).trim(), 10);
      if (Number.isFinite(dMin) && dMin >= 1 && dMin <= 5) range.$gte = dMin;
      if (Number.isFinite(dMax) && dMax >= 1 && dMax <= 5) range.$lte = dMax;
      if (Object.keys(range).length) filter.difficulty = range;
    } else if (difficulty !== undefined && difficulty !== "" && String(difficulty).trim() !== "") {
      const d = parseInt(String(difficulty).trim(), 10);
      if (Number.isFinite(d) && d >= 1 && d <= 5) filter.difficulty = d;
    }
    if (skill !== undefined && String(skill).trim() !== "") {
      const s = String(skill).trim().toLowerCase();
      if (["recall", "application", "analysis", "exam-technique"].includes(s)) filter.skill = s;
    }

    const items = await PastPaperQuestion.find(filter)
      .sort({ questionNumber: 1, createdAt: 1 })
      .lean();

    return res.status(200).json({ items });
  } catch (e) {
    return res.status(400).json({ error: e.message || "Failed to load questions" });
  }
});

/**
 * POST /api/past-paper-questions
 * Body: { pastPaperId, topicKey (non-namespaced), questionNumber?, marks?, question, markScheme (string), assets? }
 * Teacher-owned only; validates spec/topic; stores namespaced topicKey; dedupes by fingerprint.
 */
router.post("/", auth, async (req, res) => {
  try {
    const actorId = getActorId(req);
    if (!actorId) return res.status(401).json({ error: "Unauthorized" });

    const { pastPaperId, topicKey, questionNumber, marks, question, markScheme, assets, difficulty, skill, estimatedTimeSec } = req.body || {};

    if (!pastPaperId) return res.status(400).json({ error: "pastPaperId is required" });
    if (!topicKey) return res.status(400).json({ error: "topicKey is required" });
    if (!question || typeof question !== "string") return res.status(400).json({ error: "question is required" });
    if (markScheme === undefined || markScheme === null) return res.status(400).json({ error: "markScheme is required" });

    const paper = await PastPaper.findOne({ _id: pastPaperId, ownerId: actorId }).lean();
    if (!paper) return res.status(404).json({ error: "Past paper not found or not owned by you" });

    assertValidSpecKey(paper.specKey);
    assertValidSpecTopic({ specKey: paper.specKey, topicKey: String(topicKey).trim() });

    const namespacedTopicKey = buildTopicKey(paper.specKey, String(topicKey).trim());

    const msArray = typeof markScheme === "string"
      ? markScheme.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
      : Array.isArray(markScheme)
        ? markScheme.map((s) => String(s).trim()).filter(Boolean)
        : [];

    const fp = pastPaperQuestionFingerprint({
      pastPaperId: String(pastPaperId),
      topicKey: namespacedTopicKey,
      questionNumber: questionNumber != null && questionNumber !== "" ? String(questionNumber).trim() : null,
      question: String(question).trim(),
      markScheme: msArray.join("\n"),
    });

    const existing = await PastPaperQuestion.findOne({ ownerId: actorId, fingerprint: fp }).lean();
    if (existing) {
      return res.status(200).json({ item: existing, deduped: true });
    }

    let meta = { difficulty: null, skill: null, estimatedTimeSec: null };
    if (difficulty != null || skill != null || estimatedTimeSec != null) {
      try {
        meta = normalizeMetadata({ difficulty, skill, estimatedTimeSec });
      } catch (e) {
        if (e.code === "INVALID_DIFFICULTY" || e.code === "INVALID_SKILL" || e.code === "INVALID_ESTIMATED_TIME") {
          return res.status(400).json({ error: e.message });
        }
        throw e;
      }
    }

    const doc = await PastPaperQuestion.create({
      ownerId: actorId,
      pastPaperId,
      specKey: paper.specKey,
      topicKey: namespacedTopicKey,
      questionNumber: questionNumber != null && String(questionNumber).trim() !== "" ? String(questionNumber).trim() : null,
      marks: Number.isFinite(Number(marks)) ? Number(marks) : null,
      question: String(question).trim(),
      markScheme: msArray,
      assets: Array.isArray(assets) ? assets : [],
      fingerprint: fp,
      difficulty: meta.difficulty,
      skill: meta.skill,
      estimatedTimeSec: meta.estimatedTimeSec,
    });

    return res.status(201).json({ item: doc.toObject ? doc.toObject() : doc, deduped: false });
  } catch (e) {
    const code = e.code || "CREATE_FAILED";
    if (code === "INVALID_TOPIC_KEY" || code === "INVALID_SPEC_KEY") {
      return res.status(400).json({ error: e.message });
    }
    return res.status(400).json({ error: e.message || "Failed to create past paper question" });
  }
});

/**
 * POST /api/past-paper-questions/link
 * Body: { pastPaperId, specKey, items: [{ topicKey, questionNumber?, marks?, question, markScheme? }] }
 * Validates ownership, taxonomy topicKey, stores namespaced topicKey, dedupes by fingerprint.
 */
router.post("/link", auth, async (req, res) => {
  try {
    const actorId = getActorId(req);
    if (!actorId) return res.status(401).json({ error: "Unauthorized" });

    const { pastPaperId, specKey, items: rawItems } = req.body || {};
    if (!pastPaperId || !specKey) return res.status(400).json({ error: "pastPaperId and specKey are required" });
    if (!Array.isArray(rawItems) || rawItems.length === 0) return res.status(400).json({ error: "items must be a non-empty array" });

    const paper = await PastPaper.findOne({ _id: pastPaperId, ownerId: actorId }).lean();
    if (!paper) return res.status(404).json({ error: "Past paper not found or not owned by you" });
    if (String(paper.specKey) !== String(specKey)) {
      return res.status(400).json({ error: "specKey must match the past paper's spec" });
    }

    const prepared = [];
    const seenFingerprints = new Set();

    for (let i = 0; i < rawItems.length; i++) {
      const it = rawItems[i];
      if (!it || typeof it !== "object" || !it.question || typeof it.question !== "string") {
        return res.status(400).json({ error: `items[${i}]: question is required` });
      }
      const topicSlug = (it.topicKey && String(it.topicKey).trim()) || "";
      if (!topicSlug) return res.status(400).json({ error: `items[${i}]: topicKey is required` });

      assertValidSpecTopic({ specKey, topicKey: topicSlug });
      const namespacedTopicKey = buildTopicKey(specKey, topicSlug);

      const msArray = Array.isArray(it.markScheme)
        ? it.markScheme
        : typeof it.markScheme === "string"
          ? it.markScheme.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
          : [];

      const fingerprint = pastPaperQuestionFingerprint({
        pastPaperId: String(pastPaperId),
        topicKey: namespacedTopicKey,
        questionNumber: (it.questionNumber && String(it.questionNumber).trim()) || "",
        question: it.question.trim(),
        markScheme: msArray.join("\n"),
      });

      if (seenFingerprints.has(fingerprint)) continue;
      seenFingerprints.add(fingerprint);

      prepared.push({
        ownerId: actorId,
        pastPaperId,
        specKey,
        topicKey: namespacedTopicKey,
        questionNumber: (it.questionNumber && String(it.questionNumber).trim()) || null,
        marks: Number.isFinite(Number(it.marks)) ? Number(it.marks) : null,
        question: it.question.trim(),
        markScheme: msArray,
        assets: [],
        fingerprint,
      });
    }

    const fps = prepared.map((p) => p.fingerprint);
    const existing = await PastPaperQuestion.find(
      { ownerId: actorId, fingerprint: { $in: fps } },
      { fingerprint: 1 }
    ).lean();
    const existingSet = new Set(existing.map((d) => d.fingerprint));
    const toInsert = prepared.filter((p) => !existingSet.has(p.fingerprint));

    if (toInsert.length) await PastPaperQuestion.insertMany(toInsert, { ordered: false });

    return res.status(201).json({
      linked: toInsert.length,
      pastPaperId,
    });
  } catch (e) {
    const code = e.code || "LINK_FAILED";
    if (code === "INVALID_TOPIC_KEY" || code === "INVALID_SPEC_KEY") {
      return res.status(400).json({ error: e.message });
    }
    return res.status(400).json({ error: e.message || "Failed to link questions" });
  }
});

/**
 * POST /api/past-paper-questions/attach-from-bank
 * Body: { pastPaperId, examQuestionIds: string[], overrides?: [{ examQuestionId, questionNumber?, marks? }] }
 * Validates: auth, PastPaper owned by teacher, ExamQuestions owned by teacher, specKey match.
 * Creates PastPaperQuestion from each ExamQuestion (namespaced topicKey, dedupe by fingerprint).
 */
router.post("/attach-from-bank", auth, async (req, res) => {
  try {
    const actorId = getActorId(req);
    if (!actorId) return res.status(401).json({ error: "Unauthorized" });

    const { pastPaperId, examQuestionIds, overrides } = req.body || {};
    if (!pastPaperId) return res.status(400).json({ error: "pastPaperId is required" });
    if (!Array.isArray(examQuestionIds) || examQuestionIds.length === 0) {
      return res.status(400).json({ error: "examQuestionIds must be a non-empty array" });
    }

    const paper = await PastPaper.findOne({ _id: pastPaperId, ownerId: actorId }).lean();
    if (!paper) return res.status(404).json({ error: "Past paper not found" });

    assertValidSpecKey(paper.specKey);

    const ovMap = new Map();
    if (Array.isArray(overrides)) {
      for (const o of overrides) {
        if (o && o.examQuestionId) ovMap.set(String(o.examQuestionId), o);
      }
    }

    const bankItems = await ExamQuestion.find(
      { _id: { $in: examQuestionIds }, teacherId: actorId },
      { topicKey: 1, question: 1, markScheme: 1, marks: 1, assets: 1, type: 1 }
    ).lean();

    const foundIds = new Set(bankItems.map((b) => String(b._id)));
    const errors = [];
    const prepared = [];

    for (const id of examQuestionIds) {
      if (!foundIds.has(String(id))) {
        errors.push({ examQuestionId: String(id), code: "NOT_FOUND_OR_NOT_OWNED" });
      }
    }

    for (const b of bankItems) {
      const parsed = parseTopicKey(b.topicKey || "");
      const bSpecKey = parsed.specKey || paper.specKey;
      const bTopicKey = parsed.topicKey || (b.topicKey || "").trim();

      if (bSpecKey && bSpecKey !== paper.specKey) {
        errors.push({
          examQuestionId: String(b._id),
          code: "SPEC_MISMATCH",
          message: `ExamQuestion spec does not match PastPaper specKey ${paper.specKey}`,
        });
        continue;
      }

      const namespacedTopicKey = parsed.isNamespaced && parsed.specKey
        ? b.topicKey
        : buildTopicKey(paper.specKey, bTopicKey);

      const msArray = Array.isArray(b.markScheme) ? b.markScheme : [];
      const ov = ovMap.get(String(b._id)) || {};
      const questionNumber = (ov.questionNumber && String(ov.questionNumber).trim()) || null;
      const marks = Number.isFinite(Number(ov.marks))
        ? Number(ov.marks)
        : (Number.isFinite(Number(b.marks)) ? Number(b.marks) : null);

      const fp = pastPaperQuestionFingerprint({
        pastPaperId: String(pastPaperId),
        topicKey: namespacedTopicKey,
        questionNumber: questionNumber || "",
        question: String(b.question || ""),
        markScheme: msArray.join("\n"),
      });

      prepared.push({
        examQuestionId: String(b._id),
        namespacedTopicKey,
        questionNumber,
        marks,
        question: String(b.question || ""),
        markScheme: msArray,
        assets: Array.isArray(b.assets) ? b.assets : [],
        fingerprint: fp,
      });
    }

    const fps = prepared.map((p) => p.fingerprint);
    const existing = await PastPaperQuestion.find(
      { ownerId: actorId, fingerprint: { $in: fps } },
      { fingerprint: 1 }
    ).lean();
    const existingSet = new Set(existing.map((e) => e.fingerprint));

    const toInsert = [];
    const preview = [];

    for (const p of prepared) {
      if (existingSet.has(p.fingerprint)) {
        preview.push({ examQuestionId: p.examQuestionId, action: "skip_duplicate" });
        continue;
      }
      toInsert.push({
        ownerId: actorId,
        pastPaperId,
        specKey: paper.specKey,
        topicKey: p.namespacedTopicKey,
        questionNumber: p.questionNumber,
        marks: p.marks,
        question: p.question,
        markScheme: p.markScheme,
        assets: p.assets,
        fingerprint: p.fingerprint,
      });
      if (preview.length < 25) preview.push({ examQuestionId: p.examQuestionId, action: "insert" });
    }

    if (toInsert.length) {
      await PastPaperQuestion.insertMany(toInsert, { ordered: false });
    }

    return res.status(200).json({
      total: examQuestionIds.length,
      inserted: toInsert.length,
      skippedDuplicates: prepared.length - toInsert.length,
      invalid: errors.length,
      errors,
      preview,
    });
  } catch (e) {
    return res.status(400).json({ error: e.message || "Attach failed" });
  }
});

// PATCH /api/past-paper-questions/:id — partial update (teacher owner or admin)
router.patch("/:id", auth, async (req, res) => {
  try {
    const actorId = getActorId(req);
    if (!actorId) return res.status(401).json({ error: "Unauthorized" });
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid id" });
    const item = await PastPaperQuestion.findById(id);
    if (!item) return res.status(404).json({ error: "Not found" });
    if (!isAdmin && String(item.ownerId) !== String(actorId)) return res.status(403).json({ error: "Forbidden" });
    const patch = req.body || {};
    if (patch.question != null) item.question = String(patch.question);
    if (patch.markScheme != null) item.markScheme = Array.isArray(patch.markScheme) ? patch.markScheme.map(String) : [String(patch.markScheme)];
    if (patch.marks != null) item.marks = Number(patch.marks);
    if (patch.questionNumber != null) item.questionNumber = String(patch.questionNumber);
    if (patch.isArchived != null) item.isArchived = !!patch.isArchived;
    await item.save();
    return res.json({ item: item.toObject ? item.toObject() : item });
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message || "Update failed" });
  }
});

module.exports = router;
