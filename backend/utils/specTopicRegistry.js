/**
 * Pattern B: sync registry of admin sub-topics for validation (with static JSON base).
 * Refreshed on startup and after admin taxonomy mutations.
 *
 * Multi-instance / horizontal scaling: each Node process holds its own in-memory Maps.
 * After admin taxonomy writes, only that instance refreshes immediately; other instances
 * stay stale until restart or their next mutation-triggered refresh. Mitigations: (1) sticky
 * sessions to one instance for admin routes, (2) short TTL + periodic refresh (not implemented),
 * (3) restart/redeploy after bulk taxonomy changes. Student-facing validation may briefly
 * disagree across instances until all processes reload (acceptable for rare admin edits).
 */
const AdminTaxonomyItem = require("../models/AdminTaxonomyItem");
const { getTaxonomyBySpecKey } = require("./topicTaxonomy");
const { isValidTopicForSpecWithItems } = require("../services/adminTaxonomyService");

/** @type {Map<string, Array<Object>>} */
let adminSubtopicsBySpec = new Map();
/** @type {Map<string, Map<string, { mapsToCanonicalKey?: string, inheritQuestionBankFrom?: string, inheritAnalyticsFrom?: string }>>} */
let runtimeMappingBySpec = new Map();

function slugKey(slug) {
  return String(slug || "")
    .trim()
    .toLowerCase();
}

/**
 * Reload from DB. Call after Mongo connects and after admin taxonomy CRUD.
 */
async function refreshSpecTopicRegistryCache() {
  const items = await AdminTaxonomyItem.find({ type: "subTopic" }).lean();
  adminSubtopicsBySpec = new Map();
  runtimeMappingBySpec = new Map();
  for (const it of items) {
    const sk = String(it.specKey || "").trim();
    if (!sk) continue;
    if (it.status === "archived") continue;
    if (!adminSubtopicsBySpec.has(sk)) adminSubtopicsBySpec.set(sk, []);
    adminSubtopicsBySpec.get(sk).push(it);
    const slug = slugKey(it.key);
    if (!slug) continue;
    if (!runtimeMappingBySpec.has(sk)) runtimeMappingBySpec.set(sk, new Map());
    runtimeMappingBySpec.get(sk).set(slug, {
      mapsToCanonicalKey: it.mapsToCanonicalKey || "",
      inheritQuestionBankFrom: it.inheritQuestionBankFrom || "",
      inheritAnalyticsFrom: it.inheritAnalyticsFrom || "",
    });
  }
}

/**
 * @param {string} specKey
 * @param {string} topicSlug - non-namespaced slug
 * @returns {boolean}
 */
function isValidTopicSlugForSpec(specKey, topicSlug) {
  const s = String(specKey || "").trim();
  const k = slugKey(topicSlug);
  if (!s || !k) return false;
  const taxonomy = getTaxonomyBySpecKey(s);
  if (!taxonomy) return false;
  // Include both flat unit.topics[] (AQA layout) and section-nested
  // unit.sections[].topics[] (Edexcel IGCSE layout). Mirrors the frontend
  // getUnitTopics() so section leaves are not dropped from validation.
  const staticKeys = (taxonomy.units || []).flatMap((u) => {
    const flat = Array.isArray(u.topics) ? u.topics : [];
    const sectioned = (Array.isArray(u.sections) ? u.sections : []).flatMap((sec) =>
      Array.isArray(sec.topics) ? sec.topics : []
    );
    return [...flat, ...sectioned].map((t) => t.key);
  });
  if (staticKeys.includes(k)) return true;
  const adminItems = adminSubtopicsBySpec.get(s) || [];
  return isValidTopicForSpecWithItems(s, k, adminItems);
}

/**
 * @param {string} specKey
 * @param {string} topicSlug
 */
function getRuntimeMappingForSpecSlug(specKey, topicSlug) {
  const m = runtimeMappingBySpec.get(String(specKey || "").trim());
  if (!m) return null;
  return m.get(slugKey(topicSlug)) || null;
}

module.exports = {
  refreshSpecTopicRegistryCache,
  isValidTopicSlugForSpec,
  getRuntimeMappingForSpecSlug,
};
