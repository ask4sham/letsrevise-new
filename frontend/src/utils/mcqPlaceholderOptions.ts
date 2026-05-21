import { parseGeneratorMcqForSelfCheckImport } from "./parseGeneratorMcqForSelfCheckImport";
import { htmlToPlainText } from "./parseFlexibleCheckpointPaste";

const PLACEHOLDER_OPTION_RE = /^\[?Option\s*\d+\]?$/i;

/** True when MCQ options are editor placeholders, not real distractors. */
export function isPlaceholderMcqOptions(options: unknown): boolean {
  const arr = Array.isArray(options) ? options : [];
  const trimmed = arr.map((o) => String(o ?? "").trim()).filter(Boolean);
  if (trimmed.length === 0) return true;
  return trimmed.every((o) => PLACEHOLDER_OPTION_RE.test(o));
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
