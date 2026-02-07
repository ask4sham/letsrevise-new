// backend/routes/visuals.js
const express = require("express");
const router = express.Router();
const VisualModel = require("../models/VisualModel");

/**
 * GET visual for a concept + level
 * Example:
 * /api/visuals/photosynthesis?level=GCSE
 */
router.get("/:conceptKey", async (req, res) => {
  try {
    const { conceptKey } = req.params;
    const { level } = req.query;

    if (!level) {
      return res.status(400).json({ error: "level is required" });
    }

    const visual = await VisualModel.findOne({
      conceptKey,
      isPublished: true,
    }).lean();

    if (!visual) {
      return res.status(404).json({ error: "Visual model not found" });
    }

    const want = String(level).trim().toLowerCase();
const variant = visual.variants.find((v) => String(v.level).trim().toLowerCase() === want);

    if (!variant) {
      return res.status(404).json({
        error: `No visual available for level ${level}`,
      });
    }

    return res.json({
      conceptKey: visual.conceptKey,
      subject: visual.subject,
      topic: visual.topic,
      level,
      visual: variant,
    });
  } catch (err) {
    console.error("Visual fetch error:", err);
    res.status(500).json({ error: "Failed to fetch visual" });
  }
});

module.exports = router;
