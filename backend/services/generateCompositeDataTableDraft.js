/**
 * Generate a data-table composite exam question draft via LLM (no DB write).
 * V1: display-only dataTable stimulus + short parts only (no MCQ, no type "table").
 */
const { callOpenAiJson } = require("../utils/lessonAssetLlm");
const {
  DIFFICULTIES,
  normalizeDifficulty,
  validateCompositeDataTableAiDraft,
} = require("../utils/validateCompositeDataTableAiDraft");

const SYSTEM = `You are an experienced UK secondary science exam writer (GCSE / IGCSE style).
Create ONE data-table composite exam question draft as strict JSON only.

Hard requirements (do not break these):
- questionStyle MUST be "data_table".
- You MUST include a dataTable stimulus with realistic, internally consistent, biologically plausible values.
- You MUST generate short-answer parts ONLY (type "short").
- You MUST NOT use type "mcq".
- You MUST NOT use type "table".
- You MUST NOT create fill-in / blank table cells — every dataTable cell is complete data for students to read.
- Labels must be sequential: a, then b, then c…
- totalMarks must equal the sum of part marks.
- Every part must include dataDependency explaining which table row/column/value it uses.
- Mark scheme answers MUST match the table data (read values, trends, and simple calculations).

Style rules:
- Use British English spelling (colour, organise, analyse, centre, behaviour).
- Use clear exam command words (State, Identify, Describe, Calculate, Compare, Explain, Evaluate, Suggest).
- markSchemeLines are distinct marking points; each line ~10+ characters; prefer one line per mark.
- Do NOT put answers in questionText.
- Do NOT claim this is an official past paper.
- Do NOT mention diagrams, figures, graphs, photographs, or images.
- sharedStem sets context only — do NOT paste the full numeric table into sharedStem (dataTable holds the table).
- Prefer 2–4 columns and 3–5 rows of clean exam-style data.
- Quantitative columns MUST include a unit (e.g. °C, s, %, cm³).

Difficulty structure:
- easy: 2–3 short parts, totalMarks 2–4 — read a value; describe a simple trend
- medium: exactly 3 short parts, totalMarks 4–6 — compare; calculate; explain a trend
- hard: 3–4 short parts, totalMarks 6–9 — interpret; evaluate method/reliability; explain biological cause; suggest improvement

Return:
{
  "title": "string",
  "sharedStem": "string",
  "difficulty": "easy|medium|hard",
  "questionStyle": "data_table",
  "totalMarks": number,
  "dataTable": {
    "title": "string",
    "columns": [{ "heading": "Temperature", "unit": "°C" }],
    "rows": [["20", "80"], ["30", "45"]]
  },
  "parts": [
    {
      "label": "a",
      "type": "short",
      "marks": 1,
      "questionText": "string",
      "markSchemeLines": ["Award 1 mark for..."],
      "commandWord": "State",
      "skill": "read_data",
      "dataDependency": "uses Temperature / Rate column..."
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
 * }} input
 */
async function generateCompositeDataTableDraft(input) {
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
  const subject = String(input?.subject || "Biology").trim() || "Biology";
  const examBoard = String(input?.examBoard || "").trim();
  const level = String(input?.level || "").trim();
  const topic = String(input?.topic || "").trim();
  const preferredTitle = String(input?.title || "").trim();

  const mixHint =
    difficulty === "easy"
      ? "2–3 short parts: read a value from the table; describe a simple trend."
      : difficulty === "medium"
        ? "Exactly 3 short parts: compare values; calculate from the table; explain the trend."
        : "3–4 short parts: interpret data; evaluate reliability/method; explain biological cause; suggest improvement.";

  const user = `Create one ${difficulty} data-table composite exam question draft.

Subject: ${subject}
Exam board: ${examBoard || "(unspecified)"}
Level: ${level || "(unspecified)"}
Topic: ${topic || "(from topicKey)"}
topicKey: ${topicKey}
Preferred title hint: ${preferredTitle || "(none)"}

Difficulty band:
- parts: ${band.minParts}-${band.maxParts} (ALL type "short")
- totalMarks: ${band.minMarks}-${band.maxMarks}
- style: ${mixHint}
- REQUIRED: dataTable with 2–5 columns, 3–6 rows, no blank cells, units on numeric columns
- FORBIDDEN: type "mcq"; type "table"; fill-in blanks; diagrams/graphs/images

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
    questionStyle: "data_table",
  };

  const validated = validateCompositeDataTableAiDraft(candidate, { difficulty });
  if (!validated.ok) {
    const err = new Error(validated.msg || "AI data-table draft failed validation.");
    err.statusCode = 422;
    err.code = "AI_DRAFT_INVALID";
    err.issues = validated.issues || [];
    throw err;
  }

  return validated.draft;
}

module.exports = {
  generateCompositeDataTableDraft,
  SYSTEM,
};
