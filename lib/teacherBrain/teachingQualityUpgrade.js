/**
 * Phase 3H.1.8a — Prompt appendix orchestrator (no autofix, no mutation).
 */

const {
  buildReasoningChainPromptSection,
  isTeachingQualityUpgradeEnabled,
  scoreReasoningChainCoverage,
} = require("./reasoningChainEngine");
const {
  buildExaminerLanguagePromptSection,
  scoreExaminerLanguageCoverage,
} = require("./examinerLanguageEngine");
const {
  buildWorkedReasoningPromptSection,
  scoreWorkedReasoningCoverage,
  isWorkedReasoningV2Enabled,
} = require("./workedReasoningEngine");
const { resolveTeachingQualityProfile } = require("./teachingQualityProfiles");
const { evaluateTeachingQualityGate } = require("./teachingQualityPlaceholderGate");

function buildTeachingQualityUpgradePromptSection(meta = {}) {
  if (!isTeachingQualityUpgradeEnabled()) return "";

  const reasoning = buildReasoningChainPromptSection(meta);
  const examiner = buildExaminerLanguagePromptSection(meta);
  const workedReasoning = buildWorkedReasoningPromptSection(meta);
  if (!reasoning && !examiner && !workedReasoning) return "";

  return [reasoning, examiner, workedReasoning].filter(Boolean).join("\n\n");
}

function evaluateTeachingQualityUpgrade(text = "", meta = {}) {
  const profile = resolveTeachingQualityProfile(meta);
  const reasoning = scoreReasoningChainCoverage(text, profile);
  const examiner = scoreExaminerLanguageCoverage(text);
  const workedReasoning = scoreWorkedReasoningCoverage(text, profile);
  const gate = evaluateTeachingQualityGate(text, meta);

  const v2Enabled = isWorkedReasoningV2Enabled();
  const pass =
    reasoning.pass &&
    examiner.pass &&
    gate.pass &&
    (workedReasoning.skipped || !v2Enabled || workedReasoning.pass);

  return {
    enabled: isTeachingQualityUpgradeEnabled(),
    workedReasoningV2Enabled: v2Enabled,
    profileKey: profile?.taxonomyKey || null,
    reasoning,
    examiner,
    workedReasoning,
    gate,
    pass,
  };
}

function computeTeachingQualityScore(evaluation = {}) {
  let score = 0;
  let max = 0;
  if (evaluation.reasoning) {
    max += 1;
    if (evaluation.reasoning.pass) score += 1;
  }
  if (evaluation.examiner) {
    max += 1;
    if (evaluation.examiner.pass) score += 1;
  }
  if (evaluation.workedReasoning && !evaluation.workedReasoning.skipped) {
    max += 1;
    if (evaluation.workedReasoning.pass) score += 1;
  }
  if (evaluation.gate) {
    max += 1;
    if (evaluation.gate.pass) score += 1;
  }
  return max > 0 ? Math.round((score / max) * 100) : 0;
}

module.exports = {
  buildTeachingQualityUpgradePromptSection,
  evaluateTeachingQualityUpgrade,
  evaluateTeachingQualityGate,
  computeTeachingQualityScore,
  isWorkedReasoningV2Enabled,
};
