/**
 * Trusted teacher reference material — shared by Dashboard (JSON) and SS1 (markdown) generators.
 */

/**
 * @param {string} rawMaterial Teacher-pasted notes, definitions, models, vocabulary.
 * @returns {string} Prompt section, or "" if empty.
 */
function buildReferenceLessonMaterialPrompt(rawMaterial) {
  const raw =
    rawMaterial && typeof rawMaterial === "string" ? rawMaterial.trim() : "";
  if (!raw) return "";

  return `## REFERENCE LESSON MATERIAL (HIGH PRIORITY — TRUSTED TEACHER INPUT)

Use this as trusted teacher-provided reference when building the lesson.

Extract and teach:
- definition
- why it matters
- core model
- exam vocabulary

Do not copy wording verbatim — rewrite in your own tutor voice while preserving factual accuracy.

If any conflict occurs between this reference and other stylistic defaults,
PRIORITISE this reference for factual content, scope, and vocabulary.

---

${raw}

---`;
}

/** @deprecated Use buildReferenceLessonMaterialPrompt — kept for callers during migration. */
function buildAdditionalInstructionsStrong(additionalInstructions) {
  return buildReferenceLessonMaterialPrompt(additionalInstructions);
}

module.exports = {
  buildReferenceLessonMaterialPrompt,
  buildAdditionalInstructionsStrong,
};
