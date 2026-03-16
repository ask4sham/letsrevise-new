/**
 * Admin Taxonomy CRUD — add/edit/delete main topics and sub-topics. Admin only.
 */
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const AdminTaxonomyItem = require("../models/AdminTaxonomyItem");
const AdminTopicPlacement = require("../models/AdminTopicPlacement");
const { getTaxonomyBySpecKey } = require("../utils/topicTaxonomy");
const { getMergedTaxonomyBySpecKey, toSlug, getLinkedContentCounts } = require("../services/adminTaxonomyService");
const { queryCandidates } = require("../utils/topicKey");

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
          _id: u._id || null,
          sections: (u.sections || []).map((s) => ({
            _id: s._id ? String(s._id) : null,
            title: s.title,
            slug: s.slug,
            topics: (s.topics || []).map((t) => ({
              topic: t.topic,
              key: t.key,
              topicKey: t.topicKey || `${taxonomy.specKey || specKey}:${t.key}`,
              _admin: !!t._admin,
            })),
          })),
          directTopics: (u.topics || []).filter((t) => !(u.sections || []).some((s) => (s.topics || []).some((st) => (st.key || "").toLowerCase() === (t.key || "").toLowerCase()))).map((t) => ({
            topic: t.topic,
            key: t.key,
            topicKey: t.topicKey || `${taxonomy.specKey || specKey}:${t.key}`,
            _admin: !!t._admin,
          })),
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

