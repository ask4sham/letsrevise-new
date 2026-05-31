/**
 * Lesson architecture diagnostics (dev mode).
 */

const { validateLessonArchitecture } = require("./lessonArchitectureValidator");
const { computeLessonFlowScore } = require("./lessonFlowScore");
const { auditDuplication } = require("./duplicationAuditor");
const { analyzeActivitySpacing } = require("./activitySpacingEngine");
const { buildLessonArchitectureFromBlueprint } = require("./lessonArchitectureEngine");
const {
  flattenPagesToBlocks,
  classifyBlockToArchitectureSlot,
} = require("./lessonBlockAnalysis");

/**
 * @param {object[]} pages
 * @param {object} [blueprint]
 */
function runLessonArchitectureDiagnostics(pages, blueprint = null) {
  const blocks = flattenPagesToBlocks(pages);
  const arch = validateLessonArchitecture(pages, blueprint);
  const flow = computeLessonFlowScore(pages, { blueprint });
  const dup = auditDuplication(pages);
  const spacing = analyzeActivitySpacing(pages);

  const detectedStructure = blocks.map((block, index) => ({
    index,
    type: block.type,
    role: block.role,
    slot: classifyBlockToArchitectureSlot(block),
    title: block.title || "",
  }));

  const duplicateConcepts = dup.semanticFlags.map((f) => ({
    duplicateConcept: f.duplicateConcept,
    duplicateBlocks: f.duplicateBlocks,
    similarity: f.similarity,
  }));

  return {
    detectedStructure,
    missingBlocks: arch.missingBlocks,
    rhythmViolations: arch.rhythm?.violations || [],
    duplicateConcepts,
    exactDuplicates: dup.exactDuplicates,
    activitySpacingWarnings: spacing.warnings,
    flowScore: {
      overallFlowScore: flow.overallFlowScore,
      architectureScore: flow.architectureScore,
      retrievalScore: flow.retrievalScore,
      activityPlacementScore: flow.activityPlacementScore,
      duplicationScore: flow.duplicationScore,
      examReadinessScore: flow.examReadinessScore,
    },
    examReadiness: flow.details.exam,
    mandatoryArchitecture: blueprint
      ? buildLessonArchitectureFromBlueprint(blueprint).lessonArchitecture.map((s) => s.slot)
      : null,
    valid: arch.valid && flow.overallFlowScore >= 70,
  };
}

module.exports = {
  runLessonArchitectureDiagnostics,
};
