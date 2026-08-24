/**
 * Extract activity questions from a lesson block.
 * Prefers questions[]; falls back to legacy single prompt/question fields.
 * Does not invent questions.
 */
import {
  mcqFingerprintFromStemAndAnswer,
  normalizeQuestionStem,
} from "./questionStemSimilarity";
import {
  hasRenderableExamPracticeContent,
  stripDuplicateExamPracticeSections,
} from "./formatExamPracticeContent";

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
  const typeHint = String(q.questionType ?? q.type ?? "").toLowerCase();
  const questionType: "mcq" | "short" =
    typeHint === "short"
      ? "short"
      : typeHint === "mcq"
        ? options.length >= 2
          ? "mcq"
          : "short"
        : options.length < 2
          ? "short"
          : "mcq";
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

const INLINE_ACTIVITY_TYPES = new Set(["pagequiz", "selfcheck", "checkpoint", "quickcheck"]);

function blockTypeKey(block: Record<string, unknown>): string {
  return String(block.type ?? "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

function addActivityFingerprint(
  seen: Set<string>,
  stem: string,
  answer: string
): void {
  const fp = mcqFingerprintFromStemAndAnswer(stem, answer);
  if (fp !== "|") seen.add(fp);
  const ns = normalizeQuestionStem(stem);
  if (ns) seen.add(`stem:${ns}`);
}

function processInlineActivityBlock(block: unknown, seen: Set<string>): void {
  if (!block || typeof block !== "object") return;
  const b = block as Record<string, unknown>;
  if (!INLINE_ACTIVITY_TYPES.has(blockTypeKey(b))) return;
  for (const q of extractActivityQuestionsFromBlock(b)) {
    addActivityFingerprint(seen, q.prompt, q.correctAnswer);
  }
}

/**
 * Collect stem+answer fingerprints from inline activity blocks (pageQuiz, selfCheck, checkpoint).
 * Used to suppress duplicate exam-practice / revision surfaces without mutating stored lesson data.
 */
export function collectInlineActivityFingerprints(
  pages: Array<{ blocks?: unknown[]; checkpoint?: unknown }>,
  opts?: { priorBlocks?: unknown[] }
): Set<string> {
  const seen = new Set<string>();

  if (opts?.priorBlocks) {
    for (const block of opts.priorBlocks) processInlineActivityBlock(block, seen);
    return seen;
  }

  for (const page of pages) {
    const legacyCp = page?.checkpoint;
    if (legacyCp && typeof legacyCp === "object") {
      processInlineActivityBlock({ type: "checkpoint", ...(legacyCp as Record<string, unknown>) }, seen);
    }
    const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
    for (const block of blocks) processInlineActivityBlock(block, seen);
  }
  return seen;
}

function isExamPracticeBlock(block: unknown): boolean {
  if (!block || typeof block !== "object") return false;
  const b = block as Record<string, unknown>;
  const role = String(b.role ?? "").trim().toLowerCase();
  const title = String(b.title ?? "");
  return role === "exampractice" || /practice\s*questions/i.test(title);
}

/**
 * Remove exam-practice blocks whose content is entirely duplicate, and strip duplicate Q sections
 * from mixed blocks ÔÇö before student block numbering so ordinals stay contiguous.
 */
export function filterExamPracticeBlocksOnPage(
  blocks: unknown[],
  priorLessonFingerprints?: Set<string>
): unknown[] {
  const priorBlocks: unknown[] = [];
  const base = priorLessonFingerprints ? new Set(priorLessonFingerprints) : new Set<string>();
  const out: unknown[] = [];

  for (const block of blocks) {
    if (!isExamPracticeBlock(block)) {
      out.push(block);
      priorBlocks.push(block);
      continue;
    }

    const exclude = collectInlineActivityFingerprints([], { priorBlocks: [...priorBlocks] });
    base.forEach((fp) => exclude.add(fp));

    const content = String((block as Record<string, unknown>).content ?? "");
    const stripped = stripDuplicateExamPracticeSections(content, exclude);
    if (!hasRenderableExamPracticeContent(stripped)) continue;
    out.push(stripped !== content ? { ...(block as Record<string, unknown>), content: stripped } : block);
    priorBlocks.push(block);
  }

  return out;
}
