import type { ReactNode } from "react";
import type { ExamQuestionPart } from "../../../api/examQuestions";
import type { CompositePartType } from "./types";

export type CompositePartAnswerProps = {
  part: ExamQuestionPart;
  partIndex: number;
  showAnswerSpace: boolean;
  mcqInteractive: boolean;
  answerValue?: string;
  onAnswerChange?: (value: string) => void;
  mcqSelectedIndex?: number;
  onMcqSelect?: (index: number) => void;
  inputDisabled?: boolean;
  partChecked?: boolean;
  partMcqGrade?: ReturnType<typeof import("../../../utils/gradeMcq").gradeMcq> | null;
};

export type CompositeInteractionPlugin = {
  partType: CompositePartType;
  matchesPart: (part: ExamQuestionPart) => boolean;
  renderAnswer: (props: CompositePartAnswerProps) => ReactNode;
};
