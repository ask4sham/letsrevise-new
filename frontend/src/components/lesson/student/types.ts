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
  | "keyWords"
  | "interactiveSequence"
  | "interactiveDiagram";

export type InteractiveSequenceStepPersisted = {
  title: string;
  description: string;
  imageUrl: string;
  caption: string;
};

export type InteractiveDiagramHotspotPersisted = {
  id: string;
  x: number;
  y: number;
  label: string;
  description: string;
};

export type StudentLessonPageBlock = {
  type: string;
  content?: string;
  title?: string;
  intro?: string;
  /** Persisted name; API may also send `steps` as an alias when saving. */
  sequenceSteps?: InteractiveSequenceStepPersisted[];
  hotspots?: InteractiveDiagramHotspotPersisted[];
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
