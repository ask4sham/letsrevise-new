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
 * Returns null when the block is incomplete (omit from student flow).
 */
export function studentCheckpointFromBlock(
  block: unknown,
  nameSuffix: string
): StudentCheckpointRenderData | null {
  if (!isStudentCheckpointBlock(block)) return null;
  const b = block as Record<string, unknown>;
  const mode = b.questionType === "short" ? "short" : "mcq";
  const prompt = String(b.prompt ?? b.question ?? "").trim();
  const options = nonEmptyOptions(b.options);
  const correctAnswer = String(b.correctAnswer ?? b.answer ?? "").trim();

  if (mode === "short") {
    if (!prompt) return null;
  } else if (options.length < 2) {
    return null;
  }

  const explanation =
    typeof b.explanation === "string" && b.explanation.trim()
      ? b.explanation.trim()
      : undefined;

  return {
    mode,
    prompt: prompt || "Quick check",
    options,
    correctAnswer,
    explanation,
    markScheme: markSchemeLines(b.markScheme),
    name: `checkpoint-${nameSuffix}`,
  };
}
