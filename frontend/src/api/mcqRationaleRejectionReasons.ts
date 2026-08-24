/**
 * V2.3B2b1 — fixed rejection reason codes (aligned with backend).
 */

export const MCQ_RATIONALE_REJECTION_REASON_CODES = [
  "inaccurate",
  "unclear",
  "too_generic",
  "repeats_answer",
  "unsupported_detail",
  "unsuitable_exam_language",
  "other",
] as const;

export type RejectionReasonCode = (typeof MCQ_RATIONALE_REJECTION_REASON_CODES)[number];

export const MAX_REJECTION_NOTE_LENGTH = 300;

export const REJECTION_REASON_OPTIONS: ReadonlyArray<{ code: RejectionReasonCode; label: string }> = [
  { code: "inaccurate", label: "Inaccurate" },
  { code: "unclear", label: "Unclear" },
  { code: "too_generic", label: "Too generic" },
  { code: "repeats_answer", label: "Repeats the answer" },
  { code: "unsupported_detail", label: "Unsupported detail" },
  { code: "unsuitable_exam_language", label: "Unsuitable exam language" },
  { code: "other", label: "Other" },
];

export function rejectionReasonLabel(code: string | null | undefined): string {
  if (!code) return "—";
  const found = REJECTION_REASON_OPTIONS.find((o) => o.code === code);
  return found ? found.label : code;
}
