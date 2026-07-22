/**
 * PR-PRACTICE-LOOP-1 Slice 2: Generate practice set — student-only POST /generate.
 * Fresh V1: excludeSeen + lessonId, GET /:id resume, GET /fresh-availability.
 */
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const User = require("../models/User");
const StudentTeacherLink = require("../models/StudentTeacherLink");
const {
  generateAndPersistPracticeSet,
  getPracticeSetForStudent,
  CONTENT_TYPES,
} = require("../services/generatePracticeSet");
const { countLessonPracticeAttempts, listLessonPracticeAttemptedQuestionIds } = require("../services/freshPracticeExclusions");

function getUserId(req) {
  return req.user?.userId ?? req.user?._id ?? req.user?.id;
}

function isStudent(req) {
  const t = (req.user?.userType || req.user?.type || "").toString().toLowerCase();
  return t === "student";
}

async function resolveTeacherLink(studentId, teacherId) {
  let teacherIdObj = null;
  if (teacherId != null) {
    try {
      teacherIdObj = new mongoose.Types.ObjectId(teacherId);
    } catch {
      return { error: { status: 400, body: { error: "teacherId must be a valid ObjectId" } } };
    }
    const teacher = await User.findById(teacherIdObj).select("userType").lean();
    if (!teacher || (teacher.userType !== "teacher" && teacher.userType !== "admin")) {
      return { error: { status: 400, body: { error: "teacherId must be a teacher" } } };
    }
  }
  if (!teacherIdObj) {
    return { error: { status: 400, body: { error: "teacherId is required (content owner)." } } };
  }
  const link = await StudentTeacherLink.findOne({ studentId, teacherId: teacherIdObj }).lean();
  if (!link) {
    return {
      error: {
        status: 403,
        body: { error: "No student-teacher link for this teacher. Ask your teacher to add you." },
      },
    };
  }
  return { teacherIdObj };
}

// GET /api/practice-sets/fresh-availability — honest fresh count (no PracticeSet created)
router.get("/fresh-availability", auth, async (req, res) => {
  if (!isStudent(req)) {
    return res.status(403).json({ error: "Students only" });
  }
  const studentId = getUserId(req);
  if (!studentId) return res.status(401).json({ error: "Unauthorized" });

  const specKey = (req.query.specKey && String(req.query.specKey).trim()) || "";
  const topicKey = (req.query.topicKey && String(req.query.topicKey).trim()) || "";
  const teacherId = req.query.teacherId && String(req.query.teacherId).trim();
  const lessonId = req.query.lessonId && String(req.query.lessonId).trim();
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 5));
  const includeRaw = req.query.include;
  const includeTypes = includeRaw
    ? String(includeRaw)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : ["quiz_mcq", "quiz_short"];

  if (!specKey || !topicKey) {
    return res.status(400).json({ error: "specKey and topicKey are required" });
  }

  const resolved = await resolveTeacherLink(studentId, teacherId);
  if (resolved.error) return res.status(resolved.error.status).json(resolved.error.body);

  try {
    const result = await generateAndPersistPracticeSet({
      studentId,
      teacherId: resolved.teacherIdObj,
      specKey,
      topicKeys: [topicKey.includes(":") ? topicKey : `${specKey}:${topicKey}`],
      limit,
      include: includeTypes,
      excludeSeen: true,
      lessonId: lessonId || null,
      dryRun: true,
    });

    let lessonPracticeAttemptCount = 0;
    let lessonPracticeAttemptedQuestionIds = [];
    if (lessonId) {
      lessonPracticeAttemptCount = await countLessonPracticeAttempts(studentId, lessonId);
      lessonPracticeAttemptedQuestionIds = await listLessonPracticeAttemptedQuestionIds(
        studentId,
        lessonId
      );
    }

    return res.status(200).json({
      requestedCount: result.requestedCount,
      availableFreshCount: result.availableFreshCount,
      selectedCount: result.selectedCount,
      allQuestionsFresh: true,
      practiceSetId: null,
      lessonPracticeAttemptCount,
      lessonPracticeAttemptedQuestionIds,
    });
  } catch (e) {
    if (
      e.code === "INVALID_SPEC_KEY" ||
      e.code === "INVALID_TOPIC_KEY" ||
      e.code === "INVALID_TOPIC_KEYS" ||
      e.code === "INVALID_INCLUDE"
    ) {
      return res.status(400).json({ error: e.message });
    }
    return res.status(500).json({ error: e.message || "Failed to check fresh availability" });
  }
});

