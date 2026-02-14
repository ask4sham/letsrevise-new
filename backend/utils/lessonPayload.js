/**
 * Explicit payload helpers for GET /api/lessons/:id (Phase 9).
 * Prevents handlers from accidentally leaking full content into FREE_PREVIEW.
 */

/** Allowed top-level keys for free-preview response (no quiz, no full pages/flashcards). */
const PREVIEW_SAFE_KEYS = [
  "_id", "id", "title", "summary", "subject", "level", "board", "topic", "tier",
  "teacherId", "teacher", "teacherName", "createdAt", "updatedAt", "views",
  "averageRating", "shamCoinPrice", "preview", "status", "isPublished", "isFreePreview",
  "pages", "content", "flashcards",
];

/**
 * Build response for FREE_PREVIEW: first page only, no quiz, flashcards empty.
 * Explicit allowlist so new lesson fields never leak into preview by default.
 * @param {Object} lesson - Lesson doc (e.g. after attachVisualsToPagesIfPossible).
 * @returns {Object} Safe payload for 200 response.
 */
function toLessonPreviewPayload(lesson) {
  const fullPages = Array.isArray(lesson?.pages) ? lesson.pages : [];
  const firstPageOnly = fullPages.length > 0 ? [fullPages[0]] : [];
  const payload = {};
  for (const k of PREVIEW_SAFE_KEYS) {
    if (lesson[k] !== undefined) payload[k] = lesson[k];
  }
  payload.status = lesson?.status ?? (lesson?.isPublished ? "published" : "draft");
  payload.isPublished = String(payload.status).toLowerCase() === "published";
  payload.isFreePreview = true;
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
  toLessonPreviewPayload,
  toLessonFullPayload,
  PREVIEW_SAFE_KEYS,
};
