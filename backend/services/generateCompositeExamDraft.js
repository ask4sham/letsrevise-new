/**
 * Generate a composite exam question draft via LLM (no DB write).
 * V1.1+: exactly one MCQ + remaining short parts; no table.
 */
const { callOpenAiJson } = require("../utils/lessonAssetLlm");
const {
  DIFFICULTIES,
  normalizeDifficulty,
  validateCompositeExamAiDraft,
} = require("../utils/validateCompositeExamAiDraft");

const SYSTEM = `You are an experienced UK secondary science exam writer (GCSE / IGCSE style).
Create ONE composite exam question draft as strict JSON only.

Hard requirements (do not break these):
- You MUST include exactly one part with type "mcq".
- You MUST include at least one part with type "short".
- You MUST NOT use type "table" or any other type.
- The MCQ must have exactly 4 distinct non-empty plausible options.
- The MCQ must have one correct answer via correctIndex (0–3).
- The MCQ must be worth exactly 1 mark.
- Remaining parts must be short-answer questions.
- Labels must be sequential: a, then b, then c…
- totalMarks must equal the sum of part marks.

Style rules:
- Use British English spelling (colour, organise, analyse, centre, behaviour).
- Use clear exam command words (Describe, Explain, Suggest, Compare, Evaluate, Justify, Identify, State).
- For short parts: markSchemeLines are distinct marking points; each line ~10+ characters; prefer one line per mark.
- For the MCQ: markSchemeLines must identify the correct option (e.g. "Award 1 mark for selecting Option B / <correct text>").
- Do NOT put answers in questionText.
- Do NOT claim this is an official past paper.
- Prefer text-only shared stems.
- If hasImage is false: never mention diagrams, figures, graphs, photographs, or images.
- If hasImage is true: you may briefly refer to the image, but a text-only stem is still preferred.

Difficulty structure:
- easy: exactly 2 parts (1 MCQ + 1 short), recall/describe, totalMarks 2–4
- medium: exactly 3 parts (1 MCQ + 2 short), apply/explain, totalMarks 4–6
- hard: 3–4 parts (1 MCQ + remaining short), analyse/evaluate/compare/justify, totalMarks 6–9
- For Hard, the MCQ MUST test application, misconception or interpretation — not basic recall.

Return:
{
  "title": "string",
  "sharedStem": "string",
  "difficulty": "easy|medium|hard",
  "totalMarks": number,
  "parts": [
    {
      "label": "a",
      "type": "short|mcq",
      "marks": number,
      "questionText": "string",
      "options": ["A text","B text","C text","D text"],
      "correctIndex": 0,
      "markSchemeLines": ["Award 1 mark for..."],
      "commandWord": "Explain",
      "skill": "explain"
    }
  ],
  "warnings": []
}
For short parts omit options/correctIndex (or leave empty). For the required mcq part, options and correctIndex are mandatory.`;

/**
 * @param {{
 *   subject?: string,
 *   examBoard?: string,
 *   level?: string,
 *   topic?: string,
 *   topicKey?: string,
 *   difficulty: string,
 *   title?: string,
 *   hasImage?: boolean,
 * }} input
 */
async function generateCompositeExamDraft(input) {
  const difficulty = normalizeDifficulty(input?.difficulty);
  if (!difficulty) {
    const err = new Error("difficulty must be easy, medium, or hard.");
    err.statusCode = 400;
    err.code = "INVALID_DIFFICULTY";
    throw err;
  }
  const topicKey = String(input?.topicKey || "").trim();
  if (!topicKey) {
    const err = new Error("Select a topic before generating.");
    err.statusCode = 400;
    err.code = "TOPIC_REQUIRED";
    throw err;
  }

  const band = DIFFICULTIES[difficulty];
  const hasImage = Boolean(input?.hasImage);
  const subject = String(input?.subject || "Biology").trim() || "Biology";
  const examBoard = String(input?.examBoard || "").trim();
  const level = String(input?.level || "").trim();
  const topic = String(input?.topic || "").trim();
  const preferredTitle = String(input?.title || "").trim();

  const mixHint =
    difficulty === "easy"
      ? "Exactly 2 parts: one 1-mark MCQ and one short recall/describe question."
      : difficulty === "medium"
        ? "Exactly 3 parts: one 1-mark MCQ plus two short explain/apply questions."
        : "3–4 parts: one application/misconception MCQ (not basic recall) plus Higher-tier short answers.";

  const user = `Create one ${difficulty} composite exam question draft.

Subject: ${subject}
Exam board: ${examBoard || "(unspecified)"}
Level: ${level || "(unspecified)"}
Topic: ${topic || "(from topicKey)"}
topicKey: ${topicKey}
Preferred title hint: ${preferredTitle || "(none)"}
hasImage: ${hasImage ? "true" : "false"}

Difficulty band:
- parts: ${band.minParts}-${band.maxParts}
- totalMarks: ${band.minMarks}-${band.maxMarks}
- style: ${
    difficulty === "easy"
      ? "recall / describe"
      : difficulty === "medium"
        ? "application / explain with command words"
        : "higher-tier analyse / evaluate / compare / justify"
  }
- REQUIRED mix: ${mixHint}
- REQUIRED: exactly one type "mcq" part and at least one type "short" part.
- FORBIDDEN: type "table"; short-only drafts; more than one MCQ.

${hasImage ? "An image is already attached; you may refer to it carefully if useful." : "No image is attached. Do not mention diagrams, figures, graphs, photographs, or images."}

Return JSON only.`;

  let parsed;
  try {
    parsed = await callOpenAiJson({
      system: SYSTEM,
      user,
      temperature: difficulty === "hard" ? 0.35 : 0.25,
    });
  } catch (e) {
    if (e && (e.code === "LLM_NOT_CONFIGURED" || e.code === "LLM_EMPTY" || e.code === "LLM_BAD_JSON")) {
      e.statusCode = 503;
    }
    throw e;
  }

  const candidate = {
    ...parsed,
    difficulty,
  };

  const validated = validateCompositeExamAiDraft(candidate, { difficulty, hasImage });
  if (!validated.ok) {
    const err = new Error(validated.msg || "AI draft failed validation.");
    err.statusCode = 422;
    err.code = "AI_DRAFT_INVALID";
    err.issues = validated.issues || [];
    throw err;
  }

  return validated.draft;
}

module.exports = {
  generateCompositeExamDraft,
  SYSTEM,
};
