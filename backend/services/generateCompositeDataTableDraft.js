/**
 * Generate a data-table composite exam question draft via LLM (no DB write).
 * V1: display-only dataTable stimulus + short parts only (no MCQ, no type "table").
 * On fixable validation failures, retry once with an LLM repair prompt (validator stays strict).
 */
const { callOpenAiJson } = require("../utils/lessonAssetLlm");
const {
  DIFFICULTIES,
  normalizeDifficulty,
  validateCompositeDataTableAiDraft,
} = require("../utils/validateCompositeDataTableAiDraft");

const MAX_REPAIR_ATTEMPTS = 2;

const SYSTEM = `You are an experienced UK secondary science exam writer (GCSE / IGCSE style).
Create ONE data-table composite exam question draft as strict JSON only.

Hard requirements (do not break these):
- questionStyle MUST be "data_table".
- You MUST include a dataTable stimulus with realistic, internally consistent, biologically plausible values.
- dataTable.rows MUST contain between 3 and 6 rows inclusive. NEVER return only 1 or 2 rows.
- Do not return only 2 rows. A 2-row table is invalid.
- Every row MUST have the same number of cells as there are columns.
- No blank cells.
- Every numeric column MUST include a non-empty unit (e.g. °C, s, %, cm³).
- You MUST generate short-answer parts ONLY (type "short").
- You MUST NOT use type "mcq".
- You MUST NOT use type "table".
- You MUST NOT create fill-in / blank table cells — every dataTable cell is complete data for students to read.
- Labels must be sequential: a, then b, then c…
- totalMarks must equal the sum of part marks.
- Every part must include dataDependency explaining which table row/column/value it uses.
- Mark scheme answers MUST match the table data (read values, trends, and simple calculations).

Row-count targets by difficulty:
- easy: exactly 3 data rows
- medium: exactly 4 data rows (3–6 allowed; prefer 4)
- hard: 5 or 6 data rows

Style rules:
- Use British English spelling (colour, organise, analyse, centre, behaviour).
- Use clear exam command words (State, Identify, Describe, Calculate, Compare, Explain, Evaluate, Suggest).
- markSchemeLines are distinct marking points; each line ~10+ characters; prefer one line per mark.
- Do NOT put answers in questionText.
- Do NOT claim this is an official past paper.
- Do NOT mention diagrams, figures, graphs, photographs, or images.
- sharedStem sets context only — do NOT paste the full numeric table into sharedStem (dataTable holds the table).
- Prefer quantitative experimental results (measurements vs temperature/time/concentration), not vague two-option comparison lists.
- Prefer 2–4 columns.

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
    "columns": [
      { "heading": "Temperature", "unit": "°C" },
      { "heading": "Time taken", "unit": "s" },
      { "heading": "Rate", "unit": "s⁻¹" }
    ],
    "rows": [
      ["20", "80", "0.013"],
      ["30", "45", "0.022"],
      ["40", "25", "0.040"],
      ["50", "60", "0.017"]
    ]
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
}

Invalid example (never do this — only 2 rows):
{
  "dataTable": {
    "columns": [{ "heading": "Type", "unit": "" }, { "heading": "Offspring", "unit": "" }],
    "rows": [["Sexual", "Varied"], ["Asexual", "Identical"]]
  }
}`;

function rowTargetHint(difficulty) {
  if (difficulty === "easy") return "exactly 3 data rows";
  if (difficulty === "medium") return "exactly 4 data rows (minimum 3, maximum 6; prefer 4)";
  return "5 or 6 data rows (minimum 3, maximum 6)";
}

function isRepairableDraftFailure(issues) {
  if (!Array.isArray(issues) || !issues.length) return false;
  // Shape / table / type issues are fixable by a repair call. Always allow one repair attempt
  // when validation fails (bounded), except when the payload was not an object at all.
  if (issues.includes("not_object") || issues.includes("invalid_difficulty")) return false;
  return true;
}

