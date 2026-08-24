/**
 * GET /api/admin/exam-question-rationale-inventory
 * Read-only V2.2 MCQ rationale coverage report. Admin or content_manager.
 * No writes, no LLM, no backfill.
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const requireContentManager = require("../middleware/requireContentManager");
const { getMcqRationaleInventory } = require("../services/examQuestionRationaleInventoryService");

router.use(auth, requireContentManager);

router.get("/", async (req, res) => {
  try {
    const result = await getMcqRationaleInventory({
      subject: req.query.subject,
      examBoard: req.query.examBoard,
      level: req.query.level,
      topic: req.query.topic,
      topicKey: req.query.topicKey,
      status: req.query.status,
      teacherId: req.query.teacherId,
      rationaleBucket: req.query.rationaleBucket,
      potentiallyEligibleForBackfill: req.query.potentiallyEligibleForBackfill,
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    return res.json(result);
  } catch (err) {
    console.error("exam-question-rationale-inventory error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
