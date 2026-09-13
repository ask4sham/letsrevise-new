"use strict";

const Lesson = require("../../models/Lesson");
const {
  validateLessonSynthesiserDraftEnvelope,
} = require("../../utils/lessonSynthesiserDraftValidator");
const {
  adaptSynthesiserDraftToLessonCreate,
} = require("../../utils/lessonSynthesiserDraftAdapter");
const { groundLessonQuizBeforePersist } = require("../../utils/groundLessonQuizBeforePersist");
const {
  auditAndLogSynthesiserPageQuizShadow,
} = require("../../utils/synthesiserPageQuizAlignmentAudit");

/**
 * Shared ingest path for POST /api/lesson-synthesiser/drafts and teacher P1 generate.
 *
 * @param {object} envelope { source, generator, draft }
 * @param {{ ownerTeacherId, teacherName, generationProvenance?: object }} options
 */
async function createLessonFromSynthesiserEnvelope(envelope, options = {}) {
  const validation = validateLessonSynthesiserDraftEnvelope(envelope);
  if (!validation.ok) {
    return {
      ok: false,
      code: validation.errors[0]?.code || "SYNTHESISER_VALIDATION_FAILED",
      message: "Lesson Synthesiser draft validation failed.",
      errors: validation.errors,
    };
  }

  if (!options.ownerTeacherId) {
    return {
      ok: false,
      code: "SYNTHESISER_OWNER_REQUIRED",
      message: "ownerTeacherId is required to persist a synthesiser draft.",
    };
  }

  const teacherName =
    [options.teacherName].filter(Boolean).join(" ").trim() || "Teacher";

  const createDoc = adaptSynthesiserDraftToLessonCreate(envelope.draft, {
    ownerTeacherId: options.ownerTeacherId,
    teacherName,
  });

  const provenance = options.generationProvenance || {};
  createDoc.metadata = {
    ...(createDoc.metadata || {}),
    generationEngine: provenance.generationEngine || "lesson-synthesiser",
    generation: {
      engine: provenance.generationEngine || "lesson-synthesiser",
      path: provenance.path || "lesson-synthesiser-ingest",
      generatedAt: provenance.generatedAt || new Date().toISOString(),
      synthesiserCode: provenance.synthesiserCode || null,
      synthesiserMode: provenance.synthesiserMode || null,
    },
  };

  groundLessonQuizBeforePersist(createDoc);

  try {
    auditAndLogSynthesiserPageQuizShadow(createDoc);
  } catch (shadowAuditError) {
    console.warn("[LessonSynthesiser][PageQuizShadow] audit failed (fail-open)", {
      message: shadowAuditError?.message || String(shadowAuditError),
      topicKey: createDoc?.topicKey || null,
      specKey: createDoc?.specKey || null,
    });
  }

  createDoc.status = "draft";
  createDoc.isPublished = false;

  const lesson = new Lesson(createDoc);
  lesson.status = "draft";
  lesson.isPublished = false;
  await lesson.save();

  if (lesson.status !== "draft" || lesson.isPublished !== false) {
    lesson.status = "draft";
    lesson.isPublished = false;
    await lesson.save();
  }

  const lessonId = String(lesson._id);
  return {
    ok: true,
    lessonId,
    status: "draft",
    isPublished: false,
    editPath: `/edit-lesson/${lessonId}`,
  };
}

module.exports = {
  createLessonFromSynthesiserEnvelope,
};
