/**
 * Deterministic canonical serialization and hashing for Lesson Truth semantic payloads.
 */

const crypto = require("crypto");

/**
 * Locale-independent string comparator for deterministic ordering.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function compareStrings(a, b) {
  const left = String(a ?? "");
  const right = String(b ?? "");
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * Stable JSON with sorted object keys (arrays preserve order).
 * @param {unknown} value
 * @returns {string}
 */
function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

/**
 * @param {string} raw
 * @returns {string}
 */
function sha256Hex(raw) {
  return crypto.createHash("sha256").update(String(raw || ""), "utf8").digest("hex");
}

/**
 * Sort arrays whose order is not pedagogically meaningful.
 * @param {import("./types").LessonTruthSemantic} semantic
 * @returns {import("./types").LessonTruthSemantic}
 */
function canonicalizeSemantic(semantic) {
  const copy = JSON.parse(JSON.stringify(semantic || {}));

  const sortById = (arr, idKey = "id") =>
    [...(arr || [])].sort((a, b) => compareStrings(a?.[idKey], b?.[idKey]));

  copy.requiredConcepts = sortById(copy.requiredConcepts).map((c) => ({
    ...c,
    matchTerms: [...(c.matchTerms || [])].sort(),
  }));
  copy.supportingConcepts = sortById(copy.supportingConcepts).map((c) => ({
    ...c,
    matchTerms: [...(c.matchTerms || [])].sort(),
  }));
  copy.outOfScopeConcepts = sortById(copy.outOfScopeConcepts).map((c) => ({
    ...c,
    matchTerms: [...(c.matchTerms || [])].sort(),
  }));
  copy.assessmentExclusions = sortById(copy.assessmentExclusions).map((c) => ({
    ...c,
    matchTerms: [...(c.matchTerms || [])].sort(),
  }));
  copy.vocabulary = [...(copy.vocabulary || [])].sort(compareStrings);
  copy.taughtEvidence = [...(copy.taughtEvidence || [])].sort((a, b) => {
    const pageCmp = (a.pageIndex || 0) - (b.pageIndex || 0);
    if (pageCmp !== 0) return pageCmp;
    return compareStrings(a.evidenceId, b.evidenceId);
  });
  copy.taughtEvidence = copy.taughtEvidence.map((ev) => ({
    ...ev,
    conceptIds: [...(ev.conceptIds || [])].sort(),
    objectiveIds: [...(ev.objectiveIds || [])].sort(),
    matchTerms: [...(ev.matchTerms || [])].sort(),
  }));
  copy.misconceptions = sortById(copy.misconceptions);
  copy.authorityConflicts = sortById(copy.authorityConflicts, "conflictId");
  copy.learningObjectives = [...(copy.learningObjectives || [])].sort((a, b) =>
    compareStrings(a.objectiveId, b.objectiveId)
  );
  copy.learningObjectives = copy.learningObjectives.map((obj) => ({
    ...obj,
    matchTerms: [...(obj.matchTerms || [])].sort(),
  }));

  return copy;
}

/**
 * @param {import("./types").LessonTruthSemantic} semantic
 * @returns {string}
 */
function hashSemantic(semantic) {
  return sha256Hex(stableStringify(canonicalizeSemantic(semantic)));
}

/**
 * @param {object} normalizedInput
 * @returns {string}
 */
function hashLessonInput(normalizedInput) {
  return sha256Hex(stableStringify(normalizedInput));
}

/**
 * @param {import("./types").LessonTruthSemantic} a
 * @param {import("./types").LessonTruthSemantic} b
 * @returns {boolean}
 */
function semanticEquals(a, b) {
  return stableStringify(canonicalizeSemantic(a)) === stableStringify(canonicalizeSemantic(b));
}

module.exports = {
  compareStrings,
  stableStringify,
  sha256Hex,
  canonicalizeSemantic,
  hashSemantic,
  hashLessonInput,
  semanticEquals,
};