function buildRepairUser({
  subject,
  examBoard,
  level,
  topic,
  topicKey,
  preferredTitle,
  difficulty,
  band,
  mixHint,
  issues,
  invalidDraft,
}) {
  const issueList = (issues || []).map((i) => `- ${i}`).join("\n");
  const focus = [];
  if ((issues || []).some((i) => String(i).startsWith("data_table_missing_unit"))) {
    focus.push("Add a non-empty unit on every numeric column (e.g. °C, s, %, cm³, g).");
  }
  if ((issues || []).some((i) => String(i).startsWith("data_table_row_count"))) {
    focus.push("Add enough data rows (minimum 3). Never return only 2 rows.");
  }
  if ((issues || []).some((i) => String(i).startsWith("extreme_answer_mismatch"))) {
    focus.push(
      "Recompute highest/lowest answers from the table and put the correct value in markSchemeLines."
    );
  }
  if ((issues || []).some((i) => String(i).startsWith("trend_contradiction"))) {
    focus.push(
      "Rewrite trend markSchemeLines so they match the actual increase/decrease pattern in the numeric data column."
    );
  }
  if ((issues || []).some((i) => String(i).includes("mcq") || String(i).includes("unsupported_type"))) {
    focus.push('Use type "short" only. Remove any mcq/table parts.');
  }

  return `Repair this invalid ${difficulty} data-table composite exam draft.

Subject: ${subject}
Exam board: ${examBoard || "(unspecified)"}
Level: ${level || "(unspecified)"}
Topic: ${topic || "(from topicKey)"}
topicKey: ${topicKey}
Preferred title hint: ${preferredTitle || "(none)"}

Validation errors to fix:
${issueList}

Priority fixes:
${focus.length ? focus.map((f) => `- ${f}`).join("\n") : "- Fix every validation error listed above."}

Invalid draft JSON:
${JSON.stringify(invalidDraft)}

Return ONE corrected full JSON draft that satisfies ALL rules:
- parts: ${band.minParts}-${band.maxParts} (ALL type "short")
- totalMarks: ${band.minMarks}-${band.maxMarks}
- style: ${mixHint}
- dataTable.rows MUST have ${rowTargetHint(difficulty)}
- Do not return only 2 rows. A 2-row table is invalid.
- Every row length must equal columns length; no blank cells; units on numeric columns
- FORBIDDEN: type "mcq"; type "table"; fill-in blanks; diagrams/graphs/images
- Keep mark schemes consistent with the corrected table values
- If a part asks for highest/lowest/trend, recompute from the table before writing markSchemeLines

Return JSON only.`;
}

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
- REQUIRED: dataTable with 2–5 columns
- REQUIRED: dataTable.rows = ${rowTargetHint(difficulty)}
- Do not return only 2 rows. A 2-row table is invalid.
- Every row must match column count; no blank cells; units on numeric columns
- Prefer quantitative experimental results (measurements over time/temperature/concentration), not vague two-row comparison lists.
- FORBIDDEN: type "mcq"; type "table"; fill-in blanks; diagrams/graphs/images

Return JSON only.`;

  const temperature = difficulty === "hard" ? 0.35 : 0.25;

  let parsed;
  try {
    parsed = await callOpenAiJson({
      system: SYSTEM,
      user,
      temperature,
    });
  } catch (e) {
    if (e && (e.code === "LLM_NOT_CONFIGURED" || e.code === "LLM_EMPTY" || e.code === "LLM_BAD_JSON")) {
      e.statusCode = 503;
    }
    throw e;
  }

  let candidate = {
    ...parsed,
    difficulty,
    questionStyle: "data_table",
  };

  let validated = validateCompositeDataTableAiDraft(candidate, { difficulty });
  if (validated.ok) {
    return validated.draft;
  }

  let lastIssues = validated.issues || [];
  let lastMsg = validated.msg || "AI data-table draft failed validation.";

  for (let attempt = 1; attempt <= MAX_REPAIR_ATTEMPTS; attempt += 1) {
    if (!isRepairableDraftFailure(lastIssues)) break;

    let repairedParsed;
    try {
      repairedParsed = await callOpenAiJson({
        system: SYSTEM,
        user: buildRepairUser({
          subject,
          examBoard,
          level,
          topic,
          topicKey,
          preferredTitle,
          difficulty,
          band,
          mixHint,
          issues: lastIssues,
          invalidDraft: candidate,
        }),
        temperature: Math.min(temperature, 0.2),
      });
    } catch (e) {
      if (e && (e.code === "LLM_NOT_CONFIGURED" || e.code === "LLM_EMPTY" || e.code === "LLM_BAD_JSON")) {
        e.statusCode = 503;
        throw e;
      }
      break;
    }

    candidate = {
      ...repairedParsed,
      difficulty,
      questionStyle: "data_table",
    };
    validated = validateCompositeDataTableAiDraft(candidate, { difficulty });
    if (validated.ok) {
      return validated.draft;
    }
    lastIssues = validated.issues || [];
    lastMsg = validated.msg || lastMsg;
  }

  const err = new Error(lastMsg);
  err.statusCode = 422;
  err.code = "AI_DRAFT_INVALID";
  err.issues = lastIssues;
  throw err;
}

module.exports = {
  generateCompositeDataTableDraft,
  SYSTEM,
  MAX_REPAIR_ATTEMPTS,
  isRepairableDraftFailure,
  rowTargetHint,
};
