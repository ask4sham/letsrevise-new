/**
 * Lesson Generator V2 — three-phase pipeline (Lesson → Image/Activity → Question → Critic).
 *
 * NOTE: This is NOT lib/lessonGeneratorV2 (blueprint planner used inside V1 generate-and-save).
 */

const { isLessonGeneratorV2PipelineEnabled } = require("./flags");
const { runLessonGeneratorV2Scaffold, LessonV2QualityError } = require("./orchestrator");
const {
  STAGE_STATUS,
  createEmptyStagedOutput,
  validateStagedOutput,
  PHASE1_REQUIRED_PLACEHOLDERS,
} = require("./schemas");
const { buildPhase1Lesson, validatePhase1Lesson } = require("./lessonBrain");

module.exports = {
  isLessonGeneratorV2PipelineEnabled,
  runLessonGeneratorV2Scaffold,
  LessonV2QualityError,
  STAGE_STATUS,
  createEmptyStagedOutput,
  validateStagedOutput,
  PHASE1_REQUIRED_PLACEHOLDERS,
  buildPhase1Lesson,
  validatePhase1Lesson,
};
