/**
 * Build lesson.quiz.questions entries from inline pageQuiz block banks.
 * Mirrors EditLessonPage getLessonPersistPayload pageQuiz merge logic.
 */

export type PageQuizLessonQuizEntry = {
  id: string;
  type: "mcq" | "short";
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  purpose?: string;
  tags: string[];
  marks: number;
  pageId: string;
  sourceType: "pageQuiz";
};

export function buildPageQuizLessonQuizEntriesFromPages(
  pages: Array<{ pageId?: string; blocks?: unknown[] }>
): PageQuizLessonQuizEntry[] {
  const pageQuizQuestions: PageQuizLessonQuizEntry[] = [];

  for (const p of pages) {
    const pageId = p.pageId;
    if (!pageId) continue;

    for (const block of p.blocks || []) {
      if (!block || typeof block !== "object") continue;
      const b = block as Record<string, unknown>;
      if (b.type !== "pageQuiz") continue;

      const bank = Array.isArray(b.questions)
        ? (b.questions as Array<Record<string, unknown>>)
        : [];
      if (bank.length === 0) continue;

      bank.forEach((raw, qi) => {
        const qText = String(raw.prompt ?? raw.question ?? "").trim();
        const correctAnswer = String(raw.correctAnswer ?? "").trim();
        if (!qText || !correctAnswer) return;

        const qt =
          String(raw.questionType ?? raw.type ?? "").toLowerCase() === "short" ? "short" : "mcq";
        const opts = Array.isArray(raw.options)
          ? raw.options.map((o) => String(o ?? "").trim()).filter(Boolean)
          : [];
        if (qt === "mcq" && opts.length < 2) return;

        pageQuizQuestions.push({
          id: String(raw.id || `pq_${pageId}_${qi}_${Date.now()}`),
          type: qt,
          question: qText,
          options: qt === "mcq" ? opts : undefined,
          correctAnswer,
          explanation: raw.explanation != null ? String(raw.explanation).trim() : undefined,
          purpose: raw.purpose != null ? String(raw.purpose).trim() : undefined,
          tags: Array.isArray(raw.tags)
            ? [...raw.tags.map((t) => String(t ?? "").trim()).filter(Boolean), "page-quiz"]
            : ["page-quiz"],
          marks: Number(raw.marks) > 0 ? Number(raw.marks) : 1,
          pageId: String(pageId),
          sourceType: "pageQuiz",
        });
      });
    }
  }

  return pageQuizQuestions;
}
