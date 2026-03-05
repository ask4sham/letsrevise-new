// backend/routes/examQuestions.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const ExamQuestion = require("../models/ExamQuestion");
const auth = require("../middleware/auth");
const { isValidTopicForSpec } = require("../utils/topicTaxonomy");
const { buildTopicKey, parseTopicKey, queryCandidates, DEFAULT_SPEC_LEGACY } = require("../utils/topicKey");

function isTeacher(req) {
  return req.user && req.user.userType === "teacher";
}

function isTeacherOrAdmin(req) {
  if (!req.user) return false;
  const t = (req.user.userType || req.user.role || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user.isAdmin === true;
}

function resolveStoredTopicKey(specKeyFromReq, topicKeyFromReq) {
  if (!topicKeyFromReq || typeof topicKeyFromReq !== "string") return { error: "topicKey is required" };
  const trimmed = topicKeyFromReq.trim();
  if (!trimmed) return { error: "topicKey is required" };
  const specKey = (specKeyFromReq && String(specKeyFromReq).trim()) || DEFAULT_SPEC_LEGACY;
  const { specKey: parsedSpec, topicKey: rawTopic, isNamespaced } = parseTopicKey(trimmed);
  if (isNamespaced && parsedSpec && rawTopic) {
    if (!isValidTopicForSpec(parsedSpec, rawTopic)) return { error: `Invalid topicKey for spec ${parsedSpec}` };
    return { storedKey: trimmed };
  }
  const topicOnly = rawTopic || trimmed;
  if (!isValidTopicForSpec(specKey, topicOnly)) return { error: `Invalid topicKey for spec ${specKey}` };
  return { storedKey: buildTopicKey(specKey, topicOnly) };
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
      const resolved = resolveStoredTopicKey(specKeyBody, req.body.topicKey);
      if (resolved.error) {
        return res.status(400).json({ success: false, msg: resolved.error, error: resolved.error });
      }
      req.body.topicKey = resolved.storedKey;
    } else if (req.body.topicKey != null) {
      req.body.topicKey = undefined;
    }
    const teacherId = req.user.userId || req.user._id;
    const question = await ExamQuestion.create({
      ...req.body,
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

    const { specKey, topicKey: topicKeyQ, q, limit, difficulty, difficultyMin, difficultyMax, skill, estimatedTimeMaxSec } = req.query || {};
    const lim = clampInt(limit, { min: 1, max: 200, fallback: 50 });

    const query = { teacherId, status: { $in: ["draft", "published"] }, isArchived: { $ne: true } };

    if (topicKeyQ && String(topicKeyQ).trim()) {
      const spec = (specKey && String(specKey).trim()) || DEFAULT_SPEC_LEGACY;
      const candidates = queryCandidates(spec, parseTopicKey(String(topicKeyQ).trim()).topicKey || String(topicKeyQ).trim());
      if (candidates.length) query.topicKey = { $in: candidates };
    } else if (specKey && String(specKey).trim()) {
      const spec = String(specKey).trim();
      query.topicKey = { $regex: "^" + spec.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ":" };
    }

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

    const items = await ExamQuestion.find(query).sort({ updatedAt: -1 }).limit(lim).lean();
    return res.status(200).json({ items: items.map(toResponseQuestion) });
  } catch (err) {
    console.error("ExamQuestions GET /mine error:", err);
    return res.status(400).json({ error: err.message || "Failed to load exam questions" });
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
    const { subject, examBoard, level, topic, topicKey, specKey: specKeyQ, type, status, mineOnly, page: pageQ, limit: limitQ } = req.query;
    const query = {};
    // Teacher/admin: default = both draft and published (Worksheet Builder shows all bank questions)
    if (status !== undefined && status !== "") {
      query.status = String(status).trim().toLowerCase();
    } else {
      query.status = { $in: ["draft", "published"] };
    }
    // Restrict to current teacher only when mineOnly=1 (e.g. "my questions only")
    if (String(mineOnly) === "1" || String(mineOnly) === "true") {
      query.teacherId = teacherId;
    }
    if (subject) query.subject = subject;
    if (examBoard) query.examBoard = examBoard;
    if (level) query.level = level;
    if (topic) query.topic = topic;
    if (topicKey) {
      const spec = (specKeyQ && String(specKeyQ).trim()) || DEFAULT_SPEC_LEGACY;
      const parsed = parseTopicKey(String(topicKey).trim());
      const candidates = queryCandidates(spec, parsed.topicKey || String(topicKey).trim());
      query.topicKey = candidates.length ? { $in: candidates } : String(topicKey).trim().toLowerCase();
    }
    if (type) query.type = type;

    const usePagination = pageQ != null && limitQ != null && String(pageQ).trim() !== "" && String(limitQ).trim() !== "";
    const page = usePagination ? clampInt(pageQ, { min: 1, max: 1000, fallback: 1 }) : 1;
    const limit = usePagination ? clampInt(limitQ, { min: 1, max: 100, fallback: 50 }) : 50;

    if (usePagination) {
      const [questions, total] = await Promise.all([
        ExamQuestion.find(query).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        ExamQuestion.countDocuments(query),
      ]);
      return res.json({
        success: true,
        questions: questions.map(toResponseQuestion),
        pagination: { page, limit, total },
      });
    }

    const questions = await ExamQuestion.find(query).sort({ updatedAt: -1 }).lean();
    return res.json({ success: true, questions: questions.map(toResponseQuestion) });
  } catch (err) {
    console.error("ExamQuestions GET error:", err);
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
        const resolved = resolveStoredTopicKey(req.body.specKey, req.body.topicKey);
        if (resolved.error) {
          return res.status(400).json({ success: false, msg: resolved.error, error: resolved.error });
        }
        question.topicKey = resolved.storedKey;
      } else {
        question.topicKey = undefined;
      }
    }
    const { subject, examBoard, level, topic, unitKey, type, marks, question: qText, options, correctIndex, correctAnswer, markScheme, content, status } = req.body;
    if (subject !== undefined) question.subject = subject;
    if (examBoard !== undefined) question.examBoard = examBoard;
    if (level !== undefined) question.level = level;
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
    if (status !== undefined) {
      const newStatus = String(status).trim().toLowerCase();
      if (newStatus === "published") {
        const { checkPublishGateForGenerated } = require("../middleware/requirePublishGateIfGenerated");
        const qObj = question.toObject ? question.toObject() : { ...question._doc, metadata: question.metadata };
        const gate = await checkPublishGateForGenerated(qObj, req.user);
        if (!gate.ok) {
          return res.status(400).json({ success: false, msg: "Fix issues first", issues: gate.issues, blocks: gate.blocks });
        }
      }
      question.status = newStatus;
    }
    await question.save();
    return res.json({ success: true, question: toResponseQuestion(question.toObject ? question.toObject() : question) });
  } catch (err) {
    console.error("ExamQuestions PUT error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
});

// DELETE /api/exam-questions/:id — delete (only owner)
router.delete("/:id", auth, async (req, res) => {
  if (!isTeacher(req)) {
    return res.status(403).json({ success: false, msg: "Teachers only" });
  }
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, msg: "Invalid ID" });
    }
    const teacherId = req.user.userId || req.user._id;
    const question = await ExamQuestion.findOneAndDelete({ _id: id, teacherId });
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
