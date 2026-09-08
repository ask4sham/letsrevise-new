/**
 * Block 28 Phase 2 — per-lesson batch review pack builder (read-only).
 */
const { deriveLessonContentBoundary } = require("./lessonContentBoundary");
const { auditLessonAttachments } = require("./lessonAttachmentAudit");
const { classifyAttachments, proposeFinalSet, findRankedConceptualOverlaps, SELECTION } = require("./selectionEngine");
const { proposeRetainedRepair, MARK_DEMAND } = require("./repairProposals");
const { analyzeCoverageGaps } = require("./coverageAnalysis");
const { findConceptualOverlapPairs, maxOverlapRiskForQuestion } = require("./conceptualOverlap");
const { SCHEME_STATUS, SEMANTIC_READINESS, isGenericFillerPoint } = require("./schemeQuality");

const PACK_STATUS = Object.freeze({
  READY_FOR_HUMAN_REVIEW: "READY_FOR_HUMAN_REVIEW",
  NEEDS_TOOL_REVIEW: "NEEDS_TOOL_REVIEW",
  NEEDS_CONTENT_REVIEW: "NEEDS_CONTENT_REVIEW",
  BLOCKED_BY_DUPLICATION: "BLOCKED_BY_DUPLICATION",
  BLOCKED_BY_SCHEME_QUALITY: "BLOCKED_BY_SCHEME_QUALITY",
});

