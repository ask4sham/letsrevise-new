/**
 * POST /api/admin/exam-question-rationale-candidates
 * V2.3A: generate a review candidate only. Never writes ExamQuestion.
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const requireContentManager = require("../middleware/requireContentManager");
const mcqRationaleCandidateRateLimit = require("../middleware/mcqRationaleCandidateRateLimit");
const {
  createRationaleCandidate,
  CandidateServiceError,
} = require("../services/examQuestionRationaleCandidateService");

router.use(auth, requireContentManager);

router.post("/", mcqRationaleCandidateRateLimit, async (req, res) => {
  try {
    const actorId = req.user._id || req.user.userId;
    if (!actorId) {
      return res.status(401).json({ error: "Authentication required", code: "UNAUTHORIZED" });
    }

    const result = await createRationaleCandidate({
      actorId,
      body: req.body,
    });

    const status = result.replayed ? 200 : 201;
    return res.status(status).json({
      candidate: result.dto,
      replayed: Boolean(result.replayed),
    });
  } catch (err) {
    if (err instanceof CandidateServiceError) {
      const body = {
        error: err.message,
        code: err.code,
      };
      if (err.candidate) body.candidate = err.candidate;
      if (err.validationIssueCodes) body.validationIssueCodes = err.validationIssueCodes;
      if (err.bucket) body.bucket = err.bucket;
      return res.status(err.status || 400).json(body);
    }
    console.error("exam-question-rationale-candidates error:", err && err.message);
    return res.status(500).json({ error: "Server error", code: "SERVER_ERROR" });
  }
});

module.exports = router;
