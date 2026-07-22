/**
 * PR-004: LLM provider abstraction for enquiry answers.
 * generateEnquiryAnswer({ question, contextChunks, constraints }) -> structured JSON
 *
 * Structured output schema:
 * {
 *   explanation: string,
 *   keyPoints: string[],
 *   memoryHook: string,
 *   citations: [{ knowledgeDocumentId, sourceType, sourceId, quote (<=200), reason }],
 *   practice: [{ type: "mcq"|"short"|"exam", question, options?, answer, markScheme? }],
 *   warnings: string[]
 * }
 */
const { getProvider: getEmbeddingsProvider } = require("../embeddings/provider");
const { isTruthyEnv } = require("../../config/storage");

const DEBUG_ENQUIRY = process.env.DEBUG_ENQUIRY === "1" || process.env.DEBUG_ENQUIRY === "true";

const MAX_CONTEXT_CHARS = 12000;

/** LLM memoryHook: one short recall line; capped to ~12 words. */
function normalizeMemoryHook(raw) {
  let s = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (!s) return "";
  const words = s.split(" ").filter(Boolean);
  if (words.length > 12) return words.slice(0, 12).join(" ");
  return s.slice(0, 120);
}

const ENQUIRY_MEMORY_HOOK_PROMPT = `
MEMORY HOOK:
- After explanation and keyPoints, output exactly ONE field "memoryHook": a single line for fast exam recall.
- Max about 8–12 words. Compact, memorable, exam-relevant. Not vague, not jokey, not childish.
- Base it ONLY on what the answer already supports (same facts as explanation/keyPoints). Do not invent facts.
- Do NOT repeat or paraphrase the explanation verbatim. Do NOT output a full paragraph or multiple sentences.
- No waffle. Prefer tight patterns such as: "X = Y", "X = Y + Z", "Think: …", "Rule: …", "Right side → lungs", arrows for direction/flow.
- Match question type when possible:
  - Name/list questions: summarise the category or list pattern cleanly (e.g. key names or "enzyme X, enzyme Y").
  - What/function questions: state the function in one crisp line.
  - Why/how questions: state the mechanism or reason in one line.
- If no good hook fits without stretching the evidence, use "" for memoryHook.`;

const ENQUIRY_MEMORY_HOOK_SUFFIX_CURRICULUM = `
CURRICULUM MEMORY HOOK: memoryHook must only compress ideas already supported by your retrieved sources and cited answer—no new facts beyond that evidence.`;

const ENQUIRY_MEMORY_HOOK_SUFFIX_GK = `
GENERAL-KNOWLEDGE MEMORY HOOK: Be conservative; avoid speculative specifics; keep the hook safe, simple, and still useful when possible.`;

/** Unified user-visible warning when enquiry uses general-knowledge fallback (non-strict). */
const ENQUIRY_FALLBACK_LIMITED_CURRICULUM_WARNING =
  "This answer uses general knowledge because trusted curriculum sources were limited.";

/** @deprecated use ENQUIRY_FALLBACK_LIMITED_CURRICULUM_WARNING */
const ENQUIRY_GENERAL_KNOWLEDGE_NOTICE = ENQUIRY_FALLBACK_LIMITED_CURRICULUM_WARNING;
/** @deprecated use ENQUIRY_FALLBACK_LIMITED_CURRICULUM_WARNING */
const ENQUIRY_NO_CURRICULUM_SOURCES_WARNING = ENQUIRY_FALLBACK_LIMITED_CURRICULUM_WARNING;

