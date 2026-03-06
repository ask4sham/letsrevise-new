/**
 * PR-013: Coverage drill-down API — teacher + admin only.
 * GET /api/coverage/drilldown?specKey=...&topicKey=...&windowDays=14
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { getDrilldown } = require("../controllers/coverageDrilldown.controller");

router.use(auth);
router.get("/", getDrilldown);

module.exports = router;
