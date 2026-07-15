/**
 * Preserve multi-question activity banks (V2 selfCheck / checkpoint / pageQuiz)
 * across EditLessonPage hydrate → persist round-trips.
 */

export type ActivityBankQuestion = {
  id?: string;
  prompt?: string;
  question?: string;
  questionType?: string;
  type?: string;
  options?: string[];
  correctAnswer?: string;
  purpose?: string;
  marks?: number;
  tags?: string[];
  explanation?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

function asTrimmedString(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

/**
 * Normalise one bank question for editor state / PUT payload.
 */
export function normalizeActivityBankQuestion(raw: unknown, index = 0): ActivityBankQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const q = raw as Record<string, unknown>;
  const prompt = asTrimmedString(q.prompt || q.question);
  if (!prompt) return null;

  const questionTypeRaw = asTrimmedString(q.questionType || q.type).toLowerCase();
  const questionType = questionTypeRaw === "mcq" ? "mcq" : "short";
  const options = Array.isArray(q.options)
    ? q.options.map((o) => asTrimmedString(o)).filter(Boolean)
    : [];

  const out: ActivityBankQuestion = {
    id: asTrimmedString(q.id) || `q${index + 1}`,
    prompt,
    question: prompt,
    questionType,
    type: questionType,
    options: questionType === "mcq" ? options : [],
    correctAnswer: asTrimmedString(q.correctAnswer ?? q.answer),
  };

  const purpose = asTrimmedString(q.purpose);
  if (purpose) out.purpose = purpose;

  const marks = Number(q.marks);
  if (Number.isFinite(marks) && marks > 0) out.marks = marks;

  if (Array.isArray(q.tags)) {
    out.tags = q.tags.map((t) => asTrimmedString(t)).filter(Boolean);
  }

  const explanation = asTrimmedString(q.explanation);
  if (explanation) out.explanation = explanation;

  if (q.metadata && typeof q.metadata === "object") {
    out.metadata = q.metadata as Record<string, unknown>;
  }

  return out;
}

/**
 * Hydrate / persist `block.questions` when present. Returns undefined when absent/empty
 * so legacy single-prompt blocks stay unchanged.
 */
export function preserveActivityQuestions(
  raw: unknown
): ActivityBankQuestion[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: ActivityBankQuestion[] = [];
  raw.forEach((item, i) => {
    const n = normalizeActivityBankQuestion(item, i);
    if (n) out.push(n);
  });
  return out.length ? out : undefined;
}

/**
 * Attach preserved questions[] onto a hydrated/persisted activity block object.
 */
export function withPreservedActivityQuestions<T extends Record<string, unknown>>(
  blockOut: T,
  sourceBlock: { questions?: unknown }
): T {
  const qs = preserveActivityQuestions(sourceBlock?.questions);
  if (qs) {
    return { ...blockOut, questions: qs };
  }
  return blockOut;
}

/**
 * True when a block carries a multi-question bank (V2-style).
 */
export function hasActivityQuestionBank(block: { questions?: unknown } | null | undefined): boolean {
  return Array.isArray(block?.questions) && block!.questions!.length > 0;
}
