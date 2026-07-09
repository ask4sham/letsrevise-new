import React from "react";
import { CompositePartType } from "../../types";
import type { CompositeInteractionPlugin } from "../../interactionTypes";
import { isCompositeTablePart } from "../../compositeUtils";
import { TableRenderer } from "./TableRenderer";

export const tableInteraction: CompositeInteractionPlugin = {
  partType: CompositePartType.TABLE,
  matchesPart: (part) => isCompositeTablePart(part),
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
