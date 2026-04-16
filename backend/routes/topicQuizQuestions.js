/**
 * PR-Q1: Topic Quiz Bank (MCQ) — teacher/admin only.
 */
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const auth = require("../middleware/auth");
const { validateMcq, validateShortAnswer, validateQuestionForPublish } = require("../utils/quizValidation");
const { parseTopicKey, queryCandidates, DEFAULT_SPEC_LEGACY } = require("../utils/topicKey");
const { resolveStoredTopicKeyWithAdmin } = require("../services/adminTaxonomyService");
const { fingerprint, dedupeIncoming } = require("../utils/quizDedupe");
const { parseValidateDedupe, validateBulkItems, MAX_ITEMS } = require("../utils/parseBulkQuizQuestions");
const { enrichQuizMcqItems } = require("../utils/reviewQualityFlags");
const { ensureLeanQuizScored } = require("../utils/draftQualityScoring");
const { applyQuizMcqAiRewrite, QUIZ_MCQ_ACTIONS } = require("../services/aiRewriteDraftAsset");

function isTeacherOrAdmin(req) {
  if (!req.user) return false;
  const t = (req.user.userType || req.user.role || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user.isAdmin === true;
}

function getOwnerId(req) {
  return req.user._id || req.user.userId || req.user.id;
}

function resolveTopicKeyForQuery(specKeyFromReq, topicKeyFromReq) {
  const trimmed = (topicKeyFromReq != null && typeof topicKeyFromReq === "string") ? topicKeyFromReq.trim() : "";
  if (!trimmed) return null;
  if (!trimmed) return null;
  const specKey = (specKeyFromReq && String(specKeyFromReq).trim()) || DEFAULT_SPEC_LEGACY;
  const { topicKey: rawTopic } = parseTopicKey(trimmed);
  return queryCandidates(specKey, rawTopic || trimmed);
}

// GET /api/topic-quiz-questions?topicKey=...&status=draft|published|all&mineOnly=1&exactMatch=1&forAttach=1
router.get("/", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const ownerId = getOwnerId(req);
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    const {
      topicKey,
      specKey: specKeyQ,
      status,
      mineOnly,
      kind,
      exactMatch,
      forAttach,
      metadataSource,
      lessonId,
      generationType,
      sortBy,
      qualityBand: qualityBandQ,
    } = req.query;

    if (!topicKey) {
      return res.status(400).json({ error: "topicKey query is required" });
    }

    const resolved = await resolveStoredTopicKeyWithAdmin(specKeyQ, topicKey);
    const storedKey = resolved.error ? null : resolved.storedKey;

    let topicQuery;
    if (String(exactMatch) === "1" || String(exactMatch) === "true") {
      if (!storedKey) return res.status(400).json({ error: resolved.error || "Invalid topicKey for exact match" });
      topicQuery = { topicKey: storedKey };
    } else {
      const candidates = resolveTopicKeyForQuery(specKeyQ, topicKey);
      if (!candidates || candidates.length === 0) return res.status(400).json({ error: "Invalid topicKey" });
      topicQuery = { topicKey: { $in: candidates } };
    }

    const query = { ...topicQuery, isArchived: { $ne: true } };
    if (metadataSource && String(metadataSource).trim()) {
      query["metadata.source"] = String(metadataSource).trim();
    }
    if (lessonId && mongoose.Types.ObjectId.isValid(String(lessonId))) {
      query["metadata.lessonId"] = String(lessonId);
    }
    if (generationType && ["flashcard", "quiz", "exam"].includes(String(generationType).toLowerCase())) {
      query["metadata.generationType"] = String(generationType).toLowerCase();
    }
    if (String(forAttach) === "1" || String(forAttach) === "true") {
      query.status = "published";
    } else if (String(mineOnly) === "1" || String(mineOnly) === "true" || !isAdmin) {
      query.ownerId = ownerId;
    }
    if (status && String(status).toLowerCase() === "all") {
      // no status filter
    } else if (status && ["draft", "published"].includes(String(status).toLowerCase())) {
      query.status = String(status).toLowerCase();
    } else if (!query.status) {
      query.status = { $in: ["draft", "published"] };
    }
    const kindVal = ["quiz", "assessment"].includes(String(kind || "").toLowerCase()) ? String(kind).toLowerCase() : "quiz";
    query.kind = kindVal;

    let items = await TopicQuizQuestion.find(query).sort({ updatedAt: -1 }).lean();
    items = items.map((doc) => ensureLeanQuizScored(doc));
    if (qualityBandQ && ["high", "medium", "low"].includes(String(qualityBandQ).toLowerCase())) {
      const b = String(qualityBandQ).toLowerCase();
      items = items.filter((d) => d.metadata && d.metadata.qualityBand === b);
    }
    const sortKey = (sortBy && String(sortBy).toLowerCase()) || "updatedAt";
    if (sortKey === "qualityscore") {
      items.sort((a, b) => (b.metadata?.qualityScore ?? -1) - (a.metadata?.qualityScore ?? -1));
    } else {
      items.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    }
    const withReviewFlags = enrichQuizMcqItems(items);
    return res.json({ items: withReviewFlags });
  } catch (err) {
    console.error("TopicQuizQuestions GET error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/topic-quiz-questions/bulk/preview
router.post("/bulk/preview", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const ownerId = getOwnerId(req);
    const { topicKey, specKey: specKeyBody, format, text, csvOptions, dedupeMode, kind, type: bodyType } = req.body;
    const resolved = await resolveStoredTopicKeyWithAdmin(specKeyBody, topicKey);
    if (resolved.error) return res.status(400).json({ error: resolved.error });
    const validKey = resolved.storedKey;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "text is required" });
    }
    const { BULK_MAX_TEXT_LENGTH } = require("../config/limits");
    if (text.length > BULK_MAX_TEXT_LENGTH) {
      return res.status(413).json({ error: "Text too long", maxLength: BULK_MAX_TEXT_LENGTH });
    }

    const fmt = ["json", "csv"].includes(String(format || "").toLowerCase()) ? String(format).toLowerCase() : "json";
    const mode = ["skip", "error", "allow"].includes(String(dedupeMode || "").toLowerCase()) ? String(dedupeMode).toLowerCase() : "skip";
    const opts = csvOptions && typeof csvOptions === "object" ? { ...csvOptions } : {};
    opts.kind = ["quiz", "assessment"].includes(String(kind || "").toLowerCase()) ? String(kind).toLowerCase() : "quiz";
    opts.defaultType = (bodyType === "short-answer" || String(bodyType || "").toLowerCase().replace(/\s+/g, "-") === "short-answer") ? "short-answer" : "mcq";

    let validItems, invalid, duplicatesInPayload, totalParsed;
    try {
      const result = parseValidateDedupe(fmt, text, opts);
      validItems = result.validItems;
      invalid = result.invalid;
      duplicatesInPayload = result.duplicatesInPayload || [];
      totalParsed = result.totalParsed;
    } catch (e) {
      return res.status(400).json({ error: e.message || "Parse failed" });
    }

    const fps = validItems.map((x) => x.fingerprint);
    const spec = (specKeyBody && String(specKeyBody).trim()) || DEFAULT_SPEC_LEGACY;
    const topicKeyStr = (topicKey != null && typeof topicKey === "string") ? topicKey.trim() : "";
    const parsed = parseTopicKey(topicKeyStr);
    const queryKeys = queryCandidates(spec, parsed.topicKey || topicKeyStr);
    const existing = await TopicQuizQuestion.find({ ownerId, topicKey: { $in: queryKeys }, fingerprint: { $in: fps } }).lean();
    const existingFps = new Set(existing.map((e) => e.fingerprint));
    const duplicatesInDb = validItems.filter((x) => existingFps.has(x.fingerprint));
    const wouldCreate = validItems.filter((x) => !existingFps.has(x.fingerprint));

    if (mode === "error" && (duplicatesInPayload.length > 0 || duplicatesInDb.length > 0)) {
      return res.status(400).json({
        ok: false,
        error: "Duplicates found (dedupeMode=error)",
        topicKey: validKey,
        summary: {
          totalParsed,
          validCount: validItems.length,
          invalidCount: invalid.length,
          duplicatesInPayload: duplicatesInPayload.length,
          duplicatesInDb: duplicatesInDb.length,
          wouldCreate: wouldCreate.length,
        },
        invalid,
        duplicates: {
          inPayload: duplicatesInPayload.map((d) => ({ index: d.index, questionText: d.questionText, choices: d.choices, type: d.type })),
          inDb: duplicatesInDb.map((d) => ({ questionText: d.questionText, choices: d.choices, type: d.type })),
        },
      });
    }

    const previewItems = wouldCreate.slice(0, 200).map((x) => {
      const base = { questionText: x.questionText, explanation: x.explanation || "", tags: x.tags || [], fingerprint: x.fingerprint, type: x.type || "mcq" };
      if (x.type === "short-answer") {
        base.acceptableAnswers = x.acceptableAnswers || [];
        base.matchMode = x.matchMode || "contains";
      } else {
        base.choices = x.choices || [];
        base.correctIndex = x.correctIndex ?? 0;
      }
      if (x.difficulty != null) base.difficulty = x.difficulty;
      if (x.skill != null) base.skill = x.skill;
      if (x.estimatedTimeSec != null) base.estimatedTimeSec = x.estimatedTimeSec;
      return base;
    });

    return res.json({
      ok: true,
      topicKey: validKey,
      summary: {
        totalParsed,
        validCount: validItems.length,
        invalidCount: invalid.length,
        duplicatesInPayload: duplicatesInPayload.length,
        duplicatesInDb: duplicatesInDb.length,
        wouldCreate: wouldCreate.length,
      },
      invalid,
      duplicates: {
        inPayload: duplicatesInPayload.map((d) => ({ index: d.index, questionText: d.questionText, choices: d.choices, type: d.type })),
        inDb: duplicatesInDb.map((d) => ({ questionText: d.questionText, choices: d.choices, type: d.type })),
      },
      previewItems,
    });
  } catch (err) {
    console.error("TopicQuizQuestions preview error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/topic-quiz-questions/bulk
router.post("/bulk", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const ownerId = getOwnerId(req);
    const raw = req.body;
    const items = Array.isArray(raw.items) ? raw.items : null;
    if (!items || items.length === 0 || !raw.topicKey) {
      return res.status(400).json({ error: "topicKey and items array are required" });
    }
    if (items.length > MAX_ITEMS) {
      return res.status(400).json({ error: `Too many items (max ${MAX_ITEMS})` });
    }

    const resolved = await resolveStoredTopicKeyWithAdmin(raw.specKey, raw.topicKey);
    if (resolved.error) return res.status(400).json({ error: resolved.error });
    const storedTopicKey = resolved.storedKey;
    const mode = ["skip", "error", "allow"].includes(String(raw.dedupeMode || "").toLowerCase()) ? String(raw.dedupeMode).toLowerCase() : "skip";
    const bulkKind = ["quiz", "assessment"].includes(String(raw.kind || "").toLowerCase()) ? String(raw.kind).toLowerCase() : "quiz";

    const rawItems = items.map((c, i) => ({ ...c, _index: i, _raw: JSON.stringify(c) }));
    const { valid, invalid } = validateBulkItems(rawItems, bulkKind);
    const { uniqueItems, duplicatesInPayload } = dedupeIncoming(valid);

    const fps = uniqueItems.map((x) => x.fingerprint);
    const spec = (raw.specKey && String(raw.specKey).trim()) || DEFAULT_SPEC_LEGACY;
    const parsed = parseTopicKey(raw.topicKey || "");
    const queryKeys = queryCandidates(spec, parsed.topicKey || String(raw.topicKey || "").trim());
    const existing = await TopicQuizQuestion.find({ ownerId, topicKey: { $in: queryKeys }, kind: bulkKind, fingerprint: { $in: fps } }).lean();
    const existingFps = new Set(existing.map((e) => e.fingerprint));
    const toInsert = uniqueItems.filter((x) => !existingFps.has(x.fingerprint));
    const duplicatesInDb = uniqueItems.filter((x) => existingFps.has(x.fingerprint));

    if (mode === "error" && (duplicatesInPayload.length > 0 || duplicatesInDb.length > 0 || invalid.length > 0)) {
      return res.status(400).json({
        ok: false,
        error: "Duplicates or invalid items (dedupeMode=error)",
        summary: {
          duplicatesInPayload: duplicatesInPayload.length,
          duplicatesInDb: duplicatesInDb.length,
          invalid: invalid.length,
        },
      });
    }

    const createdIds = [];
    let createdCount = 0;
    for (const x of toInsert) {
      try {
        const payload = {
          ownerId,
          topicKey: storedTopicKey,
          type: x.type || "mcq",
          questionText: x.questionText,
          explanation: x.explanation || "",
          tags: x.tags || [],
          status: "draft",
          kind: x.kind || bulkKind,
          fingerprint: x.fingerprint,
          difficulty: x.difficulty ?? null,
          skill: x.skill ?? null,
          estimatedTimeSec: x.estimatedTimeSec ?? null,
        };
        if (x.type === "short-answer") {
          payload.acceptableAnswers = x.acceptableAnswers || [];
          payload.matchMode = x.matchMode || "contains";
          payload.choices = [];
          payload.correctIndex = 0;
        } else {
          payload.choices = x.choices || [];
          payload.correctIndex = x.correctIndex ?? 0;
          payload.acceptableAnswers = [];
          payload.matchMode = "contains";
        }
        const doc = await TopicQuizQuestion.create(payload);
        createdCount += 1;
        createdIds.push(String(doc._id));
      } catch (e) {
        if (e.code !== 11000) throw e;
      }
    }

    return res.json({
      ok: true,
      createdCount,
      skipped: {
        duplicatesInPayload: duplicatesInPayload.length,
        duplicatesInDb: duplicatesInDb.length,
        invalid: invalid.length,
      },
      createdIds,
    });
  } catch (err) {
    console.error("TopicQuizQuestions bulk error:", err);
    return res.status(400).json({ error: err.message || "Bad request" });
  }
});

