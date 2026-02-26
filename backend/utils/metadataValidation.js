/**
 * PR-METADATA-1: Normalize and validate difficulty, skill, estimatedTimeSec.
 * Throws with .code INVALID_DIFFICULTY | INVALID_SKILL | INVALID_ESTIMATED_TIME.
 */

const SKILLS = ["recall", "application", "analysis", "exam-technique"];

/**
 * @param {*} value
 * @returns {null | number} 1..5 or null
 */
function normalizeDifficulty(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "string" ? parseInt(value, 10) : Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 5) {
    const e = new Error("difficulty must be 1–5");
    e.code = "INVALID_DIFFICULTY";
    throw e;
  }
  return Math.floor(n);
}

/**
 * @param {*} value
 * @returns {null | string} enum or null
 */
function normalizeSkill(value) {
  if (value === undefined || value === null || value === "") return null;
  const s = String(value).trim().toLowerCase();
  if (!SKILLS.includes(s)) {
    const e = new Error(`skill must be one of: ${SKILLS.join(", ")}`);
    e.code = "INVALID_SKILL";
    throw e;
  }
  return s;
}

/**
 * @param {*} value
 * @returns {null | number} positive integer or null
 */
function normalizeEstimatedTimeSec(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "string" ? parseInt(value, 10) : Number(value);
  if (!Number.isFinite(n) || n < 1) {
    const e = new Error("estimatedTimeSec must be a positive integer");
    e.code = "INVALID_ESTIMATED_TIME";
    throw e;
  }
  return Math.floor(n);
}

/**
 * @param {{ difficulty?: *, skill?: *, estimatedTimeSec?: * }} obj
 * @returns {{ difficulty: number|null, skill: string|null, estimatedTimeSec: number|null }}
 */
function normalizeMetadata(obj) {
  if (!obj || typeof obj !== "object") {
    return { difficulty: null, skill: null, estimatedTimeSec: null };
  }
  const out = { difficulty: null, skill: null, estimatedTimeSec: null };
  try {
    out.difficulty = normalizeDifficulty(obj.difficulty);
  } catch (_) {
    throw _;
  }
  try {
    out.skill = normalizeSkill(obj.skill);
  } catch (_) {
    throw _;
  }
  try {
    out.estimatedTimeSec = normalizeEstimatedTimeSec(obj.estimatedTimeSec);
  } catch (_) {
    throw _;
  }
  return out;
}

module.exports = {
  SKILLS,
  normalizeDifficulty,
  normalizeSkill,
  normalizeEstimatedTimeSec,
  normalizeMetadata,
};