/** DELETE /api/admin/taxonomy/items/:id — delete admin item (guarded by linked content) */
router.delete("/items/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });

    const item = await AdminTaxonomyItem.findById(id);
    if (!item) return res.status(404).json({ error: "Not found" });

    if (item.type === "unit") {
      const subTopics = await AdminTaxonomyItem.find({ type: "subTopic", specKey: item.specKey, unitKey: item.unitKey }).lean();
      let totalLesson = 0, totalFlashcard = 0, totalQuiz = 0, totalExam = 0;
      for (const st of subTopics) {
        const c = await getLinkedContentCounts(item.specKey, st.key || st.topicKey);
        totalLesson += c.lessons || 0;
        totalFlashcard += c.flashcards || 0;
        totalQuiz += c.quizzes || 0;
        totalExam += c.examQuestions || 0;
      }
      if (subTopics.length > 0 || totalLesson + totalFlashcard + totalQuiz + totalExam > 0) {
        return res.status(409).json({
          error: "Main topic has linked content or sub-topics",
          linkedCounts: { lessons: totalLesson, flashcards: totalFlashcard, quizzes: totalQuiz, examQuestions: totalExam },
        });
      }
      await AdminTaxonomyItem.deleteMany({ specKey: item.specKey, unitKey: item.unitKey });
      await AdminTaxonomyItem.findByIdAndDelete(id);
    } else if (item.type === "subTopic") {
      const c = await getLinkedContentCounts(item.specKey, item.key || item.topicKey);
      if ((c.lessons || 0) + (c.flashcards || 0) + (c.quizzes || 0) + (c.examQuestions || 0) > 0) {
        return res.status(409).json({
          error: "Topic has linked content",
          linkedCounts: { lessons: c.lessons || 0, flashcards: c.flashcards || 0, quizzes: c.quizzes || 0, examQuestions: c.examQuestions || 0 },
        });
      }
      await AdminTaxonomyItem.findByIdAndDelete(id);
    } else {
      return res.status(400).json({ error: "Invalid type" });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("Admin taxonomy delete error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

/** PATCH /api/admin/taxonomy/main-topic/:id — rename main topic (title; slug if no sub-topics) */
router.patch("/main-topic/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });
    const item = await AdminTaxonomyItem.findById(id);
    if (!item || item.type !== "unit") return res.status(404).json({ error: "Not found" });
    const { title, slug } = req.body || {};
    const newTitle = (title != null && String(title).trim()) || item.unit;
    const newSlug = (slug != null && String(slug).trim()) ? toSlug(slug) : null;
    if (!newTitle) return res.status(400).json({ error: "title required" });
    const finalSlug = (newSlug && String(newSlug).trim()) ? newSlug : item.unitKey;
    const dup = await AdminTaxonomyItem.findOne({ specKey: item.specKey, type: "unit", unitKey: finalSlug, _id: { $ne: id } });
    if (dup) return res.status(400).json({ error: "Main topic with this slug already exists" });
    const staticTax = getTaxonomyBySpecKey(item.specKey);
    if (staticTax?.units?.some((u) => (u.unitKey || toSlug(u.unit)).toLowerCase() === finalSlug)) {
      return res.status(400).json({ error: "Main topic already exists in static config" });
    }
    const oldUnitKey = item.unitKey;
    item.unit = newTitle;
    item.unitKey = finalSlug;
    item.key = finalSlug;
    await item.save();
    if (oldUnitKey !== finalSlug) {
      await AdminTaxonomyItem.updateMany({ type: "subTopic", specKey: item.specKey, unitKey: oldUnitKey }, { $set: { unitKey: finalSlug } });
    }
    return res.json({ item });
  } catch (err) {
    console.error("Admin taxonomy PATCH main-topic:", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
});

/** PATCH /api/admin/taxonomy/sub-topic/:id — rename sub-topic (title only when linked; slug only if no linked content) */
router.patch("/sub-topic/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });
    const item = await AdminTaxonomyItem.findById(id);
    if (!item || item.type !== "subTopic") return res.status(404).json({ error: "Not found" });
    const { title, slug } = req.body || {};
    const newTitle = (title != null && String(title).trim()) ? String(title).trim() : item.topic;
    const newSlug = (slug != null && String(slug).trim()) ? toSlug(slug) : null;
    if (!newTitle) return res.status(400).json({ error: "title required" });
    const c = await getLinkedContentCounts(item.specKey, item.key || item.topicKey);
    const hasLinked = (c.lessons || 0) + (c.flashcards || 0) + (c.quizzes || 0) + (c.examQuestions || 0) > 0;
    let finalKey = item.key;
    let finalTopicKey = item.topicKey;
    if (newSlug && !hasLinked) {
      finalKey = newSlug;
      finalTopicKey = `${item.specKey}:${newSlug}`;
    } else if (!hasLinked && newTitle !== item.topic) {
      finalKey = toSlug(newTitle);
      finalTopicKey = `${item.specKey}:${finalKey}`;
    } else if (hasLinked) {
      finalKey = item.key;
      finalTopicKey = item.topicKey;
    }
    const dup = await AdminTaxonomyItem.findOne({ specKey: item.specKey, unitKey: item.unitKey, key: finalKey, _id: { $ne: id } });
    if (dup) return res.status(400).json({ error: "Sub-topic already exists" });
    const staticTax = getTaxonomyBySpecKey(item.specKey);
    if (staticTax?.units) {
      const u = staticTax.units.find((x) => (x.unitKey || toSlug(x.unit)).toLowerCase() === item.unitKey);
      if (u?.topics?.some((t) => (t.key || "").toLowerCase() === finalKey)) {
        return res.status(400).json({ error: "Sub-topic already exists in static config" });
      }
    }
    item.topic = newTitle;
    item.key = finalKey;
    item.topicKey = finalTopicKey;
    await item.save();
    return res.json({ item });
  } catch (err) {
    console.error("Admin taxonomy PATCH sub-topic:", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
});

/** DELETE /api/admin/taxonomy/main-topic/:id — delete main topic (guarded) */
router.delete("/main-topic/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });
    const item = await AdminTaxonomyItem.findById(id);
    if (!item || item.type !== "unit") return res.status(404).json({ error: "Not found" });
    const subTopics = await AdminTaxonomyItem.find({ type: "subTopic", specKey: item.specKey, unitKey: item.unitKey }).lean();
    let totalLesson = 0, totalFlashcard = 0, totalQuiz = 0, totalExam = 0;
    for (const st of subTopics) {
      const c = await getLinkedContentCounts(item.specKey, st.key || st.topicKey);
      totalLesson += c.lessons || 0;
      totalFlashcard += c.flashcards || 0;
      totalQuiz += c.quizzes || 0;
      totalExam += c.examQuestions || 0;
    }
    if (subTopics.length > 0 || totalLesson + totalFlashcard + totalQuiz + totalExam > 0) {
      return res.status(409).json({
        error: "Main topic has linked content or sub-topics",
        linkedCounts: { lessons: totalLesson, flashcards: totalFlashcard, quizzes: totalQuiz, examQuestions: totalExam },
      });
    }
    await AdminTaxonomyItem.deleteMany({ specKey: item.specKey, unitKey: item.unitKey });
    await AdminTaxonomyItem.findByIdAndDelete(id);
    return res.json({ ok: true });
  } catch (err) {
    console.error("Admin taxonomy DELETE main-topic:", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
});

/** DELETE /api/admin/taxonomy/sub-topic/:id — delete sub-topic (guarded) */
router.delete("/sub-topic/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });
    const item = await AdminTaxonomyItem.findById(id);
    if (!item || item.type !== "subTopic") return res.status(404).json({ error: "Not found" });
    const c = await getLinkedContentCounts(item.specKey, item.key || item.topicKey);
    if ((c.lessons || 0) + (c.flashcards || 0) + (c.quizzes || 0) + (c.examQuestions || 0) > 0) {
      return res.status(409).json({
        error: "Topic has linked content",
        linkedCounts: { lessons: c.lessons || 0, flashcards: c.flashcards || 0, quizzes: c.quizzes || 0, examQuestions: c.examQuestions || 0 },
      });
    }
    await AdminTaxonomyItem.findByIdAndDelete(id);
    return res.json({ ok: true });
  } catch (err) {
    console.error("Admin taxonomy DELETE sub-topic:", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
});

/** POST /api/admin/taxonomy/section — add section under main topic */
router.post("/section", async (req, res) => {
  try {
    const { specKey, parentUnitKey, title } = req.body || {};
    if (!specKey || !SPEC_KEYS.includes(String(specKey).trim())) {
      return res.status(400).json({ error: "Valid specKey required" });
    }
    const unitKey = (parentUnitKey && String(parentUnitKey).trim()).toLowerCase() || "";
    const sectionTitle = (title && String(title).trim()) || "";
    if (!unitKey || !sectionTitle) return res.status(400).json({ error: "parentUnitKey and title required" });

    const slug = toSlug(sectionTitle);
    if (!slug) return res.status(400).json({ error: "Invalid section title" });

    const merged = await getMergedTaxonomyBySpecKey(specKey);
    if (!merged || !merged.units) return res.status(400).json({ error: "Spec not found" });
    const unit = merged.units.find((u) => (u.unitKey || toSlug(u.unit)).toLowerCase() === unitKey);
    if (!unit) return res.status(400).json({ error: "Main topic not found" });

    const existing = await AdminTaxonomyItem.findOne({
      specKey: String(specKey).trim(),
      type: "section",
      parentUnitKey: unitKey,
      slug,
    });
    if (existing) return res.status(400).json({ error: "Section already exists with this slug" });

    const item = await AdminTaxonomyItem.create({
      specKey: String(specKey).trim(),
      type: "section",
      parentUnitKey: unitKey,
      title: sectionTitle,
      slug,
      sortOrder: 0,
    });
    return res.status(201).json({ item });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: "Section already exists" });
    console.error("Admin taxonomy add section error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

/** DELETE /api/admin/taxonomy/section/:id — delete section (clears placements, then deletes) */
router.delete("/section/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });
    const section = await AdminTaxonomyItem.findById(id);
    if (!section || section.type !== "section") return res.status(404).json({ error: "Section not found" });
    await AdminTopicPlacement.deleteMany({ sectionId: section._id });
    await AdminTaxonomyItem.findByIdAndDelete(id);
    return res.json({ ok: true });
  } catch (err) {
    console.error("Admin taxonomy DELETE section:", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
});

/** POST /api/admin/taxonomy/topic-placement — place topic under section (or remove with sectionId=null) */
router.post("/topic-placement", async (req, res) => {
  try {
    const { specKey, topicSlug, sectionId } = req.body || {};
    if (!specKey || !SPEC_KEYS.includes(String(specKey).trim())) {
      return res.status(400).json({ error: "Valid specKey required" });
    }
    const slug = (topicSlug && String(topicSlug).trim()).toLowerCase() || "";
    if (!slug) return res.status(400).json({ error: "topicSlug required" });

    const merged = await getMergedTaxonomyBySpecKey(specKey);
    if (!merged || !merged.units) return res.status(400).json({ error: "Spec not found" });

    const topicExists = merged.units.some((u) => (u.topics || []).some((t) => (t.key || "").toLowerCase() === slug));
    if (!topicExists) return res.status(400).json({ error: "Topic not found in taxonomy" });

    if (!sectionId) {
      await AdminTopicPlacement.findOneAndDelete({ specKey, topicSlug: slug });
      await AdminTaxonomyItem.updateMany(
        { specKey, type: "subTopic", $or: [{ key: slug }, { key: { $regex: new RegExp(`^${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } }] },
        { $set: { parentId: null } }
      );
      return res.json({ ok: true, placement: null });
    }

    if (!mongoose.Types.ObjectId.isValid(sectionId)) return res.status(400).json({ error: "Invalid sectionId" });
    const section = await AdminTaxonomyItem.findById(sectionId);
    if (!section || section.type !== "section" || section.specKey !== specKey) {
      return res.status(404).json({ error: "Section not found or wrong spec" });
    }

    const placement = await AdminTopicPlacement.findOneAndUpdate(
      { specKey, topicSlug: slug },
      { $set: { sectionId } },
      { upsert: true, new: true }
    );
    return res.json({ placement });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: "Placement conflict" });
    console.error("Admin taxonomy topic-placement error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

/** POST /api/admin/taxonomy/sub-topic/:id/move — move sub-topic to another main topic (or section) */
router.post("/sub-topic/:id/move", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });
    const { targetMainTopicId, targetUnitKey, targetSectionId } = req.body || {};

    if (targetSectionId) {
      if (!mongoose.Types.ObjectId.isValid(targetSectionId)) return res.status(400).json({ error: "Invalid targetSectionId" });
      const item = await AdminTaxonomyItem.findById(id);
      if (!item || item.type !== "subTopic") return res.status(404).json({ error: "Not found" });
      const section = await AdminTaxonomyItem.findById(targetSectionId);
      if (!section || section.type !== "section" || section.specKey !== item.specKey) {
        return res.status(404).json({ error: "Section not found or wrong spec" });
      }
      const sectionUnitKey = (section.parentUnitKey || "").toLowerCase();
      const itemUnitKey = (item.unitKey || "").toLowerCase();
      const isCrossUnit = sectionUnitKey && sectionUnitKey !== itemUnitKey;
      if (isCrossUnit) {
        const merged = await getMergedTaxonomyBySpecKey(item.specKey);
        const targetUnit = merged?.units?.find((u) => (u.unitKey || toSlug(u.unit)).toLowerCase() === sectionUnitKey);
        if (targetUnit) {
          item.unit = targetUnit.unit;
          item.unitKey = targetUnit.unitKey || sectionUnitKey;
          item.parentId = null;
          await item.save();
        }
      }
      const placement = await AdminTopicPlacement.findOneAndUpdate(
        { specKey: item.specKey, topicSlug: (item.key || "").toLowerCase() },
        { $set: { sectionId: targetSectionId } },
        { upsert: true, new: true }
      );
      return res.json({ item, placement });
    }

    if (!targetMainTopicId && !targetUnitKey) return res.status(400).json({ error: "targetMainTopicId, targetUnitKey, or targetSectionId required" });
    const item = await AdminTaxonomyItem.findById(id);
    if (!item || item.type !== "subTopic") return res.status(404).json({ error: "Not found" });
    let target = null;
    if (targetMainTopicId && mongoose.Types.ObjectId.isValid(targetMainTopicId)) {
      target = await AdminTaxonomyItem.findById(targetMainTopicId);
      if (!target || target.type !== "unit" || target.specKey !== item.specKey) {
        return res.status(404).json({ error: "Target main topic not found or wrong spec" });
      }
    } else if (targetUnitKey && String(targetUnitKey).trim()) {
      const merged = await getMergedTaxonomyBySpecKey(item.specKey);
      const uk = String(targetUnitKey).trim().toLowerCase();
      target = merged?.units?.find((u) => (u.unitKey || toSlug(u.unit)).toLowerCase() === uk);
      if (!target) return res.status(404).json({ error: "Target main topic not found" });
    } else {
      return res.status(400).json({ error: "targetMainTopicId or targetUnitKey required" });
    }
    const dup = await AdminTaxonomyItem.findOne({ specKey: item.specKey, unitKey: target.unitKey, key: item.key, _id: { $ne: id } });
    if (dup) return res.status(400).json({ error: "Sub-topic already exists under target main topic" });
    const staticTax = getTaxonomyBySpecKey(item.specKey);
    if (staticTax?.units) {
      const u = staticTax.units.find((x) => (x.unitKey || toSlug(x.unit)).toLowerCase() === (target.unitKey || toSlug(target.unit)).toLowerCase());
      if (u?.topics?.some((t) => (t.key || "").toLowerCase() === (item.key || ""))) {
        return res.status(400).json({ error: "Sub-topic already exists under target in static config" });
      }
    }
    item.unit = target.unit;
    item.unitKey = target.unitKey || toSlug(target.unit);
    item.parentId = null;
    await item.save();
    await AdminTopicPlacement.findOneAndDelete({ specKey: item.specKey, topicSlug: (item.key || "").toLowerCase() });
    return res.json({ item });
  } catch (err) {
    console.error("Admin taxonomy move sub-topic:", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
});

module.exports = router;