const BULK_IDS_MAX = 500;

// PR-EDGE-2: POST /api/topic-quiz-questions/bulk/publish — teachers publish own items; admins any
router.post("/bulk/publish", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) return res.status(403).json({ error: "Teachers and admins only" });
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!ids.length) return res.status(400).json({ error: "ids array is required and must not be empty" });
    if (ids.length > BULK_IDS_MAX) return res.status(400).json({ error: `Too many ids (max ${BULK_IDS_MAX})` });
    const validIds = ids.filter((id) => id && mongoose.Types.ObjectId.isValid(String(id)));
    if (validIds.length !== ids.length) return res.status(400).json({ error: "All ids must be valid ObjectIds" });
    const objIds = validIds.map((id) => new mongoose.Types.ObjectId(id));
    const ownerId = getOwnerId(req);
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    const query = { _id: { $in: objIds } };
    if (!isAdmin) query.ownerId = ownerId;
    const permitted = await TopicQuizQuestion.countDocuments(query);
    if (!isAdmin && permitted === 0) return res.status(404).json({ error: "Not found" });
    const result = await TopicQuizQuestion.updateMany(query, { $set: { status: "published" } });
    return res.json({ ok: true, matchedCount: result.matchedCount, updatedCount: result.modifiedCount });
  } catch (err) {
    console.error("TopicQuizQuestions bulk publish error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// PR-EDGE-2: POST /api/topic-quiz-questions/bulk/unpublish
router.post("/bulk/unpublish", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) return res.status(403).json({ error: "Teachers and admins only" });
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!ids.length) return res.status(400).json({ error: "ids array is required and must not be empty" });
    if (ids.length > BULK_IDS_MAX) return res.status(400).json({ error: `Too many ids (max ${BULK_IDS_MAX})` });
    const validIds = ids.filter((id) => id && mongoose.Types.ObjectId.isValid(String(id)));
    if (validIds.length !== ids.length) return res.status(400).json({ error: "All ids must be valid ObjectIds" });
    const objIds = validIds.map((id) => new mongoose.Types.ObjectId(id));
    const ownerId = getOwnerId(req);
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    const query = { _id: { $in: objIds } };
    if (!isAdmin) query.ownerId = ownerId;
    const permitted = await TopicQuizQuestion.countDocuments(query);
    if (!isAdmin && permitted === 0) return res.status(404).json({ error: "Not found" });
    const result = await TopicQuizQuestion.updateMany(query, { $set: { status: "draft" } });
    return res.json({ ok: true, matchedCount: result.matchedCount, updatedCount: result.modifiedCount });
  } catch (err) {
    console.error("TopicQuizQuestions bulk unpublish error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/topic-quiz-questions/bulk/delete — teachers delete own drafts; admins may delete any selected
router.post("/bulk/delete", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) return res.status(403).json({ error: "Teachers and admins only" });
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!ids.length) return res.status(400).json({ error: "ids array is required and must not be empty" });
    if (ids.length > BULK_IDS_MAX) return res.status(400).json({ error: `Too many ids (max ${BULK_IDS_MAX})` });
    const validIds = ids.filter((id) => id && mongoose.Types.ObjectId.isValid(String(id)));
    if (validIds.length !== ids.length) return res.status(400).json({ error: "All ids must be valid ObjectIds" });
    const objIds = validIds.map((id) => new mongoose.Types.ObjectId(id));
    const ownerId = getOwnerId(req);
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    const query = { _id: { $in: objIds } };
    if (!isAdmin) {
      query.ownerId = ownerId;
      query.status = "draft";
    }
    const permitted = await TopicQuizQuestion.countDocuments(query);
    if (!isAdmin && permitted === 0) return res.status(404).json({ error: "Not found" });
    const result = await TopicQuizQuestion.deleteMany(query);
    return res.json({ ok: true, deletedCount: result.deletedCount });
  } catch (err) {
    console.error("TopicQuizQuestions bulk delete error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/topic-quiz-questions/:id/ai-rewrite — draft MCQ only; LLM JSON (owner/admin)
router.post("/:id/ai-rewrite", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) return res.status(403).json({ error: "Teachers and admins only" });
  try {
    const id = req.params.id;
    const action = String(req.body?.action || "").trim();
    if (!action || !QUIZ_MCQ_ACTIONS.has(action)) {
      return res.status(400).json({ error: `Invalid action. Allowed: ${[...QUIZ_MCQ_ACTIONS].join(", ")}` });
    }
    const ownerId = getOwnerId(req);
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid id" });
    const doc = await TopicQuizQuestion.findById(id);
    if (!doc) return res.status(404).json({ error: "Question not found" });
    if (!isAdmin && String(doc.ownerId) !== String(ownerId)) return res.status(404).json({ error: "Question not found" });
    if (String(doc.status) !== "draft") return res.status(400).json({ error: "AI rewrite is only for drafts" });
    await applyQuizMcqAiRewrite(doc, action);
    const lean = doc.toObject ? doc.toObject() : doc;
    const enriched = enrichQuizMcqItems([lean])[0];
    return res.json({ question: enriched });
  } catch (err) {
    if (err.code === "LLM_NOT_CONFIGURED" || err.code === "LLM_EMPTY" || err.code === "LLM_BAD_JSON") {
      return res.status(503).json({ error: err.message || "LLM unavailable" });
    }
    const code = err.statusCode || 400;
    console.error("TopicQuizQuestions ai-rewrite error:", err);
    return res.status(code >= 400 && code < 500 ? code : 400).json({ error: err.message || "Bad request" });
  }
});

