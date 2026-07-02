/**
 * Edexcel IGCSE Biology (4BI1): tolerate legacy GCSE-labelled bank rows in list filters.
 * AQA GCSE and other specs use exact level matching only.
 */
export const EDexcel_IGCSE_BIOLOGY_SPEC = "edexcel-igcse-biology";

export function normalizeExamQuestionLevelLabel(level: string | undefined | null): string {
  const s = String(level ?? "").trim();
  if (!s) return "";
  if (/igcse/i.test(s)) return "IGCSE";
  if (/gcse/i.test(s)) return "GCSE";
  return s;
}

export function isEdexcelIgcseBiologyExamContext(ctx: {
  specKey?: string;
  topicKey?: string;
}): boolean {
  const specKey = String(ctx.specKey ?? "").trim().toLowerCase();
  if (specKey === EDexcel_IGCSE_BIOLOGY_SPEC) return true;
  const topicKey = String(ctx.topicKey ?? "").trim().toLowerCase();
  return topicKey.startsWith(`${EDexcel_IGCSE_BIOLOGY_SPEC}:`);
}

export function resolveExamQuestionLevelForSave(input: {
  specKey?: string;
  topicKey?: string;
  level?: string;
}): string | undefined {
  if (isEdexcelIgcseBiologyExamContext(input)) return "IGCSE";
  const normalized = normalizeExamQuestionLevelLabel(input.level);
  return normalized || undefined;
}

export function examBankDefaultFormFields(specKey: string): {
  subject: string;
  examBoard: string;
  level: string;
} {
  const key = specKey.trim();
  if (key === EDexcel_IGCSE_BIOLOGY_SPEC) {
    return { subject: "Biology", examBoard: "Edexcel", level: "IGCSE" };
  }
  if (key === "aqa-gcse-biology") {
    return { subject: "Biology", examBoard: "AQA", level: "GCSE" };
  }
  return { subject: "Biology", examBoard: "AQA", level: "GCSE" };
}
