/**
 * PR-012: Sprint order API — teacher/admin only.
 * GET /api/sprint-order — generate markdown download
 * POST /api/sprint-order/snapshots/ensure — admin only, ensure snapshots
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const sprintOrderRateLimit = require("../middleware/sprintOrderRateLimit");
const { getSprintOrderMarkdown, ensureSnapshots } = require("../controllers/sprintOrder.controller");

router.use(auth);

router.get("/", sprintOrderRateLimit, getSprintOrderMarkdown);

router.post("/snapshots/ensure", ensureSnapshots);

module.exports = router;
