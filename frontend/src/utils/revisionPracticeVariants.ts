/**
 * Build revision-practice MCQs that reinforce checkpoint concepts without repeating exact stems.
 */
import type { DerivedQuizQuestion } from "./deriveLessonRetrieval";
import {
  DEFAULT_DUPLICATE_THRESHOLD,
  isNearDuplicateStem,
  isDuplicateMcqPair,
  mcqFingerprintFromRecord,
  normalizeQuestionStem,
  questionStemFromRecord,
  correctAnswerFromRecord,
} from "./questionStemSimilarity";

type LooseBlock = Record<string, unknown>;

export type CheckpointMcqSource = {
  prompt: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
};

function safeStr(v: unknown): string {
  return v === undefined || v === null ? "" : String(v).trim();
}

function blockType(b: LooseBlock): string {
  return safeStr(b.type).replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function hashSeed(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Deterministic shuffle — same lesson checkpoint always gets same revision order. */
export function shuffleOptionsDeterministic(
  options: string[],
  correctAnswer: string,
  seedKey: string
): { options: string[]; correctAnswer: string } {
  const nonEmpty = options.map((o) => safeStr(o)).filter(Boolean);
  if (nonEmpty.length < 2) return { options: nonEmpty, correctAnswer: safeStr(correctAnswer) };
  const ca = safeStr(correctAnswer);
  let seed = hashSeed(seedKey);
  const arr = [...nonEmpty];
  for (let i = arr.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const correctInList =
    arr.find((o) => o === ca) ||
    arr.find((o) => normalizeQuestionStem(o) === normalizeQuestionStem(ca)) ||
    ca;
  return { options: arr.slice(0, 4), correctAnswer: correctInList };
}

const STEM_TEMPLATES: Array<(prompt: string) => string> = [
  (p) => {
    const t = p.replace(/^what is\s+/i, "Which option best describes ");
    if (t !== p) return t.endsWith("?") ? t : `${t}?`;
    return p.replace(/^what\s+/i, "Which of the following ");
  },
  (p) => `Without looking back at the lesson — ${p}`,
  (p) => {
    const lower = p.trim();
    if (/^which\b/i.test(lower)) return `In revision: ${lower}`;
    return `Which statement is correct? (${lower.replace(/\?$/, "")})`;
  },
];

export function paraphraseRevisionStem(prompt: string, variantIndex: number): string {
  const p = prompt.trim();
  if (!p) return p;
  const fn = STEM_TEMPLATES[variantIndex % STEM_TEMPLATES.length];
  const out = fn(p).trim();
  return out.endsWith("?") ? out : `${out}?`;
}

function collectWrongOptions(pool: CheckpointMcqSource[], correctAnswer: string): string[] {
  const caNorm = normalizeQuestionStem(correctAnswer);
  const wrong: string[] = [];
  for (const item of pool) {
    for (const o of item.options) {
      const t = safeStr(o);
      if (!t) continue;
      if (normalizeQuestionStem(t) === caNorm) continue;
      if (!wrong.includes(t)) wrong.push(t);
    }
  }
  return wrong;
}

export function createRevisionVariantFromCheckpoint(
  source: CheckpointMcqSource,
  variantIndex: number,
  allSources: CheckpointMcqSource[]
): DerivedQuizQuestion | null {
  const prompt = safeStr(source.prompt);
  const baseOpts = source.options.map((o) => safeStr(o)).filter(Boolean);
  const ca = safeStr(source.correctAnswer);
  if (!prompt || baseOpts.length < 2 || !ca) return null;

  let options = [...baseOpts];
  const altWrong = collectWrongOptions(allSources, ca);
  if (altWrong.length > 0 && options.length < 4) {
    for (const w of altWrong) {
      if (options.length >= 4) break;
      if (!options.some((o) => normalizeQuestionStem(o) === normalizeQuestionStem(w))) {
        options.push(w);
      }
    }
  }

  const shuffled = shuffleOptionsDeterministic(options, ca, `${prompt}|rev|${variantIndex}`);
  const question = paraphraseRevisionStem(prompt, variantIndex);

  return {
    id: `derived-rev-${variantIndex + 1}`,
    type: "mcq",
    question,
    options: shuffled.options,
    correctAnswer: shuffled.correctAnswer,
    explanation: source.explanation,
  };
}

export function extractCheckpointMcqFromBlock(b: LooseBlock): CheckpointMcqSource | null {
  const t = blockType(b);
  if (t !== "checkpoint" && t !== "selfcheck" && t !== "quickcheck") return null;
  const prompt = safeStr(b.prompt ?? b.question);
  const opts = Array.isArray(b.options) ? b.options.map((o) => safeStr(o)).filter(Boolean) : [];
  const ca = safeStr(b.correctAnswer ?? b.answer);
  if (!prompt || opts.length < 2 || !ca) return null;
  return {
    prompt,
    options: opts,
    correctAnswer: ca,
    explanation: safeStr(b.explanation) || undefined,
  };
}

function pushCheckpointMcq(
  out: CheckpointMcqSource[],
  seen: Set<string>,
  mcq: CheckpointMcqSource | null
) {
  if (!mcq) return;
  const key = `${normalizeQuestionStem(mcq.prompt)}|${normalizeQuestionStem(mcq.correctAnswer)}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push(mcq);
}

export function collectCheckpointMcqsFromPages(
  pages: Array<{ blocks?: unknown[]; checkpoint?: unknown }>
): CheckpointMcqSource[] {
  const out: CheckpointMcqSource[] = [];
  const seen = new Set<string>();
  for (const p of pages) {
    const legacyCp = p?.checkpoint;
    if (legacyCp && typeof legacyCp === "object") {
      pushCheckpointMcq(out, seen, extractCheckpointMcqFromBlock({
        type: "checkpoint",
        ...(legacyCp as Record<string, unknown>),
      }));
    }
    const blocks = Array.isArray(p?.blocks) ? p.blocks : [];
    for (const raw of blocks) {
      if (!raw || typeof raw !== "object") continue;
      pushCheckpointMcq(out, seen, extractCheckpointMcqFromBlock(raw as LooseBlock));
    }
  }
  return out;
}

export function buildRevisionVariantsFromCheckpoints(
  sources: CheckpointMcqSource[]
): DerivedQuizQuestion[] {
  const variants: DerivedQuizQuestion[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < sources.length && variants.length < 5; i++) {
    const v = createRevisionVariantFromCheckpoint(sources[i], i, sources);
    if (!v) continue;
    if (isNearDuplicateStem(v.question, sources[i].prompt)) {
      v.question = `Revision check: ${sources[i].prompt}`.trim();
    }
    const key = `${normalizeQuestionStem(v.question)}|${normalizeQuestionStem(v.correctAnswer)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    variants.push(v);
  }
  return variants;
}

export function filterQuizRecordsNotMatchingCheckpoints<T extends Record<string, unknown>>(
  questions: T[],
  checkpoints: CheckpointMcqSource[]
): T[] {
  if (!checkpoints.length) return questions;
  return questions.filter((q) => {
    const stem = questionStemFromRecord(q);
    if (!stem) return true;
    return !checkpoints.some((cp) => isNearDuplicateStem(stem, cp.prompt));
  });
}

const QUIZ_STEM_TEMPLATES: Array<(prompt: string) => string> = [
  (p) => {
    if (/^what is (produced|released|formed|made)\s+/i.test(p)) {
      const t = p.replace(/^what is (produced|released|formed|made)\s+/i, "Which substance is released ");
      return t.endsWith("?") ? t : `${t}?`;
    }
    if (/^where does\s+/i.test(p)) {
      const t = p.replace(/^where does\s+/i, "In which part of the cell does ");
      return t.endsWith("?") ? t : `${t}?`;
    }
    if (/^what is\s+/i.test(p)) {
      const t = p.replace(/^what is\s+/i, "Which term best describes ");
      return t.endsWith("?") ? t : `${t}?`;
    }
    if (/^which\b/i.test(p)) return `Select the best answer: ${p}`;
    return p.replace(/^what\s+/i, "Which of the following describes ");
  },
  (p) => {
    const core = p.replace(/\?$/, "").trim();
    return `Which answer best completes this statement about ${core.toLowerCase()}?`;
  },
  (p) => {
    const core = p.replace(/^what (is|are)\s+/i, "").replace(/\?$/, "").trim();
    return `A student is asked about ${core}. Which option is correct?`;
  },
  (p) => `Assessment: choose the most accurate response regarding ${p.replace(/\?$/, "").trim().toLowerCase()}.`,
];

function paraphraseQuizStem(prompt: string, variantIndex: number): string {
  const p = prompt.trim();
  if (!p) return p;
  const fn = QUIZ_STEM_TEMPLATES[variantIndex % QUIZ_STEM_TEMPLATES.length];
  const out = fn(p).trim();
  return out.endsWith("?") ? out : `${out}?`;
}

/** Quiz-page variant: different templates/seed from revision practice. */
export function createQuizVariantFromCheckpoint(
  source: CheckpointMcqSource,
  variantIndex: number,
  allSources: CheckpointMcqSource[]
): DerivedQuizQuestion | null {
  const prompt = safeStr(source.prompt);
  const baseOpts = source.options.map((o) => safeStr(o)).filter(Boolean);
  const ca = safeStr(source.correctAnswer);
  if (!prompt || baseOpts.length < 2 || !ca) return null;

  let options = [...baseOpts];
  const altWrong = collectWrongOptions(allSources, ca);
  for (const w of altWrong) {
    if (options.length >= 4) break;
    if (!options.some((o) => normalizeQuestionStem(o) === normalizeQuestionStem(w))) options.push(w);
  }

  const useInverse = variantIndex % 4 === 3 && baseOpts.length >= 3;
  let correctAnswer = ca;
  let question = paraphraseQuizStem(prompt, variantIndex + 2);

  if (useInverse) {
    const wrong = baseOpts.find((o) => normalizeQuestionStem(o) !== normalizeQuestionStem(ca));
    if (wrong) {
      correctAnswer = wrong;
      const core = prompt.replace(/\?$/, "").trim();
      question = `Which of these is NOT correct? (${core})`;
    }
  }

  const shuffled = shuffleOptionsDeterministic(options, correctAnswer, `${prompt}|quiz|${variantIndex}`);
  if (isNearDuplicateStem(question, prompt)) {
    question = paraphraseQuizStem(prompt, variantIndex + 5);
  }

  return {
    id: `derived-quiz-${variantIndex + 1}`,
    type: "mcq",
    question,
    options: shuffled.options,
    correctAnswer: shuffled.correctAnswer,
    explanation: source.explanation,
  };
}

export function buildQuizVariantsFromCheckpoints(
  sources: CheckpointMcqSource[],
  max = 8
): DerivedQuizQuestion[] {
  const variants: DerivedQuizQuestion[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < sources.length && variants.length < max; i++) {
    const v = createQuizVariantFromCheckpoint(sources[i], i, sources);
    if (!v) continue;
    const key = `${normalizeQuestionStem(v.question)}|${normalizeQuestionStem(v.correctAnswer)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    variants.push(v);
  }
  return variants;
}

export function filterAgainstStemList<T extends Record<string, unknown>>(
  questions: T[],
  excludeStems: string[],
  threshold = DEFAULT_DUPLICATE_THRESHOLD
): T[] {
  if (!excludeStems.length) return questions;
  return questions.filter((q) => {
    const stem = questionStemFromRecord(q);
    if (!stem) return true;
    return !excludeStems.some((ex) => isNearDuplicateStem(stem, ex, threshold));
  });
}
