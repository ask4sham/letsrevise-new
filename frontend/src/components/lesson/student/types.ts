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
  | "interactiveDiagram"
  | "dragDropMatch"
  | "graph";

export type InteractiveSequenceStepPersisted = {
  testQuestion?: string;
  id?: string;
  title: string;
  description: string;
  imageUrl: string;
  caption: string;
  /** Optional — AssessmentFeedback explanation after reveal (with caption as key idea). */
  testExplanation?: string;
};

export type InteractiveDiagramHotspotPersisted = {
  id: string;
  x?: number;
  y?: number;
  label: string;
  description: string;
  /** Preferred explanation text; falls back to `description` when absent (legacy lessons). */
  explanation?: string;
  /** Preset “Test me” MCQ (optional). */
  test?: unknown;
};

export type DragDropMatchPairPersisted = {
  id: string;
  prompt: string;
  answer: string;
  explanation?: string;
  answerImageUrl?: string;
  /** Text-to-image mode: large target visual per pair. */
  imageUrl?: string;
  imageAlt?: string;
};

/** type === "dragDropMatch" & matchMode === "diagram" */
export type DragDropMatchDiagramZonePersisted = {
  id: string;
  x?: number;
  y?: number;
  correctPairId: string;
  explanation?: string;
};

export type StudentLessonPageBlock = {
  type: string;
  content?: string;
  title?: string;
  /** SS1 lesson block ordinal (generator export); optional — title may already include `N —`. */
  number?: number;
  intro?: string;
  /** Teacher-only design brief / notes — never rendered in student view. */
  note?: string;
  /** Persisted name; API may also send `steps` as an alias when saving. */
  sequenceSteps?: InteractiveSequenceStepPersisted[];
  hotspots?: InteractiveDiagramHotspotPersisted[];
  instructions?: string;
  pairs?: DragDropMatchPairPersisted[];
  /** Optional layout variant for dragDropMatch; omit ⇒ text columns (legacy). */
  matchMode?: "text" | "diagram" | "text-to-image" | "textToImage";
  dragDropLayout?: string;
  /** Diagram mode image rendering controls. */
  imageFit?: "contain" | "cover";
  imagePosition?: "center center" | "center top" | "center bottom";
  dropZones?: DragDropMatchDiagramZonePersisted[];
  prompt?: string;
  questionType?: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  visualId?: string;
  caption?: string;
  /** Diagram block: teacher explanation below the image */
  subtitle?: string;
  /** Diagram block: student questions / activities */
  studentTask?: string;
  mode?: string;
  annotations?: unknown[];
  steps?: unknown[];
  imageUrl?: string;
  imageSource?: string;
  alt?: string;
  /** Mirrors LessonPageBlock.diagramVariant — featured = key visual emphasis */
  diagramVariant?: "standard" | "featured";
  /** type === "graph" */
  graphType?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  xUnits?: string;
  yUnits?: string;
  graphSeries?: Array<{
    id?: string;
    label: string;
    color?: string;
    points: Array<{ x: number | string; y: number }>;
  }>;
  graphAnnotations?: Array<{
    id?: string;
    text: string;
    kind?: string;
    seriesId?: string;
    pointIndex?: number;
  }>;
  examQuestion?: string;
  markScheme?: string | string[];
  examinerTip?: string;
};
