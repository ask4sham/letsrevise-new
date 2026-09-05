/**
 * Block 28 Phase 2 — read-only dry-run orchestrator.
 */
const fs = require("fs");
const path = require("path");
const { buildP1Manifest } = require("./p1Manifest");
const { classifyManifestMasters } = require("./classifyRepair");
const { runMarkSchemeProposal } = require("./proposalRunner");
const { simulateRepairImpact } = require("./practiceSimulator");
const { buildSharedMasterImpactReport } = require("./sharedMasterReport");
const { captureMutationGoldenState, MUTATION_LESSON_ID } = require("./mutationGoldenCapture");
const { buildHumanReviewArtefact } = require("./humanReviewArtefact");
const { buildDryRunReport } = require("./dryRunReport");
const { REPAIR_CLASS } = require("./constants");

/**
 * @param {object} opts
 * @param {Function} opts.fetchLessons
 * @param {Function} opts.fetchMastersByIds
 * @param {Function} [opts.fetchLessonById]
 * @param {Function} [opts.generateProposal] - async LLM for REGENERATE_MARK_SCHEME only
 * @param {number} [opts.proposalSampleLimit=0] - 0 = no AI proposals
 * @param {boolean} [opts.enforceExpectedCensus=true]
 * @param {string} [opts.artefactDir] - defaults to repo root
 * @param {boolean} [opts.writeArtefacts=true]
 */
async function runPhase2DryRun(opts) {
  const {
    fetchLessons,
    fetchMastersByIds,
    fetchLessonById,
    generateProposal,
    proposalSampleLimit = 0,
    enforceExpectedCensus = true,
    artefactDir = path.join(__dirname, "../../.."),
    writeArtefacts = true,
  } = opts;

  const manifest = await buildP1Manifest({
    fetchLessons,
    fetchMastersByIds,
    enforceExpectedCensus,
  });

  const classifiedMasters = classifyManifestMasters(manifest.masters);

  const lessons = await fetchLessons();
  const lessonsById = new Map(lessons.map((l) => [String(l._id), l]));

  const allMasterIds = classifiedMasters.map((m) => m.questionId);
  const mastersById = await fetchMastersByIds(allMasterIds);

  const proposals = [];
  const simulations = {};
  let proposalBudget = proposalSampleLimit;

  for (const master of classifiedMasters) {
    if (
      proposalBudget > 0 &&
      master.repairClassification === REPAIR_CLASS.REGENERATE_MARK_SCHEME &&
      generateProposal
    ) {
      const proposalResult = await runMarkSchemeProposal(master, { generate: generateProposal });
      master.proposal = proposalResult;
      master.qualityGates = proposalResult.qualityGates || null;
      proposals.push({ questionId: master.questionId, ...proposalResult });
      proposalBudget -= 1;

      if (
        proposalResult.proposal?.proposedMarkScheme &&
        proposalResult.qualityGates?.deterministicPass
      ) {
        const masterDoc = mastersById.get(master.questionId);
        simulations[master.questionId] = simulateRepairImpact({
          master: { ...masterDoc, questionId: master.questionId },
          proposedMarkScheme: proposalResult.proposal.proposedMarkScheme,
          lessonsById,
          mastersById,
        });
        master.simulation = simulations[master.questionId];
      }
    }
  }

  const sharedMasterReport = buildSharedMasterImpactReport(classifiedMasters, simulations);

  let mutationGolden = null;
  if (fetchLessonById) {
    const mutationLesson = await fetchLessonById(MUTATION_LESSON_ID);
    if (mutationLesson) {
      const mutationMasterIds = (mutationLesson.examQuestions || []).map((r) =>
        String(r.questionId)
      );
      const mutationMasters = await fetchMastersByIds(mutationMasterIds);
      mutationGolden = captureMutationGoldenState(mutationLesson, mutationMasters);
    }
  }

  const humanReview = buildHumanReviewArtefact(classifiedMasters);

  const dryRunReport = buildDryRunReport({
    manifest,
    classifiedMasters,
    proposals,
    simulations,
    sharedMasterReport,
    mutationGolden,
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const artefacts = {
    manifestPath: path.join(artefactDir, `.tmp-phase2-p1-manifest-${timestamp}.json`),
    reviewPath: path.join(artefactDir, `.tmp-phase2-human-review-${timestamp}.md`),
    reportPath: path.join(artefactDir, `.tmp-phase2-dry-run-report-${timestamp}.json`),
  };

  const output = {
    manifest: { ...manifest, masters: classifiedMasters },
    humanReview,
    dryRunReport,
    mutationGolden,
    artefacts,
    databaseWritesPerformed: 0,
  };

  if (writeArtefacts) {
    fs.writeFileSync(artefacts.manifestPath, JSON.stringify(output.manifest, null, 2));
    fs.writeFileSync(artefacts.reviewPath, humanReview.markdown);
    fs.writeFileSync(artefacts.reportPath, JSON.stringify(dryRunReport, null, 2));
  }

  return output;
}

module.exports = {
  runPhase2DryRun,
  MUTATION_LESSON_ID,
  REPAIR_CLASS,
};
