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

module.exports = { validateMcq, validateShortAnswer };
