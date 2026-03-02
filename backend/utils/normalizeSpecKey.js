/**
 * Normalize specKey for internal use: accept hyphen or underscore from API/CLI, return underscore.
 * Taxonomy and docs viewer use hyphen (e.g. aqa-gcse-biology); config filenames use underscore (aqa_gcse_biology).
 * Use specKeyForFilename(normalized) to get hyphen form for taxonomy lookup or public filenames.
 */
function normalizeSpecKey(input) {
  if (!input) return "";
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
}

/**
 * Convert normalized (underscore) specKey to hyphen form for taxonomy lookup and docs viewer filenames.
 */
function specKeyForFilename(specKeyNormalized) {
  if (!specKeyNormalized || typeof specKeyNormalized !== "string") return "";
  return String(specKeyNormalized).trim().replace(/_/g, "-");
}

module.exports = normalizeSpecKey;
module.exports.specKeyForFilename = specKeyForFilename;
