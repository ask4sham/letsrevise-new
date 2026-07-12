/**
 * Generate a composite exam question draft via LLM (no DB write).
 * V1.1: short + mcq parts; no table; Easy / Medium / Hard.
 */
const { callOpenAiJson } = require("../utils/lessonAssetLlm");
const {
  DIFFICULTIES,
  normalizeDifficulty,
  validateCompositeExamAiDraft,
} = require("../utils/validateCompositeExamAiDraft");

const SYSTEM = `You are an experienced UK secondary science exam writer (GCSE / IGCSE style).
Create ONE composite exam question draft as strict JSON only.

Rules:
- Output JSON only matching the schema.
- Use British English spelling (colour, organise, analyse, centre, behaviour).
- Use clear exam command words (Describe, Explain, Suggest, Compare, Evaluate, Justify, Identify, State).
- Part types allowed: "short" and "mcq" only. Never use "table" or any other type.
- You may include at most ONE mcq part. Do not force an MCQ into every draft.
- Prefer purposeful mix: Easy/Medium may include 1 MCQ plus short answer; Hard should be mostly short answer (optional 1 MCQ only if it tests application or a common misconception).
- Labels must be sequential: a, then b, then c…
- totalMarks must equal the sum of part marks.
- For short parts: markSchemeLines are distinct marking points; each line ~10+ characters; prefer one line per mark.
- For mcq parts: marks must be 1; exactly 4 distinct non-empty options; correctIndex 0–3; no "all of the above" / "none of the above"; markSchemeLines must identify the correct option (e.g. "Award 1 mark for selecting Option B / <correct text>").
- Do NOT put answers in questionText.
- Do NOT claim this is an official past paper.
- Prefer text-only shared stems.
- If hasImage is false: never mention diagrams, figures, graphs, photographs, or images.
- If hasImage is true: you may briefly refer to the image, but a text-only stem is still preferred.

Difficulty bands:
- easy: 1–2 parts, recall/describe, totalMarks 2–4; may include 1 MCQ
- medium: 2–3 parts, apply/explain, totalMarks 4–6; may include 1 MCQ plus short answer
- hard: 3–4 parts, analyse/evaluate/compare/justify, totalMarks 6–9; mostly short; optional 1 MCQ

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
For short parts omit options/correctIndex (or leave empty). For mcq parts options and correctIndex are required.`;

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
      ? "You may include one 1-mark MCQ plus a short recall/describe part, or short-only."
      : difficulty === "medium"
        ? "A strong pattern is one MCQ plus one or two short explain/apply parts. Short-only is also fine."
        : "Prefer short-answer Higher-tier parts. Include at most one MCQ, and only if it tests application or a misconception.";

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
- mix guidance: ${mixHint}

${hasImage ? "An image is already attached; you may refer to it carefully if useful." : "No image is attached. Do not mention diagrams, figures, graphs, photographs, or images."}

Return JSON only. Never use type "table".`;

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

  // Force difficulty to requested band for validation (model may echo wrong label)
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
