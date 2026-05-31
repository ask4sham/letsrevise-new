/**
 * Lesson teaching diagnostics — strengths, gaps, V4 premium summary.
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
const { scoreTenOutOfTenRubric } = require("./tenOutOfTenRubric");

/**
 * @param {object[]} pages
 * @param {object} [ctx] — blueprint, tier
 */
function runLessonTeachingDiagnostics(pages, ctx = {}) {
  const blueprint = ctx.blueprint || null;
  const rubric = scoreTenOutOfTenRubric(pages, ctx);
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

  const strengths = [];
  if (rubric.isTenOutOfTen) strengths.push("10/10 pedagogical rubric — premium tier");
  if (journey.teachingFlowScore >= 75) strengths.push("Coherent teaching journey");
  if (storytelling.storytellingScore >= 75) strengths.push("Strong concept storytelling");
  if (coreLearning.coreLearningScore >= 75) strengths.push("Structured core learning blocks");
  if (explanation.explanationScore >= 75) strengths.push("Strong WHAT/HOW/WHY explanations");
  if (examinerBrain.examinerBrainScore >= 75) strengths.push("Examiner brain lines present");
  if (retrieval.retrievalJourneyScore >= 75) strengths.push("Spiralling retrieval");
  if (worked.strong) strengths.push("Stepped worked example with mark rationale");
  if (linking.conceptLinkingScore >= 75) strengths.push("Concepts linked across lesson");
  if (voice.feelsTaught) strengths.push("Authentic teacher voice");

  const weakExplanations = explanation.flags
    .filter((f) => f.kind === "shallow_explanation" || f.kind === "missing_what_how_why")
    .map((f) => ({
      concept: f.concept,
      kind: f.kind,
      missing: f.missing,
      blockIndex: f.blockIndex,
    }));

  const missingMisconceptions = [];
  if (!examiner.coverage.misconception && !examinerBrain.coverage.studentsOften) {
    missingMisconceptions.push("No explicit misconception / students-often-write modelling");
  }

  const gaps = [
    ...rubric.gaps,
    ...rubric.weakCategories.map((w) => `Below 8/10: ${w}`),
  ];

  return {
    strengths,
    weakExplanations,
    missingMisconceptions: [...new Set(missingMisconceptions)],
    weakRetrievalChain: retrieval.gaps,
    spiralSteps: retrieval.spiralSteps,
    missingWorkedExamples: worked.gaps,
    weakExamReadiness: [...examiner.gaps, ...examinerBrain.gaps],
    teacherVoiceScore: voice.teacherVoiceScore,
    rubric,
    scores: {
      teachingFlowScore: journey.teachingFlowScore,
      explanationScore: explanation.explanationScore,
      examReadinessScore: examiner.examReadinessScore,
      retrievalJourneyScore: retrieval.retrievalJourneyScore,
      activityDepthScore: activities.activityDepthScore,
      workedExampleScore: worked.workedExampleScore,
      teacherVoiceScore: voice.teacherVoiceScore,
      storytellingScore: storytelling.storytellingScore,
      coreLearningScore: coreLearning.coreLearningScore,
      conceptLinkingScore: linking.conceptLinkingScore,
      tenOutOfTenAverage: rubric.average,
      isTenOutOfTen: rubric.isTenOutOfTen,
    },
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
    gaps: [...new Set(gaps)],
  };
}

module.exports = {
  runLessonTeachingDiagnostics,
};
