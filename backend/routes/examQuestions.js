// backend/routes/examQuestions.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const ExamQuestion = require("../models/ExamQuestion");
const auth = require("../middleware/auth");
const { parseTopicKey, queryCandidates, DEFAULT_SPEC_LEGACY, normalizeToStoredKey } = require("../utils/topicKey");
const { resolveStoredTopicKeyWithAdmin } = require("../services/adminTaxonomyService");
const { enrichExamItems } = require("../utils/reviewQualityFlags");
const { ensureLeanExamScored } = require("../utils/draftQualityScoring");
const { applyExamAiRewrite, EXAM_ACTIONS } = require("../services/aiRewriteDraftAsset");
const {
  validateExamQuestionPublishReadiness,
  validateNewExamQuestionBankDraft,
} = require("../utils/examQuestionPublishValidation");
const {
  isCompositePayload,
  buildCompositeFields,
} = require("../utils/compositeExamQuestion");
const {
  fetchEmbeddedExamQuestionsForLesson,
  fetchTeacherOwnedExamQuestionsByIds,
} = require("../services/examQuestionLessonEmbedService");
const {
  buildExamQuestionLevelQuery,
  resolveExamQuestionLevelForSave,
} = require("../utils/examQuestionLevelFilter");
const { buildTopicSelectorQueryClause } = require("../utils/examQuestionTopicSelectorMatch");

/** In-memory score-on-read, optional band filter, sort (matches topic flashcards/quiz list). */
function finalizeExamQuestionsForList(items, query) {
  const { sortBy, qualityBand: qualityBandQ } = query || {};
  let list = (items || []).map((d) => ensureLeanExamScored(d));
  if (qualityBandQ && ["high", "medium", "low"].includes(String(qualityBandQ).toLowerCase())) {
    const b = String(qualityBandQ).toLowerCase();
    list = list.filter((d) => d.metadata && d.metadata.qualityBand === b);
  }
  const sortKey = (sortBy && String(sortBy).toLowerCase()) || "updatedAt";
  if (sortKey === "qualityscore") {
    list.sort((a, b) => (b.metadata?.qualityScore ?? -1) - (a.metadata?.qualityScore ?? -1));
  } else {
    list.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  }
  return list;
}

function isTeacher(req) {
  return req.user && req.user.userType === "teacher";
}

