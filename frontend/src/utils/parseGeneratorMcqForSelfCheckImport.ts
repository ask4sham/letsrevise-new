import type { LessonCheckpointSegment } from "../lib/parseLessonText";
import { parseLessonText, preprocessCheckpointHeadings } from "../lib/parseLessonText";
import { coerceLessonMcqOptionsFour } from "./parseFlexibleCheckpointPaste";

export type ParsedGeneratorMcqForSelfCheck =
  | {
      ok: true;
      prompt: string;
      options: string[];
      correctAnswer: string;
      explanation: string;
      answerMismatchWarning: string | null;
    }
  | { ok: false; error: string };

const UNMATCHED_MSG = "Answer did not match any option exactly.";

/**
 * Normalise generator-style CHECKPOINT blobs so parseLessonText can find a checkpoint segment.
 * Keeps semantics local to explicit teacher import — not wired to global paste.
 */
export function normalizeGeneratorMcqBlobForParse(raw: string): string {
  let s = String(raw ?? "").replace(/\r/g, "\n");
  s = preprocessCheckpointHeadings(s);
  const plainBolt = /^[ \t]*\*{2}\s*⚡\s*CHECKPOINT\s*\*{2}\s*$/;
  const plainWord = /^[ \t]*CHECKPOINT\s*$/i;
  const numbered = /^[ \t]*\d+\.[ \t]*CHECKPOINT\s*$/i;

  const lines = s.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (plainBolt.test(line) || plainBolt.test(t)) {
      out.push("⚡ CHECKPOINT");
      continue;
    }
    if (plainWord.test(line) || plainWord.test(t) || numbered.test(line) || numbered.test(t)) {
      out.push("⚡ CHECKPOINT");
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

/** Body after Explanation: … until next checkpoint / question / structured field. */
function extractExplanation(blob: string): string {
  const lines = normalizeGeneratorMcqBlobForParse(blob).split("\n");
  const explanationIdx = lines.findIndex(
    (ln) =>
      /^Explanation:\s*$/i.test(ln.trim()) || /^Explanation:\s+.+/i.test(ln.trim())
  );
  if (explanationIdx === -1) return "";

  const firstLine = lines[explanationIdx];
  const fm = firstLine.match(/^Explanation:\s*(.*)$/i);
  const chunks: string[] = [];
  if (fm?.[1] != null && fm[1].trim()) chunks.push(fm[1].trim());

  for (let i = explanationIdx + 1; i < lines.length; i++) {
    const ln = lines[i];
    const t = ln.trim();
    if (/^⚡\s*CHECKPOINT/i.test(t)) break;
    if (/^Option\s*\d+:/i.test(t)) break;
    if (/^Answer:\s*/i.test(t)) break;
    chunks.push(ln);
  }
  return chunks.join("\n").trim();
}

/**
 * Parses generator CHECKPOINT MCQ blob for filling an existing Self-check block (explicit import).
 */
export function parseGeneratorMcqForSelfCheckImport(raw: string): ParsedGeneratorMcqForSelfCheck {
  const normalized = normalizeGeneratorMcqBlobForParse(raw);
  if (!normalized.trim()) return { ok: false, error: "Paste is empty." };

  let segments;
  try {
    segments = parseLessonText(normalized);
  } catch {
    return { ok: false, error: "Could not parse that text as a checkpoint." };
  }

  const ck = segments.find(
    (s): s is LessonCheckpointSegment =>
      s.type === "checkpoint" &&
      s.options.filter((o) => String(o ?? "").trim()).length >= 2 &&
      Boolean(String(s.question ?? "").trim())
  );

  if (!ck) {
    return {
      ok: false,
      error:
        'Expected headings like CHECKPOINT, Question:, Option 1–4:, Answer:, and optional Explanation:',
    };
  }

  const prompt = String(ck.question ?? "").trim();
  const fourRaw = coerceLessonMcqOptionsFour(ck.options);
  const trimmedAnswerKey = String(ck.answer ?? "").trim();

  let correctAnswer = "";
  for (let i = 0; i < fourRaw.length; i++) {
    if (fourRaw[i].trim() === trimmedAnswerKey) {
      correctAnswer = fourRaw[i];
      break;
    }
  }

  let explanation = extractExplanation(raw);
  let answerMismatchWarning: string | null = null;

  if (!correctAnswer.trim() && trimmedAnswerKey) {
    answerMismatchWarning = UNMATCHED_MSG;
    explanation = [
      explanation,
      "",
      UNMATCHED_MSG,
      trimmedAnswerKey ? `Imported Answer line: ${trimmedAnswerKey}` : "",
    ]
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  return {
    ok: true,
    prompt,
    options: [...fourRaw],
    correctAnswer,
    explanation,
    answerMismatchWarning,
  };
}
