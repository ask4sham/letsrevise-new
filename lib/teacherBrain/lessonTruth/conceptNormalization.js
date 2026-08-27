/**
 * Subject-agnostic concept normalization for Lesson Truth.
 */

function safeStr(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}

/**
 * @param {string} label
 * @returns {string}
 */
function normalizeConceptId(label) {
  const slug = safeStr(label)
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, " ")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return slug.slice(0, 80) || "concept";
}

/**
 * @param {string} label
 * @returns {string[]}
 */
function deriveMatchTerms(label) {
  const name = safeStr(label);
  if (!name) return [];
  const lower = name.toLowerCase();
  const terms = new Set([lower]);
  const withoutParens = lower.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  if (withoutParens && withoutParens !== lower) terms.add(withoutParens);
  return [...terms].filter(Boolean).sort();
}

/**
 * @param {string} label
 * @param {object} [options]
 * @param {string} [options.id]
 * @param {string[]} [options.matchTerms]
 * @returns {import("./types").ConceptRef}
 */
function cleanConceptLabel(label) {
  return safeStr(label).replace(/^\*+|\*+$/g, "").trim();
}

function createConceptRef(label, options = {}) {
  const name = cleanConceptLabel(label);
  const id = safeStr(options.id) || normalizeConceptId(name);
  const matchTerms = [
    ...new Set([...(options.matchTerms || []), ...deriveMatchTerms(name)].map((t) => safeStr(t).toLowerCase())),
  ]
    .filter(Boolean)
    .sort();
  return { id, name: name || id, matchTerms };
}

/**
 * @param {import("./types").ConceptRef[]} refs
 * @returns {import("./types").ConceptRef[]}
 */
function dedupeConceptRefs(refs) {
  const byId = new Map();
  for (const ref of refs || []) {
    if (!ref?.id) continue;
    const existing = byId.get(ref.id);
    if (!existing) {
      byId.set(ref.id, {
        id: ref.id,
        name: ref.name || ref.id,
        matchTerms: [...(ref.matchTerms || [])],
      });
      continue;
    }
    if (!existing.name && ref.name) existing.name = ref.name;
    existing.matchTerms = [...new Set([...(existing.matchTerms || []), ...(ref.matchTerms || [])])].sort();
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function textMentionsConcept(text, conceptRef) {
  const hay = safeStr(text).toLowerCase();
  if (!hay) return false;
  for (const term of conceptRef.matchTerms || []) {
    if (term && hay.includes(term)) return true;
  }
  return hay.includes(conceptRef.name.toLowerCase());
}

module.exports = {
  safeStr,
  cleanConceptLabel,
  normalizeConceptId,
  deriveMatchTerms,
  createConceptRef,
  dedupeConceptRefs,
  textMentionsConcept,
};
