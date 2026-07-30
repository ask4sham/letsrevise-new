/**
 * GET /api/admin/exam-question-rationale-review-context
 * V2.3B1: read-only review context. Never writes ExamQuestion / Candidate / Lesson.
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const requireContentManager = require("../middleware/requireContentManager");
const {
  getRationaleReviewContext,
  CandidateServiceError,
} = require("../services/examQuestionRationaleReviewContextService");

router.use(auth, requireContentManager);

router.get("/", async (req, res) => {
  try {
    const dto = await getRationaleReviewContext({ query: req.query });
    return res.json(dto);
  } catch (err) {
    if (err instanceof CandidateServiceError) {
      const body = {
        error: err.message,
        code: err.code,
      };
      if (err.structureReason) body.structureReason = err.structureReason;
      if (err.bucket) body.bucket = err.bucket;
      return res.status(err.status || 400).json(body);
    }
    console.error("exam-question-rationale-review-context error:", err && err.message);
    return res.status(500).json({ error: "Server error", code: "SERVER_ERROR" });
  }
});

module.exports = router;
