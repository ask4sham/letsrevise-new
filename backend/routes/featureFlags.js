/**
 * PR-007: Feature flag endpoint for frontend.
 * GET /api/feature-flags/ai-tutor?specKey=... — auth required.
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { isAiTutorEnabledForSpec } = require("../config/featureFlags");
const { isVisualExplanationEnabled } = require("../config/visualExplanationFlags");
const { isDiagramAssetLibraryEnabled } = require("../config/diagramAssetFlags");
const { isDiagramBriefFromBlockEnabled } = require("../config/diagramBriefFlags");

router.get("/ai-tutor", auth, (req, res) => {
  const specKey = req.query.specKey;
  const enabled = isAiTutorEnabledForSpec(specKey || "");
  return res.json({ enabled });
});

router.get("/visual-explanation", auth, (_req, res) => {
  return res.json({ enabled: isVisualExplanationEnabled() });
});

router.get("/diagram-assets", auth, (_req, res) => {
  return res.json({ enabled: isDiagramAssetLibraryEnabled() });
});

router.get("/diagram-brief-from-block", auth, (_req, res) => {
  return res.json({ enabled: isDiagramBriefFromBlockEnabled() });
});

module.exports = router;
