import type {
  LessonEditPayload,
  PracticeQuestionAttachment,
  PracticeQuestionEffective,
} from "../api/lessonPracticeEdits";
import {
  validateShortMarksMarkSchemeInvariant,
} from "../lib/block28PracticePolicy";

export type PendingPracticeQuestionEdit =
  | { action: "upsert"; lessonEdit: LessonEditPayload }
  | { action: "clear" };

export type PendingPracticeQuestionEditsMap = Record<string, PendingPracticeQuestionEdit>;

function trimStr(v: unknown): string {
  return v === undefined || v === null ? "" : String(v).trim();
}

function defaultMcqOptions(options?: string[]): string[] {
  const normalized = Array.isArray(options) ? options.map((o) => trimStr(o)) : [];
  while (normalized.length < 4) normalized.push("");
  return normalized.slice(0, 6);
}

function normalizeShortMarkSchemeLines(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) return [""];
  return raw.map((l) => trimStr(l));
}

function effectiveFromMaster(master: PracticeQuestionEffective | null): PracticeQuestionEffective | null {
  if (!master) return null;
  return {
    ...master,
    question: master.question != null ? String(master.question) : "",
    type: master.type,
    marks: typeof master.marks === "number" ? master.marks : 1,
    options: Array.isArray(master.options) ? [...master.options] : undefined,
    markScheme: Array.isArray(master.markScheme) ? [...master.markScheme] : undefined,
    correctAnswer: master.correctAnswer != null ? String(master.correctAnswer) : undefined,
    explanation: master.explanation != null ? String(master.explanation) : undefined,
  };
}

export function getDisplayEffective(
  attachment: PracticeQuestionAttachment,
  pending?: PendingPracticeQuestionEdit
): PracticeQuestionEffective | null {
  if (pending?.action === "clear") {
    return effectiveFromMaster(attachment.master) ?? attachment.effective;
  }
  if (pending?.action === "upsert") {
    const edit = pending.lessonEdit;
    const base = attachment.effective ?? effectiveFromMaster(attachment.master);
    const baseType = edit.type || base?.type || attachment.master?.type || "short";
    return {
      id: attachment.questionId,
      question: edit.question ?? base?.question ?? "",
      type: baseType,
      marks: typeof edit.marks === "number" ? edit.marks : base?.marks ?? 1,
      options:
        baseType === "mcq" ? defaultMcqOptions(edit.options ?? base?.options) : undefined,
      correctAnswer: edit.correctAnswer !== undefined ? edit.correctAnswer : base?.correctAnswer,
      markScheme: Array.isArray(edit.markScheme)
        ? [...edit.markScheme]
        : base?.markScheme
          ? [...base.markScheme]
          : undefined,
      explanation: edit.explanation !== undefined ? edit.explanation : base?.explanation,
      topicKey: base?.topicKey ?? attachment.master?.topicKey,
      topic: base?.topic ?? attachment.master?.topic,
    };
  }
  return attachment.effective ?? effectiveFromMaster(attachment.master);
}

export function isPracticeQuestionEdited(
  attachment: PracticeQuestionAttachment,
  pending?: PendingPracticeQuestionEdit
): boolean {
  if (pending?.action === "clear") return false;
  if (pending?.action === "upsert") return true;
  return attachment.hasLessonEdit;
}

export function buildLessonEditFromEffective(
  effective: PracticeQuestionEffective,
  type: "mcq" | "short"
): LessonEditPayload {
  const payload: LessonEditPayload = {
    type,
    question: trimStr(effective.question),
    marks: typeof effective.marks === "number" && effective.marks >= 1 ? effective.marks : 1,
  };
  if (type === "mcq") {
    payload.options = defaultMcqOptions(effective.options).filter(Boolean);
    payload.correctAnswer = trimStr(effective.correctAnswer);
  } else {
    payload.markScheme = normalizeShortMarkSchemeLines(effective.markScheme);
    const ca = trimStr(effective.correctAnswer);
    if (ca) payload.correctAnswer = ca;
  }
  const expl = trimStr(effective.explanation);
  if (expl) payload.explanation = expl;
  const ms = Array.isArray(effective.markScheme)
    ? effective.markScheme.map((l) => trimStr(l)).filter(Boolean)
    : [];
  if (type === "mcq" && ms.length > 0) payload.markScheme = ms;
  return payload;
}

