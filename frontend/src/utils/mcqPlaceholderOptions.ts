import { parseGeneratorMcqForSelfCheckImport } from "./parseGeneratorMcqForSelfCheckImport";
import { htmlToPlainText } from "./parseFlexibleCheckpointPaste";

const PLACEHOLDER_OPTION_RE = /^\[?Option\s*\d+\]?$/i;
const GENERIC_CHECKPOINT_PROMPT_RE = /^which statement is correct\??$/i;

/** True when MCQ options are editor placeholders, not real distractors. */
export function isPlaceholderMcqOptions(options: unknown): boolean {
  const arr = Array.isArray(options) ? options : [];
  const trimmed = arr.map((o) => String(o ?? "").trim()).filter(Boolean);
  if (trimmed.length === 0) return true;
  return trimmed.every((o) => PLACEHOLDER_OPTION_RE.test(o));
}

/** True for the classic invent-filler prompt used by legacy save repair. */
export function isGenericPlaceholderCheckpointPrompt(question: unknown): boolean {
  return GENERIC_CHECKPOINT_PROMPT_RE.test(String(question ?? "").trim());
}

export type RecoveredMcqFields = {
  prompt: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

/**
 * Recover MCQ fields from generator HTML / CHECKPOINT paste in `content` when export left placeholders.
 */
export function recoverMcqFieldsFromBlockContent(content: unknown): RecoveredMcqFields | null {
  const raw = String(content ?? "").trim();
  if (!raw) return null;

  let plain = raw;
  try {
    plain = htmlToPlainText(raw);
  } catch {
    plain = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  if (!plain.trim()) return null;

  const parsed = parseGeneratorMcqForSelfCheckImport(plain);
  if (!parsed.ok) return null;

  const options = parsed.options.map((o) => String(o ?? "").trim()).filter(Boolean);
  if (options.length < 2 || isPlaceholderMcqOptions(options)) return null;

  return {
    prompt: parsed.prompt,
    options,
    correctAnswer: parsed.correctAnswer,
    explanation: parsed.explanation,
  };
}