// GET /api/practice-sets/:id — resume frozen set (owner only)
router.get("/:id", auth, async (req, res) => {
  if (!isStudent(req)) {
    return res.status(403).json({ error: "Students only" });
  }
  const studentId = getUserId(req);
  if (!studentId) return res.status(401).json({ error: "Unauthorized" });

  const id = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid practiceSetId" });
  }

  try {
    const result = await getPracticeSetForStudent(id, studentId);
    return res.status(200).json(result);
  } catch (e) {
    if (e.code === "NOT_FOUND") return res.status(404).json({ error: e.message });
    if (e.code === "FORBIDDEN") return res.status(403).json({ error: e.message });
    return res.status(500).json({ error: e.message || "Failed to load practice set" });
  }
});

// POST /api/practice-sets/generate — student only
router.post("/generate", auth, async (req, res) => {
  if (!isStudent(req)) {
    return res.status(403).json({ error: "Students only" });
  }

  const studentId = getUserId(req);
  if (!studentId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const {
    specKey,
    topicKeys,
    limit,
    include,
    difficulty,
    skill,
    teacherId,
    mode,
    excludeSeen,
    lessonId,
    idempotencyKey,
    source,
  } = req.body || {};

  if (!specKey || typeof specKey !== "string") {
    return res.status(400).json({ error: "specKey is required" });
  }
  if (!Array.isArray(topicKeys) || topicKeys.length === 0) {
    return res.status(400).json({ error: "topicKeys is required and must be a non-empty array" });
  }

  const modeNorm = mode == null || mode === "" ? "standard" : String(mode).toLowerCase().trim();
  if (modeNorm !== "standard" && modeNorm !== "challenge") {
    return res.status(400).json({ error: 'mode must be "standard" or "challenge"' });
  }

  const resolved = await resolveTeacherLink(studentId, teacherId);
  if (resolved.error) return res.status(resolved.error.status).json(resolved.error.body);

  const includeTypes = include != null ? (Array.isArray(include) ? include : [include]) : CONTENT_TYPES;
  const invalid = includeTypes.find((t) => !CONTENT_TYPES.includes(t));
  if (invalid) {
    return res.status(400).json({ error: `Invalid include type: ${invalid}. Must be one of: ${CONTENT_TYPES.join(", ")}` });
  }

  try {
    const result = await generateAndPersistPracticeSet({
      studentId,
      teacherId: resolved.teacherIdObj,
      specKey: specKey.trim(),
      topicKeys: topicKeys.map((k) => String(k).trim()),
      limit: limit != null ? Math.min(50, Math.max(1, parseInt(limit, 10) || 10)) : 10,
      include: includeTypes,
      difficulty: Array.isArray(difficulty) ? difficulty : null,
      skill: Array.isArray(skill) ? skill : null,
      mode: modeNorm,
      excludeSeen: excludeSeen === true || excludeSeen === "true",
      lessonId: lessonId ? String(lessonId).trim() : null,
      dryRun: false,
      idempotencyKey: idempotencyKey ? String(idempotencyKey).trim() : null,
      source: source ? String(source).trim() : excludeSeen === true || excludeSeen === "true" ? "fresh-practice" : null,
    });
    return res.status(200).json(result);
  } catch (e) {
    if (
      e.code === "INVALID_SPEC_KEY" ||
      e.code === "INVALID_TOPIC_KEY" ||
      e.code === "INVALID_TOPIC_KEYS" ||
      e.code === "INVALID_INCLUDE"
    ) {
      return res.status(400).json({ error: e.message });
    }
    return res.status(500).json({ error: e.message || "Failed to generate practice set" });
  }
});

module.exports = router;
