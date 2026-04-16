/**
 * Generate draft exam-style questions (short answer / MCQ) for ExamQuestion bank.
 * Phase 1: optional; same LLM contract as quiz but longer mark schemes.
 */
const { callOpenAiJson } = require("../utils/lessonAssetLlm");

const SYSTEM = `You are a UK GCSE Biology tutor. Generate exam-style questions ONLY from the lesson excerpt.
Rules:
- Use ONLY information supported by the excerpt. Do not invent facts.
- Do NOT claim official exam board wording — this is practice material only.
- Return JSON only.
- Prefer type "short" or "mcq" with marks 2–6.
- Include commandWord in each item (e.g. Explain, Describe, State).
- markScheme: array of bullet strings; modelAnswer: one string for the ideal response.
- Include pageId only when clearly tied to a listed pageId.`;

/**
 * @returns {Promise<Array<{ type: string; question: string; marks: number; commandWord?: string; options?: string[]; correctIndex?: number; markScheme: string[]; modelAnswer: string; pageId?: string }>>}
 */
async function generateExamQuestionsFromLesson(opts) {
  const maxItems = Math.min(5, Math.max(0, Number(opts.maxItems) || 3));
  if (maxItems === 0) return [];

  const pageList = (opts.pageIds || []).length ? opts.pageIds.join(", ") : "(no page ids)";

  const user = `Lesson topicKey: ${opts.namespacedTopicKey}
specKey: ${opts.specKey}
Valid pageIds: ${pageList}

Lesson excerpt:
${opts.lessonText || "(empty)"}

Return JSON: { "examQuestions": [ {
  "type": "short" | "mcq",
  "question": "...",
  "marks": 2,
  "commandWord": "Explain",
  "options": [""] ,
  "correctIndex": 0,
  "markScheme": ["point 1", "point 2"],
  "modelAnswer": "...",
  "pageId": ""
} ] }
At most ${maxItems} questions. For type "short", omit options or use []. For "mcq", provide 4 options and correctIndex.`;

  const parsed = await callOpenAiJson({
    system: SYSTEM,
    user,
    temperature: 0.25,
  });

  const raw = Array.isArray(parsed.examQuestions) ? parsed.examQuestions : [];
  return raw
    .map((q) => ({
      type: String(q.type || "short").toLowerCase() === "mcq" ? "mcq" : "short",
      question: String(q.question || "").trim(),
      marks: Math.min(9, Math.max(1, parseInt(String(q.marks || 2), 10) || 2)),
      commandWord: q.commandWord != null ? String(q.commandWord).trim() : "",
      options: Array.isArray(q.options) ? q.options.map((x) => String(x || "").trim()) : [],
      correctIndex: q.correctIndex != null ? Number(q.correctIndex) : undefined,
      markScheme: Array.isArray(q.markScheme) ? q.markScheme.map((x) => String(x || "").trim()).filter(Boolean) : [],
      modelAnswer: String(q.modelAnswer || "").trim(),
      pageId: q.pageId != null && String(q.pageId).trim() ? String(q.pageId).trim() : undefined,
    }))
    .filter((q) => q.question && (q.markScheme.length > 0 || q.modelAnswer));
}

module.exports = { generateExamQuestionsFromLesson };
