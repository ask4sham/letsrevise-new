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

/** Short-answer recall for step-by-step sequence “Test me” (question + model answer). */
export type SequenceRecallPayload = {
  question: string;
  answer: string;
  explanation?: string;
};

export type GenerateSequenceRecallParams = {
  topic: string;
  stepTitle: string;
  stepDescription: string;
  keyIdeaHint?: string;
  level?: string;
  subject?: string;
};

export function parseSequenceRecallJson(rawInput: string | unknown): SequenceRecallPayload | null {
  const raw =
    typeof rawInput === "string"
      ? rawInput
      : rawInput && typeof rawInput === "object"
        ? JSON.stringify(rawInput)
        : String(rawInput ?? "");
  const o = parseJsonObjectLoose(raw);
  if (!o) return null;
  const question = typeof o.question === "string" ? o.question.trim() : "";
  const answer =
    (typeof o.answer === "string" && o.answer.trim()) ||
    (typeof o.correctAnswer === "string" && o.correctAnswer.trim()) ||
    (typeof o.keyIdea === "string" && o.keyIdea.trim()) ||
    "";
  const explanation =
    (typeof o.explanation === "string" && o.explanation.trim()) ||
    (typeof o.rationale === "string" && o.rationale.trim()) ||
    "";
  if (!question || !answer) return null;
  return { question, answer, ...(explanation ? { explanation } : {}) };
}

/**
 * GCSE-style recall question for one process step. Uses /ai/explain-chunk; JSON in response body.
 */
export async function generateSequenceRecallFromStep(
  params: GenerateSequenceRecallParams
): Promise<{ recall: SequenceRecallPayload; _disabled?: boolean }> {
  const hint = String(params.keyIdeaHint || "").trim();
  const text = [
    "Generate ONE short GCSE-style recall question for this step in a biology/science process.",
    "The question must test understanding of the step below — not generic trivia.",
    "Return JSON only (no markdown fences) with this exact structure:",
    '{ "question": string, "answer": string, "explanation": string }',
    "question: one clear exam-style question (one or two sentences max).",
    "answer: a concise model answer / key idea (1–3 sentences) a student should recall.",
    "explanation: optional extra detail (can be empty string).",
    "Do NOT copy the question text as the answer. The answer must directly address the question.",
    "",
    `Topic / lesson: ${String(params.topic || "").trim() || "—"}`,
    `Step title: ${String(params.stepTitle || "").trim() || "—"}`,
    `Step content students learned: ${String(params.stepDescription || "").trim() || "—"}`,
    ...(hint ? [`Author key idea (use for answer, do not repeat as question): ${hint}`] : []),
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
  let recall = parseSequenceRecallJson(raw);
  if (!recall) {
    res = await explainOnce();
    raw = String(res.explanation ?? extractTextFromExplainChunkResponse(res) ?? "").trim();
    recall = parseSequenceRecallJson(raw);
  }
  if (!recall) {
    throw new Error("parse_sequence_recall");
  }
  return { recall, _disabled: res._disabled };
}

/** One row for a drag-and-drop match block (client assigns stable ids). */
export type DragDropPair = {
  prompt: string;
  answer: string;
  explanation?: string;
};

function normalizeDragDropPairRows(raw: unknown[], maxRows: number): DragDropPair[] {
  const cap = Number.isFinite(maxRows) && maxRows > 0 ? Math.min(40, Math.floor(maxRows)) : 20;
  const out: DragDropPair[] = [];
  const seenAnswers = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const prompt = typeof o.prompt === "string" ? o.prompt.trim() : "";
    const answer = typeof o.answer === "string" ? o.answer.trim() : "";
    if (!prompt || !answer) continue;
    const k = answer.toLowerCase();
    if (seenAnswers.has(k)) continue;
    seenAnswers.add(k);
    const explanation = typeof o.explanation === "string" ? o.explanation.trim() : "";
    out.push(
      explanation
        ? { prompt, answer, explanation }
        : { prompt, answer }
    );
    if (out.length >= cap) break;
  }
  return out;
}

