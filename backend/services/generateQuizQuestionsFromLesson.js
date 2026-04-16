/**
 * Generate draft MCQ payloads for Topic Quiz Bank from lesson text.
 */
const { callOpenAiJson } = require("../utils/lessonAssetLlm");

const SYSTEM = `You are a UK GCSE Biology tutor. Create multiple-choice quiz questions ONLY from the lesson excerpt.
Rules:
- Use ONLY information supported by the excerpt. Do not invent facts.
- Return JSON only.
- Each question: exactly 4 options, one correct, short explanation (why the correct answer is right).
- Include "pageId" only when the question targets a specific page (must match a pageId in the prompt).
- GCSE-style command words where appropriate.`;

/**
 * @returns {Promise<Array<{ questionText: string; choices: string[]; correctIndex: number; explanation: string; pageId?: string }>>}
 */
async function generateQuizQuestionsFromLesson(opts) {
  const maxItems = Math.min(10, Math.max(1, Number(opts.maxItems) || 6));
  const pageList = (opts.pageIds || []).length ? opts.pageIds.join(", ") : "(no page ids)";

  const user = `Lesson topicKey: ${opts.namespacedTopicKey}
specKey: ${opts.specKey}
Valid pageIds: ${pageList}

Lesson excerpt:
${opts.lessonText || "(empty)"}

Return JSON: { "questions": [ { "questionText": "...", "choices": ["A","B","C","D"], "correctIndex": 0, "explanation": "...", "pageId": "" } ] }
At most ${maxItems} questions. correctIndex is 0-based.`;

  const parsed = await callOpenAiJson({
    system: SYSTEM,
    user,
    temperature: 0.25,
  });

  const raw = Array.isArray(parsed.questions) ? parsed.questions : [];
  return raw
    .map((q) => ({
      questionText: String(q.questionText || "").trim(),
      choices: Array.isArray(q.choices) ? q.choices.map((c) => String(c || "").trim()).filter(Boolean) : [],
      correctIndex: Number(q.correctIndex),
      explanation: String(q.explanation || "").trim(),
      pageId: q.pageId != null && String(q.pageId).trim() ? String(q.pageId).trim() : undefined,
    }))
    .filter((q) => q.questionText && q.choices.length >= 2 && Number.isFinite(q.correctIndex));
}

module.exports = { generateQuizQuestionsFromLesson };
