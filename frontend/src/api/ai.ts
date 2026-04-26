/**
 * Step 1 (LLM Roadmap): AI API — explain chunk, etc.
 */
import api from "../services/api";

export type ExplainChunkParams = {
  text: string;
  level?: string;
  subject?: string;
  /**
   * When true, server sends `text` to the model as the full user message (no “explain in simpler terms” wrapper).
   * Use for structured outputs (e.g. diagram “Test me” JSON) so the model follows the client’s instructions.
   */
  verbatim?: boolean;
};

export type ExplainChunkResponse = {
  explanation: string;
  _disabled?: boolean;
};

/**
 * Some proxies or clients may return content under different keys; normalize to one string.
 */
function extractTextFromExplainChunkResponse(data: unknown): string {
  if (data == null) return "";
  if (typeof data === "string") return data;
  if (typeof data === "object") {
    const o = data as Record<string, unknown>;
    const keys = ["explanation", "answer", "text", "result", "message", "content", "data"] as const;
    for (const k of keys) {
      if (typeof o[k] === "string" && String(o[k]).trim().length) return String(o[k]);
    }
  }
  return "";
}

export async function explainChunk(params: ExplainChunkParams): Promise<ExplainChunkResponse> {
  const res = await api.post<Record<string, unknown>>("/ai/explain-chunk", {
    text: params.text,
    level: params.level,
    subject: params.subject,
    verbatim: params.verbatim,
  });
  const body = res.data ?? {};
  const direct =
    typeof body.explanation === "string" && String(body.explanation).trim() ? String(body.explanation) : "";
  const explanation = direct || extractTextFromExplainChunkResponse(body) || "";
  return {
    explanation,
    _disabled: typeof body._disabled === "boolean" ? body._disabled : undefined,
  };
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

/** One MCQ for interactive diagram "Test me" — reuses {@link explainChunk} (no new backend route). */
export type HotspotMcqPayload = {
  question: string;
  options: [string, string, string, string];
  correctAnswer: string;
  explanation: string;
};

export type GenerateHotspotMcqParams = {
  topic: string;
  label: string;
  description: string;
  level?: string;
  subject?: string;
};

/** First top-level `{ ... }` balanced-brace substring (handles leading/trailing prose). */
function extractJsonObjectSubstring(s: string): string | null {
  const t = s.trim();
  const first = t.indexOf("{");
  if (first < 0) return null;
  let depth = 0;
  for (let i = first; i < t.length; i++) {
    const c = t[i];
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) return t.slice(first, i + 1);
    }
  }
  return null;
}