function isTeacherOrAdmin(req) {
  if (!req.user) return false;
  const t = (req.user.userType || req.user.role || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user.isAdmin === true;
}

/** Return question object with topicKey normalized to short form (topic slug only) for API responses. */
function toResponseQuestion(q) {
  if (!q) return q;
  const shortKey = parseTopicKey(q.topicKey || "").topicKey || q.topicKey;
  return { ...q, topicKey: shortKey };
}

// POST /api/exam-questions — create draft (teacher only)
router.post("/", auth, async (req, res) => {
  if (!isTeacher(req)) {
    return res.status(403).json({ success: false, msg: "Teachers only" });
  }
  try {
    const specKeyBody = req.body.specKey;
    if (req.body.topicKey != null && String(req.body.topicKey).trim() !== "") {
      const resolved = await resolveStoredTopicKeyWithAdmin(specKeyBody, req.body.topicKey);
      if (resolved.error) {
        return res.status(400).json({ success: false, msg: resolved.error, error: resolved.error });
      }
      req.body.topicKey = resolved.storedKey;
    } else if (req.body.topicKey != null) {
      req.body.topicKey = undefined;
    }
    const bankReady = validateNewExamQuestionBankDraft(req.body);
    if (!bankReady.ok) {
      return res.status(400).json({ success: false, msg: bankReady.msg || "Invalid exam question" });
    }
    const levelForSave = resolveExamQuestionLevelForSave({
      specKey: specKeyBody,
      topicKey: req.body.topicKey,
      level: req.body.level,
    });
    const teacherId = req.user.userId || req.user._id;
    const createDoc = isCompositePayload(req.body)
      ? { ...req.body, ...buildCompositeFields(req.body) }
      : { ...req.body };
    const question = await ExamQuestion.create({
      ...createDoc,
      ...(levelForSave ? { level: levelForSave } : {}),
      teacherId,
      status: "draft",
    });
    return res.status(201).json({ success: true, question: toResponseQuestion(question.toObject ? question.toObject() : question) });
  } catch (err) {
    console.error("ExamQuestions POST error:", err);
    return res.status(400).json({ success: false, msg: err.message });
  }
});

// GET /api/exam-questions/mine — teacher's own questions only; specKey, topicKey (slug or namespaced), q, limit.
// PR-PAST-PAPERS-UI-3: For "attach from bank" flow.
function clampInt(v, opts) {
  const n = Number(v);
  if (!Number.isFinite(n)) return opts.fallback;
  return Math.min(opts.max, Math.max(opts.min, Math.floor(n)));
}

router.get("/mine", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ success: false, msg: "Teachers and admins only" });
  }
  try {
    const teacherId = req.user.userId || req.user._id;
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });

    const {
      specKey,
      topicKey: topicKeyQ,
      q,
      limit,
      difficulty,
      difficultyMin,
      difficultyMax,
      skill,
      estimatedTimeMaxSec,
      metadataSource,
      lessonId,
      status: statusQ,
      generationType,
      sortBy,
      qualityBand,
    } = req.query || {};
    const lim = clampInt(limit, { min: 1, max: 200, fallback: 50 });
    const needsQualityPass =
      (sortBy && String(sortBy).toLowerCase() === "qualityscore") ||
      (qualityBand && ["high", "medium", "low"].includes(String(qualityBand).toLowerCase()));

    const query = { teacherId, isArchived: { $ne: true } };
    if (statusQ && String(statusQ).trim() && ["draft", "published"].includes(String(statusQ).toLowerCase())) {
      query.status = String(statusQ).toLowerCase();
    } else {
      query.status = { $in: ["draft", "published"] };
    }
    if (metadataSource && String(metadataSource).trim()) {
      query["metadata.source"] = String(metadataSource).trim();
    }
    if (lessonId && mongoose.Types.ObjectId.isValid(String(lessonId))) {
      query["metadata.lessonId"] = String(lessonId);
    }
    if (generationType && ["flashcard", "quiz", "exam"].includes(String(generationType).toLowerCase())) {
      query["metadata.generationType"] = String(generationType).toLowerCase();
    }

    // STRICT TAXONOMY: Only exact sub-topic matching. No specKey-only broadening.
    if (topicKeyQ && String(topicKeyQ).trim()) {
      const spec = (specKey && String(specKey).trim()) || DEFAULT_SPEC_LEGACY;
      const candidates = queryCandidates(spec, parseTopicKey(String(topicKeyQ).trim()).topicKey || String(topicKeyQ).trim());
      if (candidates.length) query.topicKey = { $in: candidates };
    }
    // When specKey only (no topicKey): no topic filter — returns all teacher's questions. Require topicKey for sub-topic filtering.

    if (q && String(q).trim()) {
      query.question = { $regex: String(q).trim(), $options: "i" };
    }

    if ((difficultyMin != null && String(difficultyMin).trim() !== "") || (difficultyMax != null && String(difficultyMax).trim() !== "")) {
      const range = {};
      const dMin = difficultyMin != null && String(difficultyMin).trim() !== "" ? parseInt(String(difficultyMin).trim(), 10) : NaN;
      const dMax = difficultyMax != null && String(difficultyMax).trim() !== "" ? parseInt(String(difficultyMax).trim(), 10) : NaN;
      if (Number.isFinite(dMin) && dMin >= 1 && dMin <= 5) range.$gte = dMin;
      if (Number.isFinite(dMax) && dMax >= 1 && dMax <= 5) range.$lte = dMax;
      if (Object.keys(range).length) query.difficulty = range;
    } else if (difficulty !== undefined && difficulty !== "" && String(difficulty).trim() !== "") {
      const d = parseInt(String(difficulty).trim(), 10);
      if (Number.isFinite(d) && d >= 1 && d <= 5) query.difficulty = d;
    }
    if (skill !== undefined && String(skill).trim() !== "") {
      const s = String(skill).trim().toLowerCase();
      if (["recall", "application", "analysis", "exam-technique"].includes(s)) query.skill = s;
    }
    if (estimatedTimeMaxSec !== undefined && String(estimatedTimeMaxSec).trim() !== "") {
      const t = parseInt(String(estimatedTimeMaxSec).trim(), 10);
      if (Number.isFinite(t) && t >= 1) query.estimatedTimeSec = { $lte: t };
    }

    let items;
    if (needsQualityPass) {
      items = await ExamQuestion.find(query).sort({ updatedAt: -1 }).lean();
      items = finalizeExamQuestionsForList(items, { sortBy, qualityBand }).slice(0, lim);
    } else {
      items = await ExamQuestion.find(query).sort({ updatedAt: -1 }).limit(lim).lean();
      items = finalizeExamQuestionsForList(items, { sortBy: "updatedAt" });
    }
    const enriched = enrichExamItems(items);
    return res.status(200).json({ items: enriched.map(toResponseQuestion) });
  } catch (err) {
    console.error("ExamQuestions GET /mine error:", err);
    return res.status(400).json({ error: err.message || "Failed to load exam questions" });
  }
});

