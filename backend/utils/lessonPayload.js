/**
 * Explicit payload helpers for GET /api/lessons/:id (Phase 9).
 * Prevents handlers from accidentally leaking full content into FREE_PREVIEW.
 */
const { topicToKey } = require("./topicTaxonomy");

/**
 * Canonical lesson owner id (teacher/creator). Use for draft access and ownership checks.
 * Normalizes teacherId, teacher._id, teacher, createdBy so owner detection is deterministic.
 * @param {Object} lesson - Lesson doc (lean or populated).
 * @returns {string|null} Owner id string or null.
 */
/**
 * Remove keyword-bank auto-mark config so students cannot see rubric answers (GET full lesson).
 * Teachers/admins receive unmodified pages via caller.
 * @param {Object} lesson - Lesson doc (mutates copy only)
 * @returns {Object} Lesson-like object with checkpoint.autoMark removed from each page.
 */
function stripCheckpointAutoMarkFromLesson(lesson) {
  if (!lesson || !Array.isArray(lesson.pages)) return lesson;
  const pages = lesson.pages.map((p) => {
    if (!p?.checkpoint || typeof p.checkpoint !== "object") return p;
    const cp = { ...p.checkpoint };
    delete cp.autoMark;
    return { ...p, checkpoint: cp };
  });
  return { ...lesson, pages };
}

function getLessonOwnerId(lesson) {
  if (!lesson) return null;
  const raw =
    lesson.teacherId ??
    lesson.createdBy ??
    (lesson.teacher && typeof lesson.teacher === "object" ? lesson.teacher._id : null) ??
    (lesson.teacher && typeof lesson.teacher !== "object" ? lesson.teacher : null);
  return raw != null ? String(raw) : null;
}

/** Allowed top-level keys for free-preview response (no quiz, no full pages/flashcards). */
const PREVIEW_SAFE_KEYS = [
  "_id", "id", "title", "description", "summary", "subject", "level", "board", "examBoard", "topic", "tier",
  "teacherId", "teacher", "teacherName", "createdAt", "updatedAt", "views",
  "averageRating", "preview", "status", "isPublished", "isFreePreview",
  "pages", "content", "flashcards", "assessmentPaperIds",
];

/**
 * Strip answer/markScheme from a page's checkpoint so preview never leaks correct answers.
 * Also strip correctAnswer/explanation from any block with type "checkpoint".
 * @param {Object} page - One lesson page (may have checkpoint and blocks).
 * @returns {Object} Shallow copy of page with checkpoint(s) sanitized.
 */
function sanitizePageForPreview(page) {
  if (!page) return page;
  const out = { ...page };
  if (out.checkpoint && typeof out.checkpoint === "object") {
    const cp = { ...out.checkpoint };
    delete cp.answer;
    delete cp.markScheme;
    delete cp.correctAnswer;
    delete cp.autoMark;
    out.checkpoint = cp;
  }
  if (Array.isArray(out.blocks)) {
    out.blocks = out.blocks.map((b) => {
      if (b && b.type === "checkpoint") {
        const { explanation, ...rest } = b;
        // Keep correctAnswer so frontend can show Correct/Not quite without revealing which option; never send explanation in preview
        return rest;
      }
      // Diagram blocks: allow in preview; PR11: include mode, annotations, steps; AI image fallback
      if (b && b.type === "diagram") {
        const out = {
          type: "diagram",
          visualId: b.visualId,
          caption: typeof b.caption === "string" ? b.caption : "",
          mode: ["static", "annotated", "step"].includes(b.mode) ? b.mode : "static",
        };
        if (Array.isArray(b.annotations)) out.annotations = b.annotations;
        if (Array.isArray(b.steps)) out.steps = b.steps;
        if (Array.isArray(b.connectors)) out.connectors = b.connectors;
        if (typeof b.imageUrl === "string" && b.imageUrl.trim()) out.imageUrl = b.imageUrl.trim();
        if (typeof b.imageSource === "string" && b.imageSource.trim()) out.imageSource = b.imageSource.trim();
        if (typeof b.alt === "string" && b.alt.trim()) out.alt = b.alt.trim();
        return out;
      }
      return b;
    });
  }
  return out;
}

/**
 * Build response for FREE_PREVIEW: first page only, no quiz, flashcards empty.
 * Checkpoints in the first page are sanitized (no answer/markScheme) so preview is revenue-safe.
 * @param {Object} lesson - Lesson doc (e.g. after attachVisualsToPagesIfPossible).
 * @returns {Object} Safe payload for 200 response.
 */
function toLessonPreviewPayload(lesson) {
  const fullPages = Array.isArray(lesson?.pages) ? lesson.pages : [];
  const firstPage = fullPages.length > 0 ? sanitizePageForPreview(fullPages[0]) : [];
  const firstPageOnly = firstPage ? [firstPage] : [];
  const payload = {};
  for (const k of PREVIEW_SAFE_KEYS) {
    if (lesson[k] !== undefined) payload[k] = lesson[k];
  }
  // PR0: canonical examBoard (stored as board; lean() has no virtuals)
  payload.examBoard = lesson?.examBoard ?? lesson?.board ?? "";
  payload.status = lesson?.status ?? (lesson?.isPublished ? "published" : "draft");
  payload.isPublished = String(payload.status).toLowerCase() === "published";
  payload.isFreePreview = !!lesson.isFreePreview;
  payload.pages = firstPageOnly;
  payload.flashcards = [];
  payload.content = typeof lesson?.content === "string" ? lesson.content : "";
  delete payload.quiz;
  return payload;
}

/**
 * Build full lesson response for SUB_ACTIVE / PURCHASED / ADMIN / OWNER.
 * Explicit shape so we can add fields in one place and not leak elsewhere.
 * @param {Object} lesson - Lesson doc (e.g. after attachVisualsToPagesIfPossible).
 * @returns {Object} Full payload for 200 response.
 */
function toLessonFullPayload(lesson) {
  const fullPages = Array.isArray(lesson?.pages) ? lesson.pages : [];
  const status = lesson?.status ?? (lesson?.isPublished ? "published" : "draft");
  const isPublished = String(status).toLowerCase() === "published";
  const out = {
    ...lesson,
    status,
    isPublished,
    pages: fullPages,
    content: typeof lesson?.content === "string" ? lesson.content : "",
  };
  // PR0: canonical examBoard (stored as board; lean() has no virtuals)
  out.examBoard = lesson?.examBoard ?? lesson?.board ?? "";
  // Lesson Integrity: topicKey for bank linkage (derived from topic if not stored)
  out.topicKey =
    (lesson?.topicKey && String(lesson.topicKey).trim()) ||
    (lesson?.topic && topicToKey(lesson.topic)) ||
    "";
  return out;
}

module.exports = {
  getLessonOwnerId,
  toLessonPreviewPayload,
  toLessonFullPayload,
  PREVIEW_SAFE_KEYS,
  sanitizePageForPreview,
  stripCheckpointAutoMarkFromLesson,
};