/** Max OpenAI attempts for enquiry (initial try + retries). Default 3 in prod, 1 in test. */
function getEnquiryLlmMaxAttempts() {
  const raw = process.env.ENQUIRY_LLM_MAX_ATTEMPTS;
  if (raw != null && String(raw).trim() !== "") {
    const n = parseInt(String(raw), 10);
    if (Number.isFinite(n) && n >= 1) return Math.min(8, n);
  }
  return process.env.NODE_ENV === "test" ? 1 : 3;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry only on likely-transient failures (rate limits, server errors, network).
 * Does not retry missing API key, 400, 401, 403, 404.
 */
function shouldRetryOpenAiEnquiryError(err) {
  if (!err) return false;
  const msg = String(err.message || "");

  if (msg.includes("LLM_API_KEY or OPENAI_API_KEY required")) return false;

  const status = err.response?.status;
  if (status === 400 || status === 401 || status === 403 || status === 404) return false;

  if (status === 429 || status === 408 || (status >= 500 && status < 600)) return true;

  const code = err.code;
  if (code && ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ECONNABORTED"].includes(code)) {
    return true;
  }

  if (!err.response) return true;

  if (status >= 400 && status < 500) return false;

  return false;
}

/**
 * LetsRevise LLM (enquiry, topic summary, starter pack, etc.).
 * - test: defaults to mock unless LLM_PROVIDER=openai (stable CI).
 * - non-test: explicit LLM_PROVIDER=mock → mock; LLM_PROVIDER=openai → openai;
 *   otherwise if OPENAI_API_KEY or LLM_API_KEY is set → openai (production default), else mock.
 */
function getProvider() {
  const raw = (process.env.LLM_PROVIDER || "").toLowerCase().trim();
  if (process.env.NODE_ENV === "test") {
    return raw === "openai" ? "openai" : "mock";
  }
  if (raw === "mock") return "mock";
  if (raw === "openai") return "openai";
  const hasKey = !!(process.env.LLM_API_KEY || process.env.OPENAI_API_KEY);
  return hasKey ? "openai" : "mock";
}

/**
 * Call once from server startup (not in test).
 */
function logEnquiryTutorStartup() {
  if (process.env.NODE_ENV === "test") return;
  const p = getProvider();
  const hasKey = !!(process.env.LLM_API_KEY || process.env.OPENAI_API_KEY);
  const explicit = String(process.env.LLM_PROVIDER || "").trim();
  console.log(
    `[llm] tutor startup provider=${p} apiKey=${hasKey ? "present" : "absent"}${explicit ? ` LLM_PROVIDER=${explicit}` : ""}`
  );
  if (p === "openai" && !hasKey) {
    console.error("[llm] tutor: OpenAI selected but OPENAI_API_KEY/LLM_API_KEY missing — generation will fail");
  }
  if (p === "mock" && explicit === "mock" && hasKey) {
    console.warn("[llm] tutor: LLM_PROVIDER=mock — using mock despite API key");
  }
}

/**
 * Build context string from chunks for the prompt.
 */
function buildContext(contextChunks) {
  const parts = (contextChunks || []).map((c, i) => {
    const id = c.knowledgeDocumentId || `doc-${i}`;
    const title = c.title || "Source";
    const text = (c.text || "").slice(0, 1500);
    return `[${id}]\n${title}\n${text}`;
  });
  let ctx = parts.join("\n\n---\n\n");
  if (ctx.length > MAX_CONTEXT_CHARS) {
    ctx = ctx.slice(0, MAX_CONTEXT_CHARS) + "\n[...truncated]";
  }
  return ctx;
}

/**
 * PR-019: Build conversation context string for follow-up interpretation.
 */
function buildConversationContext(conversationContext) {
  if (!conversationContext || conversationContext.length === 0) return "";
  const lines = conversationContext.map((m) => `${m.role}: ${(m.text || "").slice(0, 400)}`);
  return "Recent conversation:\n" + lines.join("\n") + "\n\n";
}

/**
 * Strip polite / filler prefixes so "Please name…" is classified like "Name…".
 */
function stripEnquiryQuestionPrefix(q) {
  return String(q || "")
    .replace(/^(?:please|can you|could you|would you|tell me|i want to know)[,:]?\s+/i, "")
    .trim();
}

/**
 * Lightweight question-shape hints for GCSE-style precision (no retrieval change).
 */
function buildEnquiryQuestionIntentBlock(question) {
  const q = stripEnquiryQuestionPrefix(String(question || "").trim());
  const lower = q.toLowerCase();
  if (!q) return "";

  const precision = `PRECISION (always) — GCSE exam-style structure:
- The FIRST sentence must directly answer the question in one clear sentence.
- Do NOT start with background context, scene-setting, or general explanations.
- Do NOT write introductions like "The stomach is an organ that…" unless that phrasing IS the direct answer to the question.
- Keep the first sentence under ~20 words where possible.
- After the first sentence, use bullet points for supporting facts only (concise, exam-style: one idea per bullet).
- Do NOT repeat the same idea in prose and in bullets.
- Do NOT expand beyond what the question asks; do not answer a broader question than the one asked.
- Match the category the question requests (e.g. if it asks for enzymes, do not list non-enzymes such as hydrochloric acid unless sources justify it).
- Prefer vocabulary from retrieved lesson/spec text when accurate.
- Anti-waffle: if the answer can be given in one sentence, do NOT add extra paragraphs or filler; do not duplicate the first sentence in keyPoints—each key point must be a distinct fact.`;

  if (
    /\bdifference\b/.test(lower) ||
    /\bcompare\b/.test(lower) ||
    /\bversus\b|\bvs\.?\b/.test(lower) ||
    /\bhow (is|are|do|does) .+ differ/.test(lower)
  ) {
    return `${precision}

QUESTION SHAPE — COMPARE / DIFFERENCE:
- First sentence: the direct comparison outcome or contrast (one sentence).
- Then bullets: paired facts (e.g. A vs B) or short contrasts—no general chapter summary.
- Do not substitute a topic overview for a comparison.`;
  }

  const nameListOpener =
    /^(name|list|give (the )?names|state the|identify)\b/i.test(q) || /^which\b/i.test(q);

  if (nameListOpener) {
    return `${precision}

QUESTION SHAPE — NAME / LIST:
- First line MUST be only the answer: the names or list (use a short list or bullets). No sentence of explanation before the list.
- Do not open with context (e.g. digestion overview) before the names.
- After the list, optional short bullets for brief supporting facts only if sources support them—no essay.
- Only include items in the category asked; do not pad with unrelated facts.`;
  }

  if (/^(why|how)\b/i.test(q)) {
    return `${precision}

QUESTION SHAPE — WHY / HOW:
- First sentence: the direct reason or main mechanism that answers the question.
- Then bullets: supporting mechanisms, steps, or evidence—one idea per bullet.
- No preamble or unrelated context before the first sentence.`;
  }

  if (
    /^(what is|what are|what does|what do|define|state what|explain what)\b/i.test(q) ||
    /\bwhat is the function\b/.test(lower)
  ) {
    return `${precision}

QUESTION SHAPE — WHAT / FUNCTION / DEFINE:
- First sentence: definition or function ONLY (one clear sentence).
- Then bullets: extra detail, conditions, or examples—no broad topic lecture.
- If the question is narrow, do not wander into general chapter content.`;
  }

  return `${precision}

QUESTION SHAPE — GENERAL:
- First sentence: direct answer. Then bullets for support. Stay on the same object/terms as the question.`;
}

/**
 * Mock: general-knowledge path when curriculum is empty (dev / no API key scenarios).
 */
function mockGeneralKnowledgeFallback(question, constraints) {
  const responseMode = String(constraints?.responseMode ?? "explain").toLowerCase();
  const q = (question || "").trim();
  const noCurriculum = constraints?.noCurriculumSources === true;
  const notice = ENQUIRY_FALLBACK_LIMITED_CURRICULUM_WARNING;

  if (noCurriculum) {
    const explanation =
      responseMode === "quick"
        ? `• Short answer (mock; no curriculum hits).\n• Topic: ${q.slice(0, 100)}`
        : `Simplified mock answer (LLM_PROVIDER=mock). No trusted sources matched.\n\nQuestion: ${q.slice(0, 200)}`;
    const keyPoints = ["Verify facts with your specification or teacher."];
    const practice =
      constraints?.includePractice !== false
        ? [
            {
              type: "short",
              question: `Key point for: ${q.slice(0, 50)}?`,
              answer: "Check your class notes.",
              markScheme: "1 mark for a valid point",
            },
          ]
        : [];
    return {
      explanation,
      keyPoints,
      memoryHook: "",
      citations: [],
      practice,
      warnings: [notice],
    };
  }

  const explanation =
    responseMode === "quick"
      ? `• Core idea: answer based on general science knowledge.\n• Typical GCSE focus: definitions + one application.\n• Verify with your specification when sources load.`
      : `This is a **mock** general-knowledge answer (LLM_PROVIDER=mock). In production with OpenAI, you get a full tutor-style reply here.\n\nQuestion: ${q.slice(0, 200)}`;
  const keyPoints = [
    "Not sourced from LetsRevise curriculum documents.",
    "Use your textbook or class notes to confirm exam wording.",
  ];
  const practice =
    constraints?.includePractice !== false
      ? [
          {
            type: "short",
            question: `Explain one key idea related to: ${q.slice(0, 60)}`,
            answer: "Compare with your specification statement.",
            markScheme: "1 mark for a valid point",
          },
        ]
      : [];
  return {
    explanation,
    keyPoints,
    memoryHook: "",
    citations: [],
    practice,
    warnings: [notice],
  };
}

/**
 * Mock provider: deterministic response from context snippets.
 */
function mockGenerate(question, contextChunks, constraints) {
  if (constraints?.generalKnowledgeFallback) {
    return mockGeneralKnowledgeFallback(question, constraints);
  }

  const chunks = contextChunks || [];
  const hasWeakEvidence = constraints?.weakEvidence === true;
  const responseMode = String(constraints?.responseMode ?? "explain").toLowerCase();

  let explanation = "";
  const keyPoints = [];
  const citations = [];
  const practice = [];
  const warnings = [];

  if (hasWeakEvidence || chunks.length === 0) {
    warnings.push("Insufficient trusted sources");
    explanation =
      "I could not find enough trusted curriculum content to answer this question confidently. Please try a more specific question or check that the topic is covered in your specification.";
    if (chunks.length > 0) {
      const nearest = chunks[0];
      keyPoints.push(`Nearest topic: ${nearest.topicKey || "unknown"}`);
    }
  } else {
    const firstChunk = chunks[0];
    const snippet = (firstChunk.text || "").slice(0, 150).trim();
    if (responseMode === "quick") {
      explanation = `• Key point 1 from curriculum\n• Key point 2\n• Key point 3`;
      keyPoints.push("Concise summary");
    } else if (responseMode === "exam") {
      explanation = `Key points (exam-style):\n1. ${snippet.slice(0, 80)}...\n2. Syllabus-aligned content.`;
      keyPoints.push("Command-word aligned");
    } else if (responseMode === "revision") {
      explanation = `Revision sheet:\n• Key facts\n• Common mistake to avoid\n• Memory cue`;
      keyPoints.push("Structured for revision");
    } else {
    explanation = `Based on the curriculum content: ${snippet}${snippet ? "..." : ""}`;
    keyPoints.push("Content is drawn from trusted specification and lesson sources.");
    keyPoints.push("Always verify against your exam board specification.");
    }

    citations.push({
      knowledgeDocumentId: firstChunk.knowledgeDocumentId,
      sourceType: firstChunk.sourceType || "lessonBlock",
      sourceId: firstChunk.sourceId || "",
      quote: (firstChunk.text || "").slice(0, 200),
      reason: "Primary source for the answer",
    });

    if (responseMode === "quick") {
      practice.push({
        type: "short",
        question: `Summarise: ${question.slice(0, 60)}?`,
        answer: "See explanation above.",
        markScheme: "1 mark",
      });
    } else if (responseMode === "exam") {
      practice.push({
        type: "exam",
        question: `Explain ${question.slice(0, 60)}. [4 marks]`,
        answer: "See explanation.",
        markScheme: "1 mark per valid point (max 4)",
      });
    } else if (responseMode === "revision") {
      practice.push(
        { type: "flashcard", front: `What is ${question.slice(0, 40)}?`, back: "See curriculum content." },
        { type: "flashcard", front: "Common mistake?", back: "Avoid oversimplification." },
        { type: "flashcard", front: "Memory cue?", back: "Link to key concept." }
      );
    } else {
    practice.push({
      type: "mcq",
        question: `Which best relates to: ${question.slice(0, 80)}?`,
      options: ["Option A (from curriculum)", "Option B", "Option C", "Option D"],
      answer: "Option A (from curriculum)",
    });
    practice.push({
      type: "short",
        question: "Summarise the key point.",
      answer: "See explanation above.",
      markScheme: "1 mark for correct summary",
    });
    }
  }

  return {
    explanation,
    keyPoints,
    memoryHook: "",
    citations,
    practice: constraints?.includePractice !== false ? practice : [],
    warnings,
  };
}

/**
 * OpenAI: general-knowledge fallback when no curriculum chunks exist.
 */
async function openaiGenerateGeneralKnowledge(question, constraints) {
  const axios = require("axios");
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    throw new Error("LLM_API_KEY or OPENAI_API_KEY required when LLM_PROVIDER=openai");
  }
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  const convCtx = buildConversationContext(constraints?.conversationContext || []);
  const responseMode = String(constraints?.responseMode ?? "explain").toLowerCase();
  const modeInstructions = {
    quick:
      "\n\nQUICK MODE: 3–5 bullet points, max ~600 characters. One practice item. No filler.",
    explain:
      "\n\nEXPLAIN MODE: Direct GCSE-style explanation first. Lead with a clear answer using precise syllabus terms; add concise key points or cause-and-effect where helpful. Do NOT generate practice questions, MCQs, or short-answer drills. Leave practice as an empty array [].",
    exam:
      "\n\nEXAM MODE: Structured points and command words; one exam question + mark scheme. No rambling.",
    revision:
      "\n\nREVISION MODE: Key facts, common mistakes, cues. Three flashcards in practice (type=flashcard).",
  };
  const modeNote = modeInstructions[responseMode] || modeInstructions.explain;
  const specHint = constraints?.specKey ? ` Specification context (wording only): ${String(constraints.specKey)}.` : "";
  const topicHint = constraints?.topicKey ? ` Sub-topic context: ${String(constraints.topicKey)}.` : "";
  const studentNote =
    constraints?.studentMode === true
      ? `

STUDENT MODE:
- Use simple language suitable for GCSE/A-Level students.
- Keep explanation <= 1200 characters.
- Prefer bullet points.
- Do not mention internal implementation details.${
          constraints?.includePractice !== false && responseMode !== "explain"
            ? "\n- You may include practice items as requested by the mode."
            : "\n- Do not include practice items; focus on the explanation."
        }`
      : "";

  const simplifiedNote =
    constraints?.noCurriculumSources === true
      ? `

SIMPLIFIED: No trusted curriculum documents matched. Give a SHORT, clear answer (aim under ~800 characters). Prefer bullet points.`
      : "";

  const intentBlockGk = buildEnquiryQuestionIntentBlock(question);

  const systemPrompt = `You are an educational AI tutor for UK GCSE/A-Level. No LetsRevise curriculum sources were retrieved for this question. Answer using well-established general knowledge and typical GCSE exam expectations. Sound like concise revision guidance—direct phrasing, no filler. Do NOT claim your answer comes from a specific LetsRevise document or spec statement. If unsure, say so briefly.${simplifiedNote}

Rules:
- Return valid JSON only.
- citations must be an empty array [].
- Do not invent quotation marks from curriculum documents.
- Do not put "Insufficient trusted sources" in warnings; the client shows a fixed curriculum notice.
- Avoid unsupported specifics; prefer widely taught syllabus ideas only.
${modeNote}${studentNote}
${ENQUIRY_MEMORY_HOOK_PROMPT}${ENQUIRY_MEMORY_HOOK_SUFFIX_GK}

${intentBlockGk}`;

  const userPrompt = `${convCtx}${specHint}${topicHint}

Question: ${question}

Return JSON: { "explanation": "...", "keyPoints": ["..."], "memoryHook": "", "citations": [], "practice": [{ "type": "mcq|short|exam|flashcard", "question": "...", "options": [], "answer": "...", "markScheme": "...", "front": "...", "back": "..." }], "warnings": [] }`;

  const res = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    },
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );

  const content = res.data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty OpenAI response");

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error("Invalid JSON from LLM: " + e.message);
  }

  const out = {
    explanation: String(parsed.explanation || "").trim(),
    keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.map(String) : [],
    memoryHook: normalizeMemoryHook(parsed.memoryHook),
    citations: [],
    practice: constraints?.includePractice !== false && Array.isArray(parsed.practice) ? parsed.practice : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
  };

  out.practice = (out.practice || [])
    .filter((p) => p && (p.type === "flashcard" ? (p.front && p.back) : p.question))
    .map((p) => {
      if (p.type === "flashcard") {
        return {
          type: "flashcard",
          front: String(p.front || "").slice(0, 300),
          back: String(p.back || "").slice(0, 500),
        };
      }
      return {
        type: p.type || "short",
        question: String(p.question || ""),
        options: Array.isArray(p.options) ? p.options.map(String) : undefined,
        answer: String(p.answer || ""),
        markScheme: p.markScheme ? String(p.markScheme) : undefined,
      };
    });

  out.warnings = [ENQUIRY_FALLBACK_LIMITED_CURRICULUM_WARNING];

  return out;
}

