/**
 * Autopilot 0 — L0 observe-only routes.
 * GET /api/autopilot0/brief — admin-only system brief (read-only).
 * GET /api/autopilot0/revision-intelligence — admin-only revision intelligence (read-only).
 */
const express = require("express");
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const { buildSystemBrief } = require("../services/autopilot0/systemBriefService");
const { buildRevisionIntelligence } = require("../services/autopilot0/revisionIntelligenceService");
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

router.get("/revision-intelligence", auth, requireAdmin, async (req, res) => {
  try {
    if (req.query.tier !== undefined) {
      return res.status(400).json({
        error: "tier is not supported in revision-intelligence V1; cohort scope is SPEC_ONLY",
      });
    }

    const specKey = (req.query.specKey || "").trim();
    if (!specKey) {
      return res.status(400).json({ error: "specKey is required" });
    }

    let limit = 20;
    if (req.query.limit !== undefined) {
      const parsed = parseInt(String(req.query.limit), 10);
      if (!Number.isNaN(parsed)) {
        limit = Math.min(50, Math.max(1, parsed));
      }
    }

    const report = await buildRevisionIntelligence({ specKey, limit });
    return res.json(report);
  } catch (err) {
    if (err.code === "INVALID_SPEC_KEY") {
      return res.status(400).json({ error: err.message });
    }
    return sendInternalError("autopilot0/revision-intelligence", err, res);
  }
});

module.exports = router;
