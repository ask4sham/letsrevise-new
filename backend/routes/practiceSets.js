/**
 * PR-PRACTICE-LOOP-1 Slice 2: Generate practice set — student-only POST /generate.
 */
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const User = require("../models/User");
const StudentTeacherLink = require("../models/StudentTeacherLink");
const { generateAndPersistPracticeSet, CONTENT_TYPES } = require("../services/generatePracticeSet");

function getUserId(req) {
  return req.user?.userId ?? req.user?._id ?? req.user?.id;
}

function isStudent(req) {
  const t = (req.user?.userType || req.user?.type || "").toString().toLowerCase();
  return t === "student";
}

// POST /api/practice-sets/generate — student only
router.post("/generate", auth, async (req, res) => {
  if (!isStudent(req)) {
    return res.status(403).json({ error: "Students only" });
  }

  const studentId = getUserId(req);
  if (!studentId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { specKey, topicKeys, limit, include, difficulty, skill, teacherId } = req.body || {};

  if (!specKey || typeof specKey !== "string") {
    return res.status(400).json({ error: "specKey is required" });
  }
  if (!Array.isArray(topicKeys) || topicKeys.length === 0) {
    return res.status(400).json({ error: "topicKeys is required and must be a non-empty array" });
  }

  let teacherIdObj = null;
  if (teacherId != null) {
    try {
      teacherIdObj = new mongoose.Types.ObjectId(teacherId);
    } catch {
      return res.status(400).json({ error: "teacherId must be a valid ObjectId" });
    }
    const teacher = await User.findById(teacherIdObj).select("userType").lean();
    if (!teacher || (teacher.userType !== "teacher" && teacher.userType !== "admin")) {
      return res.status(400).json({ error: "teacherId must be a teacher" });
    }
  }
  if (!teacherIdObj) {
    return res.status(400).json({ error: "teacherId is required (content owner)." });
  }

  const link = await StudentTeacherLink.findOne({ studentId, teacherId: teacherIdObj }).lean();
  if (!link) {
    return res.status(403).json({ error: "No student-teacher link for this teacher. Ask your teacher to add you." });
  }

  const includeTypes = include != null ? (Array.isArray(include) ? include : [include]) : CONTENT_TYPES;
  const invalid = includeTypes.find((t) => !CONTENT_TYPES.includes(t));
  if (invalid) {
    return res.status(400).json({ error: `Invalid include type: ${invalid}. Must be one of: ${CONTENT_TYPES.join(", ")}` });
  }

  try {
    const result = await generateAndPersistPracticeSet({
      studentId,
      teacherId: teacherIdObj,
      specKey: specKey.trim(),
      topicKeys: topicKeys.map((k) => String(k).trim()),
      limit: limit != null ? Math.min(50, Math.max(1, parseInt(limit, 10) || 10)) : 10,
      include: includeTypes,
      difficulty: Array.isArray(difficulty) ? difficulty : null,
      skill: Array.isArray(skill) ? skill : null,
    });
    return res.status(200).json(result);
  } catch (e) {
    if (e.code === "INVALID_SPEC_KEY" || e.code === "INVALID_TOPIC_KEY" || e.code === "INVALID_TOPIC_KEYS" || e.code === "INVALID_INCLUDE") {
      return res.status(400).json({ error: e.message });
    }
    return res.status(500).json({ error: e.message || "Failed to generate practice set" });
  }
});

module.exports = router;
