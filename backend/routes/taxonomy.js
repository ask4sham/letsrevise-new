/**
 * Taxonomy API — canonical topic lists for teacher UI, prompts, diagram mapping.
 * Merged with admin additions when available.
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const requireContentManager = require("../middleware/requireContentManager");
const { getTaxonomyBySpecKey } = require("../utils/topicTaxonomy");
const { getMergedTaxonomyBySpecKey } = require("../services/adminTaxonomyService");
const { normalizeNamespacedLessonTopicKey } = require("../utils/normalizeLessonTopicKey");
const { getCreateLessonOptionsMerged } = require("../services/taxonomyService");
const { postAdminSubtopic } = require("./adminTaxonomy");

/**
 * GET /api/taxonomy/aqa-gcse-biology
 * Returns the full AQA GCSE Biology taxonomy (subject, examBoard, level, units with topics).
 * No auth required so teacher UI can load the topic picker without logging in first.
 */
/**
 * GET /api/taxonomy/resolve-topic?specKey=X&topic=Y
 * Resolve topic display name (e.g. "Animal and plant cells") to namespaced topicKey (e.g. "aqa-gcse-biology:animal-plant-cells").
 * Use when lesson.topicKey is missing but lesson.topic (display) is present.
 */
router.get("/resolve-topic", async (req, res) => {
  try {
    const specKey = (req.query.specKey || "").trim() || "aqa-gcse-biology";
    const topic = (req.query.topic || "").trim();
    if (!topic) return res.status(400).json({ error: "topic query is required" });
    const taxonomy = await getMergedTaxonomyBySpecKey(specKey);
    const canonicalKey = taxonomy && taxonomy.units
      ? (() => {
          const norm = topic.toLowerCase();
          for (const u of taxonomy.units) {
            const found = (u.topics || []).find((t) => t.topic && String(t.topic).toLowerCase() === norm);
            if (found && found.key) return String(found.key).trim();
          }
          return "";
        })()
      : "";
    if (canonicalKey) {
      return res.json({ topicKey: `${specKey}:${canonicalKey}`, resolved: true });
    }
    const repaired = normalizeNamespacedLessonTopicKey(specKey, { topic, title: topic });
    if (repaired) return res.json({ topicKey: repaired, resolved: true });
    return res.json({ topicKey: null, resolved: false });
  } catch (err) {
    console.error("resolve-topic error:", err);
    return res.status(500).json({ error: "Failed to resolve topic" });
  }
});

/**
 * GET /api/taxonomy/create-lesson-options
 * Returns nested options for Create Lesson dropdowns: Subject → Spec → Main Topic → Sub-topic.
 * Values come from backend/config/*_topics.json. topicKey is namespaced (specKey:topicSlug).
 */
router.get("/create-lesson-options", async (req, res) => {
  try {
    const options = await getCreateLessonOptionsMerged();
    return res.json(options);
  } catch (err) {
    console.error("create-lesson-options error:", err);
    return res.status(500).json({ error: "Failed to load create-lesson options" });
  }
});

async function serveMergedTaxonomy(specKey, res) {
  try {
    // Section-based static taxonomies (e.g. Edexcel IGCSE Biology) are served from config as-is.
    // getMergedTaxonomyBySpecKey only indexes flat unit.topics and would drop section leaves.
    const taxonomy =
      specKey === "edexcel-igcse-biology"
        ? getTaxonomyBySpecKey(specKey)
        : await getMergedTaxonomyBySpecKey(specKey);
    if (!taxonomy) return res.status(404).json({ error: "Taxonomy not found" });
    return res.json({
      subject: taxonomy.subject,
      examBoard: taxonomy.examBoard,
      level: taxonomy.level,
      specKey: taxonomy.specKey || specKey,
      ...(taxonomy.displayName ? { displayName: taxonomy.displayName } : {}),
      units: taxonomy.units,
    });
  } catch (err) {
    console.error("Taxonomy fetch error:", err);
    return res.status(500).json({ error: "Failed to load taxonomy" });
  }
}

router.get("/aqa-gcse-biology", (req, res) => serveMergedTaxonomy("aqa-gcse-biology", res));
router.get("/aqa-gcse-chemistry", (req, res) => serveMergedTaxonomy("aqa-gcse-chemistry", res));
router.get("/aqa-gcse-physics", (req, res) => serveMergedTaxonomy("aqa-gcse-physics", res));
router.get("/aqa-gcse-maths-foundation", (req, res) => serveMergedTaxonomy("aqa-gcse-maths-foundation", res));
router.get("/aqa-gcse-maths-higher", (req, res) => serveMergedTaxonomy("aqa-gcse-maths-higher", res));
router.get("/aqa-l2-further-maths", (req, res) => serveMergedTaxonomy("aqa-l2-further-maths", res));
router.get("/aqa-gcse-english-literature", (req, res) => serveMergedTaxonomy("aqa-gcse-english-literature", res));
router.get("/aqa-gcse-english-language", (req, res) => serveMergedTaxonomy("aqa-gcse-english-language", res));
router.get("/edexcel-igcse-biology", (req, res) => serveMergedTaxonomy("edexcel-igcse-biology", res));

/**
 * POST /api/taxonomy/topics — Pattern B: create validated custom sub-topic (alias of POST /api/admin/taxonomy/topics).
 * Body: specKey, parentKey (or unitKey), title (or subTopicTitle), optional mapsToCanonicalKey, inheritQuestionBankFrom, inheritAnalyticsFrom.
 */
router.post("/topics", auth, requireContentManager, async (req, res) => {
  const b = req.body || {};
  req.body = {
    ...b,
    subTopicTitle: b.title || b.subTopicTitle,
    unitKey: b.parentKey || b.unitKey,
  };
  return postAdminSubtopic(req, res);
});

module.exports = router;