function dedupeOverlapPairs(pairs) {
  const seen = new Set();
  return (pairs || []).filter((p) => {
    const key = [p.questionIdA, p.questionIdB].sort().join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function countHighPairs(pairs) {
  return (pairs || []).filter((p) => p.severity === "HIGH").length;
}

function resolvePackStatus(summary) {
  const unresolvedHigh = summary.unresolvedHighPairs ?? summary.finalSetHighPairs ?? 0;
  if (unresolvedHigh > 0) return PACK_STATUS.BLOCKED_BY_DUPLICATION;
  if (summary.unresolvedSchemeCount > 0 || summary.genericFillerCount > 0) {
    return PACK_STATUS.BLOCKED_BY_SCHEME_QUALITY;
  }
  if (summary.semanticReviewRequiredCount > 0 || summary.borderlineCount > 0) {
    return PACK_STATUS.NEEDS_CONTENT_REVIEW;
  }
  if (summary.semanticFailCount > 0) return PACK_STATUS.NEEDS_TOOL_REVIEW;
  return PACK_STATUS.READY_FOR_HUMAN_REVIEW;
}

/**
 * @param {object} lesson
 * @param {Map<string, object>} mastersById
 * @param {Map<string, number>} usageCount
 */
function buildLessonReviewPack(lesson, mastersById, usageCount) {
  const boundary = deriveLessonContentBoundary(lesson);
  const audit = auditLessonAttachments(lesson, mastersById, usageCount);
  const { classified, duplicatePairs } = classifyAttachments(audit, boundary);
  const selectionResult = proposeFinalSet(classified, boundary);
  const finalSelected = selectionResult.selected;

  const preSelectionPairs = dedupeOverlapPairs(findRankedConceptualOverlaps(audit, boundary));
  const finalSetPairs = dedupeOverlapPairs(findConceptualOverlapPairs(finalSelected));
  const unresolvedHighPairs = finalSetPairs.filter((p) => p.severity === "HIGH");

  const repairs = finalSelected.map((row) => {
    const overlapRisk = maxOverlapRiskForQuestion(row.questionId, finalSetPairs);
    const repair = proposeRetainedRepair(row, {
      overlapRisk,
      highOverlapInSet: overlapRisk === "HIGH",
    });
    return { ...repair, proposedStudentPosition: row.proposedStudentPosition };
  });

  const excess = classified.filter((c) => c.selection === SELECTION.DETACH_EXCESS);
  const coverage = analyzeCoverageGaps(boundary, repairs, excess);

  const allDupPairs = [
    ...duplicatePairs,
    ...preSelectionPairs.map((p) => ({
      questionIdA: p.questionIdA,
      questionIdB: p.questionIdB,
      severity: p.severity,
      similarity: p.similarity,
      reason: p.reason,
      scope: "pre_selection",
    })),
    ...finalSetPairs.map((p) => ({
      questionIdA: p.questionIdA,
      questionIdB: p.questionIdB,
      severity: p.severity,
      similarity: p.similarity,
      reason: p.reason,
      scope: "final_set",
    })),
  ];

  const detachments = classified.filter(
    (c) =>
      c.selection === SELECTION.DETACH_UNSUPPORTED ||
      c.selection === SELECTION.DETACH_DUPLICATE ||
      c.selection === SELECTION.DETACH_EXCESS ||
      c.selection === SELECTION.REJECT_CONTENT
  );

  const sharedMasterRisks = repairs
    .map((r) => {
      const att = classified.find((c) => c.questionId === r.questionId);
      return att && (att.usageCount || 0) > 1
        ? { questionId: r.questionId, usageCount: att.usageCount, proposedStudentPosition: r.proposedStudentPosition }
        : null;
    })
    .filter(Boolean);

  const newMasterProposals = coverage.gapProposals.filter((g) => g.recommendation.type === "NEW_MASTER_REQUIRED");

  const borderlineCount = repairs.filter((r) => r.markDemand?.verdict === MARK_DEMAND.BORDERLINE).length;
  const artificiallyPaddedCount = repairs.filter((r) => r.markDemand?.verdict === MARK_DEMAND.ARTIFICIALLY_PADDED).length;
  const semanticFailCount = repairs.filter((r) => r.semanticReadiness === SEMANTIC_READINESS.FAIL).length;
  const semanticReviewRequiredCount = repairs.filter(
    (r) => r.semanticReadiness === SEMANTIC_READINESS.REVIEW_REQUIRED
  ).length;
  const unresolvedSchemeCount = repairs.filter((r) => r.schemeStatus === SCHEME_STATUS.HUMAN_REVIEW_REQUIRED).length;
  const genericFillerCount = repairs.reduce(
    (n, r) => n + (r.proposedScheme || []).filter(isGenericFillerPoint).length,
    0
  );

  const overlapMetrics = {
    preSelectionHighPairs: countHighPairs(preSelectionPairs),
    finalSetHighPairs: countHighPairs(finalSetPairs),
    unresolvedHighPairs: unresolvedHighPairs.length,
    preSelectionPairs,
    finalSetPairs,
    unresolvedPairs: unresolvedHighPairs,
  };

  const qualitySummary = {
    preSelectionHighPairs: overlapMetrics.preSelectionHighPairs,
    finalSetHighPairs: overlapMetrics.finalSetHighPairs,
    unresolvedHighPairs: overlapMetrics.unresolvedHighPairs,
    highOverlapCount: overlapMetrics.unresolvedHighPairs,
    mediumOverlapCount: finalSetPairs.filter((p) => p.severity === "MEDIUM").length,
    borderlineCount,
    artificiallyPaddedCount,
    semanticFailCount,
    semanticReviewRequiredCount,
    unresolvedSchemeCount,
    genericFillerCount,
    heuristicFillerCount: genericFillerCount,
    invariantPassCount: repairs.filter((r) => r.invariantPass).length,
    totalProposed: repairs.length,
  };

  const packStatus = resolvePackStatus(qualitySummary);

  const futureWritePlan = {
    existingMasterUpdates: repairs.filter((r) => r.questionId).length,
    newMasterInserts: newMasterProposals.length,
    lessonAttachmentRebuild: true,
    detachCount: detachments.length,
    finalAttachmentCount: repairs.length,
  };

  const genericPack = {
    lessonId: String(lesson._id),
    lessonTitle: lesson.title,
    topicKey: lesson.topicKey || lesson.canonicalTopicKey,
    packStatus,
    selectionNote: selectionResult.selectionNote,
    belowRecommendedSetSize: selectionResult.belowRecommendedSize,
    lessonContentBoundary: boundary,
    overlapMetrics,
    audit: {
      rawAttachmentCount: audit.rawAttachmentCount,
      supportedCount: audit.supportedCount,
      unsupportedCount: audit.unsupportedCount,
      servedCount: audit.servedCount,
      servedInvalidCount: audit.servedInvalidCount,
      attachments: audit.attachments,
    },
    classified,
    duplicatePairs: allDupPairs,
    conceptualOverlapPairs: finalSetPairs,
    preSelectionOverlapPairs: preSelectionPairs,
    proposedFinalSet: repairs,
    proposedDetachments: detachments,
    coverage,
    sharedMasterRisks,
    newMasterProposals,
    futureWritePlan,
    qualitySummary,
  };

  const { applyGoldenAuthoritativeOverride } = require("./goldenBulkReview");
  const { pack } = applyGoldenAuthoritativeOverride(lesson, genericPack, mastersById);
  return pack;
}

module.exports = {
  PACK_STATUS,
  buildLessonReviewPack,
  resolvePackStatus,
  dedupeOverlapPairs,
  countHighPairs,
};

