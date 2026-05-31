/**
 * Lesson Generator V4 pipeline — teaching intelligence (analysis + generation directives).
 */

const { buildTeachingJourneyPlan } = require("./teachingJourneyEngine");
const { buildExaminerIntelligencePlan } = require("./examinerIntelligenceEngine");
const { buildPremiumTeachingPromptAppendix } = require("./premiumTeachingPrompt");
const { runLessonTeachingDiagnostics } = require("./lessonTeachingDiagnostics");
const { runLessonQualityGateV2 } = require("./qualityGateV2");
const { scoreTenOutOfTenRubric } = require("./tenOutOfTenRubric");
const { computeLessonFlowScoreV2 } = require("../lessonFlowScore");

/** @deprecated Use buildPremiumTeachingPromptAppendix */
function buildTeachingPromptAppendix(blueprint = {}, ctx = {}) {
  return buildPremiumTeachingPromptAppendix(blueprint, ctx);
}

/**
 * @param {object[]} pages
 * @param {object} input — blueprint, subject, tier, etc.
 * @param {object} [opts]
 */
function runLessonGeneratorV4Pipeline(pages, input = {}, opts = {}) {
  const blueprint = input.blueprint || null;
  const ctx = { blueprint, tier: input.tier, subject: input.subject, ...input };
  const flowScore = computeLessonFlowScoreV2(pages, ctx);
  const rubric = scoreTenOutOfTenRubric(pages, ctx);
  const diagnostics =
    opts.diagnostics !== false ? runLessonTeachingDiagnostics(pages, ctx) : null;
  const qualityGate = runLessonQualityGateV2(pages, {
    ...ctx,
    strict: opts.strict === true,
    thresholds: opts.thresholds,
    rubric,
  });

  return {
    version: 4,
    blueprint,
    teachingJourneyPlan: blueprint ? buildTeachingJourneyPlan(blueprint) : null,
    examinerPlan: blueprint ? buildExaminerIntelligencePlan(blueprint) : null,
    flowScore,
    rubric,
    diagnostics,
    qualityGate,
    pages,
  };
}

module.exports = {
  buildTeachingPromptAppendix,
  buildPremiumTeachingPromptAppendix,
  runLessonGeneratorV4Pipeline,
};
