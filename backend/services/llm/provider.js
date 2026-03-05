/**
 * PR-004: LLM provider abstraction for enquiry answers.
 * generateEnquiryAnswer({ question, contextChunks, constraints }) -> structured JSON
 *
 * Structured output schema:
 * {
 *   explanation: string,
 *   keyPoints: string[],
 *   citations: [{ knowledgeDocumentId, sourceType, sourceId, quote (<=200), reason }],
 *   practice: [{ type: "mcq"|"short"|"exam", question, options?, answer, markScheme? }],
 *   warnings: string[]
 * }
 */
const { getProvider: getEmbeddingsProvider } = require("../embeddings/provider");

const MAX_CONTEXT_CHARS = 12000;

function getProvider() {
  const p = (process.env.LLM_PROVIDER || "mock").toLowerCase().trim();
  return p === "openai" ? "openai" : "mock";
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
 * Mock provider: deterministic response from context snippets.
 */
function mockGenerate(question, contextChunks, constraints) {
  const chunks = contextChunks || [];
  const hasWeakEvidence = constraints?.weakEvidence === true;
  const responseMode = (constraints?.responseMode || "explain").toLowerCase();

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
    citations,
    practice: constraints?.includePractice !== false ? practice : [],
    warnings,
  };
}

/**
 * OpenAI chat completions with JSON output.
 */
async function openaiGenerate(question, contextChunks, constraints) {
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

  const responseMode = (constraints?.responseMode || "explain").toLowerCase();
  const modeInstructions = {
    quick:
      "\n\nQUICK MODE: Answer in 3–5 bullet points, max ~600 chars. Include exactly 1 practice item. No long paragraphs.",
    explain:
      "\n\nEXPLAIN MODE: Clear explanation, simple structure, small example. Include 2 practice items (1 mcq + 1 short).",
    exam:
      "\n\nEXAM MODE: Answer like an examiner—key points, command words. Include 1 exam-style question + mark scheme. Use syllabus language; no fluff.",
    revision:
      "\n\nREVISION MODE: Give a revision sheet—key facts, common mistakes, memory cues. Provide 3 flashcard prompts in practice array as type=flashcard with front and back fields.",
  };
  const modeNote = modeInstructions[responseMode] || modeInstructions.explain;

  const weakNote =
    constraints?.weakEvidence === true
      ? "\n\nIMPORTANT: The retrieved sources are weak or insufficient. You MUST include a warning 'Insufficient trusted sources' and explain what is missing. Do not make up facts."
      : "";

  const studentNote =
    constraints?.studentMode === true
      ? `

STUDENT MODE:
- Use simple language suitable for GCSE/A-Level students.
- Keep explanation <= 1200 characters.
- Prefer bullet points.
- Encourage the student to attempt practice questions first.
- Do not mention internal implementation details.`
      : "";

  const systemPrompt = `You are an educational AI tutor for UK GCSE/A-Level. Answer ONLY using the provided curriculum sources. Every key point must be supported by a citation. If sources are weak, say so clearly.

Rules:
- Use ONLY the provided [knowledgeDocumentId] sources.
- Every citation must reference a knowledgeDocumentId from the context.
- quote must be a snippet (<=200 chars) from that document's text.
- If sources don't cover the question, add "Insufficient trusted sources" to warnings.
- Return valid JSON only.${contextNote}${modeNote}${weakNote}${studentNote}`;

  const userPrompt = `${convCtx}Question: ${question}

Context:
${context}

Return JSON: { "explanation": "...", "keyPoints": ["..."], "citations": [{ "knowledgeDocumentId": "...", "sourceType": "...", "sourceId": "...", "quote": "...", "reason": "..." }], "practice": [{ "type": "mcq|short|exam|flashcard", "question": "...", "options": [], "answer": "...", "markScheme": "...", "front": "...(for flashcard)", "back": "...(for flashcard)" }], "warnings": [] }`;

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
 * @returns {Promise<{ explanation, keyPoints, citations, practice, warnings }>}
 */
async function generateEnquiryAnswer({ question, contextChunks, constraints = {} }) {
  const provider = getProvider();
  const q = (question || "").trim();
  if (!q) throw new Error("question is required");

  if (provider === "openai") {
    return openaiGenerate(q, contextChunks, constraints);
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
    examQuestions: [
      { question: "Explain the key concept. [4 marks]", markScheme: "1 mark per valid point.", marks: 4 },
      { question: "Describe the process. [3 marks]", markScheme: "Credit correct sequence.", marks: 3 },
    ],
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

Rules:
- Derive ALL content from the provided statements and context chunks.
- Keep language GCSE/A-Level appropriate.
- Include statement codes in metadata where relevant.
- Return valid JSON only.
- Do not reference "internet" or external sources.
- Blocks: use "text", "bulletList", "workedExample", or "checkpoint".
- Lesson: 2-4 pages, 2-4 blocks per page.
- Flashcards: 5-10 items.
- Quiz: 8-12 MCQ items.
- Exam questions: 3-5 items with marks 1-6.`;

  const userPrompt = `Spec: ${specKey}
Topic: ${topicKey}
Statement codes: ${(statementCodes || []).join(", ")}

Spec statements:
${statementsText || "(none - use context)"}

Context:
${context || "(minimal - produce best-effort from statements)"}

Return JSON:
{
  "lesson": {
    "title": "...",
    "subtitle": "...",
    "learningObjectives": ["..."],
    "pages": [
      {
        "title": "...",
        "blocks": [
          { "type": "text", "content": "..." },
          { "type": "bulletList", "items": ["..."] },
          { "type": "workedExample", "prompt": "...", "answer": "..." },
          { "type": "checkpoint", "question": "...", "answer": "..." }
        ]
      }
    ]
  },
  "flashcards": [{ "front": "...", "back": "...", "tags": [] }],
  "quiz": [{ "kind": "mcq", "question": "...", "options": ["..."], "correctIndex": 0, "explanation": "..." }],
  "examQuestions": [{ "question": "...", "markScheme": "...", "marks": 4 }]
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
    examQuestions: examQuestions.slice(0, 5).map((eq) => ({
      question: String(eq.question || "").slice(0, 2000),
      markScheme: String(eq.markScheme || "").slice(0, 1000),
      marks: Math.max(1, Math.min(Number(eq.marks) || 4, 10)),
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

module.exports = { generateEnquiryAnswer, generateStarterPack, getProvider, buildContext };
