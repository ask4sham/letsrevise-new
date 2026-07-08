import React from "react";
import { CompositePartType } from "../../types";
import type { CompositeInteractionPlugin } from "../../interactionTypes";
import { TableRenderer } from "./TableRenderer";

export const tableInteraction: CompositeInteractionPlugin = {
  partType: CompositePartType.TABLE,
  matchesPart: (part) => String(part.type).toLowerCase() === CompositePartType.TABLE,
  renderAnswer: ({
    part,
    partIndex,
    showAnswerSpace,
    answerValue,
    onAnswerChange,
    inputDisabled,
    partChecked,
  }) => (
    <TableRenderer
      partData={part.partData}
      partIndex={partIndex}
      answerValue={answerValue}
      onAnswerChange={onAnswerChange}
      interactive={showAnswerSpace}
      disabled={inputDisabled}
      marked={Boolean(partChecked)}
    />
  ),
};