// POST /api/topic-quiz-questions/:id/publish (teachers + admins)
router.post("/:id/publish", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) return res.status(403).json({ error: "Teachers and admins only" });
  try {
    const id = req.params.id;
    const ownerId = getOwnerId(req);
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid id" });
    const doc = await TopicQuizQuestion.findOne({ _id: id });
    if (!doc) return res.status(404).json({ error: "Question not found" });
    if (!isAdmin && String(doc.ownerId) !== String(ownerId)) return res.status(404).json({ error: "Question not found" });
    const { valid, errors } = validateQuestionForPublish(doc);
    if (!valid) {
      return res.status(400).json({ message: "Cannot publish: validation failed", errors });
    }
    const { checkPublishGateForGenerated } = require("../middleware/requirePublishGateIfGenerated");
    const gate = await checkPublishGateForGenerated(doc.toObject ? doc.toObject() : doc, req.user);
    if (!gate.ok) {
      return res.status(400).json({ error: "Fix issues first", issues: gate.issues, blocks: gate.blocks });
    }
    doc.status = "published";
    doc.publishedBy = ownerId;
    doc.publishedAt = new Date();
    await doc.save();

    // PR-015: Enqueue knowledge refresh (async, non-blocking)
    if (doc.topicKey) {
      const specKey = String(doc.topicKey).split(":")[0];
      if (specKey) {
        const { enqueueKnowledgeRefresh } = require("../services/jobs/enqueueKnowledgeRefresh");
        enqueueKnowledgeRefresh({ specKey, topicKey: doc.topicKey, userId: req.user?._id }).catch((e) =>
          console.error("[topicQuizQuestions] enqueueKnowledgeRefresh error:", e?.message)
        );
      }
    }
    return res.json({ question: doc.toObject() });
  } catch (err) {
    console.error("TopicQuizQuestions publish error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/topic-quiz-questions/:id/unpublish
router.post("/:id/unpublish", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) return res.status(403).json({ error: "Teachers and admins only" });
  try {
    const id = req.params.id;
    const ownerId = getOwnerId(req);
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid id" });
    const doc = await TopicQuizQuestion.findOne({ _id: id });
    if (!doc) return res.status(404).json({ error: "Question not found" });
    if (!isAdmin && String(doc.ownerId) !== String(ownerId)) return res.status(403).json({ error: "Not your question" });
    doc.status = "draft";
    await doc.save();
    return res.json({ question: doc.toObject() });
  } catch (err) {
    console.error("TopicQuizQuestions unpublish error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/topic-quiz-questions/:id — edit (teacher owner or admin)
router.patch("/:id", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) return res.status(403).json({ error: "Teachers and admins only" });
  try {
    const id = req.params.id;
    const ownerId = getOwnerId(req);
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid id" });
    const item = await TopicQuizQuestion.findById(id);
    if (!item) return res.status(404).json({ error: "Not found" });
    if (!isAdmin && String(item.ownerId) !== String(ownerId)) return res.status(403).json({ error: "Forbidden" });

    const patch = req.body || {};
    if (patch.questionText != null) item.questionText = String(patch.questionText);
    if (patch.explanation != null) item.explanation = String(patch.explanation);
    if (Array.isArray(patch.tags)) item.tags = patch.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 20);
    if (patch.isArchived != null) item.isArchived = !!patch.isArchived;
    if (patch.status != null && ["draft", "published"].includes(String(patch.status))) item.status = patch.status;

    const type = patch.type != null ? patch.type : item.type;
    item.type = type === "short-answer" ? "short-answer" : "mcq";

    if (item.type === "mcq") {
      const choices = patch.choices ?? item.choices;
      const correctChoice = patch.correctChoice ?? (typeof patch.correctIndex === "number" ? String.fromCharCode(65 + patch.correctIndex) : null) ?? (item.correctIndex != null ? String.fromCharCode(65 + item.correctIndex) : "A");
      const validated = validateMcq({ choices, correctChoice });
      item.choices = validated.choices;
      item.correctIndex = validated.correctIndex;
      item.acceptableAnswers = [];
      item.matchMode = "contains";
    } else {
      const acceptableAnswers = patch.acceptableAnswers ?? item.acceptableAnswers ?? [];
      const matchMode = patch.matchMode ?? item.matchMode;
      const validated = validateShortAnswer({ acceptableAnswers, matchMode });
      item.acceptableAnswers = validated.acceptableAnswers;
      item.matchMode = validated.matchMode;
      item.choices = [];
      item.correctIndex = 0;
    }

    await item.save();
    return res.json({ item: item.toObject ? item.toObject() : item });
  } catch (err) {
    const status = err.status || (err.code === "INVALID_CHOICES" || err.code === "INVALID_CORRECT_CHOICE" || err.code === "INVALID_ACCEPTABLE_ANSWERS" ? 400 : 500);
    return res.status(status).json({ error: err.message || "Update failed", code: err.code });
  }
});

// DELETE /api/topic-quiz-questions/:id (admin only)
router.delete("/:id", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) return res.status(403).json({ error: "Teachers and admins only" });
  const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
  if (!isAdmin) return res.status(403).json({ error: "Deletion is admin-only" });
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid id" });
    const doc = await TopicQuizQuestion.findOne({ _id: id });
    if (!doc) return res.status(404).json({ error: "Question not found" });
    await TopicQuizQuestion.deleteOne({ _id: id });
    return res.json({ ok: true });
  } catch (err) {
    console.error("TopicQuizQuestions DELETE error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
