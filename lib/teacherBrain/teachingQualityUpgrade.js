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
const {
  buildExaminerLanguageV2PromptSection,
  scoreExaminerLanguageV2Coverage,
  isExaminerLanguageV2Enabled,
} = require("./examinerLanguageV2Engine");
const { resolveTeachingQualityProfile } = require("./teachingQualityProfiles");
const { evaluateTeachingQualityGate } = require("./teachingQualityPlaceholderGate");

function buildTeachingQualityUpgradePromptSection(meta = {}) {
  if (!isTeachingQualityUpgradeEnabled()) return "";

  const reasoning = buildReasoningChainPromptSection(meta);
  const examiner = buildExaminerLanguagePromptSection(meta);
  const workedReasoning = buildWorkedReasoningPromptSection(meta);
  const examinerV2 = buildExaminerLanguageV2PromptSection(meta);
  if (!reasoning && !examiner && !workedReasoning && !examinerV2) return "";

  return [reasoning, examiner, workedReasoning, examinerV2].filter(Boolean).join("\n\n");
}

function evaluateTeachingQualityUpgrade(text = "", meta = {}) {
  const profile = resolveTeachingQualityProfile(meta);
  const reasoning = scoreReasoningChainCoverage(text, profile);
  const examiner = scoreExaminerLanguageCoverage(text);
  const workedReasoning = scoreWorkedReasoningCoverage(text, profile);
  const examinerV2 = scoreExaminerLanguageV2Coverage(text, profile);
  const gate = evaluateTeachingQualityGate(text, meta);

  const workedV2Enabled = isWorkedReasoningV2Enabled();
  const examinerLangV2Enabled = isExaminerLanguageV2Enabled();
  const pass =
    reasoning.pass &&
    examiner.pass &&
    gate.pass &&
    (workedReasoning.skipped || !workedV2Enabled || workedReasoning.pass) &&
    (examinerV2.skipped || !examinerLangV2Enabled || examinerV2.pass);

  return {
    enabled: isTeachingQualityUpgradeEnabled(),
    workedReasoningV2Enabled: workedV2Enabled,
    examinerLanguageV2Enabled: examinerLangV2Enabled,
    profileKey: profile?.taxonomyKey || null,
    reasoning,
    examiner,
    workedReasoning,
    examinerV2,
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
  if (evaluation.examinerV2 && !evaluation.examinerV2.skipped) {
    max += 1;
    if (evaluation.examinerV2.pass) score += 1;
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
  isExaminerLanguageV2Enabled,
};
