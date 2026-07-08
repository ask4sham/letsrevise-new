import React from "react";
import { CompositePartType } from "../types";
import type { CompositeInteractionPlugin } from "../interactionTypes";
import { CompositeAnswerLines } from "../CompositePartComponents";

export const shortInteraction: CompositeInteractionPlugin = {
  partType: CompositePartType.SHORT,
  matchesPart: (part) => {
    const type = String(part.type).toLowerCase();
    return type === CompositePartType.SHORT || type !== CompositePartType.MCQ;
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
