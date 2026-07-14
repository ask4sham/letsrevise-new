/**
 * Lesson Generator V2 orchestrator.
 *
 * Phase 1 Lesson Brain is live; Phase 2–3 remain stubs.
 * Critic still fails closed — never saves lessons yet.
 * Distinct from lib/lessonGeneratorV2 (V1 blueprint planner).
 */

const { createEmptyStagedOutput, validateStagedOutput, STAGE_STATUS } = require("./schemas");
const { runLessonBrain } = require("./lessonBrain");
const { runImageActivityBrain } = require("./imageActivityBrain");
const { runQuestionBrain } = require("./questionBrain");
const { runCriticBrain } = require("./criticBrain");

class LessonV2QualityError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "LessonV2QualityError";
    this.code = details.code || "LESSON_V2_QUALITY_FAILED";
    this.status = 422;
    this.details = details;
  }
}

/**
 * Run the V2 pipeline. Never persists while Phase 2–3 / critic are incomplete.
 * @param {{ topic: string, subject: string, level: string, board?: string, topicKey?: string, tier?: string, phase1Override?: object }} input
 */
async function runLessonGeneratorV2Scaffold(input = {}) {
  const ctx = {
    topic: String(input.topic || "").trim(),
    subject: String(input.subject || "").trim(),
    level: String(input.level || "").trim(),
    board: String(input.board || "").trim(),
    topicKey: String(input.topicKey || "").trim(),
    tier: String(input.tier || "").trim(),
  };

  if (!ctx.topic || !ctx.subject || !ctx.level) {
    const err = new Error("topic, subject and level are required");
    err.status = 400;
    err.code = "LESSON_V2_BAD_REQUEST";
    throw err;
  }

  let staged = createEmptyStagedOutput(ctx);

  try {
    staged = await runLessonBrain(ctx, staged, { phase1Override: input.phase1Override });
  } catch (error) {
    if (error?.code === "LESSON_V2_PHASE1_FAILED") {
      throw new LessonV2QualityError(error.message, {
        code: "LESSON_V2_PHASE1_FAILED",
        issues: error.details?.issues || [],
      });
    }
    throw error;
  }

  staged = await runImageActivityBrain(ctx, staged);
  staged = await runQuestionBrain(ctx, staged);
  staged = await runCriticBrain(staged);

  const schemaCheck = validateStagedOutput(staged);
  if (!schemaCheck.ok) {
    throw new LessonV2QualityError("Lesson Generator V2 staged output failed schema validation.", {
      issues: schemaCheck.issues,
    });
  }

  // Hard no-save until later phases + critic pass.
  staged.saved = false;
  staged.finalLesson = null;

  const phase1Complete = staged.phase1Lesson?.status === STAGE_STATUS.COMPLETE;

  return {
    success: true,
    scaffold: true,
    saved: false,
    phase1Complete,
    message: phase1Complete
      ? "Lesson Generator V2 Phase 1 (Lesson Brain) complete. Phase 2–3 still stubs. No lesson saved."
      : "Lesson Generator V2 ran with incomplete Phase 1. No lesson was saved.",
    staged,
    stageStatuses: {
      phase1: staged.phase1Lesson?.status || STAGE_STATUS.PENDING,
      phase2: staged.phase2VisualActivities?.status || STAGE_STATUS.PENDING,
      phase3: staged.phase3Questions?.status || STAGE_STATUS.PENDING,
      critic: staged.criticReport?.status || STAGE_STATUS.PENDING,
    },
  };
}

module.exports = {
  runLessonGeneratorV2Scaffold,
  LessonV2QualityError,
};
