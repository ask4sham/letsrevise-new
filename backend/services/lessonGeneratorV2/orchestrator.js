/**
 * Lesson Generator V2 orchestrator (scaffold).
 *
 * Three-phase pipeline + critic. Does NOT save lessons while phases are stubs.
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
    this.code = "LESSON_V2_QUALITY_FAILED";
    this.status = 422;
    this.details = details;
  }
}

/**
 * Run the V2 scaffold pipeline. Never persists while brains are stubs.
 * @param {{ topic: string, subject: string, level: string, board?: string, topicKey?: string, tier?: string }} input
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

  staged = await runLessonBrain(ctx, staged);
  staged = await runImageActivityBrain(ctx, staged);
  staged = await runQuestionBrain(ctx, staged);
  staged = await runCriticBrain(staged);

  const schemaCheck = validateStagedOutput(staged);
  if (!schemaCheck.ok) {
    throw new LessonV2QualityError("Lesson Generator V2 staged output failed schema validation.", {
      issues: schemaCheck.issues,
    });
  }

  // Scaffold: critic always fails → never save partial/weak output.
  if (!staged.criticReport?.ok || staged.saved) {
    // Ensure hard no-save contract for scaffold.
    staged.saved = false;
    staged.finalLesson = null;
  }

  return {
    success: true,
    scaffold: true,
    saved: false,
    message:
      "Lesson Generator V2 scaffold ran Phase 1–3 stubs + critic. No lesson was saved. Implement brains next.",
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
