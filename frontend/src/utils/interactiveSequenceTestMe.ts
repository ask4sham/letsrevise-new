export type SequenceTestMeStepLike = {
  title?: string;
  description?: string;
  caption?: string;
  testQuestion?: string;
};

/** Prompt shown in Test me — explicit field or derived from step title. */
export function deriveSequenceTestMeQuestion(step: SequenceTestMeStepLike): string {
  const explicit = String(step.testQuestion ?? "").trim();
  if (explicit) return explicit;

  const titleRaw = String(step.title ?? "").trim();
  const titleClean = titleRaw.replace(/^Step\s+\d+\s*[:—\-–]\s*/i, "").trim();
  if (titleClean && !/^step\s*\d*$/i.test(titleClean)) {
    return `What is the key idea for “${titleClean}”?`;
  }
  return "Without looking above — what is the key idea for this step?";
}

/** True when caption looks like a diagram label, not a recallable key idea. */
export function isLikelyLabelCaption(
  caption: string,
  title: string,
  descriptionForStudent = ""
): boolean {
  const c = caption.trim();
  if (!c) return true;
  if (c.length > 100) return false;
  if (/[.!?]/.test(c) && c.length > 30) return false;

  const titleClean = String(title ?? "")
    .trim()
    .replace(/^Step\s+\d+\s*[:—\-–]\s*/i, "")
    .trim();
  if (titleClean && c.toLowerCase() === titleClean.toLowerCase()) return true;

  const desc = descriptionForStudent.trim();
  if (desc.length > c.length + 16) {
    const cLower = c.toLowerCase();
    const descLower = desc.toLowerCase();
    if (!descLower.includes(cLower) && c.length < 56) return true;
  }

  return false;
}

/** Answer / key idea for reveal — prefer a full caption; fall back when only a label was stored. */
export function resolveSequenceTestMeAnswer(
  step: SequenceTestMeStepLike,
  descriptionForStudent: string
): string {
  const caption = String(step.caption ?? "").trim();
  const desc = descriptionForStudent.trim();
  if (!caption) return desc;
  if (isLikelyLabelCaption(caption, String(step.title ?? ""), desc) && desc) return desc;
  return caption;
}