// GET /api/exam-questions/for-topic — published exam-bank items for a syllabus topic (students + authenticated users; no drafts).
router.get("/for-topic", auth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, msg: "Unauthorized" });
    }
    const specKeyQ = String(req.query.specKey || "").trim();
    const topicKeyQ = String(req.query.topicKey || "").trim();
    if (!specKeyQ || !topicKeyQ) {
      return res.status(400).json({ success: false, msg: "specKey and topicKey are required" });
    }
    const lim = clampInt(req.query.limit, { min: 5, max: 10, fallback: 8 });
    const spec = specKeyQ || DEFAULT_SPEC_LEGACY;
    const normalizedTopic = normalizeToStoredKey(topicKeyQ, spec);
    const parsed = parseTopicKey(normalizedTopic || topicKeyQ);
    if (parsed.isNamespaced && parsed.specKey && parsed.specKey !== spec) {
      return res.status(400).json({
        success: false,
        msg: "specKey query does not match the namespaced topicKey (canonical identity mismatch).",
        error: "SPEC_TOPIC_MISMATCH",
      });
    }
    const candidates = queryCandidates(spec, parsed.topicKey || topicKeyQ);
    if (!candidates.length) {
      return res.json({ success: true, questions: [] });
    }
    const query = {
      status: "published",
      topicKey: { $in: candidates },
      isArchived: { $ne: true },
    };
    let questions = await ExamQuestion.find(query).sort({ updatedAt: -1 }).limit(lim).lean();
    questions = finalizeExamQuestionsForList(questions, { sortBy: "updatedAt" });
    const enriched = enrichExamItems(questions);
    return res.json({
      success: true,
      questions: enriched.map(toResponseQuestion),
    });
  } catch (err) {
    console.error("ExamQuestions GET /for-topic error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
});

