import type {
  LessonEditPayload,
  PracticeQuestionAttachment,
  PracticeQuestionEffective,
} from "../api/lessonPracticeEdits";

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
    const baseType = edit.type || attachment.effective?.type || attachment.master?.type || "short";
    return {
      id: attachment.questionId,
      question: edit.question,
      type: baseType,
      marks: edit.marks,
      options: baseType === "mcq" ? defaultMcqOptions(edit.options) : undefined,
      correctAnswer: edit.correctAnswer,
      markScheme: Array.isArray(edit.markScheme) ? [...edit.markScheme] : undefined,
      explanation: edit.explanation,
      topicKey: attachment.effective?.topicKey ?? attachment.master?.topicKey,
      topic: attachment.effective?.topic ?? attachment.master?.topic,
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
    payload.markScheme = Array.isArray(effective.markScheme)
      ? effective.markScheme.map((l) => trimStr(l)).filter(Boolean)
      : [""];
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

export function buildPracticeQuestionEditsPayload(
  pending: PendingPracticeQuestionEditsMap
): Array<{ questionId: string; lessonEdit: LessonEditPayload | null }> {
  return Object.entries(pending).map(([questionId, edit]) => ({
    questionId,
    lessonEdit: edit.action === "clear" ? null : edit.lessonEdit,
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
