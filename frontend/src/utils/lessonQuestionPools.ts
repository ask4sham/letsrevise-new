/**
 * Separates retrieval layers: checkpoint (authored) vs revision practice vs quiz page.
 * Student view only — does not mutate lesson.quiz in the database.
 */
import { deriveLessonRetrieval } from "./deriveLessonRetrieval";
import {
  buildQuizVariantsFromCheckpoints,
  buildRevisionVariantsFromCheckpoints,
  collectCheckpointMcqsFromPages,
  filterQuizRecordsNotMatchingCheckpoints,
  type CheckpointMcqSource,
} from "./revisionPracticeVariants";
import {
  isDuplicateMcqPair,
  mcqFingerprintFromRecord,
  normalizeQuestionStem,
  questionStemFromRecord,
  correctAnswerFromRecord,
} from "./questionStemSimilarity";

export type QuestionSource =
  | "checkpoint"
  | "revision"
  | "quiz"
  | "ai-generated"
  | "variant-generated"
  | "topic-bank";

export type LayerQuizQuestion = {
  id: string;
  type: "mcq";
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  questionSource: QuestionSource;
  pageId?: string;
  [key: string]: unknown;
};

function inferStoredSource(raw: Record<string, unknown>): QuestionSource {
  const tags = Array.isArray(raw.tags) ? raw.tags.map(String) : [];
  const meta = raw.metadata && typeof raw.metadata === "object" ? (raw.metadata as Record<string, unknown>) : {};
  if (tags.some((t) => /ai/i.test(t)) || meta.source === "ai_lesson_assets") return "ai-generated";
  if (tags.some((t) => /topic-bank|auto-attached/i.test(t))) return "topic-bank";
  return "quiz";
}

function recordToLayer(
  raw: Record<string, unknown>,
  questionSource: QuestionSource,
  idPrefix: string,
  index: number
): LayerQuizQuestion | null {
  const question = questionStemFromRecord(raw);
  const correctAnswer = correctAnswerFromRecord(raw);
  const opts = Array.isArray(raw.options)
    ? raw.options.map((o) => String(o ?? "").trim()).filter(Boolean)
    : Array.isArray(raw.choices)
      ? raw.choices.map((o) => String(o ?? "").trim()).filter(Boolean)
      : [];
  if (!question || opts.length < 2 || !correctAnswer) return null;
  return {
    ...raw,
    id: String(raw.id ?? raw._id ?? `${idPrefix}-${index}`),
    type: "mcq",
    question,
    options: opts.slice(0, 4),
    correctAnswer,
    explanation: raw.explanation != null ? String(raw.explanation) : undefined,
    questionSource,
    pageId: raw.pageId != null ? String(raw.pageId) : undefined,
  };
}

function variantToLayer(
  v: { id: string; question: string; options: string[]; correctAnswer: string; explanation?: string },
  questionSource: QuestionSource,
  pageId?: string
): LayerQuizQuestion {
  return {
    id: v.id,
    type: "mcq",
    question: v.question,
    options: v.options,
    correctAnswer: v.correctAnswer,
    explanation: v.explanation,
    questionSource,
    pageId,
  };
}

function pushUnique(out: LayerQuizQuestion[], seen: Set<string>, q: LayerQuizQuestion | null) {
  if (!q) return;
  const fp = mcqFingerprintFromRecord(q);
  if (seen.has(fp)) return;
  seen.add(fp);
  out.push(q);
}

function conflictsCheckpoint(q: LayerQuizQuestion, checkpoints: CheckpointMcqSource[]): boolean {
  return checkpoints.some((cp) => {
    if (normalizeQuestionStem(q.question) === normalizeQuestionStem(cp.prompt)) return true;
    if (q.questionSource === "variant-generated") return false;
    return isDuplicateMcqPair(q, { question: cp.prompt, correctAnswer: cp.correctAnswer });
  });
}

/** Quiz page: exclude checkpoint clones and exact revision duplicates (not fuzzy concept overlap). */
function conflictsQuizLayer(
  q: LayerQuizQuestion,
  checkpoints: CheckpointMcqSource[],
  revisionPractice: LayerQuizQuestion[]
): boolean {
  if (conflictsCheckpoint(q, checkpoints)) return true;
  return revisionPractice.some(
    (rev) =>
      mcqFingerprintFromRecord(rev) === mcqFingerprintFromRecord(q) ||
      normalizeQuestionStem(rev.question) === normalizeQuestionStem(q.question)
  );
}

