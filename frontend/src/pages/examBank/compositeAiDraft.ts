/**
 * Map AI composite draft JSON → existing CompositePartForm fields (V1 short only).
 */
import {
  COMPOSITE_PART_LABELS,
  type CompositePartForm,
  makeEmptyCompositePart,
} from "./compositeTableEditorUtils";

export type AiCompositeDifficulty = "easy" | "medium" | "hard";

export type AiCompositeDraftPart = {
  label: string;
  type: string;
  marks: number;
  questionText: string;
  markSchemeLines: string[];
  commandWord?: string;
  skill?: string;
};

export type AiCompositeDraft = {
  title: string;
  sharedStem: string;
  difficulty: AiCompositeDifficulty | string;
  totalMarks: number;
  parts: AiCompositeDraftPart[];
  warnings?: string[];
};

export function compositeFormHasDraftContent(input: {
  title?: string;
  sharedStem?: string;
  parts?: Array<{ questionText?: string; markScheme?: string }>;
}): boolean {
  if (String(input.title || "").trim()) return true;
  if (String(input.sharedStem || "").trim()) return true;
  const parts = Array.isArray(input.parts) ? input.parts : [];
  return parts.some(
    (p) => String(p.questionText || "").trim() || String(p.markScheme || "").trim()
  );
}

export function mapAiCompositeDraftToParts(draft: AiCompositeDraft): CompositePartForm[] {
  const parts = Array.isArray(draft.parts) ? draft.parts : [];
  return parts.map((p, i) => {
    const base = makeEmptyCompositePart(i);
    const lines = Array.isArray(p.markSchemeLines)
      ? p.markSchemeLines.map((l) => String(l || "").trim()).filter(Boolean)
      : [];
    return {
      ...base,
      label: String(p.label || COMPOSITE_PART_LABELS[i] || String(i + 1)).trim() || base.label,
      type: "short",
      marks: Math.max(1, Number(p.marks) || 1),
      questionText: String(p.questionText || "").trim(),
      markScheme: lines.join("\n"),
      options: ["", "", "", ""],
      correctIndex: 0,
      partData: undefined,
    };
  });
}

export function applyAiCompositeDraftToFormFields(draft: AiCompositeDraft): {
  title: string;
  sharedStem: string;
  parts: CompositePartForm[];
} {
  return {
    title: String(draft.title || "").trim(),
    sharedStem: String(draft.sharedStem || "").trim(),
    parts: mapAiCompositeDraftToParts(draft),
  };
}