/**
 * OpenAI chat completions with JSON output.
 */
async function openaiGenerate(question, contextChunks, constraints) {
  if (constraints?.generalKnowledgeFallback) {
    return openaiGenerateGeneralKnowledge(question, constraints);
  }

  const axios = require("axios");
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    throw new Error("LLM_API_KEY or OPENAI_API_KEY required when LLM_PROVIDER=openai");
  }
  const model = process.env.LLM_MODEL || "gpt-4o-mini";

  const context = buildContext(contextChunks);
  const convCtx = buildConversationContext(constraints?.conversationContext || []);
  const contextNote =
    convCtx
      ? "\n\nUse conversation context only to interpret follow-up questions. Do not invent new facts. Still cite trusted sources."
      : "";

  const responseMode = String(constraints?.responseMode ?? "explain").toLowerCase();
  const modeInstructions = {
    quick:
      "\n\nQUICK MODE: 3–5 bullet points, max ~600 characters total. Exactly 1 practice item. No preamble or filler.",
    explain:
      "\n\nEXPLAIN MODE: Direct exam-style explanation first—definitions and the answer to the question up front; one short example only if the sources support it. Use clear GCSE terminology and cause-and-effect where relevant. Concise key points are welcome. Do NOT generate practice questions, MCQs, or short-answer drills. Leave practice as an empty array [].",
    exam:
      "\n\nEXAM MODE: GCSE-style response—address command words, use precise terminology from sources where possible. One exam-style question + mark scheme. No padding.",
    revision:
      "\n\nREVISION MODE: Compact revision notes—key facts, common mistakes, memory cues. Three flashcards in practice (type=flashcard, front+back).",
  };
  const modeNote = modeInstructions[responseMode] || modeInstructions.explain;

  const weakNote =
    constraints?.weakEvidence === true
      ? "\n\nIMPORTANT: The retrieved sources are weak or insufficient. You MUST include a warning 'Insufficient trusted sources' and explain what is missing. Do not make up facts."
      : "";

  const strongCurriculumNote =
    constraints?.weakEvidence === true
      ? ""
      : `

STRONG TRUSTED SOURCES (preferred style):
- Write like a GCSE revision tutor: direct, student-friendly, exam-appropriate wording.
- Prefer vocabulary and phrasing from the supplied sources when accurate (use verbatim quotes in citations).
- keyPoints: 3–6 short, accurate points you can support with citations—suitable for memorisation.
- Avoid long generic essays, vague introductions, and claims you cannot cite.`;

  const studentNote =
    constraints?.studentMode === true
      ? `

STUDENT MODE:
- Use simple language suitable for GCSE/A-Level students.
- Keep explanation <= 1200 characters.
- Prefer bullet points.
- Do not mention internal implementation details.${
          constraints?.includePractice !== false && responseMode !== "explain"
            ? "\n- Practice items may follow the explanation when the mode requests them."
            : "\n- Do not include practice items; the explanation is the full response."
        }`
      : "";

  const intentBlock = buildEnquiryQuestionIntentBlock(question);

  const systemPrompt = `You are an educational AI tutor for UK GCSE/A-Level. Answer ONLY using the provided curriculum sources. Every key point must be supported by a citation. If sources are weak, say so clearly.

Rules:
- Use ONLY the provided [knowledgeDocumentId] sources.
- Every citation must reference a knowledgeDocumentId from the context.
- quote must be a snippet (<=200 chars) from that document's text.
- If sources don't cover the question, add "Insufficient trusted sources" to warnings.
- Return valid JSON only.${contextNote}${modeNote}${weakNote}${studentNote}
${ENQUIRY_MEMORY_HOOK_PROMPT}${ENQUIRY_MEMORY_HOOK_SUFFIX_CURRICULUM}

${intentBlock}${strongCurriculumNote}`;

  const userPrompt = `${convCtx}Question: ${question}

Context:
${context}

Return JSON: { "explanation": "...", "keyPoints": ["..."], "memoryHook": "", "citations": [{ "knowledgeDocumentId": "...", "sourceType": "...", "sourceId": "...", "quote": "...", "reason": "..." }], "practice": [{ "type": "mcq|short|exam|flashcard", "question": "...", "options": [], "answer": "...", "markScheme": "...", "front": "...(for flashcard)", "back": "...(for flashcard)" }], "warnings": [] }`;

  const res = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    },
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );

  const content = res.data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty OpenAI response");

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error("Invalid JSON from LLM: " + e.message);
  }

  const out = {
    explanation: String(parsed.explanation || "").trim(),
    keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.map(String) : [],
    memoryHook: normalizeMemoryHook(parsed.memoryHook),
    citations: Array.isArray(parsed.citations) ? parsed.citations : [],
    practice: constraints?.includePractice !== false && Array.isArray(parsed.practice) ? parsed.practice : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
  };

  out.citations = out.citations
    .filter((c) => c && c.knowledgeDocumentId)
    .map((c) => ({
      knowledgeDocumentId: String(c.knowledgeDocumentId),
      sourceType: String(c.sourceType || "lessonBlock"),
      sourceId: String(c.sourceId || ""),
      quote: String(c.quote || "").slice(0, 200),
      reason: String(c.reason || ""),
    }));

  out.practice = (out.practice || [])
    .filter((p) => p && (p.type === "flashcard" ? (p.front && p.back) : p.question))
    .map((p) => {
      if (p.type === "flashcard") {
        return {
          type: "flashcard",
          front: String(p.front || "").slice(0, 300),
          back: String(p.back || "").slice(0, 500),
        };
      }
      return {
        type: p.type || "short",
        question: String(p.question || ""),
        options: Array.isArray(p.options) ? p.options.map(String) : undefined,
        answer: String(p.answer || ""),
        markScheme: p.markScheme ? String(p.markScheme) : undefined,
      };
    });

  return out;
}

