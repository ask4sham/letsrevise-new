/**
 * Lesson Generator V2 orchestrator.
 *
 * Phase 1–3 + assembler + critic + optional guarded draft persistence.
 * Distinct from lib/lessonGeneratorV2 (V1 blueprint planner).
 */

const { createEmptyStagedOutput, validateStagedOutput, STAGE_STATUS } = require("./schemas");
const { isLessonGeneratorV2PersistEnabled } = require("./flags");
const { runLessonBrain } = require("./lessonBrain");
const { runImageActivityBrain } = require("./imageActivityBrain");
const { runQuestionBrain } = require("./questionBrain");
const { assembleFinalLesson } = require("./assembleFinalLesson");
const { validateFinalLesson } = require("./validateFinalLesson");
const { runCriticBrain } = require("./criticBrain");
const { persistFinalLessonDraft } = require("./persistFinalLessonDraft");

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
    error?.code === "LESSON_V2_PHASE3_FAILED" ||
    error?.code === "LESSON_V2_ASSEMBLY_FAILED" ||
    error?.code === "LESSON_V2_CRITIC_FAILED" ||
    error?.code === "LESSON_V2_PERSIST_DISABLED" ||
    error?.code === "LESSON_V2_PERSIST_FAILED"
  ) {
    throw new LessonV2QualityError(error.message, {
      code: error.code,
      issues: error.details?.issues || [],
    });
  }
  throw error;
}

/**
 * @param {{ topic: string, subject: string, level: string, board?: string, topicKey?: string, tier?: string, teacherId?: string, teacherName?: string, persist?: boolean, phase1Override?: object, phase2Override?: object, phase3Override?: object }} input
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

  const wantPersist = input.persist === true || input.persist === "true" || input.persist === 1;

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

  const assembled = assembleFinalLesson(staged, {
    teacherId: input.teacherId,
    teacherName: input.teacherName,
  });
  if (!assembled.ok || !assembled.finalLesson) {
    staged.finalLesson = null;
    staged.saved = false;
    throw new LessonV2QualityError(
      `Lesson Generator V2 assembly failed: ${(assembled.issues || []).slice(0, 5).join("; ")}`,
      {
        code: "LESSON_V2_ASSEMBLY_FAILED",
        issues: assembled.issues || [],
      }
    );
  }

  staged.finalLesson = assembled.finalLesson;

  const finalCheck = validateFinalLesson(staged.finalLesson, {
    phase2: staged.phase2VisualActivities,
    topic: ctx.topic,
  });
  if (!finalCheck.ok) {
    staged.finalLesson = null;
    staged.saved = false;
    throw new LessonV2QualityError(
      `Lesson Generator V2 final validation failed: ${(finalCheck.issues || []).slice(0, 5).join("; ")}`,
      {
        code: "LESSON_V2_ASSEMBLY_FAILED",
        issues: finalCheck.issues || [],
      }
    );
  }

  staged = await runCriticBrain(staged, {
    assemblyOk: true,
    finalValidationOk: true,
    assemblyIssues: [],
  });

  if (!staged.criticReport?.ok) {
    staged.saved = false;
    staged.finalLesson = null;
    throw new LessonV2QualityError(
      `Lesson Generator V2 critic failed: ${(staged.criticReport?.issues || []).slice(0, 5).join("; ")}`,
      {
        code: "LESSON_V2_CRITIC_FAILED",
        issues: staged.criticReport?.issues || [],
      }
    );
  }

  const schemaCheck = validateStagedOutput(staged);
  if (!schemaCheck.ok) {
    throw new LessonV2QualityError("Lesson Generator V2 staged output failed schema validation.", {
      issues: schemaCheck.issues,
    });
  }

  let lessonId = null;
  staged.saved = false;

  if (wantPersist) {
    if (!isLessonGeneratorV2PersistEnabled()) {
      throw new LessonV2QualityError(
        "Lesson Generator V2 persistence is disabled. Set LESSON_GENERATOR_V2_PERSIST=1 to enable draft saves.",
        {
          code: "LESSON_V2_PERSIST_DISABLED",
          issues: ["persist_env_disabled"],
        }
      );
    }

    const persisted = await persistFinalLessonDraft(staged.finalLesson, {
      teacherId: input.teacherId,
      teacherName: input.teacherName,
      topic: ctx.topic,
      phase2: staged.phase2VisualActivities,
    });

    if (!persisted.ok) {
      staged.saved = false;
      throw new LessonV2QualityError(
        `Lesson Generator V2 persist failed: ${(persisted.issues || []).slice(0, 5).join("; ")}`,
        {
          code: persisted.code || "LESSON_V2_PERSIST_FAILED",
          issues: persisted.issues || [],
        }
      );
    }

    staged.saved = true;
    lessonId = persisted.lessonId;
    if (staged.finalLesson?.metadata) {
      staged.finalLesson.metadata.persistence = {
        implemented: true,
        saved: true,
        lessonId,
      };
    }
    if (staged.criticReport) {
      staged.criticReport.issues = (staged.criticReport.issues || []).filter(
        (i) => i !== "db_persistence_not_implemented"
      );
    }
  }

  // Schema: saved=true requires finalLesson + critic ok (already true here).
  const schemaCheck2 = validateStagedOutput(staged);
  if (!schemaCheck2.ok) {
    // If we already wrote, surface persist integrity failure rather than leaving ambiguous state.
    throw new LessonV2QualityError("Lesson Generator V2 staged output failed after persist.", {
      code: staged.saved ? "LESSON_V2_PERSIST_FAILED" : "LESSON_V2_QUALITY_FAILED",
      issues: schemaCheck2.issues,
    });
  }

  const phase1Complete = staged.phase1Lesson?.status === STAGE_STATUS.COMPLETE;
  const phase2Complete = staged.phase2VisualActivities?.status === STAGE_STATUS.COMPLETE;
  const phase3Complete = staged.phase3Questions?.status === STAGE_STATUS.COMPLETE;

  return {
    success: true,
    scaffold: !staged.saved,
    saved: staged.saved === true,
    lessonId,
    phase1Complete,
    phase2Complete,
    phase3Complete,
    criticOk: staged.criticReport?.ok === true,
    persistenceReady: staged.criticReport?.persistenceReady === true,
    persistRequested: wantPersist,
    persistEnvEnabled: isLessonGeneratorV2PersistEnabled(),
    finalLesson: staged.finalLesson,
    message: staged.saved
      ? "Lesson Generator V2 saved a draft lesson (unpublished). V1 untouched."
      : "Lesson Generator V2 assembled an in-memory finalLesson draft. Critic ok. Nothing saved (persist not requested or not enabled).",
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
