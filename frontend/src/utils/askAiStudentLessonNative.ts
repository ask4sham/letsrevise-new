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

/** Consistent student-facing tutor identity. */
export const ASK_SHAM_HEADING = "Ask Sham";

export const ASK_SHAM_SUBCOPY =
  "Your AI tutor for this lesson. Answers use trusted LetsRevise sources.";

export function buildStudentTutorHeading(
  _pageTitle?: string | null,
  _lessonTitle?: string | null
): string {
  return ASK_SHAM_HEADING;
}

export function buildStudentTutorSubcopy(
  _pageTitle?: string | null,
  _lessonTitle?: string | null
): string {
  return ASK_SHAM_SUBCOPY;
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
