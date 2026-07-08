import React from "react";
import type { ExamQuestionPart } from "../../../../api/examQuestions";
import { CompositePartType } from "../types";
import type { CompositeInteractionPlugin } from "../interactionTypes";
import { CompositeMcqOptions } from "../CompositePartComponents";

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
