/**
 * Live MCQ option editing for Self-Check / checkpoint blocks in the lesson editor.
 * Paste/import paths still use coerceLessonMcqOptionsFour via guard mode "paste".
 */

export const LIVE_MCQ_OPTIONS_MIN = 2;
export const LIVE_MCQ_OPTIONS_MAX = 6;

/** Preserve teacher-edited option count (2–6); do not pad to four slots. */
export function sanitizeLiveMcqOptions(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return ["", ""];
  }
  const mapped = input.map((o) => (typeof o === "string" ? o : String(o ?? "")));
  let out = mapped.slice(0, LIVE_MCQ_OPTIONS_MAX);
  while (out.length < LIVE_MCQ_OPTIONS_MIN) {
    out.push("");
  }
  return out;
}

export function patchMcqAddOption(currentOptions: string[]): { options: string[] } {
  const base = sanitizeLiveMcqOptions(currentOptions);
  if (base.length >= LIVE_MCQ_OPTIONS_MAX) {
    return { options: base };
  }
  return { options: [...base, ""] };
}

export function patchMcqRemoveOption(
  currentOptions: string[],
  correctAnswer: string
): { options: string[]; correctAnswer?: string } {
  const base = sanitizeLiveMcqOptions(currentOptions);
  if (base.length <= LIVE_MCQ_OPTIONS_MIN) {
    return { options: base };
  }
  const removed = base[base.length - 1] ?? "";
  const next = base.slice(0, -1);
  const patch: { options: string[]; correctAnswer?: string } = { options: next };
  const ca = String(correctAnswer ?? "").trim();
  const removedTrim = String(removed ?? "").trim();
  if (ca && removedTrim && ca === removedTrim) {
    patch.correctAnswer = next.map((o) => String(o ?? "").trim()).find(Boolean) ?? "";
  }
  return patch;
}

export function patchMcqOptionText(
  currentOptions: string[],
  optionIndex: number,
  newValue: string,
  correctAnswer: string
): { options: string[]; correctAnswer?: string } {
  const base = [...sanitizeLiveMcqOptions(currentOptions)];
  while (base.length <= optionIndex) {
    base.push("");
  }
  const oldValue = String(base[optionIndex] ?? "");
  base[optionIndex] = newValue;
  const patch: { options: string[]; correctAnswer?: string } = { options: base };
  const ca = String(correctAnswer ?? "").trim();
  if (ca && ca === oldValue.trim()) {
    patch.correctAnswer = newValue;
  }
  return patch;
}

/** Mirror EditLessonPage selfCheck persist row for save/reload tests. */
export function selfCheckBlockForPersist(b: {
  prompt?: string;
  questionType?: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  role?: string;
}): Record<string, unknown> {
  const opts = Array.isArray(b.options) ? b.options.map((o) => String(o ?? "").trim()) : [];
  return {
    type: "selfCheck",
    prompt: String(b.prompt ?? "").trim(),
    questionType: b.questionType === "short" ? "short" : "mcq",
    options: opts,
    correctAnswer: String(b.correctAnswer ?? "").trim(),
    explanation: b.explanation != null ? String(b.explanation).trim() : undefined,
    ...(typeof b.role === "string" && b.role.trim() ? { role: b.role.trim() } : {}),
  };
}

/** Mirror backend sanitisePageInput selfCheck branch (non-empty options kept, up to 6). */
export function backendSelfCheckSanitizeForTest(b: {
  prompt?: string;
  questionType?: string;
  options?: string[];
  correctAnswer?: string;
}): { options: string[]; correctAnswer: string; prompt: string } | { placeholder: true } {
  const prompt = typeof b?.prompt === "string" ? b.prompt : "";
  const options = Array.isArray(b?.options) ? b.options.map((x) => String(x)).slice(0, 6) : [];
  const correctAnswer = typeof b?.correctAnswer === "string" ? b.correctAnswer : "";
  const questionType = b?.questionType === "short" ? "short" : "mcq";
  const nonEmptyOpts = options.filter((o) => String(o || "").trim());
  const hasPrompt = String(prompt || "").trim().length > 0;
  const isValidMcq =
    questionType === "mcq"
      ? nonEmptyOpts.length >= 2 &&
        nonEmptyOpts.some((o) => String(o).trim() === String(correctAnswer || "").trim())
      : hasPrompt && String(correctAnswer || "").trim().length > 0;
  if (!hasPrompt || !isValidMcq) {
    return { placeholder: true };
  }
  return {
    prompt: prompt.trim(),
    options: questionType === "mcq" ? nonEmptyOpts.slice(0, 6) : [],
    correctAnswer: correctAnswer.trim(),
  };
}
