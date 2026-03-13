/**
 * PR-QUESTION-BROWSER-1: Validate MCQ (2-6 choices, correctChoice in range) and short-answer (≥1 acceptable answer).
 */
function normalizeChoiceLetter(v) {
  const s = String(v || "").trim().toUpperCase();
  if (!s) return null;
  return s;
}

function validateMcq({ choices, correctChoice }) {
  if (!Array.isArray(choices)) {
    throw Object.assign(new Error("MCQ choices must be 2-6"), { code: "INVALID_CHOICES" });
  }
  const cleaned = choices.map((c) => String(c ?? "").trim()).filter(Boolean);
  if (cleaned.length < 2 || cleaned.length > 6) {
    throw Object.assign(new Error("MCQ choices must be 2-6"), { code: "INVALID_CHOICES" });
  }

  const cc = normalizeChoiceLetter(correctChoice);
  if (!cc) {
    throw Object.assign(new Error("Correct choice is required"), { code: "INVALID_CORRECT_CHOICE" });
  }

  const idx = cc.charCodeAt(0) - 65;
  if (idx < 0 || idx >= cleaned.length) {
    throw Object.assign(new Error("Correct choice must match an available option"), { code: "INVALID_CORRECT_CHOICE" });
  }

  return { choices: cleaned, correctIndex: idx, correctChoice: cc };
}

function validateShortAnswer({ acceptableAnswers, matchMode }) {
  const answers = (Array.isArray(acceptableAnswers) ? acceptableAnswers : [])
    .map((a) => String(a ?? "").trim())
    .filter(Boolean);

  if (answers.length === 0) {
    throw Object.assign(new Error("Short answer requires at least one acceptable answer"), { code: "INVALID_ACCEPTABLE_ANSWERS" });
  }

  const mm = String(matchMode || "contains").toLowerCase() === "exact" ? "exact" : "contains";
  return { acceptableAnswers: answers.slice(0, 20), matchMode: mm };
}

/**
 * Validate question is ready for publishing. Returns { valid: boolean, errors: string[] }.
 * MCQ: ≥2 options, correct answer selected. Short-answer: ≥1 model answer. Question text required.
 */
function validateQuestionForPublish(doc) {
  const errors = [];
  const text = String(doc.questionText ?? doc.question ?? "").trim();
  if (!text) errors.push("Question text is required");

  const isMcq = doc.type !== "short-answer";
  if (isMcq) {
    const choices = (doc.choices ?? []).map((c) => String(c ?? "").trim()).filter(Boolean);
    if (choices.length < 2) errors.push("MCQ needs ≥2 options");
    const idx = doc.correctIndex ?? 0;
    if (choices.length >= 2 && (idx < 0 || idx >= choices.length)) {
      errors.push("MCQ needs a valid correct answer selected");
    }
  } else {
    const answers = (doc.acceptableAnswers ?? []).map((a) => String(a ?? "").trim()).filter(Boolean);
    if (answers.length === 0) errors.push("Short answer needs at least one model answer");
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateMcq, validateShortAnswer, validateQuestionForPublish };
