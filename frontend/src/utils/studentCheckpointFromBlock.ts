import { resolveLessonDisplayBlockType } from "../types/lessonBlocks";

export type StudentCheckpointRenderData = {
  mode: "mcq" | "short";
  prompt: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  markScheme?: string[];
  name: string;
};

function nonEmptyOptions(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  return options.map((o) => String(o ?? "").trim()).filter(Boolean);
}

function markSchemeLines(raw: unknown): string[] | undefined {
  if (Array.isArray(raw)) {
    const lines = raw.map((x) => String(x ?? "").trim()).filter(Boolean);
    return lines.length ? lines : undefined;
  }
  if (typeof raw === "string" && raw.trim()) {
    return [raw.trim()];
  }
  return undefined;
}

/** True when block routes to checkpoint (includes legacy type strings). */
export function isStudentCheckpointBlock(block: unknown): boolean {
  return resolveLessonDisplayBlockType(block) === "checkpoint";
}

/**
 * Normalise a persisted checkpoint block for student LessonCheckpoint rendering.
 * Prefers questions[0] when present; otherwise legacy single prompt fields.
 * Returns null when the block is incomplete (omit from student flow).
 */
export function studentCheckpointFromBlock(
  block: unknown,
  nameSuffix: string
): StudentCheckpointRenderData | null {
  if (!isStudentCheckpointBlock(block)) return null;
  const b = block as Record<string, unknown>;

  let mode: "mcq" | "short" = b.questionType === "short" ? "short" : "mcq";
  let prompt = String(b.prompt ?? b.question ?? "").trim();
  let options = nonEmptyOptions(b.options);
  let correctAnswer = String(b.correctAnswer ?? b.answer ?? "").trim();
  let explanation =
    typeof b.explanation === "string" && b.explanation.trim()
      ? b.explanation.trim()
      : undefined;
  let markScheme = markSchemeLines(b.markScheme);

  if (Array.isArray(b.questions) && b.questions.length > 0) {
    const first = b.questions[0];
    if (first && typeof first === "object") {
      const q = first as Record<string, unknown>;
      const qPrompt = String(q.prompt ?? q.question ?? q.questionText ?? "").trim();
      if (qPrompt) {
        prompt = qPrompt;
        options = nonEmptyOptions(q.options);
        correctAnswer = String(q.correctAnswer ?? q.answer ?? "").trim();
        mode =
          String(q.questionType ?? "").toLowerCase() === "short" || options.length < 2
            ? "short"
            : "mcq";
        if (typeof q.explanation === "string" && q.explanation.trim()) {
          explanation = q.explanation.trim();
        }
        const qMs = markSchemeLines(q.markScheme);
        if (qMs) markScheme = qMs;
      }
    }
  }

  if (mode === "short") {
    if (!prompt) return null;
  } else if (options.length < 2) {
    return null;
  }

  return {
    mode,
    prompt: prompt || "Quick check",
    options,
    correctAnswer,
    explanation,
    markScheme,
    name: `checkpoint-${nameSuffix}`,
  };
}
