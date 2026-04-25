/**
 * Narrow block shape for student rendering — mirrors LessonViewPage LessonPageBlock without importing the page.
 */
export type StudentLessonBlockType =
  | "text"
  | "keyIdea"
  | "examTip"
  | "commonMistake"
  | "stretch"
  | "checkpoint"
  | "selfCheck"
  | "diagram"
  | "keyWords";

export type StudentLessonPageBlock = {
  type: string;
  content?: string;
  prompt?: string;
  questionType?: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  visualId?: string;
  caption?: string;
  mode?: string;
  annotations?: unknown[];
  steps?: unknown[];
  imageUrl?: string;
  imageSource?: string;
  alt?: string;
  /** Mirrors LessonPageBlock.diagramVariant — featured = key visual emphasis */
  diagramVariant?: "standard" | "featured";
};