/**
 * Generate structured enquiry answer.
 * @param {{ question: string, contextChunks: Array, constraints?: { weakEvidence?: boolean, includePractice?: boolean, studentMode?: boolean, conversationContext?: Array<{role,text}> } }}
 * @returns {Promise<{ explanation, keyPoints, memoryHook, citations, practice, warnings }>}
 */
async function generateEnquiryAnswer({ question, contextChunks, constraints = {} }) {
  const provider = getProvider();
  const q = (question || "").trim();
  if (!q) throw new Error("question is required");

  if (provider === "openai") {
    const maxAttempts = getEnquiryLlmMaxAttempts();
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await openaiGenerate(q, contextChunks, constraints);
      } catch (err) {
        lastErr = err;
        const canRetry = attempt < maxAttempts && shouldRetryOpenAiEnquiryError(err);
        if (!canRetry) {
          break;
        }
        const delayMs = Math.min(2500, 350 * 2 ** (attempt - 1));
        if (DEBUG_ENQUIRY && process.env.NODE_ENV !== "test") {
          console.warn(
            `[llm/enquiry] OpenAI attempt ${attempt}/${maxAttempts} failed, retry in ${delayMs}ms:`,
            err && err.message ? err.message : err
          );
        }
        await sleep(delayMs);
      }
    }

    if (isTruthyEnv("ENQUIRY_LLM_FALLBACK_MOCK")) {
      const out = mockGenerate(q, contextChunks, constraints);
      const fallbackMsg =
        "Live AI was temporarily unavailable; showing a simplified offline-style response.";
      const detail =
        lastErr && lastErr.message
          ? ` (${String(lastErr.message).slice(0, 120)})`
          : "";
      out.warnings = [...(out.warnings || []), fallbackMsg + detail];
      if (DEBUG_ENQUIRY && process.env.NODE_ENV !== "test") {
        console.warn("[llm/enquiry] ENQUIRY_LLM_FALLBACK_MOCK: using mock response after OpenAI failure");
      }
      return out;
    }

    throw lastErr;
  }
  return Promise.resolve(mockGenerate(q, contextChunks, constraints));
}

/**
 * PR-014: Generate starter pack (lesson outline + flashcards + quiz + exam questions).
 * Uses ONLY provided statements + contextChunks. No external sources.
 */
function mockGenerateStarterPack({ specKey, topicKey, statementCodes, statements, contextChunks, seed }) {
  const stmtTexts = (statements || []).map((s) => `${s.statementCode || ""}: ${(s.statementText || "").slice(0, 80)}`).join("; ");
  return {
    lesson: {
      title: `Draft — ${topicKey.split(":").pop() || topicKey}`,
      subtitle: statementCodes?.length ? `Covers: ${statementCodes.join(", ")}` : "",
      learningObjectives: (statements || []).slice(0, 3).map((s) => (s.statementText || "").slice(0, 100)),
      pages: [
        {
          title: "Introduction",
          blocks: [
            { type: "text", content: `This lesson covers: ${stmtTexts || "key concepts"}. Content derived from spec statements and curriculum sources.` },
            { type: "bulletList", items: ["Key point 1", "Key point 2", "Key point 3"] },
          ],
        },
        {
          title: "Check your understanding",
          blocks: [{ type: "checkpoint", question: "What is the main concept?", answer: "See lesson content." }],
        },
      ],
    },
    flashcards: [
      { front: "Define key term 1", back: "Definition from spec", tags: ["recall"] },
      { front: "Define key term 2", back: "Definition from spec", tags: ["recall"] },
      { front: "Key concept?", back: "Explanation", tags: [] },
    ],
    quiz: [
      {
        kind: "mcq",
        question: "Which best describes the topic?",
        options: ["Option A", "Option B", "Option C", "Option D"],
        correctIndex: 0,
        explanation: "Based on spec statement.",
      },
      {
        kind: "mcq",
        question: "Another checkpoint question?",
        options: ["A", "B", "C", "D"],
        correctIndex: 1,
        explanation: "",
      },
    ],
    examQuestions: Array.from({ length: 10 }, (_, i) => ({
      question: `Explain how concept ${i + 1} for this sub-topic is important in GCSE Biology and what examiners look for. [4 marks]`,
      markScheme:
        "First marking point with enough characters to count as substantive detail for GCSE.\nSecond marking point with enough characters to count.\nThird point where appropriate for four marks.",
      marks: 4,
      modelAnswer: `A developed model answer that demonstrates understanding and would earn full marks for this structured question (${i + 1}).`,
    })),
  };
}

/**
 * OpenAI: generate starter pack with json_object.
 */
