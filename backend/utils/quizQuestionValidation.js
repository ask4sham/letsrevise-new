/**
 * PR-QUIZ-BANK-TYPES-1: Validate and normalize quiz question items (MCQ + short-answer).
 */
const { normalizeDifficulty, normalizeSkill, normalizeEstimatedTimeSec } = require("./metadataValidation");

const Q_TYPES = ["mcq", "short-answer"];
const MIN_CHOICES = 2;
const MAX_CHOICES = 6;
const MIN_ACCEPTABLE = 1;
const MAX_ACCEPTABLE = 10;
const MATCH_MODES = ["exact", "contains"];

function normalizeQuizType(type) {
  if (!type || typeof type !== "string") return "mcq";
  const t = String(type).trim().toLowerCase().replace(/\s+/g, "-");
  if (t === "shortanswer" || t === "short-answer") return "short-answer";
  if (t === "mcq") return "mcq";
  const e = new Error(`type must be mcq or short-answer, got: ${type}`);
  e.code = "INVALID_QUIZ_TYPE";
  throw e;
}

function validateMcq({ choices, correctIndex }) {
  const arr = Array.isArray(choices) ? choices.map((c) => String(c).trim()).filter(Boolean) : [];
  if (arr.length < MIN_CHOICES || arr.length > MAX_CHOICES) {
    const e = new Error(`MCQ choices must be ${MIN_CHOICES}-${MAX_CHOICES}`);
    e.code = "INVALID_MCQ_CHOICES";
    throw e;
  }
  const idx = Number.isFinite(correctIndex) ? Math.floor(Number(correctIndex)) : 0;
  if (idx < 0 || idx >= arr.length) {
    const e = new Error("correctIndex must be 0..(choices.length-1)");
    e.code = "INVALID_CORRECT_INDEX";
    throw e;
  }
  return { choices: arr, correctIndex: idx };
}

function validateShortAnswer({ acceptableAnswers, matchMode }) {
  const arr = Array.isArray(acceptableAnswers)
    ? acceptableAnswers.map((a) => String(a).trim()).filter(Boolean)
    : typeof acceptableAnswers === "string"
      ? acceptableAnswers.split("|").map((a) => a.trim()).filter(Boolean)
      : [];
  if (arr.length < MIN_ACCEPTABLE || arr.length > MAX_ACCEPTABLE) {
    const e = new Error(`acceptableAnswers must have ${MIN_ACCEPTABLE}-${MAX_ACCEPTABLE} entries`);
    e.code = "INVALID_ACCEPTABLE_ANSWERS";
    throw e;
  }
  const mode = (matchMode && MATCH_MODES.includes(String(matchMode).toLowerCase()))
    ? String(matchMode).toLowerCase()
    : "contains";
  return { acceptableAnswers: arr, matchMode: mode };
}

/**
 * @param {*} input - Raw item with question/questionText, type, choices, correctIndex, acceptableAnswers, matchMode, explanation, difficulty, skill, estimatedTimeSec
 * @returns Normalized item for storage (questionText, type, choices?, correctIndex?, acceptableAnswers?, matchMode?, explanation?, difficulty?, skill?, estimatedTimeSec?)
 */
function normalizeQuizQuestionItem(input) {
  if (!input || typeof input !== "object") throw new Error("Item must be an object");
  const question = (input.question != null ? input.question : input.questionText);
  const questionText = (typeof question === "string" ? question : "").trim();
  if (!questionText) throw new Error("question is required");

  const type = normalizeQuizType(input.type);
  const out = {
    type,
    questionText,
    explanation: (input.explanation != null && typeof input.explanation === "string") ? input.explanation.trim() : "",
    difficulty: null,
    skill: null,
    estimatedTimeSec: null,
  };

  if (input.difficulty != null || input.skill != null || input.estimatedTimeSec != null) {
    try {
      out.difficulty = normalizeDifficulty(input.difficulty);
      out.skill = normalizeSkill(input.skill);
      out.estimatedTimeSec = normalizeEstimatedTimeSec(input.estimatedTimeSec);
    } catch (_) {
      throw _;
    }
  }

  if (type === "mcq") {
    const mcq = validateMcq({
      choices: input.choices,
      correctIndex: input.correctIndex,
    });
    out.choices = mcq.choices;
    out.correctIndex = mcq.correctIndex;
  } else {
    const sa = validateShortAnswer({
      acceptableAnswers: input.acceptableAnswers,
      matchMode: input.matchMode,
    });
    out.acceptableAnswers = sa.acceptableAnswers;
    out.matchMode = sa.matchMode;
  }

  return out;
}

module.exports = {
  Q_TYPES,
  MATCH_MODES,
  MIN_CHOICES,
  MAX_CHOICES,
  MIN_ACCEPTABLE,
  MAX_ACCEPTABLE,
  normalizeQuizType,
  validateMcq,
  validateShortAnswer,
  normalizeQuizQuestionItem,
};