/**
 * Parse JSON array of drag/drop rows from /ai/explain-chunk. Returns null if the
 * response is not valid JSON or not a JSON array.
 */
function tryParseDragDropPairsJson(text: string): DragDropPair[] | null {
  try {
    let cleaned = String(text || "").trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/m, "")
        .trim();
    }
    cleaned = cleaned.replace(/```json|```/gi, "").trim();
    const parsed: unknown = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return null;
    return normalizeDragDropPairRows(parsed, 20);
  } catch {
    return null;
  }
}

/**
 * Best-effort parse for tests/callers: invalid JSON or shape → [].
 * Prefer {@link tryParseDragDropPairsJson} when you must distinguish parse failure.
 */
export function parseDragDropPairsJson(text: string): DragDropPair[] {
  return tryParseDragDropPairsJson(text) ?? [];
}

/**
 * Generate drag/drop match rows via existing {@link explainChunk} (no new backend route).
 * Throws if the model output is not a valid JSON array.
 * Returns an empty array if the model returns a valid empty array.
 */
export async function generateDragDropPairsFromText(input: {
  lessonTitle?: string;
  pageTitle?: string;
  subject?: string;
  level?: string;
  text: string;
  /**
   * "topic" — short label (e.g. virus structure); 4–6 pairs from the topic alone.
   * "lessonExcerpt" — longer pasted content (up to 8 pairs).
   */
  source?: "lessonExcerpt" | "topic";
}): Promise<DragDropPair[]> {
  const content = String(input.text || "").trim();
  const source = input.source ?? "lessonExcerpt";
  const header = [
    input.lessonTitle && `Lesson title: ${String(input.lessonTitle).trim()}`,
    input.pageTitle && `Page title: ${String(input.pageTitle).trim()}`,
    input.subject && `Subject: ${String(input.subject).trim()}`,
    input.level && `Level: ${String(input.level).trim()}`,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt =
    source === "topic"
      ? [
          "Generate GCSE-level drag-and-drop matching pairs for teaching.",
          "Return ONLY a valid JSON array. No markdown code fences, no commentary before or after.",
          'Each object must have: "prompt" (string), "answer" (string), "explanation" (string, optional but preferred).',
          "",
          "Rules:",
          "- Create between 4 and 6 pairs (inclusive) for the topic below.",
          '- "prompt" = target / label on the board; "answer" = text on the draggable card that matches it.',
          "- Use clear, accurate GCSE-style language.",
          "- Avoid duplicate answers (each answer string must be unique).",
          "- Keep prompt and answer phrases concise.",
          "- Explanation: one short GCSE-style justification or exam-facing note per pair (how an examiner expects the link to be stated); prefer precise terminology over filler.",
          "- Do not invent URLs or image paths — text only.",
          "",
          header,
          `Topic: ${content}`,
        ].join("\n")
      : [
          "Generate GCSE-level drag and drop matching pairs.",
          "Return ONLY a valid JSON array. No markdown code fences, no commentary before or after.",
          'Each object must have: "prompt" (string), "answer" (string), "explanation" (string, optional but preferred).',
          "",
          "Rules:",
          "- Focus on key concepts from the content below.",
          "- Use clear GCSE AQA-style language where appropriate.",
          "- Avoid duplicate answers (each answer string must be unique).",
          "- Keep answers concise.",
          "- Explanation: one short GCSE-style, exam-focused sentence per pair where possible.",
          "- At most 8 pairs.",
          "",
          header,
          "Content:",
          content,
        ].join("\n");

  const res = await explainChunk({
    text: prompt,
    level: input.level,
    subject: input.subject,
    verbatim: true,
  });
  const raw = String(res.explanation ?? extractTextFromExplainChunkResponse(res) ?? "").trim();
  if (!raw) {
    return [];
  }
  const arr = tryParseFlexibleJsonArray(raw);
  if (!arr) {
    throw new Error("parse_drag_drop_json");
  }
  const maxRows = source === "topic" ? 6 : 8;
  const parsed = normalizeDragDropPairRows(arr, maxRows);
  if (source === "topic" && parsed.length < 4) {
    throw new Error("parse_drag_drop_json");
  }
  return parsed;
}

/** First top-level `[` … `]` substring (handles leading prose outside the array). */
function extractFirstJsonArraySubstring(s: string): string | null {
  const t = String(s || "").trim();
  const first = t.indexOf("[");
  if (first < 0) return null;
  let depth = 0;
  let inString = false;
  let esc = false;
  for (let i = first; i < t.length; i++) {
    const c = t[i]!;
    if (esc) {
      esc = false;
      continue;
    }
    if (inString) {
      if (c === "\\") esc = true;
      else if (c === "\"") inString = false;
      continue;
    }
    if (c === "\"") {
      inString = true;
      continue;
    }
    if (c === "[") depth += 1;
    else if (c === "]") {
      depth -= 1;
      if (depth === 0) return t.slice(first, i + 1);
    }
  }
  return null;
}

/** Try full-string JSON array parse; on failure retry with {@link extractFirstJsonArraySubstring}. */
function tryParseFlexibleJsonArray(text: string): unknown[] | null {
  try {
    let cleaned = String(text || "").trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/m, "")
        .trim();
    }
    cleaned = cleaned.replace(/```json|```/gi, "").trim();
    const parsed: unknown = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    /* try substring */
  }
  const sub = extractFirstJsonArraySubstring(text);
  if (!sub?.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(sub.trim());
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function clampInt(n: number, lo: number, hi: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

/** Draft row for AI-generated interactive sequence blocks (prior to assigning ids locally). */
export type AISequenceStepDraft = {
  title: string;
  description: string;
  /** Optional key idea revealed to students behind “Reveal answer / key idea” (not MCQ). */
  caption: string;
  /** Optional text-only idea for an illustration (teachers add images later). */
  imagePrompt: string;
  /**
   * One short sentence: why the key idea is correct, GCSE-friendly and exam-focused.
   * Shown with caption after reveal; omit entirely if absent.
   */
  testExplanation?: string;
};

function normalizeSequenceStepAiRows(raw: unknown[], maxRows: number): AISequenceStepDraft[] {
  const out: AISequenceStepDraft[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const description =
      typeof o.description === "string"
        ? o.description.trim()
        : typeof o.explanation === "string"
          ? o.explanation.trim()
          : typeof o.body === "string"
            ? o.body.trim()
            : "";
    const captionRaw =
      typeof o.caption === "string"
        ? o.caption.trim()
        : typeof o.quizCaption === "string"
          ? o.quizCaption.trim()
          : "";
    const imagePromptRaw =
      typeof o.imagePrompt === "string"
        ? o.imagePrompt.trim()
        : typeof o.image_prompt === "string"
          ? o.image_prompt.trim()
          : typeof o.imageIdea === "string"
            ? o.imageIdea.trim()
            : "";
    const testExplanationRaw =
      typeof o.testExplanation === "string"
        ? o.testExplanation.trim()
        : typeof o.test_explanation === "string"
          ? o.test_explanation.trim()
          : "";
    if (!title || !description) continue;
    const draft: AISequenceStepDraft = {
      title,
      description,
      caption: captionRaw,
      imagePrompt: imagePromptRaw,
    };
    if (testExplanationRaw) draft.testExplanation = testExplanationRaw;
    out.push(draft);
    if (out.length >= maxRows) break;
  }
  return out;
}

function tryParseInteractiveSequenceStepsJson(raw: string, expected: number): AISequenceStepDraft[] | null {
  const arr = tryParseFlexibleJsonArray(raw);
  if (!arr) return null;
  const normalized = normalizeSequenceStepAiRows(arr, expected);
  if (normalized.length < Math.min(3, expected)) return null;
  return normalized.slice(0, expected);
}

/**
 * GCSE-style ordered steps for an interactive sequence activity.
 * Uses {@link explainChunk} (no new backend route).
 */
export async function generateInteractiveSequenceStepsFromTopic(input: {
  topic: string;
  numSteps?: number;
  lessonTitle?: string;
  pageTitle?: string;
  subject?: string;
  level?: string;
}): Promise<AISequenceStepDraft[]> {
  const topic = String(input.topic || "").trim();
  if (!topic) {
    throw new Error("topic_required");
  }
  const rawN =
    typeof input.numSteps === "number" && Number.isFinite(input.numSteps)
      ? Number(input.numSteps)
      : 5;
  const n = clampInt(rawN, 4, 6, 5);

  const header = [
    input.lessonTitle && `Lesson title: ${String(input.lessonTitle).trim()}`,
    input.pageTitle && `Page title: ${String(input.pageTitle).trim()}`,
    input.subject && `Subject: ${String(input.subject).trim()}`,
    input.level && `Level: ${String(input.level).trim()}`,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = [
    "Generate GCSE-level steps for an interactive sequence activity (ordered process).",
    `Return ONLY a JSON array of exactly ${n} objects, in chronological order.`,
    "No markdown code fences or commentary.",
    "",
    "Each object must include:",
    '- "title" — short heading for this step (students see it in the step list).',
    '- "description" — short student-facing explanation (about 2–4 sentences) of what happens in this step.',
    '- "imagePrompt" (optional) — text-only idea for a simple illustration later (no URLs, not a file path). Omit if not helpful.',
    '- "caption" (optional but recommended when using the self-check) — one precise GCSE-style sentence that is the “answer / key idea” revealed only after the student taps Reveal.',
    '- "testExplanation" (optional but recommended whenever "caption" is present) — exactly one short sentence explaining why that key idea is correct, exam-focused, no fluff; not a paragraph.',
    "",
    "Rules:",
    "- Cover the concept end-to-end; no repeated steps.",
    '- If "caption" is omitted, omit "testExplanation" too.',
    "- Do not output image URLs or base64 — teachers add images in the editor.",
    `- Exactly ${n} steps (no more, no fewer).`,
    header,
    `Concept / process: ${topic}`,
  ].join("\n");

  const res = await explainChunk({
    text: prompt,
    level: input.level,
    subject: input.subject,
    verbatim: true,
  });
  const raw = String(res.explanation ?? extractTextFromExplainChunkResponse(res) ?? "").trim();
  if (!raw) {
    throw new Error("parse_sequence_json");
  }
  const parsed = tryParseInteractiveSequenceStepsJson(raw, n);
  if (parsed === null) {
    throw new Error("parse_sequence_json");
  }
  return parsed;
}

/** Draft row for AI-generated interactive diagram hotspots (no x/y — placed in Edit lesson). */
export type InteractiveDiagramHotspotAiDraft = {
  label: string;
  description: string;
};

function normalizeDiagramHotspotAiRows(raw: unknown[], maxRows: number): InteractiveDiagramHotspotAiDraft[] {
  const out: InteractiveDiagramHotspotAiDraft[] = [];
  const seenLabels = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const label =
      typeof o.label === "string"
        ? o.label.trim()
        : typeof o.name === "string"
          ? o.name.trim()
          : "";
    let description =
      typeof o.description === "string"
        ? o.description.trim()
        : typeof o.details === "string"
          ? o.details.trim()
          : "";
    if (!label) continue;
    if (seenLabels.has(label.toLowerCase())) continue;
    seenLabels.add(label.toLowerCase());
    if (!description.length) description = `${label}: key idea for GCSE students.`;
    out.push({ label, description });
    if (out.length >= maxRows) break;
  }
  return out;
}

function tryParseInteractiveDiagramHotspotsJson(raw: string, expected: number): InteractiveDiagramHotspotAiDraft[] | null {
  const arr = tryParseFlexibleJsonArray(raw);
  if (!arr) return null;
  const normalized = normalizeDiagramHotspotAiRows(arr, expected);
  if (normalized.length < Math.min(2, expected)) return null;
  return normalized.slice(0, expected);
}

/**
 * Labels + teaching text for diagram hotspots before teachers place pins on an image.
 * Uses {@link explainChunk}.
 */
export async function generateInteractiveDiagramHotspotsFromConcept(input: {
  concept: string;
  /** Default 6; clamped 3–12. */
  numHotspots?: number;
  lessonTitle?: string;
  pageTitle?: string;
  subject?: string;
  level?: string;
}): Promise<InteractiveDiagramHotspotAiDraft[]> {
  const concept = String(input.concept || "").trim();
  if (!concept) {
    throw new Error("concept_required");
  }
  const rawK =
    typeof input.numHotspots === "number" && Number.isFinite(input.numHotspots)
      ? Number(input.numHotspots)
      : 6;
  const k = clampInt(rawK, 3, 12, 6);

  const header = [
    input.lessonTitle && `Lesson title: ${String(input.lessonTitle).trim()}`,
    input.pageTitle && `Page title: ${String(input.pageTitle).trim()}`,
    input.subject && `Subject: ${String(input.subject).trim()}`,
    input.level && `Level: ${String(input.level).trim()}`,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = [
    "Generate hotspots for an interactive GCSE diagram activity.",
    `Return ONLY a JSON array of exactly ${k} objects.`,
    "No markdown code fences or commentary.",
    "",
    'Each object: "label" (short noun or phrase for the clickable region list) and "description" (1–4 sentences learners read when selecting it).',
    "",
    `- Hotspots must relate to ONE diagram concept below (not random trivia).`,
    `- Exactly ${k} hotspots; labels distinct.`,
    `- No coordinates or percentages — placeholders only.`,
    header,
    `Concept/topic for the diagram: ${concept}`,
  ].join("\n");

  const res = await explainChunk({
    text: prompt,
    level: input.level,
    subject: input.subject,
    verbatim: true,
  });
  const raw = String(res.explanation ?? extractTextFromExplainChunkResponse(res) ?? "").trim();
  if (!raw) throw new Error("parse_diagram_json");
  const parsed = tryParseInteractiveDiagramHotspotsJson(raw, k);
  if (!parsed?.length) {
    throw new Error("parse_diagram_json");
  }
  return parsed;
}

function tryParseFlexibleJsonObject(text: string): Record<string, unknown> | null {
  try {
    let cleaned = String(text || "").trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/m, "")
        .trim();
    }
    cleaned = cleaned.replace(/```json|```/gi, "").trim();
    const parsed: unknown = JSON.parse(cleaned);
    return parsed != null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** AI-generated graph block payload (teachers may edit before save). */
export type GraphBlockAiDraft = {
  title: string;
  intro: string;
  graphType: "line" | "bar" | "scatter";
  xAxisLabel: string;
  yAxisLabel: string;
  xUnits: string;
  yUnits: string;
  graphSeries: Array<{
    label: string;
    points: Array<{ x: number | string; y: number }>;
  }>;
  graphAnnotations: Array<{ text: string; kind?: string }>;
  examQuestion: string;
  markScheme: string;
  examinerTip: string;
};

/**
 * Generate a data-driven graph block (Chart.js) from a teacher prompt.
 * Uses {@link explainChunk} — no new backend route required.
 */
export async function generateGraphBlockFromPrompt(input: {
  prompt: string;
  lessonTitle?: string;
  pageTitle?: string;
  subject?: string;
  level?: string;
  graphType?: "line" | "bar" | "scatter";
}): Promise<GraphBlockAiDraft> {
  const topic = String(input.prompt || "").trim();
  if (topic.length < 4) throw new Error("prompt_required");

  const graphType = input.graphType ?? "line";
  const header = [
    input.lessonTitle && `Lesson title: ${String(input.lessonTitle).trim()}`,
    input.pageTitle && `Page title: ${String(input.pageTitle).trim()}`,
    input.subject && `Subject: ${String(input.subject).trim()}`,
    input.level && `Level: ${String(input.level).trim()}`,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = [
    "Generate a GCSE exam-style data graph for a revision lesson block.",
    "Return ONLY one JSON object. No markdown fences or commentary.",
    "",
    "Required keys:",
    '- "title" (string)',
    '- "intro" (string, 2-4 sentences explaining what the graph shows)',
    `- "graphType": "${graphType}"`,
    '- "xAxisLabel", "yAxisLabel", "xUnits", "yUnits" (strings; units may be empty)',
    '- "graphSeries": array with 1-2 objects: { "label": string, "points": [ { "x": number or string, "y": number }, ... ] }',
    "  - Use 5-8 sensible data points with a clear trend (e.g. levels off, peak, linear region).",
    "  - x may be numbers (continuous) or short category strings for bar charts only.",
    '- "graphAnnotations": array of 0-3 { "text": string, "kind": "callout" | "trend" }',
    '- "examQuestion", "markScheme", "examinerTip" (strings; exam-style graph interpretation)',
    "",
    "Rules:",
    "- Scientifically accurate for the topic and level.",
    "- Data must be plausible — not random noise.",
    "- Suitable for graph interpretation questions (describe trend, explain plateau, etc.).",
    header,
    `Topic / teacher request: ${topic}`,
  ].join("\n");

  const res = await explainChunk({
    text: prompt,
    level: input.level,
    subject: input.subject,
    verbatim: true,
  });
  const raw = String(res.explanation ?? extractTextFromExplainChunkResponse(res) ?? "").trim();
  if (!raw) throw new Error("parse_graph_json");
  const obj = tryParseFlexibleJsonObject(raw);
  if (!obj) throw new Error("parse_graph_json");

  const seriesRaw = Array.isArray(obj.graphSeries) ? obj.graphSeries : [];
  const graphSeries: GraphBlockAiDraft["graphSeries"] = [];
  for (const row of seriesRaw.slice(0, 2)) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const label = String(o.label ?? "Series").trim() || "Series";
    const pts = Array.isArray(o.points) ? o.points : [];
    const points: Array<{ x: number | string; y: number }> = [];
    for (const p of pts.slice(0, 12)) {
      if (!p || typeof p !== "object") continue;
      const pt = p as Record<string, unknown>;
      const y = Number(pt.y);
      if (!Number.isFinite(y)) continue;
      const xRaw = pt.x;
      const x =
        typeof xRaw === "number" && Number.isFinite(xRaw) ? xRaw : String(xRaw ?? "").trim();
      if (x === "" && typeof x !== "number") continue;
      points.push({ x, y });
    }
    if (points.length) graphSeries.push({ label, points });
  }
  if (!graphSeries.length) throw new Error("parse_graph_json");

  const annRaw = Array.isArray(obj.graphAnnotations) ? obj.graphAnnotations : [];
  const graphAnnotations: GraphBlockAiDraft["graphAnnotations"] = annRaw
    .slice(0, 4)
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const a = row as Record<string, unknown>;
      const text = String(a.text ?? "").trim();
      if (!text) return null;
      const kind = String(a.kind ?? "").trim();
      return { text, ...(kind === "trend" || kind === "callout" ? { kind } : {}) };
    })
    .filter((a): a is GraphBlockAiDraft["graphAnnotations"][number] => a != null);

  const gt = String(obj.graphType ?? graphType).trim().toLowerCase();
  const normalizedType = gt === "bar" ? "bar" : gt === "scatter" ? "scatter" : "line";

  return {
    title: String(obj.title ?? topic).trim().slice(0, 200),
    intro: String(obj.intro ?? "").trim(),
    graphType: normalizedType,
    xAxisLabel: String(obj.xAxisLabel ?? "").trim(),
    yAxisLabel: String(obj.yAxisLabel ?? "").trim(),
    xUnits: String(obj.xUnits ?? "").trim(),
    yUnits: String(obj.yUnits ?? "").trim(),
    graphSeries,
    graphAnnotations,
    examQuestion: String(obj.examQuestion ?? "").trim(),
    markScheme: String(obj.markScheme ?? "").trim(),
    examinerTip: String(obj.examinerTip ?? "").trim(),
  };
}
