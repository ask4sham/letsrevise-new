/**
 * Block 28 Phase 2 — dry-run summary report (read-only).
 */

function buildDryRunReport({
  manifest,
  classifiedMasters,
  proposals = [],
  simulations = {},
  sharedMasterReport = [],
  mutationGolden = null,
}) {
  const classificationCounts = {};
  for (const m of classifiedMasters) {
    const c = m.repairClassification || "UNCLASSIFIED";
    classificationCounts[c] = (classificationCounts[c] || 0) + 1;
  }

  const attempted = proposals.filter((p) => p.attempted);
  const structurallyValid = attempted.filter((p) => p.proposalStatus === "structurally_valid");
  const needsReview = attempted.filter((p) => p.proposalStatus === "needs_review");
  const noSafe = attempted.filter((p) => p.proposalStatus === "no_safe_proposal");

  const currentMismatches = manifest?.census?.effectiveMismatchedAttachments ?? 0;

  let hypotheticalResolved = 0;
  for (const master of classifiedMasters) {
    const sim = simulations[master.questionId];
    if (sim?.allMismatchesResolved) hypotheticalResolved += 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    label: "BLOCK 28 PHASE 2 DRY-RUN REPORT",
    noDatabaseWritesPerformed: true,
    census: manifest?.census ?? null,
    censusDrift: manifest?.censusDrift ?? null,
    manifestFinalized: manifest?.finalized ?? false,
    totals: {
      p1Masters: classifiedMasters.length,
      classificationCounts,
      aiProposalsAttempted: attempted.length,
      proposalsStructurallyPassing: structurallyValid.length,
      proposalsNeedingReview: needsReview.length,
      proposalsNoSafeProposal: noSafe.length,
      sharedMasters: classifiedMasters.filter((m) => m.sharedMasterWarning).length,
      lessonsAffected: manifest?.census?.publishedLessons ?? 0,
      currentEffectiveMismatches: currentMismatches,
      hypotheticalMastersResolvedIfAllApproved: hypotheticalResolved,
      hypotheticalRemainingMismatches:
        currentMismatches - hypotheticalResolved > 0
          ? `approx ${currentMismatches} attachment instances (not all masters may resolve all refs)`
          : 0,
    },
    sharedMasterReport,
    mutationGoldenCapture: mutationGolden,
    futurePilotOrder: [
      "dry-run tooling (this task)",
      "sandbox technical write/rollback pilot",
      "sandbox P1 content pilot",
      "small P4 production technical pilot",
      "small P1 production pilot",
      "scale P1",
      "P2",
      "P4 remainder",
      "unsupported composite cleanup",
    ],
  };
}

module.exports = { buildDryRunReport };
