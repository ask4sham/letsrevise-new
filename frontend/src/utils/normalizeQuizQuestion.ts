/**
 * Normalise backend quiz question into QuizView shape.
 * Handles: options as string[], {text}[], {value}[], [{label, text}], {A,B,C,D} map, choices, option1..4.
 * Never outputs type "mcq" without options (downgrades to "short").
 */

export type NormalisedQuizQuestion =
  | { id: string; type: "mcq"; question: string; options: string[]; correctAnswer: string; explanation?: string; tags?: string[]; difficulty?: number; marks?: number }
  | { id: string; type: "short"; question: string; correctAnswer: string; explanation?: string; tags?: string[]; difficulty?: number; marks?: number }
  | { id: string; type: "exam"; question: string; correctAnswer: string; markScheme: string[]; explanation?: string; tags?: string[]; difficulty?: number; marks?: number };

function toOptionString(o: any): string {
  if (o == null) return "";
  if (typeof o === "string") return o.trim();
  if (typeof o === "object" && o !== null) {
    const t = (o.text ?? o.value ?? o.label ?? o.option ?? "").trim();
    if (t) return t;
    return String(o).trim();
  }
  return String(o).trim();
}

/** Extract options as string[] from any supported backend shape. */
export function extractOptions(raw: any): string[] {
  const from = raw.options ?? raw.choices ?? raw.answers;
  if (Array.isArray(from) && from.length > 0) {
    const first = from[0];
    if (typeof first === "string") {
      return from.map((o: any) => String(o ?? "").trim()).filter(Boolean);
    }
    if (typeof first === "object" && first !== null) {
      return from.map((o: any) => toOptionString(o)).filter(Boolean);
    }
  }
  if (from && typeof from === "object" && !Array.isArray(from)) {
    return Object.values(from).map((v: any) => toOptionString(v)).filter(Boolean);
  }
  const fromFields = [
    raw.option1,
    raw.option2,
    raw.option3,
    raw.option4,
    raw.Option1,
    raw.Option2,
    raw.Option3,
    raw.Option4,
  ]
    .map((o: any) => String(o ?? "").trim())
    .filter(Boolean);
  return fromFields;
}

export function normalizeQuizQuestion(raw: any, index: number): NormalisedQuizQuestion {
  const question =
    raw.question ?? raw.prompt ?? raw.stem ?? raw.text ?? "";

  const opts = extractOptions(raw);

  const rawType = String(raw.type ?? raw.questionType ?? raw.kind ?? "").toLowerCase();
  const isExplicitMcq = ["mcq", "multiple_choice", "multiple choice", "multiplechoice"].includes(rawType);
  const isExplicitShort = ["short", "short_answer", "short answer", "saq", "text"].includes(rawType);
  const isExplicitExam = ["exam", "exam_style", "exam style", "long"].includes(rawType);

  const inferredMcq = opts.length >= 2;
  const wouldBeMcq = isExplicitMcq || inferredMcq;
  const type = wouldBeMcq && opts.length > 0 ? "mcq" : isExplicitShort ? "short" : isExplicitExam ? "exam" : "short";

  const correctAnswer =
    raw.correctAnswer ?? raw.answer ?? raw.modelAnswer ?? "";

  const base = {
    id: raw.id ?? raw._id ?? `lesson-q-${index}`,
    question,
    correctAnswer: String(correctAnswer ?? ""),
    explanation: raw.explanation,
    tags: raw.tags,
    difficulty: raw.difficulty,
    marks: raw.marks,
  };

  if (type === "mcq") {
    return { ...base, type: "mcq", options: opts };
  }
  if (type === "exam") {
    const markScheme = Array.isArray(raw.markScheme) ? raw.markScheme.map((m: any) => String(m ?? "").trim()).filter(Boolean) : [];
    return { ...base, type: "exam", markScheme, correctAnswer: base.correctAnswer || "See mark scheme." };
  }
  return { ...base, type: "short" };
}
