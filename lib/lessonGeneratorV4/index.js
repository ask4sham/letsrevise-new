/**
 * Lesson Generator V4 — Teaching Intelligence Layer (refined for 10/10 premium teaching).
 */

const { buildTeachingJourneyPlan, analyzeTeachingJourney } = require("./teachingJourneyEngine");
const { analyzeExplanationQuality } = require("./explanationQualityEngine");
const { buildExaminerIntelligencePlan, analyzeExaminerIntelligence } = require("./examinerIntelligenceEngine");
const { analyzeRetrievalJourney } = require("./retrievalJourneyEngine");
const { analyzeActivityDepth } = require("./activityDepthEngine");
const {
  analyzeWorkedExamples,
  buildWorkedExamplePromptSection,
  buildWorkedExamplePlan,
} = require("./workedExampleEngine");
const { analyzeTeacherVoice, buildTeacherVoiceDirectives } = require("./teacherVoiceEngine");
const {
  buildConceptStorytellingPlan,
  buildConceptStorytellingPromptSection,
  analyzeConceptStorytelling,
} = require("./conceptStorytellingEngine");
const {
  buildCoreLearningStructurePlan,
  buildCoreLearningPromptSection,
  analyzeCoreLearningStructure,
} = require("./coreLearningStructureEngine");
const {
  buildExaminerBrainPlan,
  buildExaminerBrainPromptSection,
  analyzeExaminerBrain,
} = require("./examinerBrainEngine");
const {
  buildConceptLinkingPlan,
  buildConceptLinkingPromptSection,
  analyzeConceptLinking,
} = require("./conceptLinkingEngine");
const {
  buildHigherTierChallengePlan,
  buildHigherTierChallengePromptSection,
  analyzeHigherTierChallenge,
} = require("./higherTierChallengeEngine");
const {
  buildModelAnswerQualityPromptSection,
  analyzeModelAnswerQuality,
} = require("./modelAnswerQualityEngine");
const {
  buildTeacherTransitionPromptSection,
  analyzeTeacherTransitions,
} = require("./teacherTransitionEngine");
const { scoreTenOutOfTenRubric } = require("./tenOutOfTenRubric");
const { compareToGoldenMetabolism, loadCuratedMetabolismPages } = require("./goldenMetabolismComparison");
const { buildPremiumTeachingPromptAppendix } = require("./premiumTeachingPrompt");
const {
  buildTeacherBrainPromptAppendix,
  buildTeacherBrainPromptAppendixFromContext,
} = require("./teacherBrainPromptAppendix");
const { runLessonTeachingDiagnostics } = require("./lessonTeachingDiagnostics");
const { runLessonQualityGateV2, DEFAULT_V2_THRESHOLDS } = require("./qualityGateV2");
const {
  buildTeachingPromptAppendix,
  runLessonGeneratorV4Pipeline,
} = require("./pipeline");
const { computeLessonFlowScoreV2 } = require("../lessonFlowScore");

function isLessonGeneratorV4Enabled(env = process.env) {
  const v = env?.LESSON_GENERATOR_V4;
  return v === "true" || v === "1" || v === true;
}

module.exports = {
  isLessonGeneratorV4Enabled,
  buildTeachingJourneyPlan,
  analyzeTeachingJourney,
  analyzeExplanationQuality,
  buildExaminerIntelligencePlan,
  analyzeExaminerIntelligence,
  analyzeRetrievalJourney,
  analyzeActivityDepth,
  analyzeWorkedExamples,
  buildWorkedExamplePlan,
  buildWorkedExamplePromptSection,
  analyzeTeacherVoice,
  buildTeacherVoiceDirectives,
  buildConceptStorytellingPlan,
  buildConceptStorytellingPromptSection,
  analyzeConceptStorytelling,
  buildCoreLearningStructurePlan,
  buildCoreLearningPromptSection,
  analyzeCoreLearningStructure,
  buildExaminerBrainPlan,
  buildExaminerBrainPromptSection,
  analyzeExaminerBrain,
  buildConceptLinkingPlan,
  buildConceptLinkingPromptSection,
  analyzeConceptLinking,
  buildHigherTierChallengePlan,
  buildHigherTierChallengePromptSection,
  analyzeHigherTierChallenge,
  buildModelAnswerQualityPromptSection,
  analyzeModelAnswerQuality,
  buildTeacherTransitionPromptSection,
  analyzeTeacherTransitions,
  scoreTenOutOfTenRubric,
  compareToGoldenMetabolism,
  loadCuratedMetabolismPages,
  buildPremiumTeachingPromptAppendix,
  buildTeacherBrainPromptAppendix,
  buildTeacherBrainPromptAppendixFromContext,
  runLessonTeachingDiagnostics,
  runLessonQualityGateV2,
  DEFAULT_V2_THRESHOLDS,
  buildTeachingPromptAppendix,
  runLessonGeneratorV4Pipeline,
  computeLessonFlowScoreV2,
};
