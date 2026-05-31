/**
 * 10/10 lesson quality rubric — pedagogical dimensions scored 0–10.
 */

const { analyzeTeachingJourney } = require("./teachingJourneyEngine");
const { analyzeExplanationQuality } = require("./explanationQualityEngine");
const { analyzeExaminerIntelligence } = require("./examinerIntelligenceEngine");
const { analyzeExaminerBrain } = require("./examinerBrainEngine");
const { analyzeRetrievalJourney } = require("./retrievalJourneyEngine");
const { analyzeActivityDepth } = require("./activityDepthEngine");
const { analyzeWorkedExamples } = require("./workedExampleEngine");
const { analyzeTeacherVoice } = require("./teacherVoiceEngine");
const { analyzeConceptStorytelling } = require("./conceptStorytellingEngine");
const { analyzeCoreLearningStructure } = require("./coreLearningStructureEngine");
const { analyzeConceptLinking } = require("./conceptLinkingEngine");
const { analyzeHigherTierChallenge } = require("./higherTierChallengeEngine");
const { analyzeModelAnswerQuality } = require("./modelAnswerQualityEngine");
const { analyzeTeacherTransitions } = require("./teacherTransitionEngine");

function toTen(score100) {
  return Math.round((Math.max(0, Math.min(100, score100)) / 10) * 10) / 10;
}

/**
 * @param {object[]} pages
 * @param {object} [ctx]
 */
function scoreTenOutOfTenRubric(pages, ctx = {}) {
  const blueprint = ctx.blueprint || null;
  const journey = analyzeTeachingJourney(pages);
  const explanation = analyzeExplanationQuality(pages);
  const examiner = analyzeExaminerIntelligence(pages);
  const examinerBrain = analyzeExaminerBrain(pages);
  const retrieval = analyzeRetrievalJourney(pages, blueprint);
  const activities = analyzeActivityDepth(pages);
  const worked = analyzeWorkedExamples(pages);
  const voice = analyzeTeacherVoice(pages);
  const storytelling = analyzeConceptStorytelling(pages);
  const coreLearning = analyzeCoreLearningStructure(pages);
  const linking = analyzeConceptLinking(pages);
  const higherTier = analyzeHigherTierChallenge(pages, ctx);
  const modelAnswers = analyzeModelAnswerQuality(pages);
  const transitions = analyzeTeacherTransitions(pages);

  const categories = {
    teachingClarity: toTen((journey.teachingFlowScore + voice.teacherVoiceScore) / 2),
    conceptStorytelling: toTen(storytelling.storytellingScore),
    explanationDepth: toTen(explanation.explanationScore),
    examinerThinking: toTen((examiner.examReadinessScore + examinerBrain.examinerBrainScore) / 2),
    retrievalProgression: toTen(retrieval.retrievalJourneyScore),
    activityDepth: toTen(activities.activityDepthScore),
    workedExamples: toTen(worked.workedExampleScore),
    conceptLinking: toTen(linking.conceptLinkingScore),
    higherTierChallenge: toTen(higherTier.higherTierScore),
    finalExamReadiness: toTen(
      (examiner.examReadinessScore + modelAnswers.modelAnswerScore + coreLearning.coreLearningScore) / 3
    ),
  };

  const values = Object.values(categories);
  const average = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  const minCategory = Math.min(...values);
  const isTenOutOfTen = minCategory >= 8 && average >= 9;

  const gaps = [
    ...storytelling.gaps,
    ...coreLearning.gaps,
    ...examiner.gaps,
    ...examinerBrain.gaps,
    ...retrieval.gaps,
    ...worked.gaps,
    ...linking.gaps,
    ...higherTier.gaps,
    ...modelAnswers.gaps,
    ...transitions.gaps,
  ];

  const weakCategories = Object.entries(categories)
    .filter(([, v]) => v < 8)
    .map(([k, v]) => `${k}: ${v}/10`);

  return {
    categories,
    average,
    minCategory,
    isTenOutOfTen,
    weakCategories,
    gaps: [...new Set(gaps)],
    engines: {
      journey,
      explanation,
      examiner,
      examinerBrain,
      retrieval,
      activities,
      worked,
      voice,
      storytelling,
      coreLearning,
      linking,
      higherTier,
      modelAnswers,
      transitions,
    },
  };
}

module.exports = {
  scoreTenOutOfTenRubric,
  toTen,
};
