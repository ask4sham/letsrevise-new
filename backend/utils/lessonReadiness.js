/**
 * PR7: Single source of truth for lesson readiness (computed, not stored).
 * Used by teacher list, editor, and POST /review response.
 */

/**
 * Count diagram blocks (type === "diagram") across all pages.
 * Includes both VisualModel-backed and ai_fallback diagrams so readiness shows Diagrams: 1.
 */
function countDiagramBlocks(lesson) {
  const pages = Array.isArray(lesson?.pages) ? lesson.pages : [];
  let n = 0;
  for (const page of pages) {
    const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
    for (const b of blocks) {
      if (b?.type === "diagram") n += 1;
    }
  }
  return n;
}

function isValidPageCheckpoint(cp) {
  if (!cp || typeof cp !== "object") return false;
  const question = typeof cp.question === "string" ? cp.question.trim() : "";
  if (!question) return false;
  const options = Array.isArray(cp.options) ? cp.options : [];
  const filledOptions = options.filter((o) => String(o ?? "").trim()).length;
  if (filledOptions < 2) return false;
  const answer =
    typeof cp.answer === "string"
      ? cp.answer.trim()
      : typeof cp.correctAnswer === "string"
        ? cp.correctAnswer.trim()
        : "";
  return answer.length > 0;
}

function isValidBlockCheckpoint(b) {
  if (!b || b.type !== "checkpoint") return false;
  const prompt =
    typeof b.prompt === "string"
      ? b.prompt.trim()
      : typeof b.question === "string"
        ? b.question.trim()
        : "";
  return prompt.length > 0;
}

/** At most one checkpoint credit per page (block-level or page.checkpoint). */
function pageHasValidCheckpoint(page) {
  const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
  if (blocks.some(isValidBlockCheckpoint)) return true;
  return isValidPageCheckpoint(page?.checkpoint);
}

/**
 * Count pages with a valid checkpoint (block type checkpoint or page.checkpoint).
 * Max 1 per page; selfCheck blocks are not counted.
 */
function countCheckpointBlocks(lesson) {
  const pages = Array.isArray(lesson?.pages) ? lesson.pages : [];
  let n = 0;
  for (const page of pages) {
    if (pageHasValidCheckpoint(page)) n += 1;
  }
  return n;
}

/**
 * Compute readiness for a lesson (plain object or mongoose doc).
 * @param {Object} lesson - Lesson with pages, examQuestions, status, isPublished, reviewedAt, reviewedBy.
 * @returns {{ score: number, status: "DRAFT"|"NEEDS_REVIEW"|"READY", signals: Object }}
 */
function computeLessonReadiness(lesson) {
  const diagramCount = countDiagramBlocks(lesson);
  const checkpointCount = countCheckpointBlocks(lesson);
  const practiceCount = Array.isArray(lesson?.examQuestions) ? lesson.examQuestions.length : 0;
  const hasDiagrams = diagramCount > 0;
  const hasCheckpoints = checkpointCount > 0;
  const hasPracticeQuestions = practiceCount > 0;
  const isReviewed = !!(lesson?.reviewedAt != null && lesson.reviewedAt);
  const statusRaw = lesson?.status ?? (lesson?.isPublished ? "published" : "draft");
  const isPublished =
    String(statusRaw).toLowerCase() === "published" || !!lesson?.isPublished;

  const missing = [];
  if (!hasCheckpoints) missing.push("NO_CHECKPOINTS");
  if (!hasDiagrams) missing.push("NO_DIAGRAMS");
  if (!hasPracticeQuestions) missing.push("NO_PRACTICE");
  if (!isReviewed) missing.push("NOT_REVIEWED");

  let status;
  if (!isPublished) {
    status = "DRAFT";
  } else if (hasDiagrams && hasCheckpoints && isReviewed) {
    status = "READY";
  } else {
    status = "NEEDS_REVIEW";
  }

  let score = 0;
  if (hasCheckpoints) score += 30;
  if (hasDiagrams) score += 20;
  if (hasPracticeQuestions) score += 20;
  if (isReviewed) score += 30;
  score = Math.min(100, Math.max(0, score));

  return {
    score,
    status,
    signals: {
      hasDiagrams,
      diagramCount,
      hasCheckpoints,
      checkpointCount,
      hasPracticeQuestions,
      practiceCount,
      isPublished,
      isReviewed,
      missing,
    },
  };
}

module.exports = {
  computeLessonReadiness,
  countDiagramBlocks,
  countCheckpointBlocks,
  isValidPageCheckpoint,
  isValidBlockCheckpoint,
  pageHasValidCheckpoint,
};
