/**
 * Admin ExamQuestion rationale candidates.
 * V2.3A: POST / — generate Attempt 1 review candidate only. Never writes ExamQuestion.
 * V2.3B2b1: POST /:candidateId/reject — reject pending candidate. No LLM. No ExamQuestion write.
 * V2.3B2b2a: POST /:candidateId/replacement — Attempt 2 for rejected Attempt 1 only.
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
const { rejectRationaleCandidate } = require("../services/examQuestionRationaleCandidateRejectService");
const {
  createReplacementRationaleCandidate,
} = require("../services/examQuestionRationaleCandidateReplacementService");

router.use(auth, requireContentManager);

function sendCandidateServiceError(res, err) {
  const body = {
    error: err.message,
    code: err.code,
  };
  if (err.candidate) body.candidate = err.candidate;
  if (err.validationIssueCodes) body.validationIssueCodes = err.validationIssueCodes;
  if (err.bucket) body.bucket = err.bucket;
  return res.status(err.status || 400).json(body);
}

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
      return sendCandidateServiceError(res, err);
    }
    console.error("exam-question-rationale-candidates error:", err && err.message);
    return res.status(500).json({ error: "Server error", code: "SERVER_ERROR" });
  }
});

router.post("/:candidateId/reject", async (req, res) => {
  try {
    const actorId = req.user._id || req.user.userId;
    if (!actorId) {
      return res.status(401).json({ error: "Authentication required", code: "UNAUTHORIZED" });
    }

    const result = await rejectRationaleCandidate({
      actorId,
      candidateId: req.params.candidateId,
      body: req.body,
    });

    return res.status(200).json({
      candidate: result.dto,
      replayed: Boolean(result.replayed),
    });
  } catch (err) {
    if (err instanceof CandidateServiceError) {
      return sendCandidateServiceError(res, err);
    }
    console.error("exam-question-rationale-candidates reject error:", err && err.message);
    return res.status(500).json({ error: "Server error", code: "SERVER_ERROR" });
  }
});

router.post("/:candidateId/replacement", mcqRationaleCandidateRateLimit, async (req, res) => {
  try {
    const actorId = req.user._id || req.user.userId;
    if (!actorId) {
      return res.status(401).json({ error: "Authentication required", code: "UNAUTHORIZED" });
    }

    const result = await createReplacementRationaleCandidate({
      actorId,
      rejectedCandidateId: req.params.candidateId,
      body: req.body,
    });

    const status = result.replayed ? 200 : 201;
    return res.status(status).json({
      candidate: result.dto,
      replayed: Boolean(result.replayed),
    });
  } catch (err) {
    if (err instanceof CandidateServiceError) {
      return sendCandidateServiceError(res, err);
    }
    console.error("exam-question-rationale-candidates replacement error:", err && err.message);
    return res.status(500).json({ error: "Server error", code: "SERVER_ERROR" });
  }
});

module.exports = router;
