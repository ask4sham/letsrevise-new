/**
 * Explicit payload helpers for GET /api/lessons/:id (Phase 9).
 * Prevents handlers from accidentally leaking full content into FREE_PREVIEW.
 */

/**
 * Canonical lesson owner id (teacher/creator). Use for draft access and ownership checks.
 * Normalizes teacherId, teacher._id, teacher, createdBy so owner detection is deterministic.
 * @param {Object} lesson - Lesson doc (lean or populated).
 * @returns {string|null} Owner id string or null.
 */
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
  "_id", "id", "title", "summary", "subject", "level", "board", "topic", "tier",
  "teacherId", "teacher", "teacherName", "createdAt", "updatedAt", "views",
  "averageRating", "shamCoinPrice", "preview", "status", "isPublished", "isFreePreview",
  "pages", "content", "flashcards",
];

/**
 * Strip answer/markScheme from a page's checkpoint so preview never leaks correct answers.
 * @param {Object} page - One lesson page (may have checkpoint).
 * @returns {Object} Shallow copy of page with checkpoint sanitized.
 */
function sanitizePageForPreview(page) {
  if (!page) return page;
  const out = { ...page };
  if (out.checkpoint && typeof out.checkpoint === "object") {
    const cp = { ...out.checkpoint };
    delete cp.answer;
    delete cp.markScheme;
    delete cp.correctAnswer;
    out.checkpoint = cp;
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
  return {
    ...lesson,
    status,
    isPublished,
    pages: fullPages,
    content: typeof lesson?.content === "string" ? lesson.content : "",
  };
}

module.exports = {
  getLessonOwnerId,
  toLessonPreviewPayload,
  toLessonFullPayload,
  PREVIEW_SAFE_KEYS,
  sanitizePageForPreview,
};
