/**
 * Teacher Brain — Phase 1 entry (analysis only).
 */

const { runTeacherBrain } = require("./TeacherBrainEngine");
const {
  injectDiagramAndActivityBriefs,
  formatDiagramBrief,
  formatDragDropBrief,
  formatTextMatchBrief,
  formatTextToImageBrief,
  formatImageDropZonesBrief,
  formatStepByStepBrief,
  resolveDragDropActivityLayout,
  BRIEF_MARKER,
} = require("./diagramBriefInjector");
const { detectDragDropActivityLayout } = require("./dragDropActivityLayout");
const { formatDragDropImageDesignRequirements } = require("./dragDropVisualContract");
const { resolveInteractiveDiagramTopicKind } = require("./interactiveDiagramTopicKind");
const {
  getInteractiveDiagramPlansForTopicKind,
  formatInteractiveDiagramTopicBrief,
} = require("./interactiveDiagramTopicSpecs");
const { resolveInteractiveSequenceTopicKind } = require("./interactiveSequenceTopicKind");
const { formatInteractiveSequenceTopicBrief } = require("./interactiveSequenceTopicSpecs");

module.exports = {
  runTeacherBrain,
  injectDiagramAndActivityBriefs,
  formatDiagramBrief,
  formatDragDropBrief,
  formatTextMatchBrief,
  formatTextToImageBrief,
  formatImageDropZonesBrief,
  formatStepByStepBrief,
  resolveDragDropActivityLayout,
  detectDragDropActivityLayout,
  BRIEF_MARKER,
  formatDragDropImageDesignRequirements,
  resolveInteractiveDiagramTopicKind,
  getInteractiveDiagramPlansForTopicKind,
  formatInteractiveDiagramTopicBrief,
  resolveInteractiveSequenceTopicKind,
  formatInteractiveSequenceTopicBrief,
  extractCoreConcepts: require("./conceptExtractor").extractCoreConcepts,
  planMisconceptions: require("./misconceptionEngine").planMisconceptions,
  planRequiredDiagrams: require("./diagramPlanner").planRequiredDiagrams,
  planActivityRecommendations: require("./activityPlanner").planActivityRecommendations,
  planExamTargets: require("./examPlanner").planExamTargets,
  planRetrieval: require("./retrievalPlanner").planRetrieval,
  buildLessonCoverageMap: require("./lessonCoverageIntelligence").buildLessonCoverageMap,
  checkCoverageBeforeGeneration: require("./lessonCoverageIntelligence").checkCoverageBeforeGeneration,
  formatCoverageMapForPrompt: require("./lessonCoverageIntelligence").formatCoverageMapForPrompt,
  COGNITIVE_SKILLS: require("./lessonCoverageIntelligence").COGNITIVE_SKILLS,
  createCoverageGateFromLesson: require("./coverageGatedGeneration").createCoverageGateFromLesson,
  createCoverageGenerationGate: require("./coverageGatedGeneration").createCoverageGenerationGate,
  planCoverageGatedQuestion: require("./coverageGatedGeneration").planCoverageGatedQuestion,
  planCoverageGatedQuestionBatch: require("./coverageGatedGeneration").planCoverageGatedQuestionBatch,
  formatCoveragePlanForPrompt: require("./coverageGatedGeneration").formatCoveragePlanForPrompt,
  attachCoverageMetadata: require("./coverageGatedGeneration").attachCoverageMetadata,
  prependCoverageDirectiveToPrompt: require("./coverageGatedGeneration").prependCoverageDirectiveToPrompt,
  buildOneShotLessonCoveragePlanAppendix: require("./oneShotLessonCoveragePlan").buildOneShotLessonCoveragePlanAppendix,
  mergeOneShotCoveragePlanIntoInstructions: require("./oneShotLessonCoveragePlan").mergeOneShotCoveragePlanIntoInstructions,
  buildLessonCoverageReview: require("./lessonCoverageReview").buildLessonCoverageReview,
};