// GET /api/exam-questions — list (teacher/admin only; filters: subject, examBoard, level, topic, topicKey, type, status)
// PR-W2.2: Teacher/admin see draft + published by default so Worksheet Builder Question Bank shows seeded drafts.
// PR-W2.2.2: Response must include topicKey (and topic) on every item — do not use .select() that omits them.
// Optional: page & limit → return { questions, pagination: { page, limit, total } }; otherwise returns { questions } (backward compatible).
// Students are not allowed (403); if ever opened to students, enforce status: "published" only.
router.get("/", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ success: false, msg: "Teachers and admins only" });
  }
  try {
    const teacherId = req.user.userId || req.user._id;
    const {
      subject,
      examBoard,
      level,
      topic,
      topicKey,
      specKey: specKeyQ,
      type,
      status,
      mineOnly,
      page: pageQ,
      limit: limitQ,
      metadataSource,
      lessonId,
      generationType,
      sortBy,
      qualityBand,
    } = req.query;
    const query = {};
    // Teacher/admin: default = both draft and published (Worksheet Builder shows all bank questions)
    if (status !== undefined && status !== "") {
      query.status = String(status).trim().toLowerCase();
    } else {
      query.status = { $in: ["draft", "published"] };
    }
    if (metadataSource && String(metadataSource).trim()) {
      query["metadata.source"] = String(metadataSource).trim();
    }
    if (lessonId && mongoose.Types.ObjectId.isValid(String(lessonId))) {
      query["metadata.lessonId"] = String(lessonId);
    }
    if (generationType && ["flashcard", "quiz", "exam"].includes(String(generationType).toLowerCase())) {
      query["metadata.generationType"] = String(generationType).toLowerCase();
    }
    // Restrict to current teacher only when mineOnly=1 (e.g. "my questions only")
    if (String(mineOnly) === "1" || String(mineOnly) === "true") {
      query.teacherId = teacherId;
    }
    if (subject) query.subject = subject;
    if (examBoard) query.examBoard = examBoard;
    const levelFilter = buildExamQuestionLevelQuery(level, {
      specKey: specKeyQ,
      topicKey,
      examBoard,
      subject,
    });
    if (levelFilter) query.level = levelFilter;
    if (topic) query.topic = topic;
    if (topicKey) {
      const { clause } = buildTopicSelectorQueryClause({ specKey: specKeyQ, topicKey });
      if (clause.$or) {
        query.$and = query.$and || [];
        query.$and.push({ $or: clause.$or });
      } else if (clause.topicKey !== undefined) {
        query.topicKey = clause.topicKey;
      }
    }
    if (type) query.type = type;

    const usePagination = pageQ != null && limitQ != null && String(pageQ).trim() !== "" && String(limitQ).trim() !== "";
    const page = usePagination ? clampInt(pageQ, { min: 1, max: 1000, fallback: 1 }) : 1;
    const limit = usePagination ? clampInt(limitQ, { min: 1, max: 100, fallback: 50 }) : 50;

    const needsQualityPass =
      (sortBy && String(sortBy).toLowerCase() === "qualityscore") ||
      (qualityBand && ["high", "medium", "low"].includes(String(qualityBand).toLowerCase()));

    if (usePagination) {
      if (needsQualityPass) {
        let all = await ExamQuestion.find(query).lean();
        all = finalizeExamQuestionsForList(all, { sortBy, qualityBand });
        const total = all.length;
        const questions = all.slice((page - 1) * limit, page * limit);
        const enriched = enrichExamItems(questions);
        return res.json({
          success: true,
          questions: enriched.map(toResponseQuestion),
          pagination: { page, limit, total },
        });
      }
      const [questions, total] = await Promise.all([
        ExamQuestion.find(query).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        ExamQuestion.countDocuments(query),
      ]);
      const ordered = finalizeExamQuestionsForList(questions, { sortBy: "updatedAt" });
      const enriched = enrichExamItems(ordered);
      return res.json({
        success: true,
        questions: enriched.map(toResponseQuestion),
        pagination: { page, limit, total },
      });
    }

    let questions = await ExamQuestion.find(query).sort({ updatedAt: -1 }).lean();
    if (needsQualityPass) {
      questions = finalizeExamQuestionsForList(questions, { sortBy, qualityBand });
    } else {
      questions = finalizeExamQuestionsForList(questions, { sortBy: "updatedAt" });
    }
    const enriched = enrichExamItems(questions);
    return res.json({ success: true, questions: enriched.map(toResponseQuestion) });
  } catch (err) {
    console.error("ExamQuestions GET error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
});

// POST /api/exam-questions/bulk/purge-invalid-ai-exam-drafts — delete AI lesson exam drafts that fail publish-readiness (no new MCQs / weak schemes).
router.post("/bulk/purge-invalid-ai-exam-drafts", auth, async (req, res) => {
  if (!isTeacher(req)) {
    return res.status(403).json({ success: false, msg: "Teachers only" });
  }
  try {
    const teacherId = req.user.userId || req.user._id;
    const dryRun = req.body?.dryRun === true || String(req.query?.dryRun || "") === "1";
    const confirmed = req.body?.confirm === true || req.body?.confirm === "true";

    const query = {
      teacherId,
      status: "draft",
      "metadata.source": "ai_lesson_assets",
      "metadata.generationType": "exam",
    };
    const docs = await ExamQuestion.find(query).select("_id type marks question markScheme correctAnswer metadata").lean();
    const invalid = docs.filter((d) => !validateExamQuestionPublishReadiness(d).ok);
    const ids = invalid.map((d) => d._id);

    if (dryRun) {
      return res.status(200).json({
        success: true,
        dryRun: true,
        count: ids.length,
        ids: ids.map((id) => String(id)),
      });
    }
    if (!confirmed) {
      return res.status(400).json({
        success: false,
        msg: "Send { confirm: true } after reviewing dryRun, or use dryRun: true to preview counts only.",
      });
    }
    const del = await ExamQuestion.deleteMany({ _id: { $in: ids } });
    return res.status(200).json({
      success: true,
      deletedCount: del.deletedCount,
      ids: ids.map((id) => String(id)),
    });
  } catch (err) {
    console.error("ExamQuestions bulk purge error:", err);
    return res.status(500).json({ success: false, msg: err.message || "Server error" });
  }
});

