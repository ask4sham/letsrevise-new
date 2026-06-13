/**
 * PR-007: Feature flag endpoint for frontend.
 * GET /api/feature-flags/ai-tutor?specKey=... — auth required.
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { isAiTutorEnabledForSpec } = require("../config/featureFlags");
const { isVisualExplanationEnabled } = require("../config/visualExplanationFlags");

router.get("/ai-tutor", auth, (req, res) => {
  const specKey = req.query.specKey;
  const enabled = isAiTutorEnabledForSpec(specKey || "");
  return res.json({ enabled });
});

router.get("/visual-explanation", auth, (_req, res) => {
  return res.json({ enabled: isVisualExplanationEnabled() });
});

module.exports = router;
