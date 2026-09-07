/**
 * Block 28 Phase 2 — deterministic Edexcel IGCSE Biology lesson queue from census.
 */
const VARIATION_PILOT_LESSON_ID = "6a859bcebac845d194489029";
const MUTATION_LESSON_ID = "6a9198c765e15e080aee9ad9";
const ALLELES_LESSON_ID = "6a70fcaeffc00db240652548";
const EDEXCEL_BIO_PREFIX = "edexcel-igcse-biology:";

/**
 * @param {object} census - parsed .tmp-block28-production-remediation-queue-v2.json
 * @param {object} [opts]
 * @param {number} [opts.batchSize=5]
 * @param {number} [opts.batchIndex=1] - 1-based
 */
function buildEdexcelBioReviewQueue(census, opts = {}) {
  const batchSize = opts.batchSize ?? 5;
  const batchIndex = opts.batchIndex ?? 1;

  const queue = (census?.edexcelIgcseBiology?.priorityQueue || [])
    .filter((row) => String(row.topicKey || "").startsWith(EDEXCEL_BIO_PREFIX))
    .filter((row) => row.lessonId !== VARIATION_PILOT_LESSON_ID)
    .filter((row) => row.lessonId !== MUTATION_LESSON_ID)
    .filter((row) => row.lessonId !== ALLELES_LESSON_ID)
    .filter((row) => Number(row.currentServedInvalid) > 0);

  const sorted = [...queue].sort((a, b) => {
    const invDiff = Number(b.currentServedInvalid) - Number(a.currentServedInvalid);
    if (invDiff !== 0) return invDiff;
    const titleDiff = String(a.title || "").localeCompare(String(b.title || ""));
    if (titleDiff !== 0) return titleDiff;
    return String(a.lessonId).localeCompare(String(b.lessonId));
  });

  const start = (batchIndex - 1) * batchSize;
  const batch = sorted.slice(start, start + batchSize);

  return {
    spec: "edexcel-igcse-biology",
    excludedLessonIds: [VARIATION_PILOT_LESSON_ID, MUTATION_LESSON_ID, ALLELES_LESSON_ID],
    totalMarkingInvalidLessons: sorted.length,
    batchSize,
    batchIndex,
    batch,
    allSortedIds: sorted.map((r) => r.lessonId),
  };
}

module.exports = {
  VARIATION_PILOT_LESSON_ID,
  MUTATION_LESSON_ID,
  ALLELES_LESSON_ID,
  EDEXCEL_BIO_PREFIX,
  buildEdexcelBioReviewQueue,
};
