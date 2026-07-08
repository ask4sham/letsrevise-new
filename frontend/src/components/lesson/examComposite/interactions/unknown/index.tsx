import { CompositePartType } from "../../types";
import type { CompositeInteractionPlugin } from "../../interactionTypes";
import { CompositeAnswerLines } from "../../CompositePartComponents";

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
