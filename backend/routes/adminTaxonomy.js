/**
 * Admin Taxonomy CRUD — add/edit/delete main topics and sub-topics. Admin only.
 */
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const AdminTaxonomyItem = require("../models/AdminTaxonomyItem");
const { getTaxonomyBySpecKey } = require("../utils/topicTaxonomy");
const { getMergedTaxonomyBySpecKey, toSlug } = require("../services/adminTaxonomyService");

router.use(auth, requireAdmin);

const SPEC_KEYS = [
  "aqa-gcse-biology",
  "aqa-gcse-chemistry",
  "aqa-gcse-physics",
  "aqa-gcse-maths-foundation",
  "aqa-gcse-maths-higher",
  "aqa-l2-further-maths",
  "aqa-gcse-english-literature",
  "aqa-gcse-english-language",
];

/** GET /api/admin/taxonomy — full hierarchy for admin manager (merged static + admin) */
router.get("/", async (req, res) => {
  try {
    const hierarchy = [];
    for (const specKey of SPEC_KEYS) {
      const taxonomy = await getMergedTaxonomyBySpecKey(specKey);
      if (!taxonomy) continue;
      const subject = taxonomy.subject || "Unknown";
      let subjectNode = hierarchy.find((s) => s.subject === subject);
      if (!subjectNode) {
        subjectNode = { subject, specs: [] };
        hierarchy.push(subjectNode);
      }
      const specNode = {
        specKey,
        specLabel: `${taxonomy.examBoard || ""} ${taxonomy.level || ""} ${taxonomy.subject || specKey}`.trim(),
        mainTopics: (taxonomy.units || []).map((u) => ({
          unit: u.unit,
          unitKey: u.unitKey || toSlug(u.unit),
          subTopics: (u.topics || []).map((t) => ({
            topic: t.topic,
            key: t.key,
            topicKey: t.topicKey || `${taxonomy.specKey || specKey}:${t.key}`,
            _admin: !!t._admin,
          })),
          _admin: !!u._admin,
        })),
      };
      subjectNode.specs.push(specNode);
    }
    return res.json({ hierarchy });
  } catch (err) {
    console.error("Admin taxonomy GET error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/** GET /api/admin/taxonomy/specs — list specs with units for dropdowns */
router.get("/specs", async (req, res) => {
  try {
    const specs = [];
    for (const specKey of SPEC_KEYS) {
      const taxonomy = await getMergedTaxonomyBySpecKey(specKey);
      if (!taxonomy) continue;
      specs.push({
        specKey,
        subject: taxonomy.subject,
        specLabel: `${taxonomy.examBoard || ""} ${taxonomy.level || ""} ${taxonomy.subject || specKey}`.trim(),
        units: (taxonomy.units || []).map((u) => ({
          unit: u.unit,
          unitKey: u.unitKey || toSlug(u.unit),
        })),
      });
    }
    return res.json({ specs });
  } catch (err) {
    console.error("Admin taxonomy specs error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/** POST /api/admin/taxonomy/unit — add main topic (unit) */
router.post("/unit", async (req, res) => {
  try {
    const { specKey, unit } = req.body || {};
    if (!specKey || !SPEC_KEYS.includes(String(specKey).trim())) {
      return res.status(400).json({ error: "Valid specKey required" });
    }
    const unitName = (unit && String(unit).trim()) || "";
    if (!unitName) return res.status(400).json({ error: "unit (main topic name) required" });

    const unitKey = toSlug(unitName);
    if (!unitKey) return res.status(400).json({ error: "Invalid unit name" });

    const staticTax = getTaxonomyBySpecKey(specKey);
    if (staticTax && staticTax.units) {
      const exists = staticTax.units.some((u) => (u.unitKey || toSlug(u.unit)).toLowerCase() === unitKey);
      if (exists) return res.status(400).json({ error: "Main topic already exists" });
    }

    const existing = await AdminTaxonomyItem.findOne({ specKey, type: "unit", unitKey });
    if (existing) return res.status(400).json({ error: "Main topic already exists" });

    const item = await AdminTaxonomyItem.create({
      specKey: String(specKey).trim(),
      type: "unit",
      unit: unitName,
      unitKey,
      key: unitKey,
    });
    return res.status(201).json({ item });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: "Main topic already exists" });
    console.error("Admin taxonomy add unit error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

/** POST /api/admin/taxonomy/subtopic — add sub-topic */
router.post("/subtopic", async (req, res) => {
  try {
    const { specKey, unitKey, unit, subTopicTitle } = req.body || {};
    if (!specKey || !SPEC_KEYS.includes(String(specKey).trim())) {
      return res.status(400).json({ error: "Valid specKey required" });
    }
    const mainTopicKey = (unitKey && String(unitKey).trim()) || toSlug(unit || "").toLowerCase();
    const mainTopicName = (unit && String(unit).trim()) || "";
    const title = (subTopicTitle && String(subTopicTitle).trim()) || "";

    if (!title) return res.status(400).json({ error: "subTopicTitle required" });

    const key = toSlug(title);
    if (!key) return res.status(400).json({ error: "Invalid sub-topic title" });

    const topicKey = `${String(specKey).trim()}:${key}`;

    const merged = await getMergedTaxonomyBySpecKey(specKey);
    if (!merged || !merged.units) return res.status(400).json({ error: "Spec not found" });

    const targetUnit = merged.units.find(
      (u) => (u.unitKey || toSlug(u.unit)).toLowerCase() === mainTopicKey
    );
    if (!targetUnit) return res.status(400).json({ error: "Main topic not found" });

    const duplicate = (targetUnit.topics || []).some((t) => (t.key || "").toLowerCase() === key);
    if (duplicate) return res.status(400).json({ error: "Sub-topic already exists under this main topic" });

    const item = await AdminTaxonomyItem.create({
      specKey: String(specKey).trim(),
      type: "subTopic",
      unit: targetUnit.unit,
      unitKey: mainTopicKey,
      topic: title,
      key,
      topicKey,
    });
    return res.status(201).json({ item });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: "Sub-topic already exists" });
    console.error("Admin taxonomy add subtopic error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

/** GET /api/admin/taxonomy/items — list admin items (for edit/delete) */
router.get("/items", async (req, res) => {
  try {
    const items = await AdminTaxonomyItem.find({}).sort({ specKey: 1, unitKey: 1, key: 1 }).lean();
    return res.json({ items });
  } catch (err) {
    console.error("Admin taxonomy items error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/** PUT /api/admin/taxonomy/items/:id — edit admin item */
router.put("/items/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });

    const item = await AdminTaxonomyItem.findById(id);
    if (!item) return res.status(404).json({ error: "Not found" });

    const { unit, subTopicTitle } = req.body || {};

    if (item.type === "unit") {
      const unitName = (unit && String(unit).trim()) || item.unit;
      if (!unitName) return res.status(400).json({ error: "unit required" });
      const newUnitKey = toSlug(unitName);
      if (!newUnitKey) return res.status(400).json({ error: "Invalid unit name" });
      const oldUnitKey = item.unitKey;
      item.unit = unitName;
      item.unitKey = newUnitKey;
      item.key = newUnitKey;
      await item.save();
      if (oldUnitKey !== newUnitKey) {
        await AdminTaxonomyItem.updateMany(
          { type: "subTopic", specKey: item.specKey, unitKey: oldUnitKey },
          { $set: { unitKey: newUnitKey } }
        );
      }
      return res.json({ item });
    }

    if (item.type === "subTopic") {
      const title = (subTopicTitle && String(subTopicTitle).trim()) || item.topic;
      if (!title) return res.status(400).json({ error: "subTopicTitle required" });
      const key = toSlug(title);
      if (!key) return res.status(400).json({ error: "Invalid sub-topic title" });
      const topicKey = `${item.specKey}:${key}`;

      const duplicate = await AdminTaxonomyItem.findOne({
        specKey: item.specKey,
        unitKey: item.unitKey,
        key,
        _id: { $ne: item._id },
      });
      if (duplicate) return res.status(400).json({ error: "Sub-topic already exists" });

      const staticTax = getTaxonomyBySpecKey(item.specKey);
      if (staticTax && staticTax.units) {
        const u = staticTax.units.find((x) => (x.unitKey || toSlug(x.unit)).toLowerCase() === item.unitKey);
        if (u && (u.topics || []).some((t) => (t.key || "").toLowerCase() === key)) {
          return res.status(400).json({ error: "Sub-topic already exists in static config" });
        }
      }

      item.topic = title;
      item.key = key;
      item.topicKey = topicKey;
      await item.save();
      return res.json({ item });
    }

    return res.status(400).json({ error: "Unknown type" });
  } catch (err) {
    console.error("Admin taxonomy edit error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

/** DELETE /api/admin/taxonomy/items/:id — delete admin item */
router.delete("/items/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });

    const item = await AdminTaxonomyItem.findByIdAndDelete(id);
    if (!item) return res.status(404).json({ error: "Not found" });

    if (item.type === "unit") {
      await AdminTaxonomyItem.deleteMany({ specKey: item.specKey, unitKey: item.unitKey });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("Admin taxonomy delete error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

module.exports = router;