async function openaiGenerateStarterPack({ specKey, topicKey, statementCodes, statements, contextChunks, seed }) {
  const axios = require("axios");
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    throw new Error("LLM_API_KEY or OPENAI_API_KEY required when LLM_PROVIDER=openai");
  }
  const model = process.env.LLM_MODEL || "gpt-4o-mini";

  const statementsText = (statements || [])
    .map((s) => `[${s.statementCode || "?"}] ${s.statementText || ""}`)
    .join("\n");
  const context = buildContext(contextChunks || []);

  const systemPrompt = `You are a curriculum author for UK GCSE/A-Level. Generate a STARTER PACK (draft content) using ONLY the provided spec statements and context. No external sources, no internet references.

STRICT SCOPE: Generate content ONLY for the selected sub-topic (Topic). Do NOT include neighbouring sub-topics. For example, if Topic is cell-structure: include cell membrane, cytoplasm, nucleus, ribosomes; do NOT include mitosis, diffusion, osmosis, stem cells. Stay strictly within the sub-topic.

Rules:
- Derive ALL content from the provided statements and context chunks.
- Keep language GCSE/A-Level appropriate.
- Include statement codes in metadata where relevant.
- Return valid JSON only.
- Do not reference "internet" or external sources.
- Create a SINGLE-PAGE lesson draft. Do NOT create multiple pages. Put all content in blocks within one page.
- Blocks: use "text", "bulletList", "keyIdea", "examTip", "commonMistake", "stretch", "workedExample", "checkpoint". Use section types (key ideas, exam tips, misconceptions, checkpoint, deeper knowledge) as blocks within the page.
- Do NOT create separate pages for: Core Concept 1, Core Concept 2, Comparison, Check Understanding, Exam Tips, Stretch.
- Lesson: exactly 1 page, 4-10 blocks (mix of text, keyIdea, examTip, checkpoint, etc.).
- Flashcards: 5-10 items.
- Quiz: 8-12 MCQ items (Topic Quiz Bank only — never put MCQs in examQuestions).
- Exam questions: aim for 10 structured GCSE-style written questions (2–6 marks each). No MCQs in examQuestions. Each needs question, markScheme (multi-line or bullets), modelAnswer, marks ≥ 2. Command words: Explain, Describe, Compare, Suggest, etc.`;

  const userPrompt = `Spec: ${specKey}
Topic: ${topicKey}
Statement codes: ${(statementCodes || []).join(", ")}

Spec statements:
${statementsText || "(none - use context)"}

Context:
${context || "(minimal - produce best-effort from statements)"}

Return JSON (exactly 1 lesson page, all content in blocks):
{
  "lesson": {
    "title": "...",
    "subtitle": "...",
    "learningObjectives": ["..."],
    "pages": [
      {
        "title": "Page 1",
        "blocks": [
          { "type": "text", "content": "..." },
          { "type": "keyIdea", "content": "..." },
          { "type": "examTip", "content": "..." },
          { "type": "bulletList", "items": ["..."] },
          { "type": "checkpoint", "question": "...", "options": ["A","B","C","D"], "answer": "..." }
        ]
      }
    ]
  },
  "flashcards": [{ "front": "...", "back": "...", "tags": [] }],
  "quiz": [{ "kind": "mcq", "question": "...", "options": ["..."], "correctIndex": 0, "explanation": "..." }],
  "examQuestions": [{ "question": "...", "markScheme": "Line one...\\nLine two...", "marks": 4, "modelAnswer": "..." }]
}`;

  const res = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 6000,
    },
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );

  const content = res.data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty OpenAI response");

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error("Invalid JSON from LLM: " + e.message);
  }

  const lesson = parsed.lesson || {};
  const pages = Array.isArray(lesson.pages) ? lesson.pages : [];
  const flashcards = Array.isArray(parsed.flashcards) ? parsed.flashcards : [];
  const quiz = Array.isArray(parsed.quiz) ? parsed.quiz : [];
  const examQuestions = Array.isArray(parsed.examQuestions) ? parsed.examQuestions : [];

  return {
    lesson: {
      title: String(lesson.title || "").trim() || `Draft — ${topicKey.split(":").pop() || topicKey}`,
      subtitle: String(lesson.subtitle || "").trim(),
      learningObjectives: Array.isArray(lesson.learningObjectives) ? lesson.learningObjectives.map(String) : [],
      pages: pages.map((p) => ({
        title: String(p.title || "").trim() || "Page",
        blocks: Array.isArray(p.blocks) ? p.blocks : [],
      })),
    },
    flashcards: flashcards.slice(0, 10).map((f) => ({
      front: String(f.front || "").slice(0, 500),
      back: String(f.back || "").slice(0, 2000),
      tags: Array.isArray(f.tags) ? f.tags.map(String) : [],
    })),
    quiz: quiz.slice(0, 12).map((q) => ({
      kind: "mcq",
      question: String(q.question || "").slice(0, 1000),
      options: Array.isArray(q.options) ? q.options.map(String).slice(0, 6) : [],
      correctIndex: Math.max(0, Math.min(Number(q.correctIndex) || 0, 5)),
      explanation: String(q.explanation || "").slice(0, 500),
    })),
    examQuestions: examQuestions.slice(0, 10).map((eq) => ({
      question: String(eq.question || "").slice(0, 2000),
      markScheme: String(eq.markScheme || "").slice(0, 3000),
      marks: Math.max(2, Math.min(Number(eq.marks) || 4, 10)),
      modelAnswer: String(eq.modelAnswer || eq.answer || "").slice(0, 2000),
    })),
  };
}

/**
 * Generate starter pack content.
 */
async function generateStarterPack({ specKey, topicKey, statementCodes, statements, contextChunks, constraints = {}, seed }) {
  const provider = getProvider();
  if (provider === "openai") {
    return openaiGenerateStarterPack({ specKey, topicKey, statementCodes, statements, contextChunks, seed });
  }
  return Promise.resolve(mockGenerateStarterPack({ specKey, topicKey, statementCodes, statements, contextChunks, seed }));
}

/**
 * PR-031: Generate weak evidence fix pack — targeted content to fix missing spec + weak enquiries.
 * Output: 1 lesson page, 4 flashcards, 5 quiz, 2 exam questions.
 */
function mockGenerateWeakEvidenceFixPack({ specKey, topicKey, statementCodes, statements, weakQuestions, contextChunks }) {
  const stmtTexts = (statements || []).map((s) => `${s.statementCode || ""}: ${(s.statementText || "").slice(0, 80)}`).join("; ");
  const weakHint = (weakQuestions || [])[0] ? ` Address: ${weakQuestions[0].slice(0, 60)}...` : "";
  return {
    lesson: {
      title: `Draft — Gap fix: ${topicKey.split(":").pop() || topicKey}`,
      subtitle: statementCodes?.length ? `Covers: ${statementCodes.join(", ")}` : "",
      learningObjectives: (statements || []).slice(0, 3).map((s) => (s.statementText || "").slice(0, 100)),
      pages: [
        {
          title: "Gap-fill content",
          blocks: [
            { type: "text", content: `This content addresses missing spec coverage and weak enquiry areas.${weakHint} Key concepts: ${stmtTexts || "see spec statements"}.` },
            { type: "bulletList", items: ["Key point 1", "Key point 2", "Key point 3"] },
          ],
        },
      ],
    },
    flashcards: [
      { front: "Define key term 1", back: "Definition from spec", tags: [] },
      { front: "Define key term 2", back: "Definition from spec", tags: [] },
      { front: "Key concept?", back: "Explanation", tags: [] },
      { front: "Common misconception?", back: "Clarification", tags: [] },
    ],
    quiz: [
      { kind: "mcq", question: "Which best describes the topic?", options: ["Option A", "Option B", "Option C", "Option D"], correctIndex: 0, explanation: "Based on spec." },
      { kind: "mcq", question: "Another checkpoint?", options: ["A", "B", "C", "D"], correctIndex: 1, explanation: "" },
      { kind: "short", question: "Summarise the key point.", acceptableAnswers: ["See explanation"], explanation: "" },
      { kind: "mcq", question: "Third question?", options: ["1", "2", "3", "4"], correctIndex: 0, explanation: "" },
      { kind: "short", question: "What is the main concept?", acceptableAnswers: ["Key concept"], explanation: "" },
    ],
    examQuestions: [
      {
        question: "Explain the key concept for this sub-topic in detail. [4 marks]",
        markScheme:
          "First substantive marking point with enough characters to count.\nSecond substantive marking point with enough characters to count.",
        marks: 4,
        modelAnswer: "A developed model answer that demonstrates understanding and would earn full marks.",
      },
      {
        question: "Describe the process using correct terminology and sequence. [3 marks]",
        markScheme: "Credit correct first step with sufficient detail.\nCredit correct second step with sufficient detail.",
        marks: 3,
        modelAnswer: "A clear description that would earn full marks for this structured question.",
      },
    ],
  };
}

