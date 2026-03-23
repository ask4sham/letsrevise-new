/**
 * Contract-based lesson structure validation.
 * Ensures lessons follow the LetsRevise block role contract.
 */

/** Flattens blocks from all pages. */
function getBlocks(lesson: { pages?: Array<{ blocks?: Array<Record<string, unknown>> }> }): Array<Record<string, unknown>> {
  const pages = lesson?.pages ?? [];
  return pages.flatMap((p) => p?.blocks ?? []);
}

/** Required roles that must appear at least once. */
const REQUIRED_ROLES = [
  "hook",
  "coreRule",
  "commonMistake",
  "patternRecognition",
  "workedExample",
  "synthesis",
  "finalMemoryRule",
] as const;

/**
 * Validate lesson structure against the block role contract.
 * @returns Array of issue messages (empty if valid).
 */
export function validateLessonStructure(lesson: unknown): string[] {
  const issues: string[] = [];
  const blocks = getBlocks(lesson as Parameters<typeof getBlocks>[0]);

  if (blocks.length < 10) {
    issues.push("Too few blocks (need at least 10)");
  }

  const diagramCount = blocks.filter((b) => String(b?.type ?? "").trim() === "diagram").length;
  if (diagramCount < 2) {
    issues.push("Not enough diagrams");
  }

  const roles = new Set(blocks.map((b) => String(b?.role ?? "").trim()).filter(Boolean));

  REQUIRED_ROLES.forEach((role) => {
    if (!roles.has(role)) {
      issues.push(`Missing role: ${role}`);
    }
  });

  const hasWhatToNotice = blocks.some((b) => String(b?.role ?? "").trim() === "whatToNotice");
  if (!hasWhatToNotice) {
    issues.push("Missing What to Notice block");
  }

  const workedExampleContent = (b: Record<string, unknown>): string =>
    [b.explanation, b.correctAnswer, b.prompt, b.answer].filter(Boolean).map(String).join(" ");

  const hasWorkedExample = blocks.some(
    (b) =>
      String(b?.role ?? "").trim() === "workedExample" &&
      workedExampleContent(b).length > 30
  );

  if (!hasWorkedExample) {
    issues.push("Missing worked example (needs role 'workedExample' with substantial content)");
  }

  const checkpointBlocks = blocks.filter((b) => String(b?.type ?? "").trim() === "checkpoint");
  const placeholderPrompts = /^(which statement is correct\??\s*|choose the correct\??\s*|option [1234]\??\s*|quick check\??\s*)$/i;
  for (let i = 0; i < checkpointBlocks.length; i++) {
    const b = checkpointBlocks[i];
    const prompt = String(b?.prompt ?? b?.question ?? "").trim();
    const correctAnswer = String(b?.correctAnswer ?? b?.answer ?? "").trim();
    if (!prompt || prompt.length < 15) {
      issues.push(`Checkpoint ${i + 1}: must contain a real exam-style question`);
    } else if (placeholderPrompts.test(prompt)) {
      issues.push(`Checkpoint ${i + 1}: must contain a real exam-style question (not a placeholder)`);
    }
    if (!correctAnswer) {
      issues.push(`Checkpoint ${i + 1}: must include a correct answer`);
    }
  }

  return issues;
}
