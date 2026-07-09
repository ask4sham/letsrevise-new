import React from "react";
import type { ExamQuestionPart } from "../../../api/examQuestions";
import { isCompositePartTypeEnabled } from "./featureFlags";
import type { CompositeInteractionPlugin } from "./interactionTypes";
import { CompositeAnswerLines, CompositeMcqOptions } from "./CompositePartComponents";
import { isCompositeTablePart, normalizeCompositePartType } from "./compositeUtils";
import { tableInteraction } from "./interactions/table";
import { CompositePartType } from "./types";

function partOptions(part: ExamQuestionPart): string[] {
  return Array.isArray(part.options)
    ? part.options.map((o) => String(o ?? "").trim()).filter(Boolean)
    : [];
}

export const mcqInteraction: CompositeInteractionPlugin = {
  partType: CompositePartType.MCQ,
  matchesPart: (part) =>
    String(part.type).toLowerCase() === CompositePartType.MCQ && partOptions(part).length > 0,
  renderAnswer: ({
    part,
    partIndex,
    mcqInteractive,
    mcqSelectedIndex,
    onMcqSelect,
    inputDisabled,
    partChecked,
    partMcqGrade,
  }) => (
    <CompositeMcqOptions
      options={partOptions(part)}
      partIndex={partIndex}
      interactive={mcqInteractive}
      selectedIndex={mcqSelectedIndex}
      onSelect={onMcqSelect}
      disabled={inputDisabled}
      marked={Boolean(partChecked)}
      mcqGrade={partMcqGrade}
    />
  ),
};

export const shortInteraction: CompositeInteractionPlugin = {
  partType: CompositePartType.SHORT,
  matchesPart: (part) => {
    if (mcqInteraction.matchesPart(part) || isCompositeTablePart(part)) return false;
    const type = normalizeCompositePartType(part);
    if (type === CompositePartType.SHORT) return true;
    return type !== CompositePartType.MCQ && type !== CompositePartType.TABLE;
  },
  renderAnswer: ({
    part,
    showAnswerSpace,
    answerValue,
    onAnswerChange,
    inputDisabled,
  }) =>
    showAnswerSpace ? (
      <CompositeAnswerLines
        marks={part.marks}
        value={answerValue}
        onChange={onAnswerChange}
        interactive
        disabled={inputDisabled}
      />
    ) : (
      <CompositeAnswerLines marks={part.marks} interactive={false} />
    ),
};

/** Graceful fallback for unknown or disabled interaction types — never crashes. */
export const unknownInteraction: CompositeInteractionPlugin = {
  partType: CompositePartType.SHORT,
  matchesPart: () => true,
  renderAnswer: ({ part, showAnswerSpace }) =>
    showAnswerSpace ? (
      <CompositeAnswerLines marks={part.marks} interactive={false} />
    ) : (
      <CompositeAnswerLines marks={part.marks} interactive={false} />
    ),
};

const TYPED_REGISTRY: Partial<
  Record<(typeof CompositePartType)[keyof typeof CompositePartType], CompositeInteractionPlugin>
> = {
  [CompositePartType.MCQ]: mcqInteraction,
  [CompositePartType.SHORT]: shortInteraction,
  [CompositePartType.TABLE]: tableInteraction,
};

function normalizePartType(raw: string): (typeof CompositePartType)[keyof typeof CompositePartType] | null {
  const key = raw.toLowerCase();
  const values = Object.values(CompositePartType) as string[];
  return values.includes(key) ? (key as (typeof CompositePartType)[keyof typeof CompositePartType]) : null;
}

export function resolveCompositeInteraction(part: ExamQuestionPart): CompositeInteractionPlugin {
  if (mcqInteraction.matchesPart(part)) {
    return mcqInteraction;
  }

  if (isCompositeTablePart(part)) {
    if (!isCompositePartTypeEnabled(CompositePartType.TABLE)) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[CompositeExam] Part type "table" is disabled by feature flag.`);
      }
      return unknownInteraction;
    }
    return tableInteraction;
  }

  const raw = String(part.type ?? "").toLowerCase();
  const typed = normalizePartType(raw);

  if (typed && typed !== CompositePartType.MCQ && typed !== CompositePartType.SHORT) {
    if (!isCompositePartTypeEnabled(typed)) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[CompositeExam] Part type "${raw}" is disabled by feature flag.`);
      }
      return unknownInteraction;
    }
    const plugin = TYPED_REGISTRY[typed];
    if (plugin) return plugin;
  }

  if (shortInteraction.matchesPart(part)) {
    return shortInteraction;
  }

  if (process.env.NODE_ENV === "development") {
    console.warn(`[CompositeExam] Unknown part type "${raw}" — using fallback renderer.`);
  }
  return unknownInteraction;
}

export { TYPED_REGISTRY as compositeInteractionRegistry };
