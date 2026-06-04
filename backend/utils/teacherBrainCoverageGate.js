/**
 * Teacher Brain Phase 4 — coverage gate helpers for backend routes/services.
 * Re-exports lib/teacherBrain/coverageGatedGeneration (tracked path; not under services/coverage/).
 */
const {
  createCoverageGenerationGate,
  createCoverageGateFromLesson,
  planCoverageGatedQuestion,
  planCoverageGatedQuestionBatch,
  formatCoveragePlanForPrompt,
  attachCoverageMetadata,
  prependCoverageDirectiveToPrompt,
} = require("../../lib/teacherBrain/coverageGatedGeneration");

module.exports = {
  createCoverageGenerationGate,
  createCoverageGateFromLesson,
  planCoverageGatedQuestion,
  planCoverageGatedQuestionBatch,
  formatCoveragePlanForPrompt,
  attachCoverageMetadata,
  prependCoverageDirectiveToPrompt,
};
