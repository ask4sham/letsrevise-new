/**
 * PR-024: Topic summary routes — teacher/admin + student (PR-024.1).
 * PR-027: GET /logs, GET /logs/:id for saved summaries.
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const topicSummaryRateLimit = require("../middleware/topicSummaryRateLimit");
const { postTopicSummary } = require("../controllers/topicSummary.controller");
const { getTopicSummaryLogs, getTopicSummaryLogById } = require("../controllers/topicSummaryLogs.controller");

router.use(auth);
router.post("/", topicSummaryRateLimit, postTopicSummary);
router.get("/logs", getTopicSummaryLogs);
router.get("/logs/:id", getTopicSummaryLogById);

module.exports = router;
