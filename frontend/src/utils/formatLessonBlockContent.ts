/**
 * Teacher-First V1 presentation cleanup on import — mirrors generator lessonPresentationCleanup.js.
 */

const OBJECTIVES_INTRO_RES = [
  /^<p>\s*At the end of this lesson, you should be able to:\s*<\/p>\s*/i,
  /^<p>\s*By the end you should be able to\.\.\.\s*<\/p>\s*/i,
  /^<p>\s*By the end you should be able to:\s*<\/p>\s*/i,
];

const LEADING_DUPLICATE_HEADING_RES = [
  /^<h[1-6][^>]*>\s*<strong>\s*Revision objectives\s*<\/strong>\s*<\/h[1-6]>\s*/i,
  /^<h[1-6][^>]*>\s*<strong>\s*Lesson objectives\s*<\/strong>\s*<\/h[1-6]>\s*/i,
  /^<h[1-6][^>]*>\s*<strong>\s*Definition\s*<\/strong>\s*<\/h[1-6]>\s*/i,
  /^<h[1-6][^>]*>\s*<strong>\s*Why it matters\s*<\/strong>\s*<\/h[1-6]>\s*/i,
  /^<h[1-6][^>]*>\s*<strong>\s*Core model\s*<\/strong>\s*<\/h[1-6]>\s*/i,
  /^<h[1-6][^>]*>\s*<strong>\s*Key examples\s*<\/strong>\s*<\/h[1-6]>\s*/i,
  /^<h[1-6][^>]*>\s*<strong>\s*Exam vocabulary\s*<\/strong>\s*<\/h[1-6]>\s*/i,
  /^<h[1-6][^>]*>\s*<strong>\s*Keywords\s*<\/strong>\s*<\/h[1-6]>\s*/i,
  /^<h[1-6][^>]*>\s*<strong>\s*Summary\s*<\/strong>\s*<\/h[1-6]>\s*/i,
  /^<p>\s*<strong>(?:👉\s*)?(?:🎯\s*)?Revision Objectives<\/strong>\s*<\/p>\s*/i,
  /^<p>\s*<strong>(?:👉\s*)?(?:🎯\s*)?Lesson Objectives<\/strong>\s*<\/p>\s*/i,
  /^<p>\s*<strong>(?:👉\s*)?Keywords<\/strong>\s*<\/p>\s*/i,
];

function stripLeadingPatterns(text: string, patterns: RegExp[]): string {
  let out = String(text || "").trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of patterns) {
      const next = out.replace(re, "");
      if (next !== out) {
        out = next.trim();
        changed = true;
        break;
      }
    }
  }
  return out;
}

export function formatLessonBlockContentForImport(content = ""): string {
  let out = stripLeadingPatterns(content, LEADING_DUPLICATE_HEADING_RES);
  out = stripLeadingPatterns(out, OBJECTIVES_INTRO_RES);
  out = stripLeadingPatterns(out, LEADING_DUPLICATE_HEADING_RES);
  return out.replace(/\n{3,}/g, "\n\n").trim();
}
