/**
 * Autopilot 0 — L0 observe-only routes.
 * GET /api/autopilot0/brief — admin-only system brief (read-only).
 */
const express = require("express");
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const { buildSystemBrief } = require("../services/autopilot0/systemBriefService");
const { sendInternalError } = require("../utils/safeErrorResponse");

const router = express.Router();

router.get("/brief", auth, requireAdmin, async (req, res) => {
  try {
    const brief = await buildSystemBrief();
    return res.json(brief);
  } catch (err) {
    return sendInternalError("autopilot0/brief", err, res);
  }
});

module.exports = router;
