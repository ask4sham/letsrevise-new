/**
 * Generate draft exam-style questions for the Exam Question Bank (structured responses only).
 * Distinct from Topic Quiz Bank: no quick recall MCQs here—use quiz generation for those.
 */
const { callOpenAiJson } = require("../utils/lessonAssetLlm");

const SYSTEM = `You are a UK GCSE Biology teacher. Generate EXAM-STYLE structured short / extended written questions from the lesson excerpt only.
This output feeds the Exam Question Bank (formal assessed items), NOT the Topic Quiz Bank (quick checks).
Rules:
- Output ONLY written exam-style questions. type must always be exactly "short" (structured written answer). Never output MCQs, multiple choice, options arrays, or correctIndex — those belong ONLY in the quiz flow.
- Forbid 1-mark recall-only quiz items; every item must be at least 2 marks.
- Each question must use a clear command word (Explain, Describe, Compare, Evaluate, Outline, Suggest, Justify, or How / Why as appropriate).
- Marks must be 2–6 and match the depth expected: more marks → richer mark scheme and longer model answer.
- Use ONLY information supported by the excerpt. Do not invent facts.
- Do NOT claim official exam board wording — practice material only.
- markScheme: at least TWO bullet strings, each a distinct marking point (each ~10+ characters, not one-word lines).
- modelAnswer: a strong exemplar response that could earn full marks.
- Aim for 10 questions unless the excerpt is too thin; if thin, return as many valid items as you can (still no padding with low-quality items).
- Return JSON only.
- Include pageId only when clearly tied to a listed pageId.`;

/**
 * @returns {Promise<Array<{ type: string; question: string; marks: number; commandWord?: string; markScheme: string[]; modelAnswer: string; pageId?: string }>>}
 */
async function generateExamQuestionsFromLesson(opts) {
  const rawN = Number(opts.maxItems);
  const maxItems = Math.min(12, Math.max(0, Number.isFinite(rawN) && rawN > 0 ? rawN : 10));
  if (maxItems === 0) return [];

  const pageList = (opts.pageIds || []).length ? opts.pageIds.join(", ") : "(no page ids)";

  const user = `Lesson topicKey: ${opts.namespacedTopicKey}
specKey: ${opts.specKey}
Valid pageIds: ${pageList}

Lesson excerpt:
${opts.lessonText || "(empty)"}

Return JSON: { "examQuestions": [ {
  "type": "short",
  "question": "Explain ...",
  "marks": 4,
  "commandWord": "Explain",
  "markScheme": ["Point one with detail", "Second marking point", "Third where appropriate"],
  "modelAnswer": "A developed answer that matches the marks...",
  "pageId": ""
} ] }
Produce up to ${maxItems} questions (target 10 when the excerpt supports it). All items MUST have type exactly "short". Never include options, choices, or correctIndex.`;

  const parsed = await callOpenAiJson({
    system: SYSTEM,
    user,
    temperature: 0.25,
  });

  const rawList = Array.isArray(parsed.examQuestions) ? parsed.examQuestions : [];
  return rawList
    .filter((q) => {
      const t = String(q.type || "short").toLowerCase();
      if (t === "mcq") return false;
      if (Array.isArray(q.options) && q.options.length > 0) return false;
      if (q.correctIndex != null && q.correctIndex !== "") return false;
      return true;
    })
    .map((q) => ({
      type: "short",
      question: String(q.question || "").trim(),
      marks: Math.min(6, Math.max(2, parseInt(String(q.marks || 4), 10) || 4)),
      commandWord: q.commandWord != null ? String(q.commandWord).trim() : "",
      options: [],
      correctIndex: undefined,
      markScheme: Array.isArray(q.markScheme) ? q.markScheme.map((x) => String(x || "").trim()).filter(Boolean) : [],
      modelAnswer: String(q.modelAnswer || "").trim(),
      pageId: q.pageId != null && String(q.pageId).trim() ? String(q.pageId).trim() : undefined,
    }))
    .filter((q) => q.question && q.markScheme.length >= 2 && q.modelAnswer);
}

module.exports = { generateExamQuestionsFromLesson };
