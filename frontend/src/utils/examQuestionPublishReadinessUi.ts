/**
 * Client-side mirror of backend/utils/examQuestionPublishValidation.js for badges and hints only.
 * Keep in sync when server rules change.
 */
type CompositePartLike = {
  label?: string;
  type?: string;
  marks?: number;
  questionText?: string;
  options?: string[];
  correctIndex?: number | null;
  markScheme?: string[];
};

export function getExamPublishReadinessUi(doc: {
  type?: string;
  marks?: number;
  question?: string;
  markScheme?: string[];
  correctAnswer?: string | null;
  metadata?: Record<string, unknown>;
  questionMode?: string;
  sharedStem?: string | null;
  parts?: CompositePartLike[];
}): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const isComposite =
    String(doc.questionMode || "").toLowerCase() === "composite" ||
    String(doc.type || "").toLowerCase() === "composite";
  if (isComposite) {
    const parts = Array.isArray(doc.parts) ? doc.parts : [];
    if (!String(doc.sharedStem || doc.question || "").trim()) {
      reasons.push("Add a shared question stem.");
    }
    if (parts.length < 1) {
      reasons.push("Add at least one part (a, b, c…).");
    }
    parts.forEach((part) => {
      const label = part.label ? `(${part.label})` : "";
      const pType = String(part.type || "short").toLowerCase();
      if (!String(part.questionText || "").trim()) reasons.push(`Part ${label} needs question text.`);
      if (pType === "mcq") {
        const opts = Array.isArray(part.options) ? part.options.map((o) => String(o ?? "").trim()).filter(Boolean) : [];
        if (opts.length < 2) reasons.push(`Part ${label} MCQ needs at least 2 options.`);
        if (part.correctIndex == null || part.correctIndex < 0) reasons.push(`Part ${label} MCQ needs a correct option.`);
      } else {
        const ms = Array.isArray(part.markScheme) ? part.markScheme.map((l) => String(l ?? "").trim()).filter((l) => l.length >= 10) : [];
        if (ms.length < 1) reasons.push(`Part ${label} needs a substantive mark-scheme point.`);
      }
    });
    return { ok: reasons.length === 0, reasons };
  }
  const type = String(doc.type || "short").toLowerCase();
  const marks = Number(doc.marks);
  const qText = String(doc.question || "").trim();
  const ms = Array.isArray(doc.markScheme) ? doc.markScheme.map((s) => String(s || "").trim()).filter(Boolean) : [];
  const substantial = ms.filter((l) => l.length >= 10);
  const metaModel = doc.metadata && typeof doc.metadata.modelAnswer === "string" ? doc.metadata.modelAnswer : "";
  const modelAns = String(doc.correctAnswer || metaModel || "").trim();

  if (type === "mcq") {
    if (!Number.isFinite(marks) || marks < 3) {
      reasons.push(
        "MCQ under 3 marks — use Topic Quiz Bank for quick recall, or add marks + rationale (publish rule)."
      );
    }
    if (substantial.length < 1) {
      reasons.push("MCQ: add at least one substantive mark-scheme line before publish.");
    }
  }

  if (substantial.length < 2) {
    reasons.push("Need at least two substantive mark-scheme points (≈10+ characters each) to publish.");
  }

  if (type === "short") {
    if (qText.length > 0 && qText.length < 25) {
      reasons.push("Stem is short for an exam-style question — expand before publish.");
    }
    if (modelAns.length < 20 && substantial.length < 3) {
      reasons.push("Add a clearer model answer or a third mark-scheme bullet before publish.");
    }
  }

  return { ok: reasons.length === 0, reasons };
}
