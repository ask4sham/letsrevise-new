/**
 * Autopilot 0 — L0 observe-only routes.
 * GET /api/autopilot0/brief — admin-only system brief (read-only).
 * GET /api/autopilot0/revision-intelligence — admin-only revision intelligence (read-only).
 * GET /api/autopilot0/question-intelligence — admin-only question intelligence (read-only).
 * GET /api/autopilot0/learning-trend-intelligence — admin-only learning trend intelligence (read-only).
 * GET /api/autopilot0/revision-outcome-intelligence — admin-only revision outcome intelligence (read-only).
 * GET /api/autopilot0/grounded-next-action-intelligence — admin-only grounded next-action intelligence (read-only).
 * GET /api/autopilot0/action-readiness-intelligence — admin-only safe action readiness observer (read-only).
 */
const express = require("express");
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const { buildSystemBrief } = require("../services/autopilot0/systemBriefService");
const { buildRevisionIntelligence } = require("../services/autopilot0/revisionIntelligenceService");
const { buildQuestionIntelligence } = require("../services/autopilot0/questionIntelligenceService");
const { buildLearningTrendIntelligence } = require("../services/autopilot0/learningTrendIntelligenceService");
const { buildRevisionOutcomeIntelligence } = require("../services/autopilot0/revisionOutcomeIntelligenceService");
const { buildGroundedNextActionIntelligence } = require("../services/autopilot0/groundedNextActionIntelligenceService");
const { buildActionReadinessIntelligence } = require("../services/autopilot0/actionReadinessIntelligenceService");
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

router.get("/question-intelligence", auth, requireAdmin, async (req, res) => {
  try {
    if (req.query.tier !== undefined) {
      return res.status(400).json({
        error: "tier is not supported in question-intelligence V1; cohort scope is SPEC_ONLY",
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

    const report = await buildQuestionIntelligence({ specKey, limit });
    return res.json(report);
  } catch (err) {
    if (err.code === "INVALID_SPEC_KEY") {
      return res.status(400).json({ error: err.message });
    }
    return sendInternalError("autopilot0/question-intelligence", err, res);
  }
});

router.get("/learning-trend-intelligence", auth, requireAdmin, async (req, res) => {
  try {
    if (req.query.tier !== undefined) {
      return res.status(400).json({
        error: "tier is not supported in learning-trend-intelligence V1; cohort scope is SPEC_ONLY",
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

    const report = await buildLearningTrendIntelligence({ specKey, limit });
    return res.json(report);
  } catch (err) {
    if (err.code === "INVALID_SPEC_KEY") {
      return res.status(400).json({ error: err.message });
    }
    return sendInternalError("autopilot0/learning-trend-intelligence", err, res);
  }
});

router.get("/revision-outcome-intelligence", auth, requireAdmin, async (req, res) => {
  try {
    if (req.query.tier !== undefined) {
      return res.status(400).json({
        error: "tier is not supported in revision-outcome-intelligence V1; cohort scope is SPEC_ONLY",
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

    const report = await buildRevisionOutcomeIntelligence({ specKey, limit });
    return res.json(report);
  } catch (err) {
    if (err.code === "INVALID_SPEC_KEY") {
      return res.status(400).json({ error: err.message });
    }
    return sendInternalError("autopilot0/revision-outcome-intelligence", err, res);
  }
});

router.get("/grounded-next-action-intelligence", auth, requireAdmin, async (req, res) => {
  try {
    if (req.query.tier !== undefined) {
      return res.status(400).json({
        error: "tier is not supported in grounded-next-action-intelligence V1; cohort scope is SPEC_ONLY",
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

    const report = await buildGroundedNextActionIntelligence({ specKey, limit });
    return res.json(report);
  } catch (err) {
    if (err.code === "INVALID_SPEC_KEY") {
      return res.status(400).json({ error: err.message });
    }
    return sendInternalError("autopilot0/grounded-next-action-intelligence", err, res);
  }
});

router.get("/action-readiness-intelligence", auth, requireAdmin, async (req, res) => {
  try {
    if (req.query.tier !== undefined) {
      return res.status(400).json({
        error: "tier is not supported in action-readiness-intelligence V1; cohort scope is SPEC_ONLY",
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

    const report = await buildActionReadinessIntelligence({ specKey, limit });
    return res.json(report);
  } catch (err) {
    if (err.code === "INVALID_SPEC_KEY") {
      return res.status(400).json({ error: err.message });
    }
    return sendInternalError("autopilot0/action-readiness-intelligence", err, res);
  }
});

module.exports = router;
