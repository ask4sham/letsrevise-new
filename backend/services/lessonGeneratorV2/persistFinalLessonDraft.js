/**
 * Guarded V2 draft persistence — MongoDB save for Lesson Generator V2 only.
 *
 * Preconditions (enforced by caller + this module):
 * - LESSON_GENERATOR_V2_ENABLED
 * - LESSON_GENERATOR_V2_PERSIST
 * - request persist: true
 * - criticReport.ok === true
 * - finalLesson validated
 *
 * Always saves as draft / unpublished with metadata.generator = "v2".
 */

const mongoose = require("mongoose");
const Lesson = require("../../models/Lesson");
const { makeLessonDbSafe } = require("../../utils/lessonDbSafe");
const { validateFinalLesson } = require("./validateFinalLesson");
const { isLessonGeneratorV2PersistEnabled } = require("./flags");

/**
 * @param {object} finalLesson
 * @param {{ teacherId: string, teacherName?: string, topic?: string, phase2?: object }} ctx
 * @returns {Promise<{ ok: true, lessonId: string, lesson: object } | { ok: false, code: string, issues: string[] }>}
 */
async function persistFinalLessonDraft(finalLesson, ctx = {}) {
  const issues = [];

  if (!isLessonGeneratorV2PersistEnabled()) {
    return {
      ok: false,
      code: "LESSON_V2_PERSIST_DISABLED",
      issues: ["persist_env_disabled"],
    };
  }

  if (!finalLesson || typeof finalLesson !== "object") {
    return { ok: false, code: "LESSON_V2_PERSIST_FAILED", issues: ["finalLesson_missing"] };
  }

  const teacherIdRaw = ctx.teacherId || finalLesson.teacherId;
  if (!teacherIdRaw || !mongoose.Types.ObjectId.isValid(String(teacherIdRaw))) {
    return {
      ok: false,
      code: "LESSON_V2_PERSIST_FAILED",
      issues: ["teacherId_required"],
    };
  }

  // Hard-force draft contract before re-validation / save.
  const draft = {
    ...finalLesson,
    teacherId: String(teacherIdRaw),
    teacherName: String(ctx.teacherName || finalLesson.teacherName || "").trim(),
    status: "draft",
    isPublished: false,
    metadata: {
      ...(finalLesson.metadata || {}),
      generator: "v2",
      pipeline: "lesson-generator-v2",
      persistence: {
        implemented: true,
        saved: true,
        savedAt: new Date().toISOString(),
      },
    },
  };

  // Drop non-schema top-level keys that are V2-only markers.
  delete draft.pipeline;
  delete draft.examBoardName;

  const check = validateFinalLesson(draft, {
    phase2: ctx.phase2 || draft.metadata?.v2VisualPlan,
    topic: ctx.topic || draft.topic,
  });
  if (!check.ok) {
    return {
      ok: false,
      code: "LESSON_V2_PERSIST_FAILED",
      issues: check.issues || ["final_validation_failed"],
    };
  }

  if (draft.status !== "draft") issues.push("status_not_draft");
  if (draft.isPublished !== false) issues.push("isPublished_not_false");
  if (draft.metadata?.generator !== "v2") issues.push("generator_not_v2");
  if (issues.length) {
    return { ok: false, code: "LESSON_V2_PERSIST_FAILED", issues };
  }

  let safe;
  try {
    safe = makeLessonDbSafe(draft);
  } catch (err) {
    return {
      ok: false,
      code: "LESSON_V2_PERSIST_FAILED",
      issues: [`db_safe_failed:${err?.message || "unknown"}`],
    };
  }

  try {
    const doc = new Lesson({
      title: safe.title,
      description: safe.description,
      content: safe.content,
      teacherId: safe.teacherId,
      teacherName: safe.teacherName || "",
      subject: safe.subject,
      level: safe.level,
      topic: safe.topic,
      board: safe.board || "",
      tier: safe.tier || undefined,
      topicKey: safe.topicKey || null,
      specKey: safe.specKey || undefined,
      pages: safe.pages || [],
      quiz: safe.quiz || { questions: [] },
      status: "draft",
      isPublished: false,
      metadata: safe.metadata || { generator: "v2" },
    });
    await doc.save();
    return {
      ok: true,
      lessonId: String(doc._id),
      lesson: {
        _id: doc._id,
        title: doc.title,
        status: doc.status,
        isPublished: doc.isPublished,
        metadata: doc.metadata,
      },
    };
  } catch (err) {
    return {
      ok: false,
      code: "LESSON_V2_PERSIST_FAILED",
      issues: [`mongoose_save_failed:${err?.message || "unknown"}`],
    };
  }
}

module.exports = {
  persistFinalLessonDraft,
};
