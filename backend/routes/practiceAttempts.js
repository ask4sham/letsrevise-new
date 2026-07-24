/**
 * PR-PRACTICE-LOOP-1 Slice 1+3: Student submits practice attempt.
 * Slice 3: teacherId validated via StudentTeacherLink; MCQ correctness computed server-side.
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const PracticeAttempt = require("../models/PracticeAttempt");
const PracticeSet = require("../models/PracticeSet");
const StudentTeacherLink = require("../models/StudentTeacherLink");
const { assertValidSpecKey, assertValidNamespacedTopicKey } = require("../utils/specTopicValidation");
const { computeMcqCorrectness } = require("../services/computeMcqCorrectness");
const { recordExamQuestionAttempt, recordQuizAttempt } = require("../services/learningEvidenceService");
const { updateReviewStateAfterSession } = require("../services/adaptiveRevisionService");

const CONTENT_TYPES = PracticeAttempt.CONTENT_TYPES || ["quiz_mcq", "quiz_short", "exam_question", "past_paper_question"];
const MCQ_CONTENT_TYPE = "quiz_mcq";

function getUserId(req) {
  return req.user?.userId ?? req.user?._id ?? req.user?.id;
}

function isStudent(req) {
  const t = (req.user?.userType || req.user?.type || "").toString().toLowerCase();
  return t === "student";
}

// POST /api/practice-attempts — student only
router.post("/", auth, async (req, res) => {
  if (!isStudent(req)) {
    return res.status(403).json({ error: "Students only" });
  }

  const studentId = getUserId(req);
  if (!studentId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const {
    specKey,
    topicKey,
    contentType,
    contentId,
    isCorrect,
    selectedChoiceIndex,
    confidence,
    timeSpentSec,
    teacherId,
    practiceSetId,
  } = req.body || {};

  if (!specKey || typeof specKey !== "string") {
    return res.status(400).json({ error: "specKey is required" });
  }
  if (!topicKey || typeof topicKey !== "string") {
    return res.status(400).json({ error: "topicKey is required" });
  }
  if (!contentType || !CONTENT_TYPES.includes(contentType)) {
    return res.status(400).json({ error: "contentType must be one of: " + CONTENT_TYPES.join(", ") });
  }
  if (!contentId) {
    return res.status(400).json({ error: "contentId is required" });
  }
  // Linked dashboard path needs teacherId. No-link resume may send practiceSetId only
  // (teacher is resolved from the owned set — client teacherId is not authorisation).
  if (!teacherId && !practiceSetId) {
    return res.status(400).json({ error: "teacherId is required" });
  }

  if (contentType === MCQ_CONTENT_TYPE) {
    if (typeof isCorrect === "boolean") {
      return res.status(400).json({ error: "Do not send isCorrect for quiz_mcq; send selectedChoiceIndex instead. Correctness is computed server-side." });
    }
    if (selectedChoiceIndex === undefined || selectedChoiceIndex === null) {
      return res.status(400).json({ error: "selectedChoiceIndex is required for quiz_mcq" });
    }
    const idx = typeof selectedChoiceIndex === "number" ? selectedChoiceIndex : parseInt(selectedChoiceIndex, 10);
    if (Number.isNaN(idx) || idx < 0) {
      return res.status(400).json({ error: "selectedChoiceIndex must be a non-negative integer" });
    }
  } else {
    if (typeof isCorrect !== "boolean") {
      return res.status(400).json({ error: "isCorrect is required and must be a boolean for non-MCQ content" });
    }
  }

  try {
    assertValidSpecKey(specKey.trim());
    assertValidNamespacedTopicKey(specKey.trim(), String(topicKey).trim());
  } catch (e) {
    const code = e.code || "VALIDATION_ERROR";
    return res.status(400).json({ error: e.message || "Invalid spec or topic", code });
  }

  const mongoose = require("mongoose");

  let contentIdObj;
  try {
    contentIdObj = new mongoose.Types.ObjectId(contentId);
  } catch {
    return res.status(400).json({ error: "contentId must be a valid ObjectId" });
  }

  /**
   * A) Linked-teacher path: StudentTeacherLink for client teacherId — unchanged; practiceSetId optional.
   * B) No-link path: require practiceSetId; ownership + exact item membership; teacher from set.
   */
  let teacherIdObj = null;

  if (teacherId) {
    try {
      teacherIdObj = new mongoose.Types.ObjectId(teacherId);
    } catch {
      return res.status(400).json({ error: "teacherId must be a valid ObjectId" });
    }
    const link = await StudentTeacherLink.findOne({ studentId, teacherId: teacherIdObj }).lean();
    if (link) {
      // Linked dashboard / ordinary practice — keep using validated link teacherId.
    } else {
      teacherIdObj = null;
    }
  }

  if (!teacherIdObj) {
    if (!practiceSetId) {
      return res.status(403).json({
        error: "No student-teacher link for this teacher. Ask your teacher to add you.",
      });
    }
    if (!mongoose.Types.ObjectId.isValid(String(practiceSetId))) {
      return res.status(400).json({ error: "Invalid practiceSetId" });
    }

    const set = await PracticeSet.findById(practiceSetId).lean();
    // Same safe 403 for missing / other-owned — do not leak ownership.
    if (!set || String(set.studentId) !== String(studentId)) {
      return res.status(403).json({ error: "You do not have access to this practice set." });
    }

    const inSet = (set.items || []).some(
      (it) =>
        String(it.contentId) === String(contentIdObj) &&
        it.contentType === contentType
    );
    if (!inSet) {
      return res.status(403).json({ error: "You do not have access to this practice item." });
    }

    // Authoritative teacher for the attempt record — never trust client teacherId here.
    teacherIdObj = set.teacherId;
  }

  const confidenceNum =
    confidence != null ? (typeof confidence === "number" ? confidence : parseInt(confidence, 10)) : undefined;
  if (confidenceNum != null && (confidenceNum < 1 || confidenceNum > 3 || Number.isNaN(confidenceNum))) {
    return res.status(400).json({ error: "confidence must be 1–3 if provided" });
  }

  const timeSpent =
    timeSpentSec != null ? (typeof timeSpentSec === "number" ? timeSpentSec : parseInt(timeSpentSec, 10)) : undefined;
  if (timeSpent != null && (timeSpent < 0 || Number.isNaN(timeSpent))) {
    return res.status(400).json({ error: "timeSpentSec must be a non-negative number if provided" });
  }

  let isCorrectValue;
  let selectedChoiceIndexStored;

  if (contentType === MCQ_CONTENT_TYPE) {
    const idx = typeof selectedChoiceIndex === "number" ? selectedChoiceIndex : parseInt(selectedChoiceIndex, 10);
    try {
      const result = await computeMcqCorrectness(contentIdObj, idx);
      isCorrectValue = result.isCorrect;
      selectedChoiceIndexStored = idx;
    } catch (e) {
      if (e.code === "CONTENT_NOT_FOUND" || e.code === "INVALID_CONTENT_TYPE") {
        return res.status(400).json({ error: e.message });
      }
      return res.status(500).json({ error: e.message || "Failed to compute correctness" });
    }
  } else {
    isCorrectValue = isCorrect;
  }

  try {
    await PracticeAttempt.create({
      studentId,
      teacherId: teacherIdObj,
      specKey: specKey.trim(),
      topicKey: String(topicKey).trim(),
      contentType,
      contentId: contentIdObj,
      isCorrect: isCorrectValue,
      selectedChoiceIndex: selectedChoiceIndexStored,
      confidence: confidenceNum,
      timeSpentSec: timeSpent,
    });

    // Learning evidence: fire-and-forget for dashboard mastery
    const topicOnly = (topicKey || "").includes(":") ? String(topicKey).split(":").pop() : String(topicKey).trim();
    if (specKey && topicOnly) {
      if (contentType === "exam_question" || contentType === "past_paper_question") {
        recordExamQuestionAttempt({
          userId: studentId,
          specKey: specKey.trim(),
          topicKey: topicOnly,
          questionId: contentIdObj,
          correct: isCorrectValue,
          timeSpentSeconds: timeSpent,
        }).catch(() => {});
      } else if (contentType === "quiz_mcq" || contentType === "quiz_short") {
        recordQuizAttempt({
          userId: studentId,
          specKey: specKey.trim(),
          topicKey: topicOnly,
          correct: isCorrectValue,
          score: isCorrectValue ? 100 : 0,
          timeSpentSeconds: timeSpent,
        }).catch(() => {});
      }
      updateReviewStateAfterSession({
        userId: studentId,
        specKey: specKey.trim(),
        topicKey: String(topicKey).trim(),
        wasSuccess: isCorrectValue,
        wasHard: !isCorrectValue,
      }).catch(() => {});
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Failed to save attempt" });
  }
});

module.exports = router;