// POST /api/exam-questions/by-ids — batch fetch with lesson embed or teacher-owner scope
router.post("/by-ids", auth, async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const lessonId = req.body?.lessonId ?? req.query?.lessonId;
    const classroomMode = req.query?.present === "classroom";

    if (lessonId && mongoose.Types.ObjectId.isValid(String(lessonId))) {
      const result = await fetchEmbeddedExamQuestionsForLesson(req.user, lessonId, ids, { classroomMode });
      if (!result.ok) {
        return res.status(result.status || 400).json({ success: false, msg: result.error, error: result.error });
      }
      const enriched = enrichExamItems(result.questions || []);
      return res.json({
        success: true,
        questions: enriched.map(toResponseQuestion),
      });
    }

    const owned = await fetchTeacherOwnedExamQuestionsByIds(req.user, ids);
    if (!owned.ok) {
      return res.status(owned.status || 403).json({ success: false, msg: owned.error, error: owned.error });
    }
    const enriched = enrichExamItems(owned.questions || []);
    return res.json({
      success: true,
      questions: enriched.map(toResponseQuestion),
    });
  } catch (err) {
    console.error("ExamQuestions POST /by-ids error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
});

// GET /api/exam-questions/:id — single fetch with lesson embed or teacher-owner scope
router.get("/:id", auth, async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, msg: "Invalid ID" });
    }
    const lessonId = req.query?.lessonId;
    const classroomMode = req.query?.present === "classroom";

    if (lessonId && mongoose.Types.ObjectId.isValid(String(lessonId))) {
      const result = await fetchEmbeddedExamQuestionsForLesson(req.user, lessonId, [id], { classroomMode });
      if (!result.ok) {
        return res.status(result.status || 400).json({ success: false, msg: result.error, error: result.error });
      }
      const q = (result.questions || []).find((row) => String(row._id) === String(id));
      if (!q) {
        return res.status(404).json({ success: false, msg: "Question not found" });
      }
      const enriched = enrichExamItems([q])[0];
      return res.json({ success: true, question: toResponseQuestion(enriched) });
    }

    const owned = await fetchTeacherOwnedExamQuestionsByIds(req.user, [id]);
    if (!owned.ok) {
      return res.status(owned.status || 403).json({ success: false, msg: owned.error, error: owned.error });
    }
    const q = (owned.questions || []).find((row) => String(row._id) === String(id));
    if (!q) {
      return res.status(404).json({ success: false, msg: "Question not found" });
    }
    const enriched = enrichExamItems([q])[0];
    return res.json({ success: true, question: toResponseQuestion(enriched) });
  } catch (err) {
    console.error("ExamQuestions GET /:id error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
});

// PATCH /api/exam-questions/:id — partial update (teacher owner or admin)
router.patch("/:id", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) return res.status(403).json({ error: "Teachers and admins only" });
  try {
    const id = req.params.id;
    const teacherId = req.user.userId || req.user._id;
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid id" });
    const item = await ExamQuestion.findById(id);
    if (!item) return res.status(404).json({ error: "Not found" });
    if (!isAdmin && String(item.teacherId) !== String(teacherId)) return res.status(403).json({ error: "Forbidden" });
    const patch = req.body || {};
    if (patch.question != null) item.question = String(patch.question);
    if (patch.markScheme != null) item.markScheme = Array.isArray(patch.markScheme) ? patch.markScheme.map(String) : [String(patch.markScheme)];
    if (patch.marks != null) item.marks = Number(patch.marks);
    if (patch.isArchived != null) item.isArchived = !!patch.isArchived;
    if (patch.imageUrl !== undefined) {
      const u = patch.imageUrl;
      item.imageUrl = u != null && String(u).trim() ? String(u).trim() : null;
    }
    await item.save();
    return res.json({ item: toResponseQuestion(item.toObject ? item.toObject() : item) });
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message || "Update failed" });
  }
});

