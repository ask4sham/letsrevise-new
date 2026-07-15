/**
 * Lesson Generator V2 — three-phase pipeline (Lesson → Image/Activity → Question → Critic).
 *
 * NOTE: This is NOT lib/lessonGeneratorV2 (blueprint planner used inside V1 generate-and-save).
 */

const { isLessonGeneratorV2PipelineEnabled, isLessonGeneratorV2PersistEnabled } = require("./flags");
const { runLessonGeneratorV2Scaffold, LessonV2QualityError } = require("./orchestrator");
const {
  STAGE_STATUS,
  createEmptyStagedOutput,
  validateStagedOutput,
  PHASE1_REQUIRED_PLACEHOLDERS,
} = require("./schemas");
const { buildPhase1Lesson, validatePhase1Lesson } = require("./lessonBrain");
const {
  buildPhase2VisualActivities,
  validatePhase2VisualActivities,
} = require("./imageActivityBrain");
const {
  studentImageRevealsAnswer,
  findRevealLeaks,
} = require("./studentImageSafety");
const {
  buildPhase3Questions,
  validatePhase3Questions,
} = require("./questionBrain");
const { isBannedStem, findBannedStemHits } = require("./questionBanList");
const { assembleFinalLesson } = require("./assembleFinalLesson");
const { validateFinalLesson } = require("./validateFinalLesson");
const { persistFinalLessonDraft } = require("./persistFinalLessonDraft");

module.exports = {
  isLessonGeneratorV2PipelineEnabled,
  isLessonGeneratorV2PersistEnabled,
  runLessonGeneratorV2Scaffold,
  LessonV2QualityError,
  STAGE_STATUS,
  createEmptyStagedOutput,
  validateStagedOutput,
  PHASE1_REQUIRED_PLACEHOLDERS,
  buildPhase1Lesson,
  validatePhase1Lesson,
  buildPhase2VisualActivities,
  validatePhase2VisualActivities,
  studentImageRevealsAnswer,
  findRevealLeaks,
  buildPhase3Questions,
  validatePhase3Questions,
  isBannedStem,
  findBannedStemHits,
  assembleFinalLesson,
  validateFinalLesson,
  persistFinalLessonDraft,
};
