/**
 * P3.0C — Generate Diagram Brief from lesson block.
 * Flag: DIAGRAM_BRIEF_FROM_BLOCK=1
 *
 * POST /api/diagram-briefs/from-block
 */
const express = require("express");
const auth = require("../middleware/auth");
const { isDiagramBriefFromBlockEnabled } = require("../config/diagramBriefFlags");
const { composeDiagramBriefFromBlock } = require("../services/diagramSpecificationEngine/briefFromBlock");
const { sendInternalError } = require("../utils/safeErrorResponse");

const router = express.Router();

function requireFeatureEnabled(req, res, next) {
  if (!isDiagramBriefFromBlockEnabled()) {
    return res.status(404).json({
      code: "FEATURE_DISABLED",
      error: "Diagram brief from block is not enabled",
    });
  }
  return next();
}

function requireTeacherOrAdmin(req, res) {
  const t = String(req.user?.userType || req.user?.role || "").toLowerCase();
  if (t !== "teacher" && t !== "admin") {
    res.status(403).json({ error: "Only teachers or admins can generate diagram briefs" });
    return false;
  }
  return true;
}

router.use(requireFeatureEnabled);

router.post("/from-block", auth, async (req, res) => {
  try {
    if (!requireTeacherOrAdmin(req, res)) return;

    const block = req.body?.block;
    if (!block || typeof block !== "object") {
      return res.status(422).json({
        code: "INVALID_REQUEST",
        error: "block is required",
      });
    }

    const result = composeDiagramBriefFromBlock({
      block,
      lesson: req.body?.lesson || {},
      page: req.body?.page || {},
      options: req.body?.options || {},
    });

    if (!result.ok) {
      return res.status(422).json({
        code: "BRIEF_COMPOSE_FAILED",
        error: "Could not compose diagram brief from block",
        errors: result.errors,
      });
    }

    return res.json({
      brief: result.brief,
      teacherMetadata: result.teacherMetadata,
      warnings: result.warnings,
      metadata: result.metadata,
      spec: result.spec,
    });
  } catch (err) {
    return sendInternalError("diagram-briefs/from-block", err, res);
  }
});

module.exports = router;
