/**
 * Separates retrieval layers: checkpoint (authored) vs revision practice vs quiz page.
 * Student view only — does not mutate lesson.quiz in the database.
 */
import { deriveLessonRetrieval } from "./deriveLessonRetrieval";
import { collectInlineActivityFingerprints } from "./activityQuestionsFromBlock";
import {
  buildQuizVariantsFromCheckpoints,
  buildEndOfLessonVariantsFromCheckpoints,
  buildRevisionVariantsFromCheckpoints,
  collectCheckpointMcqsFromPages,
  createRevisionVariantFromCheckpoint,
  filterQuizRecordsNotMatchingCheckpoints,
  sourceLinkageKeyFromCheckpoint,
  type CheckpointMcqSource,
} from "./revisionPracticeVariants";
import {
  isRevisionPracticeOverride,
  listRevisionPracticeOverrides,
} from "./revisionPracticeOverrides";
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
  if (tags.some((t) => /page-quiz|pagequiz/i.test(t)) || meta.source === "pageQuiz") return "quiz";
  if (tags.some((t) => /ai/i.test(t)) || meta.source === "ai_lesson_assets") return "ai-generated";
  if (tags.some((t) => /topic-bank|auto-attached/i.test(t))) return "topic-bank";
  return "quiz";
}

function isPageQuizTagged(raw: Record<string, unknown>): boolean {
  const tags = Array.isArray(raw.tags) ? raw.tags.map(String) : [];
  if (tags.some((t) => /page-quiz|pagequiz/i.test(t))) return true;
  const meta = raw.metadata && typeof raw.metadata === "object" ? (raw.metadata as Record<string, unknown>) : {};
  return meta.source === "pageQuiz" || String(raw.sourceType || "").toLowerCase() === "pagequiz";
}

function excludeFingerprints(questions: LayerQuizQuestion[]): Set<string> {
  const seen = new Set<string>();
  for (const q of questions) {
    seen.add(mcqFingerprintFromRecord(q));
    const stem = normalizeQuestionStem(q.question);
    if (stem) seen.add(`stem:${stem}`);
  }
  return seen;
}

