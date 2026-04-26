/**
 * Step 1 (LLM Roadmap): AI API — explain chunk, etc.
 */
import api from "../services/api";

export type ExplainChunkParams = {
  text: string;
  level?: string;
  subject?: string;
};

export type ExplainChunkResponse = {
  explanation: string;
  _disabled?: boolean;
};

export async function explainChunk(params: ExplainChunkParams): Promise<ExplainChunkResponse> {
  const res = await api.post<ExplainChunkResponse>("/ai/explain-chunk", {
    text: params.text,
    level: params.level,
    subject: params.subject,
  });
  return res.data;
}

// Step 2: Explain my mistake
export type ExplainMistakeParams = {
  questionText: string;
  userAnswer: string;
  correctAnswer: string;
  topic?: string;
  markScheme?: string[] | string;
  level?: string;
  subject?: string;
};

export type ExplainMistakeResponse = {
  explanation: string;
  _disabled?: boolean;
};

export async function explainMistake(params: ExplainMistakeParams): Promise<ExplainMistakeResponse> {
  const res = await api.post<ExplainMistakeResponse>("/ai/explain-mistake", {
    questionText: params.questionText,
    userAnswer: params.userAnswer,
    correctAnswer: params.correctAnswer,
    topic: params.topic,
    markScheme: params.markScheme,
    level: params.level,
    subject: params.subject,
  });
  return res.data;
}

// Step 3: Quiz me (LLM) — generate practice quiz
export type GeneratePracticeQuizParams = {
  topic: string;
  subject?: string;
  level?: string;
  numQuestions?: number;
};

export type PracticeQuizQuestion = {
  id: string;
  type: "mcq" | "short";
  question: string;
  options?: string[];
  correctAnswer: string;
  marks?: number;
};

export type GeneratePracticeQuizResponse = {
  questions: PracticeQuizQuestion[];
  _disabled?: boolean;
};

export async function generatePracticeQuiz(
  params: GeneratePracticeQuizParams
): Promise<GeneratePracticeQuizResponse> {
  const res = await api.post<GeneratePracticeQuizResponse>("/ai/generate-practice-quiz", {
    topic: params.topic,
    subject: params.subject,
    level: params.level,
    numQuestions: params.numQuestions,
  });
  return res.data;
}

// Step 4: RAG — ask about lesson content
export type AskRAGParams = {
  question: string;
  lessonId: string;
};

export type AskRAGResponse = {
  answer: string;
  _disabled?: boolean;
};

export async function askRAG(params: AskRAGParams): Promise<AskRAGResponse> {
  const res = await api.post<AskRAGResponse>("/ai/ask", {
    question: params.question,
    lessonId: params.lessonId,
  });
  return res.data;
}

// Step 5: Summarise / key points
export type SummariseParams = {
  lessonId: string;
};

export type SummariseResponse = {
  summary: string;
  keyPoints: string[];
  _disabled?: boolean;
};

export async function summariseLesson(params: SummariseParams): Promise<SummariseResponse> {
  const res = await api.post<SummariseResponse>("/ai/summarise", {
    lessonId: params.lessonId,
  });
  return res.data;
}

// Step 7: Structure my notes (user input → summary + flashcards)
export type StructureNotesParams = {
  notes: string;
};

export type StructureNotesResponse = {
  summary: string;
  flashcards: { front: string; back: string }[];
  _disabled?: boolean;
};

export async function structureNotes(params: StructureNotesParams): Promise<StructureNotesResponse> {
  const res = await api.post<StructureNotesResponse>("/ai/structure-notes", {
    notes: params.notes,
  });
  return res.data;
}

/**
 * Suggested glossary definition for a key term (teacher review before save).
 * Reuses {@link explainChunk} — instructions are packed into the `text` field.
 */
export type SuggestKeyTermDefinitionParams = {
  term: string;
  lessonTitle: string;
  subject: string;
  level: string;
  examBoardName?: string | null;
  topic: string;
  pageTitle: string;
  blockContext: string;
};

const KEY_TERM_DEF_MAX = 300;

