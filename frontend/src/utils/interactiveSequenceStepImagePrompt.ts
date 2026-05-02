/**
 * Optional per-step image prompt is stored after this delimiter inside `description`
 * (no extra Mongoose fields). Student UI strips the suffix; editors split for two fields.
 */
const INTERACTIVE_SEQUENCE_IMAGE_PROMPT_DELIM = "\n\n«IMAGE_PROMPT»\n";

/** Student-facing explanation only (hides teacher image-prompt notes). */
export function stripSequenceStepImagePromptFromDescription(raw: string): string {
  const d = String(raw ?? "");
  const i = d.indexOf(INTERACTIVE_SEQUENCE_IMAGE_PROMPT_DELIM);
  if (i < 0) return d.trim();
  return d.slice(0, i).trimEnd();
}

/** Teacher-only image prompt text extracted from stored description. */
export function extractSequenceStepImagePromptFromDescription(raw: string): string {
  const d = String(raw ?? "");
  const i = d.indexOf(INTERACTIVE_SEQUENCE_IMAGE_PROMPT_DELIM);
  if (i < 0) return "";
  return d.slice(i + INTERACTIVE_SEQUENCE_IMAGE_PROMPT_DELIM.length).trim();
}

/** Persist explanation + optional image prompt in one string. */
export function mergeSequenceStepDescriptionAndImagePrompt(main: string, imagePrompt: string): string {
  const m = String(main ?? "").trimEnd();
  const p = String(imagePrompt ?? "").trim();
  if (!p) return m;
  return `${m}${INTERACTIVE_SEQUENCE_IMAGE_PROMPT_DELIM}${p}`;
}
