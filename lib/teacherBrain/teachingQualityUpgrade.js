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
const { resolveTeachingQualityProfile } = require("./teachingQualityProfiles");

function buildTeachingQualityUpgradePromptSection(meta = {}) {
  if (!isTeachingQualityUpgradeEnabled()) return "";

  const reasoning = buildReasoningChainPromptSection(meta);
  const examiner = buildExaminerLanguagePromptSection(meta);
  if (!reasoning && !examiner) return "";

  return [reasoning, examiner].filter(Boolean).join("\n\n");
}

function evaluateTeachingQualityUpgrade(text = "", meta = {}) {
  const profile = resolveTeachingQualityProfile(meta);
  const reasoning = scoreReasoningChainCoverage(text, profile);
  const examiner = scoreExaminerLanguageCoverage(text);

  return {
    enabled: isTeachingQualityUpgradeEnabled(),
    profileKey: profile?.taxonomyKey || null,
    reasoning,
    examiner,
    pass: reasoning.pass && examiner.pass,
  };
}

module.exports = {
  buildTeachingQualityUpgradePromptSection,
  evaluateTeachingQualityUpgrade,
};
