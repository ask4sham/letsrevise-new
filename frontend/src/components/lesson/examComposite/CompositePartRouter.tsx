import React from "react";
import type { ExamQuestionPart } from "../../../api/examQuestions";
import {
  CompositePartMarkingSection,
  CompositePartPrompt,
} from "./CompositePartComponents";
import type { CompositePartAnswerProps } from "./interactionTypes";
import { resolveCompositeInteraction } from "./registry";

export type CompositePartRouterProps = CompositePartAnswerProps & {
  part: ExamQuestionPart;
  sectionClassName?: string;
  enableMarking?: boolean;
  onPartCheck?: () => void;
};

export function CompositePartRouter({
  part,
  partIndex,
  sectionClassName = "exam-composite__part exam-composite__part--written",
  enableMarking,
  onPartCheck,
  ...answerProps
}: CompositePartRouterProps): React.ReactElement {
  const interaction = resolveCompositeInteraction(part);
  const partCheckedSafe = Boolean(answerProps.partChecked);

  return (
    <section className={sectionClassName}>
      <CompositePartPrompt part={part} index={partIndex} />
      {interaction.renderAnswer({ part, partIndex, ...answerProps })}
      {enableMarking && onPartCheck ? (
        <CompositePartMarkingSection
          part={part}
          partIndex={partIndex}
          checked={partCheckedSafe}
          onCheck={onPartCheck}
          mcqSelectedIndex={answerProps.mcqSelectedIndex}
          writtenAnswer={answerProps.answerValue}
        />
      ) : null}
    </section>
  );
}
