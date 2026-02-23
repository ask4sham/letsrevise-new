/**
 * Taxonomy API — canonical topic lists for teacher UI, prompts, diagram mapping.
 * GET /api/taxonomy/aqa-gcse-biology → returns AQA GCSE Biology units and topics.
 */
const express = require("express");
const router = express.Router();
const { getBiologyTopics, getChemistryTopics } = require("../utils/topicTaxonomy");

/**
 * GET /api/taxonomy/aqa-gcse-biology
 * Returns the full AQA GCSE Biology taxonomy (subject, examBoard, level, units with topics).
 * No auth required so teacher UI can load the topic picker without logging in first.
 */
router.get("/aqa-gcse-biology", (req, res) => {
  try {
    const taxonomy = getBiologyTopics();
    return res.json(taxonomy);
  } catch (err) {
    console.error("Taxonomy fetch error:", err);
    return res.status(500).json({ error: "Failed to load taxonomy" });
  }
});

/**
 * GET /api/taxonomy/aqa-gcse-chemistry
 * Returns the full AQA GCSE Chemistry taxonomy (subject, examBoard, level, units with topics).
 * Collections = units; Topics = topics within each unit. For flashcard/topic setup and teacher UI.
 */
router.get("/aqa-gcse-chemistry", (req, res) => {
  try {
    const taxonomy = getChemistryTopics();
    return res.json(taxonomy);
  } catch (err) {
    console.error("Taxonomy fetch error:", err);
    return res.status(500).json({ error: "Failed to load Chemistry taxonomy" });
  }
});

module.exports = router;