/** Revision practice: topic-bank / AI first, then checkpoint-derived variants — never raw checkpoint clones. */
export function buildRevisionPracticePool(
  pages: Array<{ blocks?: unknown[]; checkpoint?: unknown }>,
  storedQuiz: Array<Record<string, unknown>>,
  max = 5
): LayerQuizQuestion[] {
  const checkpoints = collectCheckpointMcqsFromPages(pages);
  const derived = deriveLessonRetrieval(pages);
  const seen = new Set<string>();
  const out: LayerQuizQuestion[] = [];

  const bankFiltered = filterQuizRecordsNotMatchingCheckpoints(storedQuiz, checkpoints);
  for (let i = 0; i < bankFiltered.length && out.length < max; i++) {
    const layer = recordToLayer(bankFiltered[i], inferStoredSource(bankFiltered[i]), "rev-bank", i);
    if (!layer || conflictsCheckpoint(layer, checkpoints)) continue;
    pushUnique(out, seen, layer);
  }

  for (const v of buildRevisionVariantsFromCheckpoints(checkpoints)) {
    if (out.length >= max) break;
    const layer = variantToLayer(v, "variant-generated");
    if (conflictsCheckpoint(layer, checkpoints)) continue;
    pushUnique(out, seen, layer);
  }

  for (const v of derived.quizQuestions) {
    if (out.length >= max) break;
    const layer = variantToLayer(v, "variant-generated");
    if (conflictsCheckpoint(layer, checkpoints)) continue;
    pushUnique(out, seen, layer);
  }

  return out;
}

/** Quiz page: excludes checkpoint + revision stems; prefers bank/AI, then quiz-style variants. */
export function buildQuizPagePool(
  pages: Array<{ blocks?: unknown[]; checkpoint?: unknown }>,
  storedQuiz: Array<Record<string, unknown>>,
  revisionPractice: LayerQuizQuestion[],
  opts?: { pageId?: string; max?: number }
): LayerQuizQuestion[] {
  const max = opts?.max ?? 8;
  const pageId = opts?.pageId?.trim();
  const checkpoints = collectCheckpointMcqsFromPages(pages);
  let scoped = storedQuiz;
  if (pageId) {
    scoped = storedQuiz.filter((q) => {
      const pid = String(q.pageId ?? "").trim();
      return pid === pageId || (!pid && storedQuiz.length <= 12);
    });
  }

  const seen = new Set<string>();
  const out: LayerQuizQuestion[] = [];

  const bankFiltered = filterQuizRecordsNotMatchingCheckpoints(scoped, checkpoints);

  for (let i = 0; i < bankFiltered.length && out.length < max; i++) {
    const layer = recordToLayer(bankFiltered[i], inferStoredSource(bankFiltered[i]), "quiz-bank", i);
    if (!layer) continue;
    if (conflictsQuizLayer(layer, checkpoints, revisionPractice)) continue;
    pushUnique(out, seen, { ...layer, questionSource: layer.questionSource, pageId: pageId || layer.pageId });
  }

  for (const v of buildQuizVariantsFromCheckpoints(checkpoints, max)) {
    if (out.length >= max) break;
    const layer = variantToLayer(v, "variant-generated", pageId);
    if (conflictsQuizLayer(layer, checkpoints, revisionPractice)) continue;
    pushUnique(out, seen, layer);
  }

  return out;
}

/** One pass for LessonView: revision + quiz page layers. */
export function buildLessonQuestionLayers(
  pages: Array<{ blocks?: unknown[]; checkpoint?: unknown }>,
  storedQuiz: Array<Record<string, unknown>>
): { revisionPractice: LayerQuizQuestion[]; quizPage: LayerQuizQuestion[] } {
  const revisionPractice = buildRevisionPracticePool(pages, storedQuiz);
  const quizPage = buildQuizPagePool(pages, storedQuiz, revisionPractice);
  return { revisionPractice, quizPage };
}
