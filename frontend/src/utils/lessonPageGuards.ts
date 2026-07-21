import { extractActivityQuestionsFromBlock } from "./activityQuestionsFromBlock";

/**
 * Guard rails: Learn = teaching only; never invent placeholder MCQs;
 * never surface Option 1–4 / "Which statement is correct?" as student self-check.
 */

const PLACEHOLDER_OPTION_RE = /^\[?Option\s*\d+\]?$/i;
const GENERIC_CHECKPOINT_PROMPT_RE = /^which statement is correct\??$/i;

export const LEARN_TESTING_BLOCK_TYPES = new Set([
  "checkpoint",
  "selfCheck",
  "pageQuiz",
]);

/** True for the synthesised / V1 Learn (teaching) page — no scored testing UI. */
export function isLearnTeachingPage(page: {
  title?: unknown;
  pageType?: unknown;
  order?: unknown;
} | null | undefined): boolean {
  if (!page) return false;
  const title = String(page.title ?? "")
    .trim()
    .toLowerCase();
  const pageType = String(page.pageType ?? "")
    .trim()
    .toLowerCase();
  if (pageType === "learn" || pageType === "teaching") return true;
  if (!title) return false;
  if (title === "learn") return true;
  if (/^learn\b/.test(title)) return true;
  if (/page-1-learn|page\s*1\s*\(learn\)/.test(title)) return true;
  return false;
}

export function isPlaceholderMcqOptionLabel(label: unknown): boolean {
  return PLACEHOLDER_OPTION_RE.test(String(label ?? "").trim());
}

/** Empty or editor-filler checkpoint that must never render as SELF-CHECK. */
export function isPlaceholderOrEmptyCheckpoint(
  cp:
    | {
        question?: unknown;
        prompt?: unknown;
        options?: unknown;
        answer?: unknown;
        correctAnswer?: unknown;
      }
    | null
    | undefined
): boolean {
  if (!cp || typeof cp !== "object") return true;
  const question = String(cp.question ?? cp.prompt ?? "").trim();
  const options = Array.isArray(cp.options)
    ? cp.options.map((o) => String(o ?? "").trim()).filter(Boolean)
    : [];
  if (!question) return true;
  if (options.length === 0) return true;
  if (options.every((o) => PLACEHOLDER_OPTION_RE.test(o))) return true;
  if (
    GENERIC_CHECKPOINT_PROMPT_RE.test(question) &&
    options.every((o) => PLACEHOLDER_OPTION_RE.test(o) || /^option\s*\d+$/i.test(o))
  ) {
    return true;
  }
  return false;
}

/** Student-visible page.checkpoint / footer self-check must be real content. */
export function isRenderablePageCheckpoint(
  cp: {
    question?: unknown;
    options?: unknown;
  } | null | undefined
): boolean {
  if (isPlaceholderOrEmptyCheckpoint(cp)) return false;
  const options = Array.isArray(cp?.options)
    ? cp!.options.map((o) => String(o ?? "").trim()).filter(Boolean)
    : [];
  return Boolean(String(cp?.question ?? "").trim()) && options.length >= 2;
}

/** Inline pageQuiz only when it has a real question bank (avoids empty "N — QUIZ PAGE" shells). */
export function isStudentVisiblePageQuizBlock(block: unknown): boolean {
  return extractActivityQuestionsFromBlock(block).length > 0;
}

/** Teacher-facing copy when a pageQuiz block has no usable bank items. */
export function emptyPageQuizBankEditorWarning(block: unknown): string | null {
  const t = String((block as { type?: unknown } | null | undefined)?.type ?? "").trim();
  if (t !== "pageQuiz") return null;
  if (isStudentVisiblePageQuizBlock(block)) return null;
  return "This Quiz Page has no usable questions yet. Students will not see an empty quiz shell - add questions to the bank (or ensure lesson quiz is synced on save).";
}

export function stripLearnPageTestingBlocks<T extends { type?: unknown }>(
  blocks: T[] | null | undefined
): T[] {
  if (!Array.isArray(blocks)) return [];
  return blocks.filter((b) => {
    const t = String(b?.type ?? "").trim();
    return !LEARN_TESTING_BLOCK_TYPES.has(t);
  });
}