async function openaiGenerateWeakEvidenceFixPack({ specKey, topicKey, statementCodes, statements, weakQuestions, contextChunks }) {
  const axios = require("axios");
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    throw new Error("LLM_API_KEY or OPENAI_API_KEY required when LLM_PROVIDER=openai");
  }
  const model = process.env.LLM_MODEL || "gpt-4o-mini";

  const statementsText = (statements || []).map((s) => `[${s.statementCode || "?"}] ${s.statementText || ""}`).join("\n");
  const weakText = (weakQuestions || []).map((q, i) => `${i + 1}. ${q}`).join("\n");
  const context = buildContext(contextChunks || []);

  const systemPrompt = `You are a curriculum author for UK GCSE/A-Level. Generate a WEAK EVIDENCE FIX PACK — draft content to address missing spec coverage and weak enquiry questions. Use ONLY the provided spec statements, weak questions, and context. No external sources.

STRICT SCOPE: Generate content ONLY for the selected sub-topic (Topic). Do NOT include neighbouring sub-topics. If evidence for this sub-topic is limited, stay within the sub-topic — do not broaden to sibling topics.

Rules:
- Derive ALL content from the provided statements, weak questions, and context chunks.
- Output exactly: 1 lesson page with 4-8 blocks. Do NOT create multiple pages. Use blocks (text, keyIdea, examTip, commonMistake, checkpoint) within the single page.
- Keep language GCSE/A-Level appropriate.
- Return valid JSON only.
- Blocks: use "text", "bulletList", "keyIdea", "examTip", "commonMistake", "checkpoint".
- Quiz: kind "mcq" (options, correctIndex) or "short" (acceptableAnswers array).
- Exam (examQuestions): ONLY structured written exam-style items for the Exam Question Bank — no MCQs, no options arrays. Include question, markScheme (multi-line), modelAnswer, marks 2–6.`;

  const userPrompt = `Spec: ${specKey}
Topic: ${topicKey}
Statement codes: ${(statementCodes || []).join(", ")}

Spec statements:
${statementsText || "(none)"}

Weak enquiry questions (students asked these but had insufficient sources):
${weakText || "(none)"}

Context:
${context || "(minimal)"}

Return JSON (exactly 1 lesson page, all content in blocks):
{
  "lesson": {
    "title": "...",
    "subtitle": "...",
    "learningObjectives": ["..."],
    "pages": [{ "title": "Page 1", "blocks": [{ "type": "text", "content": "..." }, { "type": "keyIdea", "content": "..." }, { "type": "checkpoint", "question": "...", "options": ["A","B","C","D"], "answer": "..." }] }]
  },
  "flashcards": [{ "front": "...", "back": "...", "tags": [] }],
  "quiz": [
    { "kind": "mcq", "question": "...", "options": ["..."], "correctIndex": 0, "explanation": "..." },
    { "kind": "short", "question": "...", "acceptableAnswers": ["..."], "explanation": "..." }
  ],
  "examQuestions": [{ "question": "...", "markScheme": "...", "marks": 4, "modelAnswer": "..." }]
}`;

  const res = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 4000,
    },
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );

  const content = res.data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty OpenAI response");

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error("Invalid JSON from LLM: " + e.message);
  }

  const lesson = parsed.lesson || {};
  const pages = Array.isArray(lesson.pages) ? lesson.pages : [];
  const flashcards = Array.isArray(parsed.flashcards) ? parsed.flashcards : [];
  const quiz = Array.isArray(parsed.quiz) ? parsed.quiz : [];
  const examQuestions = Array.isArray(parsed.examQuestions) ? parsed.examQuestions : [];

  return {
    lesson: {
      title: String(lesson.title || "").trim() || `Draft — Gap fix: ${topicKey.split(":").pop() || topicKey}`,
      subtitle: String(lesson.subtitle || "").trim(),
      learningObjectives: Array.isArray(lesson.learningObjectives) ? lesson.learningObjectives.map(String) : [],
      pages: pages.map((p) => ({
        title: String(p.title || "").trim() || "Page",
        blocks: Array.isArray(p.blocks) ? p.blocks : [],
      })),
    },
    flashcards: flashcards.slice(0, 4).map((f) => ({
      front: String(f.front || "").slice(0, 500),
      back: String(f.back || "").slice(0, 2000),
      tags: Array.isArray(f.tags) ? f.tags.map(String) : [],
    })),
    quiz: quiz.slice(0, 5).map((q) => {
      const kind = (q.kind || "mcq").toLowerCase();
      if (kind === "short") {
        return {
          kind: "short",
          question: String(q.question || "").slice(0, 1000),
          acceptableAnswers: Array.isArray(q.acceptableAnswers) ? q.acceptableAnswers.map(String).slice(0, 10) : [],
          explanation: String(q.explanation || "").slice(0, 500),
        };
      }
      return {
        kind: "mcq",
        question: String(q.question || "").slice(0, 1000),
        options: Array.isArray(q.options) ? q.options.map(String).slice(0, 6) : [],
        correctIndex: Math.max(0, Math.min(Number(q.correctIndex) || 0, 5)),
        explanation: String(q.explanation || "").slice(0, 500),
      };
    }),
    examQuestions: examQuestions.slice(0, 5).map((eq) => ({
      question: String(eq.question || "").slice(0, 2000),
      markScheme: String(eq.markScheme || "").slice(0, 3000),
      marks: Math.max(2, Math.min(Number(eq.marks) || 4, 10)),
      modelAnswer: String(eq.modelAnswer || eq.answer || "").slice(0, 2000),
    })),
  };
}

async function generateWeakEvidenceFixPack({ specKey, topicKey, statementCodes, statements, weakQuestions, contextChunks }) {
  const provider = getProvider();
  if (provider === "openai") {
    return openaiGenerateWeakEvidenceFixPack({ specKey, topicKey, statementCodes, statements, weakQuestions, contextChunks });
  }
  return Promise.resolve(mockGenerateWeakEvidenceFixPack({ specKey, topicKey, statementCodes, statements, weakQuestions, contextChunks }));
}

/**
 * PR-024: Topic summary generation — mode-specific structured output.
 * PR-024.1: studentSafe = shorter, simpler, GCSE student language.
 */
function mockGenerateTopicSummary({ mode, specKey, topicKey, contextChunks, constraints }) {
  const chunks = contextChunks || [];
  const snippet = chunks[0]?.text ? chunks[0].text.slice(0, 150) : "No sources";
  const docId = chunks[0]?.knowledgeDocumentId || "unknown";
  const studentSafe = constraints?.studentSafe === true;

  const base = {
    summary: studentSafe
      ? `Key ideas for ${topicKey}. ${snippet.slice(0, 200)}...`
      : `Topic summary for ${topicKey}. Based on curriculum: ${snippet}...`,
    keyPoints: studentSafe ? ["Key point 1", "Key point 2", "Key point 3", "Key point 4", "Key point 5"] : ["Key point 1 from sources", "Key point 2", "Key point 3", "Key point 4"],
    sections: {},
    citations: [
      {
        knowledgeDocumentId: docId,
        sourceType: chunks[0]?.sourceType || "lessonBlock",
        sourceId: chunks[0]?.sourceId || "",
        quote: snippet,
        reason: "Primary source",
        externalUrl: chunks[0]?.sourceType === "externalTrusted" ? chunks[0].metadata?.url : undefined,
      },
    ],
    warnings: chunks.length === 0 ? ["Insufficient trusted sources"] : [],
  };

  if (mode === "lessonPlan") {
    base.sections.lessonPlan = {
      durationMinutes: 50,
      segments: [
        { minutes: "0-5", title: "Starter", teacherScript: "Introduce topic", activity: "Quick question", checkForUnderstanding: "Thumbs up/down" },
        { minutes: "5-15", title: "Main 1", teacherScript: "Explain key concept", activity: "Paired discussion", checkForUnderstanding: "Mini whiteboard" },
        { minutes: "15-30", title: "Main 2", teacherScript: "Develop", activity: "Worksheet", checkForUnderstanding: "Peer check" },
        { minutes: "30-45", title: "Practice", teacherScript: "Guided practice", activity: "Exam-style Q", checkForUnderstanding: "Mark scheme" },
        { minutes: "45-50", title: "Plenary", teacherScript: "Recap", activity: "Exit ticket", checkForUnderstanding: "Summary" },
      ],
    };
  } else if (mode === "revisionSheet") {
    base.sections.revisionSheet = {
      commonMistakes: ["Confusing similar terms", "Missing units", "Incomplete answers"],
      memoryCues: ["Acronym: ABC", "Link to everyday example", "Diagram"],
      flashcards: studentSafe
        ? [
            { front: "Define key term", back: "Definition from spec" },
            { front: "What is X?", back: "Explanation" },
            { front: "Common mistake?", back: "Avoid Y" },
            { front: "Key concept?", back: "Brief answer" },
          ]
        : [
            { front: "Define key term", back: "Definition from spec" },
            { front: "What is X?", back: "Explanation" },
            { front: "Common mistake?", back: "Avoid Y" },
          ],
    };
    if (studentSafe) {
      base.sections.revisionSheet.checkYourself = {
        question: "Which best describes this topic?",
        options: ["A", "B", "C", "D"],
        answer: "A",
      };
    }
  } else if (mode === "examFocus") {
    base.sections.examFocus = {
      commandWords: ["State", "Describe", "Explain", "Compare", "Evaluate"],
      examTips: ["Read command words", "Check marks", "Use key terms"],
      examQuestion: {
        question: "Explain the key concept. [4 marks]",
        answer: "See mark scheme",
        markScheme: "1 mark per valid point, max 4",
        marks: 4,
      },
    };
  }

  return Promise.resolve(base);
}

