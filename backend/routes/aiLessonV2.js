/**
 * Lesson Generator V2 HTTP route — independent of V1 /api/ai/generate-and-save.
 *
 * POST /api/ai/generate-and-save-v2
 * Feature flags:
 * - LESSON_GENERATOR_V2_ENABLED=1 — run pipeline
 * - LESSON_GENERATOR_V2_PERSIST=1 — allow draft Mongo save when body.persist=true
 */

const express = require("express");
const auth = require("../middleware/auth");
const {
  isLessonGeneratorV2PipelineEnabled,
  runLessonGeneratorV2Scaffold,
  LessonV2QualityError,
} = require("../services/lessonGeneratorV2");

const router = express.Router();

function requireTeacherOrAdmin(req, res) {
  const t = String(req.user?.userType || "").toLowerCase();
  if (t !== "teacher" && t !== "admin") {
    res.status(403).json({ msg: "Teachers and admins only", code: "FORBIDDEN" });
    return false;
  }
  return true;
}

/**
 * POST /generate-and-save-v2
 * Mounted under /api/ai alongside V1 routes (separate router file; V1 untouched).
 */
router.post("/generate-and-save-v2", auth, async (req, res) => {
  try {
    if (!isLessonGeneratorV2PipelineEnabled()) {
      return res.status(503).json({
        success: false,
        msg: "Lesson Generator V2 is disabled. Set LESSON_GENERATOR_V2_ENABLED=1 to enable.",
        code: "LESSON_GENERATOR_V2_DISABLED",
      });
    }

    if (!requireTeacherOrAdmin(req, res)) return;

    const {
      topic,
      subject,
      level,
      board,
      topicKey,
      tier,
      persist,
    } = req.body || {};

    const teacherId = req.user?._id ? String(req.user._id) : undefined;
    const teacherName = [req.user?.firstName, req.user?.lastName].filter(Boolean).join(" ").trim() || undefined;

    const result = await runLessonGeneratorV2Scaffold({
      topic,
      subject,
      level,
      board,
      topicKey,
      tier,
      teacherId,
      teacherName,
      persist,
    });

    // Safety: saved without lessonId is never acceptable.
    if (result.saved && !result.lessonId) {
      return res.status(422).json({
        success: false,
        msg: "Lesson Generator V2 reported saved without lessonId.",
        code: "LESSON_V2_PERSIST_FAILED",
        saved: false,
        finalLesson: null,
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    const code = error?.code || error?.details?.code;
    if (
      error instanceof LessonV2QualityError ||
      code === "LESSON_V2_QUALITY_FAILED" ||
      code === "LESSON_V2_PHASE1_FAILED" ||
      code === "LESSON_V2_PHASE2_FAILED" ||
      code === "LESSON_V2_PHASE3_FAILED" ||
      code === "LESSON_V2_ASSEMBLY_FAILED" ||
      code === "LESSON_V2_CRITIC_FAILED" ||
      code === "LESSON_V2_PERSIST_DISABLED" ||
      code === "LESSON_V2_PERSIST_FAILED"
    ) {
      const mapped = [
        "LESSON_V2_PHASE1_FAILED",
        "LESSON_V2_PHASE2_FAILED",
        "LESSON_V2_PHASE3_FAILED",
        "LESSON_V2_ASSEMBLY_FAILED",
        "LESSON_V2_CRITIC_FAILED",
        "LESSON_V2_PERSIST_DISABLED",
        "LESSON_V2_PERSIST_FAILED",
      ].includes(code)
        ? code
        : "LESSON_V2_QUALITY_FAILED";
      const status = code === "LESSON_V2_PERSIST_DISABLED" ? 503 : 422;
      return res.status(status).json({
        success: false,
        msg: error.message || "Lesson Generator V2 quality failed.",
        code: mapped,
        details: error.details || undefined,
        saved: false,
        finalLesson: null,
      });
    }
    if (error?.status === 400 || error?.code === "LESSON_V2_BAD_REQUEST") {
      return res.status(400).json({
        success: false,
        msg: error.message || "Bad request",
        code: "LESSON_V2_BAD_REQUEST",
      });
    }
    console.error("[ai/generate-and-save-v2]", error?.message || error);
    return res.status(500).json({
      success: false,
      msg: "Lesson Generator V2 failed",
      code: "LESSON_V2_INTERNAL_ERROR",
    });
  }
});

module.exports = router;
