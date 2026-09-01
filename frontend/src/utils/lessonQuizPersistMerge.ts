/**
 * Merge lesson.quiz.questions for save payload — mirrors EditLessonPage getLessonPersistPayload().
 */

import { buildPageQuizLessonQuizEntriesFromPages } from "./pageQuizLessonQuizRebuild";

export type PersistMergeQuizQuestion = {
  id: string;
  type?: string;
  question?: string;
  correctAnswer?: string;
  options?: string[];
  pageId?: string;
  sourceQuestionId?: string;
  sourceType?: string;
  tags?: string[];
  explanation?: string;
  [key: string]: unknown;
};

export function mergeLessonQuizQuestionsForPersist(
  sanitizedPages: Array<{ pageId?: string; blocks?: unknown[] }>,
  lessonQuizQuestions: PersistMergeQuizQuestion[]
): PersistMergeQuizQuestion[] {
  const pageQuizQuestions: PersistMergeQuizQuestion[] = [
    ...buildPageQuizLessonQuizEntriesFromPages(sanitizedPages),
  ];

  const pagesCoveredByBlockBank = new Set<string>();
  for (const p of sanitizedPages) {
    const pageId = p.pageId;
    if (!pageId) continue;
    for (const b of p.blocks || []) {
      const block = b as { type?: string; questions?: unknown[]; question?: string; prompt?: string; correctAnswer?: string; questionType?: string; options?: string[]; explanation?: unknown };
      if (block.type !== "pageQuiz") continue;
      const bank = Array.isArray(block.questions) ? block.questions : [];
      if (bank.length > 0) {
        pagesCoveredByBlockBank.add(String(pageId));
        continue;
      }
      const qText = String(block.question ?? block.prompt ?? "").trim();
      if (!qText) continue;
      const correctAnswer = String(block.correctAnswer ?? "").trim();
      if (!correctAnswer) continue;
      const qt = block.questionType === "short" ? "short" : "mcq";
      const opts = Array.isArray(block.options)
        ? block.options.map((o) => String(o ?? "").trim()).filter(Boolean)
        : [];
      if (qt === "mcq" && opts.length < 2) continue;
      pageQuizQuestions.push({
        id: `pq_${pageId}_${pageQuizQuestions.length}`,
        type: qt,
        question: qText,
        options: qt === "mcq" ? opts : undefined,
        correctAnswer,
        explanation: block.explanation != null ? String(block.explanation).trim() : undefined,
        pageId: String(pageId),
      });
    }
  }

  const pageIdsInLesson = new Set(
    sanitizedPages.map((p) => String(p.pageId || "").trim()).filter(Boolean)
  );

  const bankAttachedPageQuiz = lessonQuizQuestions.filter((q) => {
    const pid = String(q?.pageId ?? "").trim();
    if (!pid || pid === "END" || !pageIdsInLesson.has(pid)) return false;
    return Boolean(q.sourceQuestionId || q.sourceType === "topicQuizQuestion");
  });

  const preservedPageScopedQuiz = lessonQuizQuestions.filter((q) => {
    const pid = String(q?.pageId ?? "").trim();
    if (!pid || pid === "END" || !pageIdsInLesson.has(pid)) return false;
    if (q.sourceQuestionId || q.sourceType === "topicQuizQuestion") return false;
    if (pagesCoveredByBlockBank.has(pid)) return false;
    return Boolean(String(q.question || "").trim() && String(q.correctAnswer || "").trim());
  });

  const endOfLessonQuestions = lessonQuizQuestions.filter(
    (q) => !q.pageId || String(q.pageId) === "END"
  );

  return [
    ...pageQuizQuestions,
    ...preservedPageScopedQuiz,
    ...bankAttachedPageQuiz,
    ...endOfLessonQuestions,
  ];
}
