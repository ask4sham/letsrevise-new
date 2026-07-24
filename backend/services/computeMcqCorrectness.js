/**
 * PR-PRACTICE-LOOP-1 Slice 3: Server-side MCQ correctness — never trust client isCorrect for quiz_mcq.
 * Post-submit feedback may include correctChoiceIndex + explanation (never expose before submit).
 */
const TopicQuizQuestion = require("../models/TopicQuizQuestion");

/**
 * @param {ObjectId|string} contentId - TopicQuizQuestion._id
 * @param {number} selectedChoiceIndex - 0-based index chosen by student
 * @returns {Promise<{ isCorrect: boolean, correctChoiceIndex: number, explanation: string }>}
 */
async function computeMcqCorrectness(contentId, selectedChoiceIndex) {
  const doc = await TopicQuizQuestion.findById(contentId)
    .select("correctIndex type explanation")
    .lean();
  if (!doc) {
    const err = new Error("MCQ content not found");
    err.code = "CONTENT_NOT_FOUND";
    throw err;
  }
  if (doc.type !== "mcq") {
    const err = new Error("Content is not an MCQ");
    err.code = "INVALID_CONTENT_TYPE";
    throw err;
  }
  const correctChoiceIndex = doc.correctIndex != null ? Number(doc.correctIndex) : 0;
  const chosen = Number(selectedChoiceIndex);
  const isCorrect = correctChoiceIndex === chosen && !Number.isNaN(chosen);
  const explanation =
    typeof doc.explanation === "string" && doc.explanation.trim()
      ? doc.explanation.trim()
      : "";
  return { isCorrect, correctChoiceIndex, explanation };
}

module.exports = { computeMcqCorrectness };
