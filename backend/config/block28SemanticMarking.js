/**
 * Block 28 Semantic Short-Answer Marking — feature flags.
 */

function parseSpecList(raw) {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim().toLowerCase().replace(/_/g, "-"))
    .filter(Boolean);
}

function normalizeSpecKey(specKey) {
  if (specKey == null || typeof specKey !== "string") return "";
  return String(specKey).trim().toLowerCase().replace(/_/g, "-");
}

function isTruthyEnv(name) {
  const v = process.env[name];
  return v === "1" || String(v || "").toLowerCase() === "true";
}

function getSemanticMarkingEnabledSpecs() {
  return parseSpecList(process.env.BLOCK28_SEMANTIC_MARKING_SPECS || "");
}

/**
 * Global semantic marking flag. When scoped specs are set, lesson spec must match.
 * @param {string} [lessonSpecKey]
 */
function isBlock28SemanticMarkingEnabled(lessonSpecKey) {
  if (!isTruthyEnv("BLOCK28_SEMANTIC_MARKING_V1")) return false;
  const scoped = getSemanticMarkingEnabledSpecs();
  if (scoped.length === 0) return true;
  const normalized = normalizeSpecKey(lessonSpecKey);
  if (!normalized) return false;
  return scoped.includes(normalized);
}

function getSemanticMarkingModel() {
  return (
    String(process.env.BLOCK28_SEMANTIC_MARKING_MODEL || process.env.LLM_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini").trim() ||
    "gpt-4o-mini"
  );
}

function getSemanticMarkingTimeoutMs() {
  const raw = process.env.BLOCK28_SEMANTIC_MARKING_TIMEOUT_MS;
  const n = raw != null ? parseInt(String(raw), 10) : 18000;
  return Number.isFinite(n) && n >= 3000 ? Math.min(n, 60000) : 18000;
}

module.exports = {
  isBlock28SemanticMarkingEnabled,
  getSemanticMarkingEnabledSpecs,
  getSemanticMarkingModel,
  getSemanticMarkingTimeoutMs,
  normalizeSpecKey,
};