// PUT /api/exam-questions/:id — update (only owner)
router.put("/:id", auth, async (req, res) => {
  if (!isTeacher(req)) {
    return res.status(403).json({ success: false, msg: "Teachers only" });
  }
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, msg: "Invalid ID" });
    }
    const teacherId = req.user.userId || req.user._id;
    const question = await ExamQuestion.findOne({ _id: id, teacherId });
    if (!question) {
      return res.status(404).json({ success: false, msg: "Question not found" });
    }
    if (req.body.topicKey != null) {
      if (req.body.topicKey && String(req.body.topicKey).trim() !== "") {
        const resolved = await resolveStoredTopicKeyWithAdmin(req.body.specKey, req.body.topicKey);
        if (resolved.error) {
          return res.status(400).json({ success: false, msg: resolved.error, error: resolved.error });
        }
        question.topicKey = resolved.storedKey;
      } else {
        question.topicKey = undefined;
      }
    }
    const {
      subject,
      examBoard,
      level,
      topic,
      unitKey,
      type,
      marks,
      question: qText,
      options,
      correctIndex,
      correctAnswer,
      markScheme,
      content,
      status,
      imageUrl,
      specKey: specKeyBody,
    } = req.body;
    if (subject !== undefined) question.subject = subject;
    if (examBoard !== undefined) question.examBoard = examBoard;
    const resolvedSpecKey =
      (specKeyBody && String(specKeyBody).trim()) ||
      (question.topicKey && String(question.topicKey).includes(":")
        ? String(question.topicKey).split(":")[0]
        : undefined);
    if (level !== undefined || specKeyBody !== undefined || req.body.topicKey != null) {
      const levelForSave = resolveExamQuestionLevelForSave({
        specKey: resolvedSpecKey,
        topicKey: question.topicKey,
        level: level !== undefined ? level : question.level,
      });
      if (levelForSave) question.level = levelForSave;
      else if (level !== undefined) question.level = level;
    }
    if (topic !== undefined) question.topic = topic;
    if (unitKey !== undefined) question.unitKey = unitKey || undefined;
    if (type !== undefined) question.type = type;
    if (marks !== undefined) question.marks = marks;
    if (qText !== undefined) question.question = qText;
    if (options !== undefined) question.options = options;
    if (correctIndex !== undefined) question.correctIndex = correctIndex;
    if (correctAnswer !== undefined) question.correctAnswer = correctAnswer;
    if (markScheme !== undefined) question.markScheme = markScheme;
    if (content !== undefined) question.content = content;
    if (imageUrl !== undefined) {
      question.imageUrl = imageUrl != null && String(imageUrl).trim() ? String(imageUrl).trim() : null;
    }

    // Composite update: rebuild shared stem / parts / total marks together so
    // question + marks stay in sync. Runs after the single-field assignments so
    // it overrides any stray type/marks values for composite records.
    const wantsComposite =
      isCompositePayload(req.body) ||
      (question.questionMode === "composite" &&
        (req.body.parts !== undefined ||
          req.body.sharedStem !== undefined ||
          req.body.title !== undefined));
    if (wantsComposite) {
      const composite = buildCompositeFields({
        parts: req.body.parts !== undefined ? req.body.parts : question.parts,
        sharedStem: req.body.sharedStem !== undefined ? req.body.sharedStem : question.sharedStem,
        title: req.body.title !== undefined ? req.body.title : question.title,
      });
      question.questionMode = "composite";
      question.type = "composite";
      question.title = composite.title;
      question.sharedStem = composite.sharedStem;
      question.parts = composite.parts;
      question.totalMarks = composite.totalMarks;
      question.question = composite.question;
      question.marks = composite.marks;
    }

    let justPublished = false;
    if (status !== undefined) {
      const newStatus = String(status).trim().toLowerCase();
      if (newStatus === "published") {
        const { checkPublishGateForGenerated } = require("../middleware/requirePublishGateIfGenerated");
        const qObj = question.toObject ? question.toObject() : { ...question._doc, metadata: question.metadata };
        const gate = await checkPublishGateForGenerated(qObj, req.user);
        if (!gate.ok) {
          return res.status(400).json({ success: false, msg: "Fix issues first", issues: gate.issues, blocks: gate.blocks });
        }
        const mergedForPub = {
          ...qObj,
          question: qText !== undefined ? qText : question.question,
          type: type !== undefined ? type : question.type,
          marks: marks !== undefined ? marks : question.marks,
          markScheme: markScheme !== undefined ? markScheme : question.markScheme,
          correctAnswer: correctAnswer !== undefined ? correctAnswer : question.correctAnswer,
          metadata: question.metadata,
        };
        const ready = validateExamQuestionPublishReadiness(mergedForPub);
        if (!ready.ok) {
          return res.status(400).json({ success: false, msg: ready.msg || "Not ready to publish" });
        }
        justPublished = true;
      }
      question.status = newStatus;
    }
    await question.save();

    // PR-015: Enqueue knowledge refresh when publishing (async, non-blocking)
    if (justPublished && question.topicKey) {
      const specKey = String(question.topicKey).split(":")[0];
      if (specKey) {
        const { enqueueKnowledgeRefresh } = require("../services/jobs/enqueueKnowledgeRefresh");
        enqueueKnowledgeRefresh({ specKey, topicKey: question.topicKey, userId: req.user?._id }).catch((e) =>
          console.error("[examQuestions] enqueueKnowledgeRefresh error:", e?.message)
        );
      }
    }
    return res.json({ success: true, question: toResponseQuestion(question.toObject ? question.toObject() : question) });
  } catch (err) {
    console.error("ExamQuestions PUT error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
});

