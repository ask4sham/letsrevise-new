/**
 * Editor/preview compatibility for Synthesiser (and other) V2 activity banks.
 * When legacy single-question fields are empty but block.questions[] exists,
 * project the first bank question into legacy fields for the existing UI.
 * Does not redesign layout or invent Option 1–4 filler as saved content.
 */

import { extractActivityQuestionsFromBlock } from "./activityQuestionsFromBlock";
import {
  hasActivityQuestionBank,
  preserveActivityQuestions,
  withPreservedActivityQuestions,
  type ActivityBankQuestion,
} from "./activityQuestionBankRoundTrip";

export type LegacyActivityFields = {
  prompt?: unknown;
  question?: unknown;
  options?: unknown;
  correctAnswer?: unknown;
};

/** True when classic single-question fields have no usable content. */
export function legacyActivityFieldsAreEmpty(block: LegacyActivityFields | null | undefined): boolean {
  if (!block) return true;
  const prompt = String(block.prompt ?? block.question ?? "").trim();
  const correctAnswer = String(block.correctAnswer ?? "").trim();
  const options = Array.isArray(block.options)
    ? block.options.map((o) => String(o ?? "").trim()).filter(Boolean)
    : [];
  return !prompt && !correctAnswer && options.length === 0;
}

export type ProjectedLegacyActivityFields = {
  prompt: string;
  question: string;
  questionType: "mcq" | "short";
  options: string[];
  correctAnswer: string;
  explanation?: string;
  markScheme?: string[];
};

function bankQuestionToProjected(
  q: ActivityBankQuestion
): ProjectedLegacyActivityFields | null {
  const questionType: "mcq" | "short" = q.questionType === "mcq" ? "mcq" : "short";
  const options =
    questionType === "mcq" && Array.isArray(q.options)
      ? q.options.map((o) => String(o ?? "").trim()).filter(Boolean)
      : [];
  if (questionType === "mcq" && options.length < 2) return null;
  const prompt = String(q.prompt ?? q.question ?? "").trim();
  if (!prompt) return null;
  const projected: ProjectedLegacyActivityFields = {
    prompt,
    question: prompt,
    questionType,
    options: questionType === "mcq" ? options : [],
    correctAnswer: String(q.correctAnswer ?? "").trim(),
  };
  if (q.explanation != null && String(q.explanation).trim()) {
    projected.explanation = String(q.explanation).trim();
  }
  if (Array.isArray(q.markScheme)) {
    const ms = q.markScheme.map((x) => String(x ?? "").trim()).filter(Boolean);
    if (ms.length) projected.markScheme = ms;
  }
  return projected;
}

/**
 * Map a bank question onto legacy editor fields.
 * Prefers the first MCQ with real options (so Option 1–4 placeholders are not shown);
 * otherwise the first usable short/MCQ question.
 */
export function projectFirstBankQuestionToLegacyFields(
  sourceBlock: { questions?: unknown } | null | undefined
): ProjectedLegacyActivityFields | null {
  const bank = preserveActivityQuestions(sourceBlock?.questions);
  if (!bank?.length) return null;
  for (const q of bank) {
    if (q.questionType !== "mcq") continue;
    const projected = bankQuestionToProjected(q);
    if (projected?.questionType === "mcq") return projected;
  }
  for (const q of bank) {
    const projected = bankQuestionToProjected(q);
    if (projected) return projected;
  }
  return null;
}

/**
 * After building a hydrated activity block from legacy fields, preserve questions[]
 * and fill empty legacy slots from the first bank question when needed.
 */
export function withEditorCompatFromActivityBank<T extends Record<string, unknown>>(
  blockOut: T,
  sourceBlock: { questions?: unknown } & LegacyActivityFields
): T {
  const withBank = withPreservedActivityQuestions(blockOut, sourceBlock);
  if (!hasActivityQuestionBank(withBank) && !hasActivityQuestionBank(sourceBlock)) {
    return withBank;
  }
  if (!legacyActivityFieldsAreEmpty(blockOut)) {
    return withBank;
  }
  const projected = projectFirstBankQuestionToLegacyFields({
    questions: (withBank as { questions?: unknown }).questions ?? sourceBlock.questions,
  });
  if (!projected) return withBank;

  const next: Record<string, unknown> = {
    ...withBank,
    prompt: projected.prompt,
    question: projected.question,
    questionType: projected.questionType,
    options: projected.options,
    correctAnswer: projected.correctAnswer,
  };
  if (projected.explanation != null) next.explanation = projected.explanation;
  if (projected.markScheme) next.markScheme = projected.markScheme;
  return next as T;
}

/**
 * Resolve the first displayable activity question for editor preview.
 * Prefers questions[]; falls back to legacy extraction.
 */
export function resolveActivityPreviewQuestion(block: unknown): {
  prompt: string;
  questionType: "mcq" | "short";
  options: string[];
  correctAnswer: string;
  explanation?: string;
  markScheme?: string[];
  fromBank: boolean;
  bankCount: number;
} | null {
  if (!block || typeof block !== "object") return null;
  const b = block as Record<string, unknown>;
  const bank = preserveActivityQuestions(b.questions);
  if (bank?.length) {
    const projected = projectFirstBankQuestionToLegacyFields({ questions: bank });
    if (projected) {
      return {
        ...projected,
        fromBank: true,
        bankCount: bank.length,
      };
    }
  }
  const extracted = extractActivityQuestionsFromBlock(block);
  if (!extracted.length) return null;
  const q = extracted[0];
  return {
    prompt: q.prompt,
    questionType: q.questionType,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    markScheme: q.markScheme,
    fromBank: false,
    bankCount: extracted.length,
  };
}

/** Snapshot of bank content used to assert save/reload preservation. */
export function snapshotActivityBankForCompare(
  questions: unknown
): Array<{
  prompt: string;
  questionType: string;
  options: string[];
  correctAnswer: string;
  markScheme?: string[];
  sourceIds?: string[];
}> {
  const bank = preserveActivityQuestions(questions) || [];
  return bank.map((q: ActivityBankQuestion) => {
    const row: {
      prompt: string;
      questionType: string;
      options: string[];
      correctAnswer: string;
      markScheme?: string[];
      sourceIds?: string[];
    } = {
      prompt: String(q.prompt ?? q.question ?? "").trim(),
      questionType: q.questionType === "mcq" ? "mcq" : "short",
      options:
        q.questionType === "mcq" && Array.isArray(q.options)
          ? q.options.map((o) => String(o ?? "").trim()).filter(Boolean)
          : [],
      correctAnswer: String(q.correctAnswer ?? "").trim(),
    };
    if (Array.isArray(q.markScheme)) {
      const ms = q.markScheme.map((x) => String(x ?? "").trim()).filter(Boolean);
      if (ms.length) row.markScheme = ms;
    }
    const sourceIds = Array.isArray(q.sourceIds)
      ? q.sourceIds.map((x) => String(x ?? "").trim()).filter(Boolean)
      : Array.isArray(q.metadata?.sourceIds)
        ? (q.metadata!.sourceIds as unknown[]).map((x) => String(x ?? "").trim()).filter(Boolean)
        : [];
    if (sourceIds.length) row.sourceIds = sourceIds;
    return row;
  });
}