function clipKeyTermDefinition(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

export async function suggestKeyTermDefinition(
  params: SuggestKeyTermDefinitionParams
): Promise<{ definition: string; _disabled?: boolean }> {
  const term = String(params.term || "").trim();
  if (!term) {
    throw new Error("term is required");
  }
  const blockContext = String(params.blockContext || "")
    .trim()
    .slice(0, 3500);
  const board = params.examBoardName?.trim() || "—";
  const text = [
    "TASK: Write a very short glossary definition for the term below, for students reading this lesson. Reply with plain text only.",
    "",
    `Term: ${term}`,
    `Lesson title: ${String(params.lessonTitle || "").trim() || "—"}`,
    `Page title: ${String(params.pageTitle || "").trim() || "—"}`,
    `Subject: ${String(params.subject || "").trim() || "—"}`,
    `Level: ${String(params.level || "").trim() || "—"}`,
    `Exam board: ${board}`,
    `Topic: ${String(params.topic || "").trim() || "—"}`,
    "",
    "Lesson extract (context around the term; may be truncated):",
    "---",
    blockContext || "(none)",
    "---",
    "",
    "Rules:",
    "- British English, simple language, suitable for the level and subject above.",
    "- Exactly 1–2 short sentences, at most 300 characters total.",
    "- No markdown, no bullet points, no heading, no surrounding quotation marks for the whole answer.",
    "- Define the term in the context of this lesson, not a generic dictionary entry.",
  ].join("\n");

  const res = await explainChunk({
    text,
    level: params.level,
    subject: params.subject,
  });
  let def = String(res.explanation || "").trim();
  def = def
    .replace(/^\*+|\*+$/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^["']|["']$/g, "")
    .trim();
  def = clipKeyTermDefinition(def, KEY_TERM_DEF_MAX);
  return { definition: def, _disabled: res._disabled };
}

/** Suggested key terms for a single lesson block (AI returns JSON; parsed on the client). */
export type SuggestKeyTermsForBlockParams = {
  lessonTitle: string;
  subject: string;
  level: string;
  examBoardName?: string | null;
  topic: string;
  pageTitle: string;
  blockText: string;
};

export type SuggestedKeyTermRow = { term: string; definition: string };

/**
 * Reuses {@link explainChunk} — instruction + JSON request are packed into `text`.
 * Returns 5–8 terms or throws if the model output is not valid JSON.
 */
export function parseSuggestedKeyTermsJson(raw: string): SuggestedKeyTermRow[] | null {
  try {
    let t = String(raw || "").trim();
    if (t.startsWith("```")) {
      t = t
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/m, "")
        .trim();
    }
    const data = JSON.parse(t) as unknown;
    if (!Array.isArray(data)) return null;
    const out: SuggestedKeyTermRow[] = [];
    for (const row of data) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const term = typeof o.term === "string" ? o.term.trim() : "";
      const definition = typeof o.definition === "string" ? o.definition.trim() : "";
      if (!term) continue;
      out.push({ term, definition });
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

export async function suggestKeyTermsForBlock(
  params: SuggestKeyTermsForBlockParams
): Promise<{ items: SuggestedKeyTermRow[]; _disabled?: boolean }> {
  const blockText = String(params.blockText || "")
    .trim()
    .slice(0, 12000);
  if (!blockText) {
    throw new Error("empty_block");
  }
  const board = params.examBoardName?.trim() || "—";
  const text = [
    "TASK: Return 5–8 important GCSE-friendly key terms from the lesson block below.",
    "For each term, use the wording as it appears in the text when possible.",
    "Each definition must be exactly one short GCSE-friendly sentence.",
    "Reply with JSON only — a single JSON array. No markdown fences, no commentary before or after.",
    "Each object must have keys term (string) and definition (string).",
    "",
    `Lesson title: ${String(params.lessonTitle || "").trim() || "—"}`,
    `Page title: ${String(params.pageTitle || "").trim() || "—"}`,
    `Subject: ${String(params.subject || "").trim() || "—"}`,
    `Level: ${String(params.level || "").trim() || "—"}`,
    `Exam board: ${board}`,
    `Topic: ${String(params.topic || "").trim() || "—"}`,
    "",
    "Block text:",
    "---",
    blockText,
    "---",
  ].join("\n");

  const res = await explainChunk({
    text,
    level: params.level,
    subject: params.subject,
  });
  const raw = String(res.explanation || "").trim();
  const items = parseSuggestedKeyTermsJson(raw);
  if (!items) {
    throw new Error("parse");
  }
  return { items, _disabled: res._disabled };
}
