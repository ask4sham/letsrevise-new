/**
 * Client-side mirror of backend/utils/examQuestionPublishValidation.js for badges and hints only.
 * Keep in sync when server rules change.
 */
export function getExamPublishReadinessUi(doc: {
  type?: string;
  marks?: number;
  question?: string;
  markScheme?: string[];
  correctAnswer?: string | null;
  metadata?: Record<string, unknown>;
}): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
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
