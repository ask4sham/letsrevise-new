/**
 * Block 28 Phase 2 — batch review pack orchestrator (read-only).
 */
const { buildEdexcelBioReviewQueue } = require("./lessonQueue");
const { buildLessonReviewPack, PACK_STATUS } = require("./batchReviewPack");
const { buildBatchReviewMarkdown } = require("./reviewPackMarkdown");
const { isNoiseToken } = require("./coverageGapFilter");

/**
 * @param {object} opts
 * @param {object} opts.census - parsed remediation queue JSON
 * @param {Function} opts.fetchLessonById - async (id) => lesson with pages
 * @param {Function} opts.fetchMastersByIds - async (ids) => Map
 * @param {Function} opts.fetchUsageCounts - async () => Map<string, number>
 * @param {number} [opts.batchIndex=1]
 * @param {number} [opts.batchSize=5]
 */
async function generateEdexcelBioReviewBatch(opts) {
  const { census, fetchLessonById, fetchMastersByIds, fetchUsageCounts, batchIndex = 1, batchSize = 5 } =
    opts;

  const queue = buildEdexcelBioReviewQueue(census, { batchIndex, batchSize });
  const usageCount = await fetchUsageCounts();
  const packs = [];

  for (const row of queue.batch) {
    const lesson = await fetchLessonById(row.lessonId);
    if (!lesson) {
      packs.push({
        lessonId: row.lessonId,
        lessonTitle: row.title,
        error: "LESSON_NOT_FOUND",
        packStatus: PACK_STATUS.NEEDS_TOOL_REVIEW,
      });
      continue;
    }
    const refs = lesson.examQuestions || [];
    const masterIds = refs.map((r) => String(r.questionId));
    const mastersById = await fetchMastersByIds(masterIds);
    const pack = buildLessonReviewPack(lesson, mastersById, usageCount);
    pack.censusRow = row;
    packs.push(pack);
  }

  const batchMeta = {
    generatedAt: new Date().toISOString(),
    mode: "READ_ONLY",
    spec: "edexcel-igcse-biology",
    batchIndex: queue.batchIndex,
    batchSize: queue.batchSize,
    totalBatches: Math.ceil(queue.totalMarkingInvalidLessons / queue.batchSize),
    excludedLessonIds: queue.excludedLessonIds,
    totalMarkingInvalidLessons: queue.totalMarkingInvalidLessons,
    lessonIds: queue.batch.map((r) => r.lessonId),
    lessonTitles: queue.batch.map((r) => r.title),
    databaseWritesPerformed: 0,
  };

  const markdown = buildBatchReviewMarkdown(batchMeta, packs.filter((p) => !p.error));

  const summary = {
    currentServedInvalidTotal: packs.reduce((n, p) => n + (p.audit?.servedInvalidCount || 0), 0),
    proposedRetainedRepairCount: packs.reduce((n, p) => n + (p.proposedFinalSet?.length || 0), 0),
    proposedDetachCount: packs.reduce((n, p) => n + (p.proposedDetachments?.length || 0), 0),
    newMasterProposals: packs.reduce((n, p) => n + (p.newMasterProposals?.length || 0), 0),
    noiseGapProposals: packs.reduce(
      (n, p) =>
        n + (p.coverage?.gapProposals || []).filter((g) => isNoiseToken(String(g.gap || ""))).length,
      0
    ),
    genericFillerCount: packs.reduce((n, p) => n + (p.qualitySummary?.genericFillerCount || 0), 0),
    heuristicFillerCount: packs.reduce((n, p) => n + (p.qualitySummary?.heuristicFillerCount || 0), 0),
    preSelectionHighPairCount: packs.reduce((n, p) => n + (p.qualitySummary?.preSelectionHighPairs || 0), 0),
    finalSetHighPairCount: packs.reduce((n, p) => n + (p.qualitySummary?.finalSetHighPairs || 0), 0),
    unresolvedHighPairCount: packs.reduce((n, p) => n + (p.qualitySummary?.unresolvedHighPairs || 0), 0),
    highOverlapPairCount: packs.reduce((n, p) => n + (p.qualitySummary?.unresolvedHighPairs || 0), 0),
    borderlineMarkDemandCount: packs.reduce((n, p) => n + (p.qualitySummary?.borderlineCount || 0), 0),
    semanticPassCount: packs.reduce(
      (n, p) => n + (p.proposedFinalSet || []).filter((q) => q.semanticReadiness === "PASS").length,
      0
    ),
    semanticReviewRequiredCount: packs.reduce(
      (n, p) => n + (p.qualitySummary?.semanticReviewRequiredCount || 0),
      0
    ),
    sharedMasterRiskCount: packs.reduce((n, p) => n + (p.sharedMasterRisks?.length || 0), 0),
    highOverlapLessons: packs
      .filter((p) => (p.qualitySummary?.unresolvedHighPairs || 0) > 0)
      .map((p) => p.lessonTitle),
    artificiallyPaddedCount: packs.reduce((n, p) => n + (p.qualitySummary?.artificiallyPaddedCount || 0), 0),
    semanticFailCount: packs.reduce((n, p) => n + (p.qualitySummary?.semanticFailCount || 0), 0),
    packStatuses: packs.map((p) => ({ lessonTitle: p.lessonTitle, packStatus: p.packStatus })),
    readyForHumanReview: packs.every((p) => p.packStatus === PACK_STATUS.READY_FOR_HUMAN_REVIEW && !p.error),
  };

  return {
    batchMeta,
    packs,
    markdown,
    summary,
    databaseWritesPerformed: 0,
  };
}

module.exports = {
  generateEdexcelBioReviewBatch,
};