async function openaiGenerateTopicSummary({ mode, specKey, topicKey, contextChunks, constraints }) {
  const axios = require("axios");
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    throw new Error("LLM_API_KEY or OPENAI_API_KEY required when LLM_PROVIDER=openai");
  }
  const model = process.env.LLM_MODEL || "gpt-4o-mini";

  const context = buildContext(contextChunks || []);
  const modeInstructions = {
    overview:
      "OVERVIEW: 1200-1600 chars summary, 6-10 key points. Succinct, curriculum-aligned.",
    lessonPlan:
      "LESSON PLAN: 45-60 min, 5-8 segments. Each: minutes, title, teacherScript, activity, checkForUnderstanding. Include common misconceptions.",
    revisionSheet:
      "REVISION SHEET: Headings-style. commonMistakes, memoryCues, 6 flashcards with front/back.",
    examFocus:
      "EXAM FOCUS: Examiner tone. commandWords, examTips, examQuestion with question, answer, markScheme, marks. No fluff.",
  };
  const modeNote = modeInstructions[mode] || modeInstructions.overview;

  const studentNote = studentSafe
    ? "\nSTUDENT MODE: Simple GCSE-level language. Do not mention embeddings, retrieval, or internal systems."
    : "";
  const systemPrompt = `You are an educational AI for UK GCSE/A-Level. Summarise the topic using ONLY the provided sources.

Rules:
- Use ONLY the provided [knowledgeDocumentId] sources.
- Every citation must reference a knowledgeDocumentId from the context.
- quote must be a snippet (<=200 chars) from that document's text.
- Return valid JSON only. No markdown.
${modeNote}${studentNote}`;

  const schema = `{
  "summary": "string (1200-1600 chars for overview)",
  "keyPoints": ["string"],
  "sections": {
    "lessonPlan"?: { "durationMinutes": number, "segments": [{ "minutes": "string", "title": "string", "teacherScript": "string", "activity": "string", "checkForUnderstanding": "string" }] },
    "revisionSheet"?: { "commonMistakes": ["string"], "memoryCues": ["string"], "flashcards": [{ "front": "string", "back": "string" }] },
    "examFocus"?: { "commandWords": ["string"], "examTips": ["string"], "examQuestion": { "question": "string", "answer": "string", "markScheme": "string", "marks": number } }
  },
  "citations": [{ "knowledgeDocumentId": "string", "sourceType": "string", "sourceId": "string", "quote": "string", "reason": "string", "externalUrl"?: "string" }],
  "warnings": ["string"]
}`;

  const userPrompt = `Spec: ${specKey}
Topic: ${topicKey}
Mode: ${mode}

Context:
${context || "(no sources)"}

Return JSON: ${schema}`;

  const res = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 4000,
    },
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );

  const content = res.data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty OpenAI response");

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error("Invalid JSON from LLM: " + e.message);
  }

  let summary = String(parsed.summary || "").trim();
  let keyPoints = Array.isArray(parsed.keyPoints) ? parsed.keyPoints.map(String) : [];
  if (studentSafe) {
    summary = summary.slice(0, 950);
    keyPoints = keyPoints.slice(0, 7);
  } else {
    keyPoints = keyPoints.slice(0, 15);
  }
  let sections = parsed.sections || {};
  if (studentSafe && sections.revisionSheet?.flashcards) {
    sections = {
      ...sections,
      revisionSheet: {
        ...sections.revisionSheet,
        flashcards: sections.revisionSheet.flashcards.slice(0, 4),
      },
    };
  }
  const out = {
    summary,
    keyPoints,
    sections,
    citations: (Array.isArray(parsed.citations) ? parsed.citations : [])
      .filter((c) => c && c.knowledgeDocumentId)
      .map((c) => ({
        knowledgeDocumentId: String(c.knowledgeDocumentId),
        sourceType: String(c.sourceType || "lessonBlock"),
        sourceId: String(c.sourceId || ""),
        quote: String(c.quote || "").slice(0, 200),
        reason: String(c.reason || ""),
        externalUrl: c.externalUrl ? String(c.externalUrl) : undefined,
      })),
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
  };

  return out;
}

async function generateTopicSummary({ mode, specKey, topicKey, contextChunks, constraints = {} }) {
  const provider = getProvider();
  const m = (mode || "overview").toLowerCase();
  const validModes = ["overview", "lessonplan", "revisionsheet", "examfocus"];
  const modeKey = m.replace(/([a-z])([A-Z])/g, "$1$2").toLowerCase();
  const modeNorm = m === "lessonplan" ? "lessonPlan" : m === "revisionsheet" ? "revisionSheet" : m === "examfocus" ? "examFocus" : "overview";

  if (provider === "openai") {
    return openaiGenerateTopicSummary({ mode: modeNorm, specKey, topicKey, contextChunks, constraints });
  }
  return mockGenerateTopicSummary({ mode: modeNorm, specKey, topicKey, contextChunks, constraints });
}

/**
 * PR-032: Generate practice set — flashcards, quiz (MCQ + short), exam questions.
 * Output: { flashcards: [{front,back}], quiz: [...], exam: [...] }
 */
function mockGeneratePracticeSet({ specKey, topicKey, contextChunks, counts, weakConfidence }) {
  const topicPart = (topicKey || "").split(":").pop() || topicKey || "";
  const nFlash = Math.min(10, Math.max(1, counts?.flashcards || 6));
  const nMcq = Math.min(10, Math.max(1, counts?.quizMcq || 5));
  const nShort = Math.min(5, Math.max(0, counts?.quizShort || 3));
  const nExam = Math.min(5, Math.max(1, counts?.exam || 2));

  const flashcards = [];
  for (let i = 0; i < nFlash; i++) {
    flashcards.push({
      front: `Define key term ${i + 1} for ${topicPart}`,
      back: `Definition from curriculum. ${weakConfidence ? "(Limited sources)" : ""}`,
    });
  }

  const quiz = [];
  for (let i = 0; i < nMcq; i++) {
    quiz.push({
      type: "mcq",
      question: `Which best describes ${topicPart}? (Q${i + 1})`,
      options: ["Option A", "Option B", "Option C", "Option D"],
      correctIndex: 0,
      explanation: "Based on spec.",
    });
  }
  for (let i = 0; i < nShort; i++) {
    quiz.push({
      type: "short",
      question: `Summarise: ${topicPart} (Q${i + 1})`,
      answers: ["Key concept from curriculum"],
      markScheme: "1 mark per valid point",
    });
  }

  const exam = [];
  for (let i = 0; i < nExam; i++) {
    exam.push({
      question: `Explain ${topicPart}. [${i + 3} marks]`,
      markScheme: "1 mark per valid point.",
      marks: i + 3,
      examinerTip: "Use key terms from spec.",
    });
  }

  return { flashcards, quiz, exam };
}