// POST /api/exam-questions/:id/ai-rewrite — draft mcq/short only; LLM JSON (owner/admin)
router.post("/:id/ai-rewrite", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ success: false, msg: "Teachers and admins only" });
  }
  try {
    const id = req.params.id;
    const action = String(req.body?.action || "").trim();
    if (!action || !EXAM_ACTIONS.has(action)) {
      return res.status(400).json({
        success: false,
        msg: `Invalid action. Allowed: ${[...EXAM_ACTIONS].join(", ")}`,
      });
    }
    const teacherId = req.user.userId || req.user._id;
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, msg: "Invalid ID" });
    const query = isAdmin ? { _id: id } : { _id: id, teacherId };
    const ex = await ExamQuestion.findOne(query);
    if (!ex) return res.status(404).json({ success: false, msg: "Question not found" });
    if (String(ex.status) !== "draft") return res.status(400).json({ success: false, msg: "AI rewrite is only for drafts" });
    await applyExamAiRewrite(ex, action);
    const enriched = enrichExamItems([ex.toObject ? ex.toObject() : ex])[0];
    return res.json({ success: true, question: toResponseQuestion(enriched) });
  } catch (err) {
    if (err.code === "LLM_NOT_CONFIGURED" || err.code === "LLM_EMPTY" || err.code === "LLM_BAD_JSON") {
      return res.status(503).json({ success: false, msg: err.message || "LLM unavailable" });
    }
    const code = err.statusCode || 400;
    console.error("ExamQuestions ai-rewrite error:", err);
    return res.status(code >= 400 && code < 500 ? code : 400).json({ success: false, msg: err.message || "Bad request" });
  }
});

// DELETE /api/exam-questions/:id — delete (owner or admin). Admin can delete any.
router.delete("/:id", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ success: false, msg: "Teachers and admins only" });
  }
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, msg: "Invalid ID" });
    }
    const teacherId = req.user.userId || req.user._id;
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    const query = isAdmin ? { _id: id } : { _id: id, teacherId };
    const question = await ExamQuestion.findOneAndDelete(query);
    if (!question) {
      return res.status(404).json({ success: false, msg: "Question not found" });
    }
    return res.json({ success: true, question });
  } catch (err) {
    console.error("ExamQuestions DELETE error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
});

module.exports = router;