export function applyPracticeQuestionFieldPatch(
  attachment: PracticeQuestionAttachment,
  pending: PendingPracticeQuestionEdit | undefined,
  patch: Partial<PracticeQuestionEffective>
): LessonEditPayload {
  const current = getDisplayEffective(attachment, pending);
  const type = (current?.type === "short" ? "short" : "mcq") as "mcq" | "short";
  const merged: PracticeQuestionEffective = {
    ...(current ?? {}),
    ...patch,
    type,
  };
  if (type === "mcq" && patch.options) {
    merged.options = defaultMcqOptions(patch.options);
    const ca = trimStr(merged.correctAnswer);
    const opts = merged.options.map((o) => trimStr(o)).filter(Boolean);
    if (ca && !opts.includes(ca) && opts.length > 0) {
      merged.correctAnswer = opts[0];
    }
  }
  return buildLessonEditFromEffective(merged, type);
}

export function validatePendingPracticeQuestionEditsForSave(
  pending: PendingPracticeQuestionEditsMap
): string | null {
  for (const edit of Object.values(pending)) {
    if (edit.action !== "upsert" || edit.lessonEdit.type !== "short") continue;
    const ms = edit.lessonEdit.markScheme;
    if (Array.isArray(ms) && ms.some((line) => trimStr(line) === "")) {
      return "Each mark scheme point needs text before you save. Finish editing or remove empty mark points.";
    }
    const marks = edit.lessonEdit.marks;
    const schemeCheck = validateShortMarksMarkSchemeInvariant(marks, ms);
    if (schemeCheck.ok === false) {
      return schemeCheck.msg;
    }
  }
  return null;
}

export function buildPracticeQuestionEditsPayload(
  pending: PendingPracticeQuestionEditsMap
): Array<{ questionId: string; lessonEdit: LessonEditPayload | null }> {
  return Object.entries(pending).map(([questionId, edit]) => ({
    questionId,
    lessonEdit:
      edit.action === "clear"
        ? null
        : edit.lessonEdit.type === "short" && Array.isArray(edit.lessonEdit.markScheme)
          ? {
              ...edit.lessonEdit,
              markScheme: edit.lessonEdit.markScheme.map((l) => trimStr(l)).filter(Boolean),
            }
          : edit.lessonEdit,
  }));
}

export function hasPendingPracticeQuestionEdits(
  pending: PendingPracticeQuestionEditsMap
): boolean {
  return Object.keys(pending).length > 0;
}

export function formatPracticeQuestionTypeLabel(type?: string | null): string {
  if (type === "mcq") return "Multiple choice (MCQ)";
  if (type === "short") return "Short answer";
  return type ? String(type) : "Unknown";
}

/** Teacher-facing copy for unsupported Question Bank types in Block 28. */
export const PRACTICE_QUESTION_BANK_MANAGED_MESSAGE =
  "This question is managed in the Question Bank.";

/**
 * Whether an attachment is expected in the student practice list for Block 28.
 * Teacher tabs list every attachment; GET /practice may omit unavailable or
 * bank-managed (non mcq/short) attachments and applies dedup/limit separately.
 */
export function isPracticeAttachmentShownToStudents(
  attachment: PracticeQuestionAttachment
): boolean {
  if (!attachment.available) return false;
  if (!attachment.editable && attachment.unsupportedReason) return false;
  return true;
}

export function countStudentVisiblePracticeAttachments(
  attachments: PracticeQuestionAttachment[]
): number {
  return attachments.filter(isPracticeAttachmentShownToStudents).length;
}

export type PracticeQuestionTabLabel = {
  teacherIndex: number;
  label: string;
  studentNumber: number | null;
  shownToStudents: boolean;
};

export function buildPracticeQuestionTabLabels(
  attachments: PracticeQuestionAttachment[]
): PracticeQuestionTabLabel[] {
  let studentCounter = 0;
  return attachments.map((att, idx) => {
    const shownToStudents = isPracticeAttachmentShownToStudents(att);
    const studentNumber = shownToStudents ? ++studentCounter : null;
    const teacherNum = idx + 1;
    let label = `Q${teacherNum}`;
    if (!att.available) {
      label += " · Unavailable";
    } else if (!shownToStudents) {
      label += " · Not shown";
    } else if (studentNumber !== null && studentNumber !== teacherNum) {
      label += ` · Student Q${studentNumber}`;
    }
    return { teacherIndex: idx, label, studentNumber, shownToStudents };
  });
}
