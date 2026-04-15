/**
 * AI checkpoint quality validation — types for API responses and tooling.
 */

export type ValidationSeverity = "error" | "warning" | "info";

export type QualityIssueCode =
  | "DUPLICATE_QUESTION"
  | "LOW_CURRICULUM_OVERLAP"
  | "MCQ_NON_DISTINCT_OPTIONS"
  | "SHORT_NOT_MARKABLE"
  | "VARIETY_LOW"
  | "CLARITY_TOO_SHORT"
  | "CLARITY_TOO_LONG"
  | "CLARITY_ALL_CAPS"
  | "GCSE_LANGUAGE_RISK"
  | "SAFETY_BLOCKLIST"
  | "FORMATTING_INCONSISTENT";

export interface QualityIssue {
  severity: ValidationSeverity;
  code: QualityIssueCode | string;
  message: string;
  /** Page id when item-level */
  pageId?: string;
}

export type QualityDimension =
  | "curriculumRelevance"
  | "uniqueness"
  | "answerability"
  | "gcseFit"
  | "variety"
  | "clarity"
  | "safety"
  | "formatting";

/** Per-dimension score 0–1 */
export type DimensionScores = Partial<Record<QualityDimension, number>>;

export type QualityTier = "draft" | "review" | "auto_publish";

export interface CheckpointQualityResult {
  /** 0–1 aggregate */
  qualityScore: number;
  /** False if any blocking rule failed (set stays draft-only) */
  passed: boolean;
  /** Human-readable blocking reasons */
  failReasons: string[];
  /** Structured issues (warnings + errors) */
  issues: QualityIssue[];
  dimensionScores: DimensionScores;
  /** Derived band for routing UI / auto-publish */
  tier: QualityTier;
  /** Same thresholds used (for debugging) */
  thresholds: QualityThresholds;
}

export interface QualityThresholds {
  /** Inclusive: minimum score to leave strict "draft-only" and allow review surfacing */
  reviewMin: number;
  /** Upper bound of review band (informational; tier uses autoPublishMin) */
  reviewMax: number;
  /** Inclusive: tier "auto_publish" when score >= this (subject to structural gates) */
  autoPublishMin: number;
}

export interface NormalisedCheckpointItem {
  pageId: string;
  type: "mcq" | "shortExplain";
  question: string;
  options?: string[];
  answer?: string;
  markScheme?: string[];
  autoMark?: Record<string, unknown>;
}

export interface ValidateCheckpointQualityContext {
  /** Flattened lesson text (from extractLessonContent) */
  lessonText: string;
  /** e.g. GCSE, A-Level */
  level?: string;
  /** Optional per-item stage (recall | explain | apply | examStyle) for future LLM output */
  itemPhases?: Record<string, string>;
}