function conflictsExcludedPool(
  q: LayerQuizQuestion,
  excluded: LayerQuizQuestion[],
  opts?: { strictPair?: boolean }
): boolean {
  const strictPair = opts?.strictPair !== false;
  return excluded.some((ex) => {
    if (mcqFingerprintFromRecord(ex) === mcqFingerprintFromRecord(q)) return true;
    if (normalizeQuestionStem(ex.question) === normalizeQuestionStem(q.question)) return true;
    if (!strictPair) return false;
    return isDuplicateMcqPair(q, { question: ex.question, correctAnswer: ex.correctAnswer });
  });
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

function conflictsInlineActivity(
  q: LayerQuizQuestion,
  inlineFingerprints: Set<string>
): boolean {
  const fp = mcqFingerprintFromRecord(q);
  if (inlineFingerprints.has(fp)) return true;
  const stemOnly = `stem:${normalizeQuestionStem(q.question)}`;
  return inlineFingerprints.has(stemOnly);
}

/** Revision practice: topic-bank / AI first, then checkpoint-derived variants — never raw checkpoint clones. */
function buildRevisionPracticePoolLegacy(
  pages: Array<{ blocks?: unknown[]; checkpoint?: unknown }>,
  storedQuiz: Array<Record<string, unknown>>,
  max = 5
): LayerQuizQuestion[] {
  const checkpoints = collectCheckpointMcqsFromPages(pages);
  const inlineFingerprints = collectInlineActivityFingerprints(pages);
  const derived = deriveLessonRetrieval(pages);
  const seen = new Set<string>();
  const out: LayerQuizQuestion[] = [];

  const bankFiltered = filterQuizRecordsNotMatchingCheckpoints(storedQuiz, checkpoints);
  for (let i = 0; i < bankFiltered.length && out.length < max; i++) {
    if (isPageQuizTagged(bankFiltered[i])) continue;
    if (isRevisionPracticeOverride(bankFiltered[i])) continue;
    const layer = recordToLayer(bankFiltered[i], inferStoredSource(bankFiltered[i]), "rev-bank", i);
    if (!layer || conflictsCheckpoint(layer, checkpoints)) continue;
    if (conflictsInlineActivity(layer, inlineFingerprints)) continue;
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

function overrideRecordToLayer(
  raw: Record<string, unknown>,
  index: number
): LayerQuizQuestion | null {
  const layer = recordToLayer(raw, "revision", "rev-override", index);
  if (!layer) return null;
  return {
    ...layer,
    questionSource: "revision",
    sourceQuestionId: raw.sourceQuestionId != null ? String(raw.sourceQuestionId) : undefined,
    sourceType: raw.sourceType != null ? String(raw.sourceType) : undefined,
  };
}

function buildRevisionPracticePoolWithOverrides(
  pages: Array<{ blocks?: unknown[]; checkpoint?: unknown }>,
  storedQuiz: Array<Record<string, unknown>>,
  max = 5
): LayerQuizQuestion[] {
  const checkpoints = collectCheckpointMcqsFromPages(pages);
  const inlineFingerprints = collectInlineActivityFingerprints(pages);
  const derived = deriveLessonRetrieval(pages);
  const seen = new Set<string>();
  const out: LayerQuizQuestion[] = [];

  const overrides = listRevisionPracticeOverrides(
    storedQuiz as import("./revisionPracticeOverrides").PersistedLessonQuizQuestion[]
  );
  const overrideByKey = new Map<string, Record<string, unknown>>();
  for (const o of overrides) {
    const key = String(o.sourceQuestionId ?? "").trim();
    if (key) overrideByKey.set(key, o as Record<string, unknown>);
  }

  const checkpointSegments: LayerQuizQuestion[] = [];
  for (let i = 0; i < checkpoints.length; i++) {
    const source = checkpoints[i];
    const linkageKey = sourceLinkageKeyFromCheckpoint(source);
    const override = linkageKey ? overrideByKey.get(linkageKey) : undefined;
    if (override) {
      overrideByKey.delete(linkageKey);
      const layer = overrideRecordToLayer(override, i);
      if (layer && !conflictsInlineActivity(layer, inlineFingerprints)) {
        checkpointSegments.push(layer);
      }
      continue;
    }
    const v = createRevisionVariantFromCheckpoint(source, i, checkpoints);
    if (!v) continue;
    const layer = variantToLayer(v, "variant-generated");
    if (conflictsCheckpoint(layer, checkpoints)) continue;
    checkpointSegments.push(layer);
  }

  const orphanOverrides = Array.from(overrideByKey.values());
  const orphanReserve = orphanOverrides.length;
  const checkpointBudget = Math.max(0, max - orphanReserve);

  for (let i = 0; i < checkpointSegments.length && out.length < checkpointBudget; i++) {
    pushUnique(out, seen, checkpointSegments[i]);
  }

  for (const orphanOverride of orphanOverrides) {
    if (out.length >= max) break;
    const layer = overrideRecordToLayer(orphanOverride, out.length);
    if (layer && !conflictsInlineActivity(layer, inlineFingerprints)) {
      pushUnique(out, seen, layer);
    }
  }

  const bankFiltered = filterQuizRecordsNotMatchingCheckpoints(storedQuiz, checkpoints);
  for (let i = 0; i < bankFiltered.length && out.length < max; i++) {
    if (isPageQuizTagged(bankFiltered[i])) continue;
    if (isRevisionPracticeOverride(bankFiltered[i])) continue;
    const layer = recordToLayer(bankFiltered[i], inferStoredSource(bankFiltered[i]), "rev-bank", i);
    if (!layer || conflictsCheckpoint(layer, checkpoints)) continue;
    if (conflictsInlineActivity(layer, inlineFingerprints)) continue;
    pushUnique(out, seen, layer);
  }

  for (const v of derived.quizQuestions) {
    if (out.length >= max) break;
    // deriveLessonRetrieval also emits checkpoint revision variants (derived-rev-N).
    // Those are already handled per-source in the checkpoint loop above.
    if (String(v.id).startsWith("derived-rev-") && checkpoints.length > 0) continue;
    const layer = variantToLayer(v, "variant-generated");
    if (conflictsCheckpoint(layer, checkpoints)) continue;
    pushUnique(out, seen, layer);
  }

  return out;
}

export function buildRevisionPracticePool(
  pages: Array<{ blocks?: unknown[]; checkpoint?: unknown }>,
  storedQuiz: Array<Record<string, unknown>>,
  max = 5
): LayerQuizQuestion[] {
  const hasOverrides = storedQuiz.some((q) => isRevisionPracticeOverride(q));
  if (!hasOverrides) {
    return buildRevisionPracticePoolLegacy(pages, storedQuiz, max);
  }
  return buildRevisionPracticePoolWithOverrides(pages, storedQuiz, max);
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

/**
 * End-of-lesson test: must never repeat Quiz Page / revision stems.
 * Prefers topic-bank / END items; otherwise builds differently seeded variants.
 */
export function buildEndOfLessonQuizPool(
  pages: Array<{ blocks?: unknown[]; checkpoint?: unknown }>,
  storedQuiz: Array<Record<string, unknown>>,
  pageQuizQuestions: LayerQuizQuestion[],
  revisionPractice: LayerQuizQuestion[],
  opts?: { max?: number }
): LayerQuizQuestion[] {
  const max = opts?.max ?? 8;
  const checkpoints = collectCheckpointMcqsFromPages(pages);
  const excluded = [...pageQuizQuestions, ...revisionPractice];
  const seen = excludeFingerprints(excluded);
  const out: LayerQuizQuestion[] = [];

  const prefer = storedQuiz.filter((q) => {
    if (isPageQuizTagged(q)) return false;
    const pid = String(q.pageId ?? "").trim();
    const source = inferStoredSource(q);
    if (source === "topic-bank" || source === "ai-generated") return true;
    if (pid === "END") return true;
    // Unscoped items that are not page-quiz tagged may still be end-of-lesson bank.
    if (!pid && !isPageQuizTagged(q)) return true;
    return false;
  });

  for (let i = 0; i < prefer.length && out.length < max; i++) {
    const layer = recordToLayer(prefer[i], inferStoredSource(prefer[i]), "eol-bank", i);
    if (!layer) continue;
    if (conflictsCheckpoint(layer, checkpoints)) continue;
    // Strict against Quiz Page; stem-only against revision so EOL can still fill.
    if (conflictsExcludedPool(layer, pageQuizQuestions, { strictPair: true })) continue;
    if (conflictsExcludedPool(layer, revisionPractice, { strictPair: false })) continue;
    pushUnique(out, seen, { ...layer, questionSource: layer.questionSource === "quiz" ? "topic-bank" : layer.questionSource });
  }

  // Differently seeded variants ONLY when Quiz Page has no bank items yet.
  // Prefer an empty EOL over paraphrasing the same checkpoint set (repeat questions).
  if (pageQuizQuestions.length === 0) {
    for (const v of buildEndOfLessonVariantsFromCheckpoints(checkpoints, max)) {
      if (out.length >= max) break;
      let stem = String(v.question || "").trim();
      if (!/^end-of-lesson\b/i.test(stem)) {
        stem = `End-of-lesson: ${stem.replace(/^\?+/, "").trim()}`;
      }
      if (!stem.endsWith("?")) stem = `${stem.replace(/\?+$/, "")}?`;
      const layer = variantToLayer({ ...v, question: stem }, "variant-generated");
      if (conflictsExcludedPool(layer, pageQuizQuestions, { strictPair: true })) continue;
      if (conflictsExcludedPool(layer, revisionPractice, { strictPair: false })) continue;
      if (conflictsExcludedPool(layer, out, { strictPair: false })) continue;
      pushUnique(out, seen, layer);
    }
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
