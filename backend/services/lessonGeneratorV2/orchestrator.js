/**
 * Lesson Generator V2 orchestrator.
 *
 * Phase 1 Lesson Brain + Phase 2 Image/Activity Brain + Phase 3 Question Brain are live.
 * Critic reports Phase 3 quality but still blocks save (persistence not enabled).
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

function rethrowPhaseError(error) {
  if (
    error?.code === "LESSON_V2_PHASE1_FAILED" ||
    error?.code === "LESSON_V2_PHASE2_FAILED" ||
    error?.code === "LESSON_V2_PHASE3_FAILED"
  ) {
    throw new LessonV2QualityError(error.message, {
      code: error.code,
      issues: error.details?.issues || [],
    });
  }
  throw error;
}

/**
 * @param {{ topic: string, subject: string, level: string, board?: string, topicKey?: string, tier?: string, phase1Override?: object, phase2Override?: object, phase3Override?: object }} input
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
    rethrowPhaseError(error);
  }

  try {
    staged = await runImageActivityBrain(ctx, staged, { phase2Override: input.phase2Override });
  } catch (error) {
    rethrowPhaseError(error);
  }

  try {
    staged = await runQuestionBrain(ctx, staged, { phase3Override: input.phase3Override });
  } catch (error) {
    rethrowPhaseError(error);
  }

  staged = await runCriticBrain(staged);

  const schemaCheck = validateStagedOutput(staged);
  if (!schemaCheck.ok) {
    throw new LessonV2QualityError("Lesson Generator V2 staged output failed schema validation.", {
      issues: schemaCheck.issues,
    });
  }

  staged.saved = false;
  staged.finalLesson = null;

  const phase1Complete = staged.phase1Lesson?.status === STAGE_STATUS.COMPLETE;
  const phase2Complete = staged.phase2VisualActivities?.status === STAGE_STATUS.COMPLETE;
  const phase3Complete = staged.phase3Questions?.status === STAGE_STATUS.COMPLETE;

  return {
    success: true,
    scaffold: true,
    saved: false,
    phase1Complete,
    phase2Complete,
    phase3Complete,
    message: phase3Complete
      ? "Lesson Generator V2 Phase 1–3 complete (Lesson + Image/Activity + Question Brain). Critic blocks save until persistence is enabled."
      : "Lesson Generator V2 ran with incomplete Phase 3. No lesson was saved.",
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
