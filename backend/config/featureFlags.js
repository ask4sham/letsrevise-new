/**
 * PR-007: Feature flags for AI Tutor rollout.
 * AI_TUTOR_ENABLED_SPECS: comma-separated specKeys (e.g. aqa-gcse-biology,edexcel-gcse-chemistry)
 */

function normalizeSpecKey(specKey) {
  if (specKey == null || typeof specKey !== "string") return "";
  return String(specKey)
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

let _enabledSpecs = null;

function getEnabledSpecs() {
  if (_enabledSpecs !== null) return _enabledSpecs;
  const raw = process.env.AI_TUTOR_ENABLED_SPECS || "";
  _enabledSpecs = raw
    .split(",")
    .map((s) => s.trim().toLowerCase().replace(/_/g, "-"))
    .filter(Boolean);
  return _enabledSpecs;
}

/**
 * Check if AI Tutor is enabled for the given specKey.
 * @param {string} specKey - e.g. "AQA_GCSE_BIOLOGY" or "aqa-gcse-biology"
 * @returns {boolean}
 */
function isAiTutorEnabledForSpec(specKey) {
  const normalized = normalizeSpecKey(specKey);
  if (!normalized) return false;
  const specs = getEnabledSpecs();
  return specs.includes(normalized);
}

module.exports = {
  isAiTutorEnabledForSpec,
  getEnabledSpecs,
  normalizeSpecKey,
};
