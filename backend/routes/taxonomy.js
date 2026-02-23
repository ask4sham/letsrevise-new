/**
 * Taxonomy API — canonical topic lists for teacher UI, prompts, diagram mapping.
 * GET /api/taxonomy/aqa-gcse-biology → returns AQA GCSE Biology units and topics.
 */
const express = require("express");
const router = express.Router();
const { getBiologyTopics, getChemistryTopics, getPhysicsTopics, getTaxonomyBySpecKey } = require("../utils/topicTaxonomy");

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
    return res.json({
      subject: taxonomy.subject,
      examBoard: taxonomy.examBoard,
      level: taxonomy.level,
      specKey: taxonomy.specKey || "aqa-gcse-chemistry",
      units: taxonomy.units,
    });
  } catch (err) {
    console.error("Taxonomy fetch error:", err);
    return res.status(500).json({ error: "Failed to load Chemistry taxonomy" });
  }
});

/**
 * GET /api/taxonomy/aqa-gcse-physics
 * Returns the full AQA GCSE Physics taxonomy (subject, examBoard, level, units with topics).
 */
router.get("/aqa-gcse-physics", (req, res) => {
  try {
    const taxonomy = getPhysicsTopics();
    return res.json({
      subject: taxonomy.subject,
      examBoard: taxonomy.examBoard,
      level: taxonomy.level,
      specKey: taxonomy.specKey || "aqa-gcse-physics",
      units: taxonomy.units,
    });
  } catch (err) {
    console.error("Taxonomy fetch error:", err);
    return res.status(500).json({ error: "Failed to load Physics taxonomy" });
  }
});

/**
 * GET /api/taxonomy/aqa-gcse-maths-foundation
 * Returns the full AQA GCSE Maths (Foundation) taxonomy (subject, examBoard, level, specKey, units).
 */
router.get("/aqa-gcse-maths-foundation", (req, res) => {
  try {
    const taxonomy = getTaxonomyBySpecKey("aqa-gcse-maths-foundation");
    if (!taxonomy) return res.status(404).json({ error: "Taxonomy not found" });
    return res.json({
      subject: taxonomy.subject,
      examBoard: taxonomy.examBoard,
      level: taxonomy.level,
      specKey: taxonomy.specKey || "aqa-gcse-maths-foundation",
      units: taxonomy.units,
    });
  } catch (err) {
    console.error("Taxonomy fetch error:", err);
    return res.status(500).json({ error: "Failed to load Maths Foundation taxonomy" });
  }
});

/**
 * GET /api/taxonomy/aqa-gcse-maths-higher
 * Returns the full AQA GCSE Maths (Higher) taxonomy (subject, examBoard, level, specKey, units).
 */
router.get("/aqa-gcse-maths-higher", (req, res) => {
  try {
    const taxonomy = getTaxonomyBySpecKey("aqa-gcse-maths-higher");
    if (!taxonomy) return res.status(404).json({ error: "Taxonomy not found" });
    return res.json({
      subject: taxonomy.subject,
      examBoard: taxonomy.examBoard,
      level: taxonomy.level,
      specKey: taxonomy.specKey || "aqa-gcse-maths-higher",
      units: taxonomy.units,
    });
  } catch (err) {
    console.error("Taxonomy fetch error:", err);
    return res.status(500).json({ error: "Failed to load Maths Higher taxonomy" });
  }
});

/**
 * GET /api/taxonomy/aqa-l2-further-maths
 * Returns the full AQA Level 2 Further Maths taxonomy (subject, examBoard, level, specKey, units).
 */
router.get("/aqa-l2-further-maths", (req, res) => {
  try {
    const taxonomy = getTaxonomyBySpecKey("aqa-l2-further-maths");
    if (!taxonomy) return res.status(404).json({ error: "Taxonomy not found" });
    return res.json({
      subject: taxonomy.subject,
      examBoard: taxonomy.examBoard,
      level: taxonomy.level,
      specKey: taxonomy.specKey || "aqa-l2-further-maths",
      units: taxonomy.units,
    });
  } catch (err) {
    console.error("Taxonomy fetch error:", err);
    return res.status(500).json({ error: "Failed to load Further Maths taxonomy" });
  }
});

module.exports = router;
