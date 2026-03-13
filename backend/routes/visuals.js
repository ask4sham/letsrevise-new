// backend/routes/visuals.js
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const VisualModel = require("../models/VisualModel");

/**
 * GET list of published visuals (for diagram picker in editor).
 * Query: subject (optional), limit (default 50).
 */
router.get("/", async (req, res) => {
  try {
    const subject = req.query.subject && String(req.query.subject).trim();
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const filter = { isPublished: true };
    if (subject) filter.subject = subject;
    const list = await VisualModel.find(filter)
      .select("_id conceptKey subject topic")
      .sort({ topic: 1, conceptKey: 1 })
      .limit(limit)
      .lean();
    return res.json({ visuals: list });
  } catch (err) {
    console.error("Visual list error:", err);
    res.status(500).json({ error: "Failed to list visuals" });
  }
});

/**
 * GET visual by ID (for diagram blocks that store visualId).
 * Returns same shape as conceptKey endpoint: conceptKey, subject, topic, level, visual (variant).
 * Picks first available variant (e.g. GCSE) for level.
 */
router.get("/id/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid visual ID" });
    }
    const level = (req.query.level && String(req.query.level).trim()) || "GCSE";
    const want = level.trim().toLowerCase();

    const visual = await VisualModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      isPublished: true,
    }).lean();

    if (!visual) {
      return res.status(404).json({ error: "Visual not found" });
    }

    const variant = (visual.variants || []).find(
      (v) => String(v && v.level).trim().toLowerCase() === want
    ) || (visual.variants && visual.variants[0]);

    if (!variant) {
      return res.status(404).json({
        error: `No variant for level ${level}`,
      });
    }

    return res.json({
      _id: visual._id,
      conceptKey: visual.conceptKey,
      subject: visual.subject,
      topic: visual.topic,
      level: variant.level,
      visual: variant,
    });
  } catch (err) {
    console.error("Visual by ID fetch error:", err);
    res.status(500).json({ error: "Failed to fetch visual" });
  }
});

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
