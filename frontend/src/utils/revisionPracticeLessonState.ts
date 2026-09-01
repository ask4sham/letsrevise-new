/**
 * Atomic Revision Practice override state transitions for EditLessonPage.
 * Resolves source block.id and upserts/removes overrides against prev.pages + prev.quiz.questions.
 */

import {
  buildSourceLinkageKey,
  isPositionalBankQuestionId,
  removeRevisionPracticeOverride,
  upsertRevisionPracticeOverride,
  type PersistedLessonQuizQuestion,
} from "./revisionPracticeOverrides";

export type RevisionPracticeSourceIdentityContext = {
  pageId?: string;
  blockIndex?: number;
  questionBankId?: string;
};

export type RevisionPracticeOverrideUpsertInput = {
  linkageKey?: string;
  sourcePageId?: string;
  sourceBlockIndex?: number;
  sourceQuestionBankId?: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  existingOverrideId?: string;
};

export type RevisionPracticeOverrideRemoveInput = {
  linkageKey?: string;
  overrideId?: string;
};

export type LessonLikeForRevisionPractice = {
  pages?: Array<{ pageId?: string; blocks?: unknown[] }>;
  quiz?: {
    timeSeconds?: number;
    questions?: PersistedLessonQuizQuestion[];
  };
};

type LessonPageBlock = {
  id?: string;
  questions?: unknown[];
};

export function generateStableBlockId(): string {
  return `blk_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 10)}`;
}

function generateStableBankQuestionId(): string {
  return `q_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 10)}`;
}

/** Pure: assign block.id (and bank question id if needed) on a pages snapshot. */
export function ensureRevisionPracticeSourceIdentityOnPages(
  pages: Array<{ pageId?: string; blocks?: unknown[] }>,
  ctx: RevisionPracticeSourceIdentityContext
): { pages: Array<{ pageId?: string; blocks?: unknown[] }>; linkageKey: string } {
  if (!pages.length) return { pages: [], linkageKey: "" };

  const pageId = ctx.pageId?.trim();
  const blockIndex = ctx.blockIndex;
  if (!pageId || typeof blockIndex !== "number" || blockIndex < 0) {
    return { pages, linkageKey: "" };
  }

  let resolvedBlockId = "";
  let resolvedQuestionId = ctx.questionBankId?.trim() || undefined;

  const nextPages = pages.map((p) => {
    if (p.pageId !== pageId) return p;
    const blocks = Array.isArray(p.blocks) ? [...p.blocks] : [];
    const rawBlock = blocks[blockIndex];
    if (!rawBlock || typeof rawBlock !== "object") return p;

    const block = { ...(rawBlock as LessonPageBlock) };
    const existingBlockId = typeof block.id === "string" ? block.id.trim() : "";
    resolvedBlockId = existingBlockId || generateStableBlockId();
    block.id = resolvedBlockId;

    if (resolvedQuestionId && Array.isArray(block.questions) && block.questions.length) {
      block.questions = block.questions.map((rawQ) => {
        const q = { ...(rawQ as Record<string, unknown>) };
        const qid = String(q.id ?? "").trim();
        if (qid !== resolvedQuestionId) return q;
        if (!qid || isPositionalBankQuestionId(qid)) {
          const newQid = generateStableBankQuestionId();
          q.id = newQid;
          resolvedQuestionId = newQid;
        } else {
          resolvedQuestionId = qid;
        }
        return q;
      });
    }

    blocks[blockIndex] = block;
    return { ...p, blocks };
  });

  const linkageKey = buildSourceLinkageKey(resolvedBlockId, resolvedQuestionId);
  return { pages: nextPages, linkageKey };
}

/** Atomic lesson patch: source identity (pages) + override upsert (quiz) in one transition. */
export function applyRevisionPracticeOverridePatch(
  lesson: LessonLikeForRevisionPractice,
  patch: RevisionPracticeOverrideUpsertInput
): LessonLikeForRevisionPractice {
  let pages = lesson.pages ?? [];
  let linkageKey = String(patch.linkageKey ?? "").trim();

  if (
    !linkageKey &&
    patch.sourcePageId != null &&
    typeof patch.sourceBlockIndex === "number"
  ) {
    const ensured = ensureRevisionPracticeSourceIdentityOnPages(pages, {
      pageId: patch.sourcePageId,
      blockIndex: patch.sourceBlockIndex,
      questionBankId: patch.sourceQuestionBankId,
    });
    pages = ensured.pages;
    linkageKey = ensured.linkageKey;
  }

  if (!linkageKey) return lesson;

  const prevQuestions = lesson.quiz?.questions ?? [];
  const nextQuestions = upsertRevisionPracticeOverride(prevQuestions, {
    linkageKey,
    question: patch.question,
    options: patch.options,
    correctAnswer: patch.correctAnswer,
    explanation: patch.explanation,
    existingOverrideId: patch.existingOverrideId,
  });

  const pagesChanged = pages !== lesson.pages;
  const quizChanged = nextQuestions !== prevQuestions;
  if (!pagesChanged && !quizChanged) return lesson;

  return {
    ...lesson,
    pages,
    quiz: {
      ...(lesson.quiz || { timeSeconds: 600 }),
      questions: nextQuestions,
    },
  };
}

/** Remove override using authoritative prev.quiz.questions. */
export function applyRevisionPracticeOverrideRemove(
  lesson: LessonLikeForRevisionPractice,
  opts: RevisionPracticeOverrideRemoveInput
): LessonLikeForRevisionPractice {
  const prevQuestions = lesson.quiz?.questions ?? [];
  const nextQuestions = removeRevisionPracticeOverride(prevQuestions, {
    linkageKey: opts.linkageKey,
    overrideId: opts.overrideId,
  });

  if (nextQuestions.length === prevQuestions.length) return lesson;

  return {
    ...lesson,
    quiz: {
      ...(lesson.quiz || { timeSeconds: 600 }),
      questions: nextQuestions,
    },
  };
}
