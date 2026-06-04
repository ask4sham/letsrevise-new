/**
 * Shared coverage planning for lesson-asset LLM calls.
 */
const {
  createCoverageGateFromLesson,
  planCoverageGatedQuestionBatch,
  formatCoveragePlanForPrompt,
  attachCoverageMetadata,
} = require("./teacherBrainCoverageGate");
const { formatBoundaryReplacementAppendix } = require("../../lib/teacherBrain/boundaryReplacementPlanner");

/**
 * @param {object} opts — lesson asset generator opts
 */
function ensureCoverageGate(opts) {
  if (opts.coverageGate) return opts.coverageGate;
  const lesson = opts.lesson;
  if (!lesson) return null;
  return createCoverageGateFromLesson(lesson);
}

/**
 * @param {string} baseUserPrompt
 * @param {object|null} gate
 * @param {number} count
 * @param {string} generationKind
 */
function appendBoundaryReplacementToUserPrompt(baseUserPrompt, gate) {
  const plan = gate?.replacementPlan || gate?.boundary?.replacementPlan;
  const section = formatBoundaryReplacementAppendix(plan);
  if (!section) return baseUserPrompt;
  return `${section}\n\n${baseUserPrompt}`;
}

function appendCoveragePlanToUserPrompt(baseUserPrompt, gate, count, generationKind) {
  if (!gate || count <= 0) return baseUserPrompt;
  const plans = planCoverageGatedQuestionBatch(gate, count, generationKind);
  const section = formatCoveragePlanForPrompt(plans);
  let out = baseUserPrompt;
  if (section) out = `${section}\n\n${out}`;
  return appendBoundaryReplacementToUserPrompt(out, gate);
}

/**
 * @param {object[]} items
 * @param {object|null} gate
 * @param {number} startIndex — diagnostics offset if batch was pre-planned
 */
function tagItemsWithCoverageDiagnostics(items, gate, startIndex = 0) {
  if (!gate || !Array.isArray(gate.diagnostics)) return items;
  return items.map((item, i) => {
    const diagnostic = gate.diagnostics[startIndex + i];
    return diagnostic ? attachCoverageMetadata(item, diagnostic) : item;
  });
}

module.exports = {
  ensureCoverageGate,
  appendCoveragePlanToUserPrompt,
  appendBoundaryReplacementToUserPrompt,
  tagItemsWithCoverageDiagnostics,
};
