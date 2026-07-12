/**
 * Map AI composite draft JSON → existing CompositePartForm fields (V1.1: short + mcq).
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
  options?: string[];
  correctIndex?: number | null;
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
  return parts
    .filter((p) => {
      const t = String(p.type || "").toLowerCase();
      return t === "short" || t === "mcq";
    })
    .map((p, i) => {
      const base = makeEmptyCompositePart(i);
      const lines = Array.isArray(p.markSchemeLines)
        ? p.markSchemeLines.map((l) => String(l || "").trim()).filter(Boolean)
        : [];
      const type = String(p.type || "").toLowerCase() === "mcq" ? "mcq" : "short";
      const rawOpts = Array.isArray(p.options) ? p.options.map((o) => String(o ?? "").trim()) : [];
      const options =
        type === "mcq"
          ? [...rawOpts, "", "", "", ""].slice(0, Math.max(4, rawOpts.length))
          : ["", "", "", ""];
      const correctIndex =
        type === "mcq" && typeof p.correctIndex === "number" && p.correctIndex >= 0 && p.correctIndex <= 3
          ? p.correctIndex
          : 0;
      return {
        ...base,
        label: String(p.label || COMPOSITE_PART_LABELS[i] || String(i + 1)).trim() || base.label,
        type,
        marks: Math.max(1, Number(p.marks) || 1),
        questionText: String(p.questionText || "").trim(),
        markScheme: lines.join("\n"),
        options,
        correctIndex,
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