async function openaiGeneratePracticeSet({
  specKey,
  topicKey,
  contextChunks,
  counts,
  weakConfidence,
  coveragePlan,
}) {
  const axios = require("axios");
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    throw new Error("LLM_API_KEY or OPENAI_API_KEY required when LLM_PROVIDER=openai");
  }
  const model = process.env.LLM_MODEL || "gpt-4o-mini";

  const nFlash = Math.min(10, Math.max(1, counts?.flashcards || 6));
  const nMcq = Math.min(10, Math.max(1, counts?.quizMcq || 5));
  const nShort = Math.min(5, Math.max(0, counts?.quizShort || 3));
  const nExam = Math.min(5, Math.max(1, counts?.exam || 2));

  const context = buildContext(contextChunks || []);
  const weakNote = weakConfidence
    ? "\n\nIMPORTANT: The retrieved sources are limited. Bias heavily toward spec statements. Add a note that sources may be generic."
    : "";

  const systemPrompt = `You are a curriculum author for UK GCSE/A-Level. Generate a PRACTICE SET (draft) using ONLY the provided context. No external sources.

STRICT SCOPE: Generate content ONLY for the selected sub-topic (Topic). Do NOT include neighbouring sub-topics. Stay strictly within the sub-topic.

Rules:
- Derive ALL content from the provided context chunks.
- MCQs: exactly 4 options, correctIndex 0-3. At least 2 options required.
- Short-answer: answers array (acceptable answers), markScheme.
- Exam: question, markScheme, marks (1-6), optional examinerTip.
- Keep language GCSE/A-Level appropriate.
- Return valid JSON only.${weakNote}`;

  const coverageSection = coveragePlan ? `${coveragePlan}\n\n` : "";

  const userPrompt = `${coverageSection}Spec: ${specKey}
Topic: ${topicKey}

Generate:
- ${nFlash} flashcards (front, back)
- ${nMcq} MCQ questions (type "mcq", question, options [4], correctIndex, explanation)
- ${nShort} short-answer questions (type "short", question, answers [], markScheme)
- ${nExam} exam-style questions (question, markScheme, marks, examinerTip?)

Context:
${context || "(minimal - produce best-effort from topic)"}

Return JSON:
{
  "flashcards": [{ "front": "...", "back": "..." }],
  "quiz": [
    { "type": "mcq", "question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "..." },
    { "type": "short", "question": "...", "answers": ["..."], "markScheme": "..." }
  ],
  "exam": [{ "question": "...", "markScheme": "...", "marks": 4, "examinerTip": "..." }]
}`;

  const res = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 4000,
    },
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );

  const content = res.data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty OpenAI response");

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error("Invalid JSON from LLM: " + e.message);
  }

  const flashcards = (Array.isArray(parsed.flashcards) ? parsed.flashcards : [])
    .slice(0, nFlash)
    .map((f) => ({
      front: String(f.front || "").slice(0, 500),
      back: String(f.back || "").slice(0, 2000),
    }))
    .filter((f) => f.front && f.back);

  const quizRaw = Array.isArray(parsed.quiz) ? parsed.quiz : [];
  const quiz = [];
  for (const q of quizRaw) {
    const t = (q.type || "mcq").toLowerCase();
    if (t === "mcq") {
      const opts = Array.isArray(q.options) ? q.options.map(String).slice(0, 6) : [];
      if (opts.length < 2) continue;
      const ci = Math.max(0, Math.min(Number(q.correctIndex) ?? 0, opts.length - 1));
      quiz.push({
        type: "mcq",
        question: String(q.question || "").slice(0, 1000),
        options: opts,
        correctIndex: ci,
        explanation: String(q.explanation || "").slice(0, 500),
      });
    } else if (t === "short") {
      const answers = Array.isArray(q.answers) ? q.answers : Array.isArray(q.acceptableAnswers) ? q.acceptableAnswers : [];
      if (answers.length === 0) continue;
      quiz.push({
        type: "short",
        question: String(q.question || "").slice(0, 1000),
        answers: answers.map(String).slice(0, 10),
        markScheme: String(q.markScheme || "").slice(0, 500),
      });
    }
  }

  const exam = (Array.isArray(parsed.exam) ? parsed.exam : [])
    .slice(0, nExam)
    .map((eq) => ({
      question: String(eq.question || "").slice(0, 2000),
      markScheme: String(eq.markScheme || "").slice(0, 1000),
      marks: Math.max(1, Math.min(Number(eq.marks) || 4, 10)),
      examinerTip: eq.examinerTip ? String(eq.examinerTip).slice(0, 300) : undefined,
    }))
    .filter((eq) => eq.question);

  return { flashcards, quiz, exam };
}

async function generatePracticeSet({ specKey, topicKey, contextChunks, counts, weakConfidence }) {
  const provider = getProvider();
  if (provider === "openai") {
    return openaiGeneratePracticeSet({ specKey, topicKey, contextChunks, counts, weakConfidence });
  }
  return Promise.resolve(mockGeneratePracticeSet({ specKey, topicKey, contextChunks, counts, weakConfidence }));
}

/**
 * Post-publish checkpoint draft: one item per page (MCQ or shortExplain) aligned to lesson text.
 * @param {{ lessonTitle: string, specKey: string, topicKey: string, subject?: string, level?: string, extracted: { text: string, pages: { pageId: string, title: string }[] } }} params
 * @returns {Promise<{ checkpointItems: object[], usage: { promptTokens: number, completionTokens: number, totalTokens: number, model: string } }>}
 */
function mockGenerateLessonCheckpointDraft({ lessonTitle, specKey, topicKey, extracted }) {
  const pages = (Array.isArray(extracted?.pages) ? extracted.pages : []).filter((p) => String(p?.pageId || "").trim());
  const checkpointItems = pages.slice(0, Math.min(6, pages.length)).map((p, i) => {
    const pageId = String(p.pageId || "").trim();
    const titleHint = String(p.title || "topic").slice(0, 60);
    if (i % 2 === 0) {
      return {
        pageId,
        type: "mcq",
        question: `Recall (${lessonTitle || "this lesson"}): which statement best matches "${titleHint}"?`,
        options: [
          "A key idea from the lesson content",
          "A plausible but incorrect statement",
          "An unrelated statement",
          "A vague statement",
        ],
        answer: "A key idea from the lesson content",
      };
    }
    return {
      pageId,
      type: "shortExplain",
      question: `In 2–3 sentences, explain one main idea from the section "${titleHint || "this page"}".`,
      markScheme: ["1 mark: relevant point linked to lesson content", "1 mark: use of appropriate terminology"],
      autoMark: {
        canonicalAnswer: "Students should link the explanation to ideas taught on this page.",
        requiredKeywords: ["because", "this"],
        optionalKeywords: [titleHint.split(/\s+/)[0] || "structure"],
        minMatchThreshold: 0.4,
      },
    };
  });

  return {
    checkpointItems,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, model: "mock" },
  };
}

async function openaiGenerateLessonCheckpointDraft({
  lessonTitle,
  specKey,
  topicKey,
  subject,
  level,
  extracted,
  coveragePlan,
}) {
  const axios = require("axios");
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    throw new Error("LLM_API_KEY or OPENAI_API_KEY required when LLM_PROVIDER=openai");
  }
  const model = process.env.LLM_MODEL || "gpt-4o-mini";

  const pages = Array.isArray(extracted?.pages) ? extracted.pages : [];
  const pageList = pages
    .map((p) => `- pageId: ${p.pageId} | title: ${(p.title || "").slice(0, 120)}`)
    .join("\n");

  const systemPrompt = `You are a GCSE science assessment author. Generate CHECKPOINT questions that match ONLY the provided lesson excerpt.
Rules:
- Output valid JSON only (response_format json_object).
- For EACH listed pageId produce exactly ONE checkpoint item for that pageId.
- Alternate MCQ and shortExplain across pages when possible (start with MCQ on first page).
- MCQ: exactly 4 options, "answer" must equal one option exactly.
- shortExplain: include "markScheme" (1–4 bullet strings) and "autoMark" with canonicalAnswer, requiredKeywords (3–8 short tokens), optionalKeywords, forbiddenMisconceptions if relevant, minMatchThreshold 0.5–0.7.
- Questions must be answerable from the excerpt alone; do not require facts not implied by the excerpt.
- British English; exam-neutral wording.`;

  const coverageSection = coveragePlan ? `${coveragePlan}\n\n` : "";

  const userPrompt = `${coverageSection}Lesson title: ${lessonTitle}
Spec: ${specKey || "unknown"}
Topic key: ${topicKey || "unknown"}
Subject: ${subject || ""}
Level: ${level || ""}

Pages (generate one checkpoint each):
${pageList || "(no pages)"}

Lesson content excerpt:
${(extracted?.text || "").slice(0, 12000)}

Return JSON:
{
  "checkpointItems": [
    {
      "pageId": "<must match>",
      "type": "mcq" | "shortExplain",
      "question": "...",
      "options": ["...","...","...","..."],
      "answer": "<one of options for mcq>",
      "markScheme": ["..."],
      "autoMark": { }
    }
  ]
}`;

  const res = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.35,
      max_tokens: 4096,
    },
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );

  const content = res.data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty OpenAI response");

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error("Invalid JSON from LLM: " + e.message);
  }

  const usage = res.data?.usage || {};
  const checkpointItems = Array.isArray(parsed.checkpointItems) ? parsed.checkpointItems : [];

  return {
    checkpointItems,
    usage: {
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0,
      model,
    },
  };
}

async function generateLessonCheckpointDraft(params) {
  const provider = getProvider();
  if (provider === "openai") {
    return openaiGenerateLessonCheckpointDraft(params);
  }
  return Promise.resolve(mockGenerateLessonCheckpointDraft(params));
}

module.exports = {
  generateEnquiryAnswer,
  generateStarterPack,
  generateTopicSummary,
  generateWeakEvidenceFixPack,
  generatePracticeSet,
  generateLessonCheckpointDraft,
  getProvider,
  logEnquiryTutorStartup,
  buildContext,
  ENQUIRY_FALLBACK_LIMITED_CURRICULUM_WARNING,
  ENQUIRY_GENERAL_KNOWLEDGE_NOTICE,
  ENQUIRY_NO_CURRICULUM_SOURCES_WARNING,
};
