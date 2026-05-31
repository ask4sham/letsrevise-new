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
  extractCoreConcepts: require("./conceptExtractor").extractCoreConcepts,
  planMisconceptions: require("./misconceptionEngine").planMisconceptions,
  planRequiredDiagrams: require("./diagramPlanner").planRequiredDiagrams,
  planActivityRecommendations: require("./activityPlanner").planActivityRecommendations,
  planExamTargets: require("./examPlanner").planExamTargets,
  planRetrieval: require("./retrievalPlanner").planRetrieval,
};
