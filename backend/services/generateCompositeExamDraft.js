/**
 * Generate a composite exam question draft via LLM (no DB write).
 * V1: short parts only; Easy / Medium / Hard.
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
- Use clear exam command words (Describe, Explain, Suggest, Compare, Evaluate, Justify, Calculate only if appropriate).
- Parts must be type "short" only. Never use mcq, table, or other types.
- Labels must be sequential: a, then b, then c…
- totalMarks must equal the sum of part marks.
- markSchemeLines: one distinct marking point per string; each line at least ~10 characters; prefer one line per mark.
- Do NOT put answers in questionText.
- Do NOT claim this is an official past paper.
- Prefer text-only shared stems.
- If hasImage is false: never mention diagrams, figures, graphs, photographs, or images.
- If hasImage is true: you may briefly refer to the image, but a text-only stem is still preferred.

Difficulty bands:
- easy: 1–2 parts, recall/describe, totalMarks 2–4
- medium: 2–3 parts, apply/explain, totalMarks 4–6
- hard: 3–4 parts, analyse/evaluate/compare/justify, totalMarks 6–9

Return:
{
  "title": "string",
  "sharedStem": "string",
  "difficulty": "easy|medium|hard",
  "totalMarks": number,
  "parts": [
    {
      "label": "a",
      "type": "short",
      "marks": number,
      "questionText": "string",
      "markSchemeLines": ["Award 1 mark for..."],
      "commandWord": "Explain",
      "skill": "explain"
    }
  ],
  "warnings": []
}`;

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
