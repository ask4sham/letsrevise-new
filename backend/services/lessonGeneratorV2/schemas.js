/**
 * Lesson Generator V2 — staged pipeline schemas.
 * Internal debug shape before any save. Not persisted to Lesson documents yet.
 */

const { PHASE1_REQUIRED_PLACEHOLDERS } = require("./placeholders");

const STAGE_STATUS = Object.freeze({
  PENDING: "pending",
  SKIPPED: "skipped",
  COMPLETE: "complete",
  FAILED: "failed",
  STUB: "stub",
});

/**
 * Empty staged envelope used by the orchestrator.
 * @param {{ topic?: string, subject?: string, level?: string, board?: string, topicKey?: string, tier?: string }} ctx
 */
function createEmptyStagedOutput(ctx = {}) {
  const meta = {
    topic: String(ctx.topic || "").trim(),
    subject: String(ctx.subject || "").trim(),
    level: String(ctx.level || "").trim(),
    board: String(ctx.board || "").trim(),
    topicKey: String(ctx.topicKey || "").trim(),
    tier: String(ctx.tier || "").trim(),
    createdAt: new Date().toISOString(),
    pipeline: "lesson-generator-v2",
    version: "phase1-0.1",
  };

  return {
    meta,
    phase1Lesson: {
      status: STAGE_STATUS.PENDING,
      title: "",
      topic: meta.topic,
      subject: meta.subject,
      examBoard: meta.board,
      level: meta.level,
      tier: meta.tier,
      objectives: [],
      priorKnowledge: "",
      sections: [],
      keyTerms: [],
      misconceptions: [],
      examTips: [],
      summary: "",
      placeholders: [...PHASE1_REQUIRED_PLACEHOLDERS],
      questionsFinalised: false,
      imagePromptsFinalised: false,
      notes: "",
    },
    phase2VisualActivities: {
      status: STAGE_STATUS.PENDING,
      teachingDiagrams: [],
      retrievalActivities: [],
      /** retrieval/activity images must not reveal answers */
      studentSafe: true,
      notes: "",
    },
    phase3Questions: {
      status: STAGE_STATUS.PENDING,
      selfCheck: [],
      checkpoint: [],
      quiz: [],
      rules: {
        selfCheckCount: 3,
        checkpointCount: 3,
        quizCount: 5,
      },
      notes: "",
    },
    criticReport: {
      status: STAGE_STATUS.PENDING,
      ok: false,
      issues: [],
      regeneratedPhase3Once: false,
    },
    finalLesson: null,
    saved: false,
  };
}

/**
 * Lightweight structural validation for staged V2 output.
 * @returns {{ ok: boolean, issues: string[] }}
 */
function validateStagedOutput(staged) {
  const issues = [];
  if (!staged || typeof staged !== "object") {
    return { ok: false, issues: ["staged_output_missing"] };
  }
  for (const key of ["meta", "phase1Lesson", "phase2VisualActivities", "phase3Questions", "criticReport"]) {
    if (!staged[key] || typeof staged[key] !== "object") {
      issues.push(`staged_missing:${key}`);
    }
  }
  if (staged.saved === true && !staged.finalLesson) {
    issues.push("saved_true_without_finalLesson");
  }
  if (staged.saved === true && staged.criticReport && staged.criticReport.ok !== true) {
    issues.push("saved_true_without_critic_ok");
  }
  const q = staged.phase3Questions;
  if (q && q.status === STAGE_STATUS.COMPLETE) {
    if (!Array.isArray(q.selfCheck) || q.selfCheck.length !== 3) {
      issues.push("phase3_selfCheck_must_be_exactly_3");
    }
    if (!Array.isArray(q.checkpoint) || q.checkpoint.length !== 3) {
      issues.push("phase3_checkpoint_must_be_exactly_3");
    }
    if (!Array.isArray(q.quiz) || q.quiz.length !== 5) {
      issues.push("phase3_quiz_must_be_exactly_5");
    }
  }
  return { ok: issues.length === 0, issues };
}

module.exports = {
  STAGE_STATUS,
  createEmptyStagedOutput,
  validateStagedOutput,
  PHASE1_REQUIRED_PLACEHOLDERS,
};
