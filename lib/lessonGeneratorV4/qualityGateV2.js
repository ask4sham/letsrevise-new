/**
 * Quality Gate V2 — premium teaching tier + 10/10 rubric.
 */

const { computeLessonFlowScoreV2 } = require("../lessonFlowScore");
const { scoreTenOutOfTenRubric } = require("./tenOutOfTenRubric");

const DEFAULT_V2_THRESHOLDS = {
  teaching: 80,
  explanation: 80,
  examReadiness: 80,
  retrievalJourney: 80,
  architecture: 80,
  overallTeaching: 80,
  premiumScore: 90,
  minRubricCategory: 8,
  minRubricAverage: 9,
};

/**
 * @param {object[]} pages
 * @param {object} [ctx]
 */
function runLessonQualityGateV2(pages, ctx = {}) {
  const thresholds = { ...DEFAULT_V2_THRESHOLDS, ...ctx.thresholds };
  const scores = computeLessonFlowScoreV2(pages, ctx);
  const rubric = ctx.rubric || scoreTenOutOfTenRubric(pages, ctx);
  const failures = [];

  if (scores.teachingFlowScore < thresholds.teaching) {
    failures.push(`teachingFlowScore ${scores.teachingFlowScore} < ${thresholds.teaching}`);
  }
  if (scores.explanationScore < thresholds.explanation) {
    failures.push(`explanationScore ${scores.explanationScore} < ${thresholds.explanation}`);
  }
  if (scores.examReadinessScore < thresholds.examReadiness) {
    failures.push(`examReadinessScore ${scores.examReadinessScore} < ${thresholds.examReadiness}`);
  }
  if (scores.retrievalJourneyScore < thresholds.retrievalJourney) {
    failures.push(`retrievalJourneyScore ${scores.retrievalJourneyScore} < ${thresholds.retrievalJourney}`);
  }
  if (scores.architectureScore < thresholds.architecture) {
    failures.push(`architectureScore ${scores.architectureScore} < ${thresholds.architecture}`);
  }
  if (scores.overallTeachingScore < thresholds.overallTeaching) {
    failures.push(`overallTeachingScore ${scores.overallTeachingScore} < ${thresholds.overallTeaching}`);
  }

  if (rubric.minCategory < thresholds.minRubricCategory) {
    failures.push(
      `10/10 rubric min category ${rubric.minCategory} < ${thresholds.minRubricCategory} (${rubric.weakCategories.join(", ")})`
    );
  }
  if (rubric.average < thresholds.minRubricAverage) {
    failures.push(`10/10 rubric average ${rubric.average} < ${thresholds.minRubricAverage}`);
  }

  const teachingGatePassed = failures.length === 0;
  const canAchievePremium =
    teachingGatePassed &&
    rubric.isTenOutOfTen &&
    (scores.overallFlowScore >= thresholds.premiumScore || rubric.average >= 9);

  return {
    passed: teachingGatePassed,
    canAchievePremium,
    isTenOutOfTen: rubric.isTenOutOfTen,
    rubric,
    blockPremium: !canAchievePremium,
    blockExport: failures.length > 0 && ctx.strict === true,
    failures,
    scores,
    thresholds,
    message: canAchievePremium
      ? "Lesson meets V4 premium 10/10 teaching bar."
      : "Lesson cannot reach 10/10 until flow sub-scores and rubric (no category below 8, average ≥ 9) pass.",
  };
}

module.exports = {
  DEFAULT_V2_THRESHOLDS,
  runLessonQualityGateV2,
};
