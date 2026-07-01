/**
 * Merge admin taxonomy additions with static config. Used by taxonomy routes and taxonomyService.
 * Supports 4-level hierarchy: Main Topic → Section → Topic (leaf).
 */
const AdminTaxonomyItem = require("../models/AdminTaxonomyItem");
const AdminTopicPlacement = require("../models/AdminTopicPlacement");
const { getTaxonomyBySpecKey, isValidTopicForSpec, isTopicGroup, findLeafTopicInTaxonomy } = require("../utils/topicTaxonomy");
const { buildTopicKey, parseTopicKey, DEFAULT_SPEC_LEGACY } = require("../utils/topicKey");

/** Generate slug from display name */
function toSlug(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Get merged taxonomy for spec (static + admin additions).
 * @param {string} specKey
 * @returns {Object} { subject, examBoard, level, specKey, units }
 */
async function getMergedTaxonomyBySpecKey(specKey) {
  const staticTaxonomy = getTaxonomyBySpecKey(specKey);
  if (!staticTaxonomy) return null;

  const [adminItems, placements] = await Promise.all([
    AdminTaxonomyItem.find({ specKey }).sort({ sortOrder: 1, unitKey: 1, key: 1 }).lean(),
    AdminTopicPlacement.find({ specKey }).lean(),
  ]);

  const spec = staticTaxonomy.specKey || specKey;

  function getUnitKey(u) {
    return (u.unitKey || toSlug(u.unit || "")).toLowerCase();
  }

  const units = JSON.parse(JSON.stringify(staticTaxonomy.units || []));
  for (const u of units) {
    u.unitKey = u.unitKey || getUnitKey(u);
  }
  const unitKeys = new Set(units.map(getUnitKey));

  // Add admin units (main topics) not in static
  const adminUnits = adminItems.filter((i) => i.type === "unit");
  for (const au of adminUnits) {
    const uk = (au.unitKey || toSlug(au.unit)).toLowerCase();
    if (unitKeys.has(uk)) continue;
    unitKeys.add(uk);
    units.push({
      unit: au.unit,
      unitKey: uk,
      topics: [],
      _admin: true,
      _id: au._id,
    });
  }

  // Sections (by parentUnitKey)
  const sections = adminItems
    .filter((i) => i.type === "section" && (i.parentUnitKey || i.parentId))
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const sectionById = new Map(sections.map((s) => [String(s._id), s]));
  const placementsBySlug = new Map(placements.map((p) => [String(p.topicSlug).toLowerCase(), p]));

  // Add admin sub-topics
  const adminSubTopics = adminItems.filter((i) => i.type === "subTopic" && i.key);
  for (const st of adminSubTopics) {
    const uk = (st.unitKey || toSlug(st.unit)).toLowerCase();
    let unit = units.find((u) => getUnitKey(u) === uk);
    if (!unit) {
      unit = { unit: st.unit, unitKey: uk, topics: [], _admin: true };
      units.push(unit);
    }
    if (!unit.topics) unit.topics = [];
    const existing = unit.topics.find((t) => (t.key || "").toLowerCase() === (st.key || "").toLowerCase());
    if (!existing) {
      unit.topics.push({
        topic: st.topic,
        key: st.key,
        topicKey: st.topicKey || `${spec}:${st.key}`,
        tier: st.tier || ["foundation", "higher"],
        requiredPractical: !!st.requiredPractical,
        _admin: true,
      });
    }
  }

  // Build topic -> final location (unitKey, sectionId or null). Placement can move topic to different unit.
  const topicToLocation = new Map(); // slug -> { unitKey, sectionId }
  const allTopicObjects = new Map(); // slug -> topic object

  for (const unit of units) {
    const uk = getUnitKey(unit);
    for (const t of unit.topics || []) {
      const slug = (t.key || "").toLowerCase();
      if (!allTopicObjects.has(slug)) allTopicObjects.set(slug, t);
      const placement = placementsBySlug.get(slug);
      const adminSt = adminSubTopics.find((st) => (st.key || "").toLowerCase() === slug);
      const defaultSectionId = adminSt?.parentId ? String(adminSt.parentId) : null;
      const effectiveSectionId = placement ? String(placement.sectionId) : defaultSectionId;
      if (effectiveSectionId) {
        const sect = sectionById.get(effectiveSectionId);
        const targetUk = sect ? (sect.parentUnitKey || "").toLowerCase() : uk;
        topicToLocation.set(slug, { unitKey: targetUk, sectionId: effectiveSectionId });
      } else {
        topicToLocation.set(slug, { unitKey: uk, sectionId: null });
      }
    }
  }
  for (const st of adminSubTopics) {
    const slug = (st.key || "").toLowerCase();
    if (allTopicObjects.has(slug)) continue;
    allTopicObjects.set(slug, {
      topic: st.topic,
      key: st.key,
      topicKey: st.topicKey || `${spec}:${st.key}`,
      tier: st.tier || ["foundation", "higher"],
      requiredPractical: !!st.requiredPractical,
      _admin: true,
    });
    const uk = (st.unitKey || toSlug(st.unit)).toLowerCase();
    const placement = placementsBySlug.get(slug);
    const effectiveSectionId = placement ? String(placement.sectionId) : (st.parentId ? String(st.parentId) : null);
    if (effectiveSectionId) {
      const sect = sectionById.get(effectiveSectionId);
      const targetUk = sect ? (sect.parentUnitKey || "").toLowerCase() : uk;
      topicToLocation.set(slug, { unitKey: targetUk, sectionId: effectiveSectionId });
    } else {
      topicToLocation.set(slug, { unitKey: uk, sectionId: null });
    }
  }

  // Build sections per unit and partition topics by final location
  for (const unit of units) {
    const uk = getUnitKey(unit);
    const unitSections = sections.filter(
      (s) => (s.parentUnitKey || "").toLowerCase() === uk || (s.parentId && units.some((u) => u._id && String(u._id) === String(s.parentId)))
    );
    const topicsUnderSection = new Map();
    const directTopics = [];

    for (const [slug, loc] of topicToLocation) {
      if (loc.unitKey !== uk) continue;
      const t = allTopicObjects.get(slug);
      if (!t) continue;
      if (loc.sectionId) {
        if (!topicsUnderSection.has(loc.sectionId)) topicsUnderSection.set(loc.sectionId, []);
        topicsUnderSection.get(loc.sectionId).push(t);
      } else {
        directTopics.push(t);
      }
    }

    unit.sections = unitSections.map((s) => ({
      _id: s._id,
      title: s.title || s.slug,
      slug: s.slug,
      topics: topicsUnderSection.get(String(s._id)) || [],
    }));

    unit.topics = [];
    for (const sec of unit.sections) {
      for (const t of sec.topics) unit.topics.push(t);
    }
    for (const t of directTopics) unit.topics.push(t);
  }

  return {
    ...staticTaxonomy,
    specKey: spec,
    units,
  };
}

/**
 * Sync version for use in non-async contexts (e.g. topicTaxonomy). Uses cached/stale admin data.
 * Pass adminItems from a prior fetch if available.
 */
function mergeTaxonomySync(staticTaxonomy, adminItems = []) {
  if (!staticTaxonomy) return null;
  const units = JSON.parse(JSON.stringify(staticTaxonomy.units || []));
  const unitKeys = new Set(units.map((u) => toSlug(u.unit || "")));

  const adminUnits = adminItems.filter((i) => i.type === "unit");
  for (const au of adminUnits) {
    const uk = (au.unitKey || toSlug(au.unit)).toLowerCase();
    if (unitKeys.has(uk)) continue;
    unitKeys.add(uk);
    units.push({ unit: au.unit, unitKey: uk, topics: [], _admin: true });
  }

  const adminSubTopics = adminItems.filter((i) => i.type === "subTopic" && i.key);
  for (const st of adminSubTopics) {
    const uk = (st.unitKey || toSlug(st.unit)).toLowerCase();
    let unit = units.find((u) => (u.unitKey || toSlug(u.unit)).toLowerCase() === uk);
    if (!unit) {
      unit = { unit: st.unit, unitKey: uk, topics: [], _admin: true };
      units.push(unit);
    }
    if (!unit.topics) unit.topics = [];
    const existing = unit.topics.find((t) => (t.key || "").toLowerCase() === (st.key || "").toLowerCase());
    if (!existing) {
      const spec = staticTaxonomy.specKey || "";
      unit.topics.push({
        topic: st.topic,
        key: st.key,
        topicKey: st.topicKey || `${spec}:${st.key}`,
        tier: st.tier || ["foundation", "higher"],
        requiredPractical: !!st.requiredPractical,
        _admin: true,
      });
    }
  }

  return { ...staticTaxonomy, units };
}

/** Pattern B: admin sub-topics with status archived must not match registry-backed validation. */
function excludeArchivedSubTopics(adminItems) {
  return (adminItems || []).filter((i) => i.status !== "archived");
}

/** Check if topicKey exists in static or admin taxonomy for spec (async) */
async function isValidTopicForSpecWithAdmin(specKey, topicKey) {
  const adminItems = await AdminTaxonomyItem.find({ specKey, type: "subTopic" }).lean();
  return isValidTopicForSpecWithItems(specKey, topicKey, adminItems);
}

/**
 * Resolve topicKey from request to stored form. Validates against static + admin taxonomy.
 * Use for topic quiz, exam questions, flashcards when assigning to topics.
 * @param {string} specKeyFromReq
 * @param {string} topicKeyFromReq
 * @returns {Promise<{ storedKey: string } | { error: string }>}
 */
async function resolveStoredTopicKeyWithAdmin(specKeyFromReq, topicKeyFromReq) {
  const trimmed = (topicKeyFromReq != null && typeof topicKeyFromReq === "string") ? topicKeyFromReq.trim() : "";
  if (!trimmed) return { error: "topicKey is required" };

  const specKey = (specKeyFromReq && String(specKeyFromReq).trim()) || DEFAULT_SPEC_LEGACY;
  const { specKey: parsedSpec, topicKey: rawTopic, isNamespaced } = parseTopicKey(trimmed);

  if (isNamespaced && parsedSpec && rawTopic) {
    if (!isValidTopicForSpec(parsedSpec, rawTopic)) {
      const adminItems = excludeArchivedSubTopics(
        await AdminTaxonomyItem.find({ specKey: parsedSpec, type: "subTopic" }).lean()
      );
      if (!isValidTopicForSpecWithItems(parsedSpec, rawTopic, adminItems)) {
        return { error: `Invalid topicKey for spec ${parsedSpec}` };
      }
      return { storedKey: trimmed };
    }
    return { storedKey: trimmed };
  }

  const topicOnly = rawTopic || trimmed;
  if (!isValidTopicForSpec(specKey, topicOnly)) {
    const adminItems = excludeArchivedSubTopics(
      await AdminTaxonomyItem.find({ specKey, type: "subTopic" }).lean()
    );
    if (!isValidTopicForSpecWithItems(specKey, topicOnly, adminItems)) {
      return { error: `Invalid topicKey for spec ${specKey}` };
    }
  }
  return { storedKey: buildTopicKey(specKey, topicOnly) };
}

/**
 * Get linked content counts for a topic. Used to block delete when content exists.
 * @param {string} specKey
 * @param {string} topicKeyOrSlug - Full topicKey (spec:slug) or slug only
 * @returns {Promise<{ lessons: number, flashcards: number, quizzes: number, examQuestions: number }>}
 */
async function getLinkedContentCounts(specKey, topicKeyOrSlug) {
  const { queryCandidates } = require("../utils/topicKey");
  const topicOnly =
    topicKeyOrSlug && typeof topicKeyOrSlug === "string" && topicKeyOrSlug.includes(":")
      ? topicKeyOrSlug.split(":").pop()
      : (topicKeyOrSlug || "").trim();
  if (!topicOnly) return { lessons: 0, flashcards: 0, quizzes: 0, examQuestions: 0 };

  const candidates = queryCandidates(specKey || "", topicOnly);

  const Lesson = require("../models/Lesson");
  const TopicFlashcard = require("../models/TopicFlashcard");
  const TopicQuizQuestion = require("../models/TopicQuizQuestion");
  const ExamQuestion = require("../models/ExamQuestion");

  const [lessons, flashcards, quizzes, examQuestions] = await Promise.all([
    Lesson.countDocuments({ topicKey: { $in: candidates } }),
    TopicFlashcard.countDocuments({ topicKey: { $in: candidates } }),
    TopicQuizQuestion.countDocuments({ topicKey: { $in: candidates } }),
    ExamQuestion.countDocuments({ topicKey: { $in: candidates } }),
  ]);

  return { lessons, flashcards, quizzes, examQuestions };
}

/**
 * Whether this topicSlug/namespaced key is flagged as a group (folder) in merged taxonomy.
 * @param {string} specKey
 * @param {string} topicKeyOrNamespaced - e.g. "cell-structure" or "aqa-gcse-biology:cell-structure"
 * @returns {Promise<boolean>}
 */
async function topicIsGroupInMerged(specKey, topicKeyOrNamespaced) {
  if (!specKey || !topicKeyOrNamespaced) return false;
  const { parseTopicKey } = require("../utils/topicKey");
  let slug = (parseTopicKey(topicKeyOrNamespaced).topicKey || "").trim();
  if (!slug) slug = String(topicKeyOrNamespaced).trim();
  slug = slug.split(":").pop().trim().toLowerCase();
  if (!slug) return false;

  const taxonomy = await getMergedTaxonomyBySpecKey(specKey);
  if (!taxonomy?.units) return false;

  for (const unit of taxonomy.units) {
    for (const t of unit.topics || []) {
      const k = String(t.key || "")
        .trim()
        .toLowerCase();
      if (k === slug) return isTopicGroup(t);
    }
    for (const sec of unit.sections || []) {
      for (const t of sec.topics || []) {
        const k = String(t.key || "")
          .trim()
          .toLowerCase();
        if (k === slug) return isTopicGroup(t);
      }
    }
  }
  return false;
}

/** Sync check with pre-fetched admin items */
function isValidTopicForSpecWithItems(specKey, topicKey, adminItems = []) {
  const { topicKey: raw } = require("../utils/topicKey").parseTopicKey(topicKey || "");
  const k = raw.trim().toLowerCase();
  if (!k) return false;

  const staticTaxonomy = getTaxonomyBySpecKey(specKey);
  const merged = mergeTaxonomySync(staticTaxonomy, adminItems || []);
  if (!merged || !Array.isArray(merged.units)) return false;

  return findLeafTopicInTaxonomy(merged, k) !== null;
}

module.exports = {
  getMergedTaxonomyBySpecKey,
  topicIsGroupInMerged,
  mergeTaxonomySync,
  isValidTopicForSpecWithAdmin,
  isValidTopicForSpecWithItems,
  resolveStoredTopicKeyWithAdmin,
  toSlug,
  getLinkedContentCounts,
};
