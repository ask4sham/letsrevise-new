/**
 * Extract activity questions from a lesson block.
 * Prefers questions[]; falls back to legacy single prompt/question fields.
 * Does not invent questions.
 */

export type ActivityQuestionItem = {
  prompt: string;
  questionType: "mcq" | "short";
  options: string[];
  correctAnswer: string;
  explanation?: string;
  markScheme?: string[];
};

function nonEmptyOptions(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  return options.map((o) => String(o ?? "").trim()).filter(Boolean);
}

function markSchemeLines(raw: unknown): string[] | undefined {
  if (Array.isArray(raw)) {
    const lines = raw.map((x) => String(x ?? "").trim()).filter(Boolean);
    return lines.length ? lines : undefined;
  }
  if (typeof raw === "string" && raw.trim()) return [raw.trim()];
  return undefined;
}

function fromRecord(q: Record<string, unknown>): ActivityQuestionItem | null {
  const prompt = String(q.prompt ?? q.question ?? q.questionText ?? q.stem ?? "").trim();
  if (!prompt) return null;
  const options = nonEmptyOptions(q.options);
  const questionType: "mcq" | "short" =
    String(q.questionType ?? "").toLowerCase() === "short" || options.length < 2 ? "short" : "mcq";
  const correctAnswer = String(q.correctAnswer ?? q.answer ?? "").trim();
  if (questionType === "mcq" && options.length < 2) return null;
  return {
    prompt,
    questionType,
    options: questionType === "mcq" ? options.slice(0, 4) : [],
    correctAnswer,
    explanation:
      typeof q.explanation === "string" && q.explanation.trim()
        ? q.explanation.trim()
        : undefined,
    markScheme: markSchemeLines(q.markScheme),
  };
}

/** Honest extraction — empty when block has no stored question data. */
export function extractActivityQuestionsFromBlock(block: unknown): ActivityQuestionItem[] {
  if (!block || typeof block !== "object") return [];
  const b = block as Record<string, unknown>;
  if (Array.isArray(b.questions) && b.questions.length > 0) {
    return b.questions
      .map((q) => (q && typeof q === "object" ? fromRecord(q as Record<string, unknown>) : null))
      .filter((q): q is ActivityQuestionItem => Boolean(q));
  }
  const legacy = fromRecord(b);
  return legacy ? [legacy] : [];
}
