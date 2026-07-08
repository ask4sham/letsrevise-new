/**
 * Composite Exam Engine V2 — frozen type contracts.
 * See README.md in this folder for the canonical architecture specification.
 *
 * Implementation note: Phase 0 may import these types only.
 * Do not add renderers until Phase 0 regression gate passes.
 */

/** Composite question schema versions. Omitted on legacy records = V1. */
export const CompositeSchemaVersion = {
  V1: 1,
  V2: 2,
} as const;

export type CompositeSchemaVersion =
  (typeof CompositeSchemaVersion)[keyof typeof CompositeSchemaVersion];

/**
 * Typed part types for registry lookup.
 * V1 production composite questions use MCQ and SHORT only.
 */
export const CompositePartType = {
  MCQ: "mcq",
  SHORT: "short",
  TABLE: "table",
  CALCULATION: "calculation",
  GRAPH: "graph",
  LABEL: "label",
  MATCHING: "matching",
  ORDERING: "ordering",
  EXTENDED_RESPONSE: "extended_response",
} as const;

export type CompositePartType =
  (typeof CompositePartType)[keyof typeof CompositePartType];

/** V1-compatible part shape; V2 adds optional partData. */
export type CompositeExamPartV2 = {
  label: string;
  type: CompositePartType | string;
  marks: number;
  questionText: string;
  markScheme?: string[];
  options?: string[];
  correctIndex?: number | null;
  /** V2 only — interaction-specific content. Absent on all V1 records. */
  partData?: Record<string, unknown>;
};

export type CompositeExamQuestionV2 = {
  questionMode?: "single" | "composite" | string;
  schemaVersion?: CompositeSchemaVersion;
  sharedStem?: string | null;
  imageUrl?: string | null;
  title?: string | null;
  totalMarks?: number | null;
  parts?: CompositeExamPartV2[];
};