function parseJsonObjectLoose(raw: string): Record<string, unknown> | null {
  let t = String(raw || "").trim();
  if (t.startsWith("```")) {
    t = t
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
  }
  const candidates = [t, extractJsonObjectSubstring(t) || t];
  for (const chunk of candidates) {
    if (!chunk?.trim()) continue;
    try {
      const data = JSON.parse(chunk) as unknown;
      if (data && typeof data === "object" && !Array.isArray(data)) return data as Record<string, unknown>;
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Map model output (e.g. "B" or "Option C") to one of the four option strings. */
function resolveCorrectAnswerToOptionText(correctRaw: string, options: [string, string, string, string]): string | null {
  const c0 = correctRaw.trim();
  if (!c0) return null;
  for (const op of options) {
    if (op === c0) return op;
  }
  for (const op of options) {
    if (op.toLowerCase() === c0.toLowerCase()) return op;
  }
  // Single letter A–D → index
  const letter = c0.replace(/[^A-Da-d]/g, "").slice(0, 1);
  if (letter && /^[A-Da-d]$/.test(letter)) {
    const idx = letter.toUpperCase().charCodeAt(0) - 65; // A=0
    if (idx >= 0 && idx < 4) return options[idx]!;
  }
  const m = c0.match(/^option\s*([A-Da-d])\b/i) ?? c0.match(/^([A-Da-d])[\s\).:]/i);
  if (m) {
    const idx = m[1].toUpperCase().charCodeAt(0) - 65;
    if (idx >= 0 && idx < 4) return options[idx]!;
  }
  return null;
}

/**
 * Parse MCQ JSON from /ai/explain-chunk (often with prose or fences around the object).
 * Accepts `correctAnswer` or `answer`; maps letter answers to full option text.
 */
export function parseHotspotMcqJson(rawInput: string | unknown): HotspotMcqPayload | null {
  const raw =
    typeof rawInput === "string"
      ? rawInput
      : rawInput && typeof rawInput === "object"
        ? JSON.stringify(rawInput)
        : String(rawInput ?? "");
  const o = parseJsonObjectLoose(raw);
  if (!o) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.warn("[Hotspot MCQ] Failed to parse AI response", String(raw).slice(0, 2000));
    }
    return null;
  }
  const question = typeof o.question === "string" ? o.question.trim() : "";
  const correctField =
    (typeof o.correctAnswer === "string" && o.correctAnswer.trim()) ||
    (typeof o.answer === "string" && o.answer.trim()) ||
    "";
  const explanation =
    (typeof o.explanation === "string" && o.explanation.trim()) ||
    (typeof o.rationale === "string" && o.rationale.trim()) ||
    "";
  if (!question) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.warn("[Hotspot MCQ] Missing question in parsed object", o);
    }
    return null;
  }
  if (!Array.isArray(o.options)) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.warn("[Hotspot MCQ] Missing or invalid options array", o);
    }
    return null;
  }
  const opts = o.options.map((x) => String(x ?? "").trim()).filter((s) => s.length > 0);
  if (opts.length !== 4) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.warn("[Hotspot MCQ] Expected exactly 4 options, got", opts.length, o);
    }
    return null;
  }
  const four: [string, string, string, string] = [opts[0]!, opts[1]!, opts[2]!, opts[3]!];
  const correctAnswer = resolveCorrectAnswerToOptionText(correctField, four);
  if (!correctAnswer) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.warn("[Hotspot MCQ] Could not match correctAnswer to an option", correctField, four);
    }
    return null;
  }
  return { question, options: four, correctAnswer, explanation: explanation || "—" };
}

/**
 * One GCSE-style MCQ from a diagram hotspot. Uses /ai/explain-chunk; JSON in response body.
 */
export async function generateHotspotMcqFromConcept(
  params: GenerateHotspotMcqParams
): Promise<{ mcq: HotspotMcqPayload; _disabled?: boolean }> {
  const text = [
    "Generate 1 GCSE-style multiple choice question based on this concept.",
    "Return JSON only (no markdown code fences) with this exact structure:",
    '{ "question": string, "options": [string, string, string, string], "correctAnswer": string, "explanation": string }',
    "Use exactly 4 options. correctAnswer must match one of the four option strings exactly (same spelling and casing).",
    "The question should test whether the student understood the idea below, not random trivia.",
    "",
    `Topic / lesson: ${String(params.topic || "").trim() || "—"}`,
    `Concept (label): ${String(params.label || "").trim() || "—"}`,
    `What students read (explanation to base the question on): ${String(params.description || "").trim() || "—"}`,
  ].join("\n");

  const explainOnce = () =>
    explainChunk({
      text,
      level: params.level,
      subject: params.subject,
      verbatim: true,
    });

  let res = await explainOnce();
  let raw = String(res.explanation ?? extractTextFromExplainChunkResponse(res) ?? "").trim();
  let mcq = parseHotspotMcqJson(raw);
  if (!mcq) {
    res = await explainOnce();
    raw = String(res.explanation ?? extractTextFromExplainChunkResponse(res) ?? "").trim();
    mcq = parseHotspotMcqJson(raw);
  }
  if (!mcq) {
    throw new Error("parse_mcq");
  }
  return { mcq, _disabled: res._disabled };
}
