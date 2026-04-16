/**
 * Generate draft flashcard payloads from lesson page text (JSON via LLM).
 * Does not save — caller validates and persists TopicFlashcard rows.
 */
const { callOpenAiJson } = require("../utils/lessonAssetLlm");

const SYSTEM = `You are a UK GCSE Biology tutor. Generate revision flashcards ONLY from the lesson excerpt provided.
Rules:
- Use ONLY information supported by the excerpt. Do not invent facts.
- Return JSON only, no markdown fences.
- Each flashcard: concise front (question/term), back (definition/explanation), GCSE-appropriate.
- Include "pageId" only when the card clearly relates to one page section (must match a pageId listed in the prompt).
- Aim for 4–8 items unless the excerpt is very short; fewer is OK if content is thin.`;

/**
 * @param {Object} opts
 * @param {Object} opts.lesson
 * @param {string} opts.lessonText
 * @param {string[]} opts.pageIds
 * @param {string} opts.namespacedTopicKey
 * @param {string} opts.specKey
 * @param {number} [opts.maxItems=8]
 * @returns {Promise<Array<{ front: string; back: string; pageId?: string }>>}
 */
async function generateFlashcardsFromLesson(opts) {
  const maxItems = Math.min(12, Math.max(1, Number(opts.maxItems) || 8));
  const pageList = (opts.pageIds || []).length ? opts.pageIds.join(", ") : "(no page ids — omit pageId on each card)";

  const user = `Lesson topicKey: ${opts.namespacedTopicKey}
specKey: ${opts.specKey}
Valid pageIds for this lesson: ${pageList}

Lesson excerpt:
${opts.lessonText || "(empty)"}

Return JSON: { "flashcards": [ { "front": "...", "back": "...", "pageId": "" } ] }
Use at most ${maxItems} flashcards. Omit pageId or use "" if not tied to a specific page.`;

  const parsed = await callOpenAiJson({
    system: SYSTEM,
    user,
    temperature: 0.3,
  });

  const raw = Array.isArray(parsed.flashcards) ? parsed.flashcards : [];
  return raw
    .map((f) => ({
      front: String(f.front || "").trim(),
      back: String(f.back || "").trim(),
      pageId: f.pageId != null && String(f.pageId).trim() ? String(f.pageId).trim() : undefined,
    }))
    .filter((f) => f.front && f.back);
}

module.exports = { generateFlashcardsFromLesson };
