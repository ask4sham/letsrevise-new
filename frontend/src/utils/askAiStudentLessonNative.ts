/**
 * Slice 3 — Lesson-native Ask AI copy helpers (student panel only).
 * Display / prompt wording only — does not change enquiry API shape.
 */

function trimTitle(value?: string | null): string {
  return value == null ? "" : String(value).trim();
}

function truncateTitle(value: string, max = 48): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function buildStudentTutorHeading(
  pageTitle?: string | null,
  lessonTitle?: string | null
): string {
  const page = trimTitle(pageTitle);
  const lesson = trimTitle(lessonTitle);
  if (page) return `Ask about ${page}`;
  if (lesson) return `Ask about ${lesson}`;
  return "Ask for help on this topic";
}

export function buildStudentTutorSubcopy(
  pageTitle?: string | null,
  lessonTitle?: string | null
): string {
  const page = trimTitle(pageTitle);
  const lesson = trimTitle(lessonTitle);
  if (page && lesson && page.toLowerCase() !== lesson.toLowerCase()) {
    return `Questions stay grounded to this lesson (${lesson} — ${page}). Tutor actions use the same thread; only your latest exchange is shown.`;
  }
  if (lesson) {
    return `Questions stay grounded to this lesson (${lesson}). Tutor actions use the same thread; only your latest exchange is shown.`;
  }
  if (page) {
    return `Questions stay grounded to this page (${page}). Tutor actions use the same thread; only your latest exchange is shown.`;
  }
  return "Ask a question about this lesson… Tutor actions and follow-ups still use the same thread; only your latest exchange is shown here.";
}

export function buildStudentTutorPlaceholder(
  pageTitle?: string | null,
  lessonTitle?: string | null
): string {
  const label = trimTitle(pageTitle) || trimTitle(lessonTitle);
  if (label) {
    return `e.g. What do I need to know about ${truncateTitle(label)}?`;
  }
  return "e.g. What do I need to know about…? / Explain simpler";
}

export type LessonNativeStarterChip = {
  label: string;
  prompt: string;
};

/** Page/lesson-named starter chips (max 2). Empty when titles missing. */
export function buildLessonNativeStarterChips(
  pageTitle?: string | null,
  lessonTitle?: string | null
): LessonNativeStarterChip[] {
  const page = trimTitle(pageTitle);
  const lesson = trimTitle(lessonTitle);
  const chips: LessonNativeStarterChip[] = [];
  if (page) {
    chips.push({
      label: "Explain this page",
      prompt: `Explain "${page}" from this lesson in simple terms.`,
    });
  }
  if (lesson) {
    chips.push({
      label: "What should I remember?",
      prompt: `What should I remember from "${lesson}" for the exam?`,
    });
  }
  return chips.slice(0, 2);
}
