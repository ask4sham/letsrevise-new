/**
 * Merge admin taxonomy additions with static config. Used by taxonomy routes and taxonomyService.
 */
const AdminTaxonomyItem = require("../models/AdminTaxonomyItem");
const { getTaxonomyBySpecKey, isValidTopicForSpec } = require("../utils/topicTaxonomy");
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

  const adminItems = await AdminTaxonomyItem.find({ specKey }).sort({ sortOrder: 1, unitKey: 1, key: 1 }).lean();

  const units = JSON.parse(JSON.stringify(staticTaxonomy.units || []));

  function getUnitKey(u) {
    return (u.unitKey || toSlug(u.unit || "")).toLowerCase();
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
    });
  }

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
      const spec = staticTaxonomy.specKey || specKey;
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

  return {
    ...staticTaxonomy,
    specKey: staticTaxonomy.specKey || specKey,
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
      const adminItems = await AdminTaxonomyItem.find({ specKey: parsedSpec, type: "subTopic" }).lean();
      if (!isValidTopicForSpecWithItems(parsedSpec, rawTopic, adminItems)) {
        return { error: `Invalid topicKey for spec ${parsedSpec}` };
      }
      return { storedKey: trimmed };
    }
    return { storedKey: trimmed };
  }

  const topicOnly = rawTopic || trimmed;
  if (!isValidTopicForSpec(specKey, topicOnly)) {
    const adminItems = await AdminTaxonomyItem.find({ specKey, type: "subTopic" }).lean();
    if (!isValidTopicForSpecWithItems(specKey, topicOnly, adminItems)) {
      return { error: `Invalid topicKey for spec ${specKey}` };
    }
  }
  return { storedKey: buildTopicKey(specKey, topicOnly) };
}

/** Sync check with pre-fetched admin items */
function isValidTopicForSpecWithItems(specKey, topicKey, adminItems = []) {
  const { topicKey: raw } = require("../utils/topicKey").parseTopicKey(topicKey || "");
  const k = raw.trim().toLowerCase();
  if (!k) return false;

  const staticTaxonomy = getTaxonomyBySpecKey(specKey);
  const merged = mergeTaxonomySync(staticTaxonomy, adminItems || []);
  if (!merged || !Array.isArray(merged.units)) return false;

  for (const u of merged.units) {
    const topics = Array.isArray(u.topics) ? u.topics : [];
    if (topics.some((t) => (t.key || "").toLowerCase() === k)) return true;
  }
  return false;
}

module.exports = {
  getMergedTaxonomyBySpecKey,
  mergeTaxonomySync,
  isValidTopicForSpecWithAdmin,
  isValidTopicForSpecWithItems,
  resolveStoredTopicKeyWithAdmin,
  toSlug,
};
