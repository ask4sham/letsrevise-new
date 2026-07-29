/**
 * Generate a composite exam question draft via LLM (no DB write).
 * V1.1+: exactly one MCQ + remaining short parts; no table.
 * V2.1: every MCQ part must include a substantive `explanation` (transient AI field).
 * Max LLM calls: 1 initial + 1 focused repair.
 */
const { callOpenAiJson } = require("../utils/lessonAssetLlm");
const {
  DIFFICULTIES,
  normalizeDifficulty,
  validateCompositeExamAiDraft,
} = require("../utils/validateCompositeExamAiDraft");

/** One initial generation + at most one repair. */
const MAX_REPAIR_ATTEMPTS = 1;

const SYSTEM = `You are an experienced UK secondary science exam writer (GCSE / IGCSE style).
Create ONE composite exam question draft as strict JSON only.

Hard requirements (do not break these):
- You MUST include exactly one part with type "mcq".
- You MUST include at least one part with type "short".
- You MUST NOT use type "table" or any other type.
- The MCQ must have exactly 4 distinct non-empty plausible options.
- The MCQ must have one correct answer via correctIndex (0–3).
- The MCQ must be worth exactly 1 mark.
- The MCQ MUST include "explanation": a meaningful educational rationale for why the correct option is correct.
- Remaining parts must be short-answer questions.
- Labels must be sequential: a, then b, then c…
- totalMarks must equal the sum of part marks.

MCQ explanation rules (mandatory):
- Explain the subject knowledge behind the correct option.
- Use the subject, exam board, level/tier and topic context.
- Plain student-facing text; approximately 1–3 sentences; at most 1000 characters.
- Explain a reason, mechanism, distinction or calculation where appropriate.
- Do NOT simply repeat the correct option text.
- Do NOT state only the answer letter (e.g. "C" or "Option C").
- Do NOT use marking administration ("Award 1 mark", "Accept…").
- Do NOT say: "This is correct", "The answer is C", "The selected response matches the correct answer".
- Do NOT change or question correctIndex.
- Do NOT include markdown headings or HTML.
- Mention distractors only when brief and genuinely useful.

Good explanation example:
"Light is not essential because the seed initially uses energy stored in its food reserves. Water activates enzymes, oxygen is required for aerobic respiration, and a suitable temperature allows enzyme-controlled reactions to occur."

Bad explanation examples (never use):
- "Light."
- "The answer is C."
- "This is correct because it is Light."
- "Award 1 mark for selecting Option C."
- "The selected response matches the correct answer."

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
      "explanation": "Why the correct option is correct (MCQ only — mandatory educational rationale).",
      "markSchemeLines": ["Award 1 mark for..."],
      "commandWord": "Explain",
      "skill": "explain"
    }
  ],
  "warnings": []
}
For short parts omit options/correctIndex/explanation (or leave empty). For the required mcq part, options, correctIndex and explanation are mandatory.`;

function isRepairableDraftFailure(issues) {
  if (!Array.isArray(issues) || !issues.length) return false;
  if (issues.includes("not_object") || issues.includes("invalid_difficulty")) return false;
  return true;
}

function hasStableMcqScoring(part) {
  if (!part || typeof part !== "object") return false;
  if (String(part.type || "").toLowerCase() !== "mcq") return false;
  const options = Array.isArray(part.options)
    ? part.options.map((o) => String(o || "").trim())
    : [];
  if (options.length !== 4 || options.some((o) => !o)) return false;
  const ci = Number(part.correctIndex);
  return Number.isInteger(ci) && ci >= 0 && ci <= 3;
}

/**
 * After repair, keep original scoring/structure when the first draft already had a stable MCQ.
 * Explanation (and other weak fields) come from the repaired draft.
 */
function mergeRepairPreservingStructure(originalCandidate, repairedParsed, difficulty) {
  const originalParts = Array.isArray(originalCandidate?.parts) ? originalCandidate.parts : [];
  const repairedParts = Array.isArray(repairedParsed?.parts) ? repairedParsed.parts : [];
  if (!originalParts.length || repairedParts.length !== originalParts.length) {
    return { ...repairedParsed, difficulty };
  }

  const mergedParts = repairedParts.map((rp, i) => {
    const op = originalParts[i];
    if (!op || typeof op !== "object") return rp;
    const opType = String(op.type || "").toLowerCase();
    const label = String(op.label || rp.label || "").trim().toLowerCase() || String(rp.label || "");

    if (opType === "mcq" && hasStableMcqScoring(op)) {
      return {
        ...rp,
        label,
        type: "mcq",
        marks: op.marks,
        options: op.options,
        correctIndex: op.correctIndex,
        questionText:
          String(op.questionText || "").trim().length >= 8 ? op.questionText : rp.questionText,
        markSchemeLines:
          Array.isArray(op.markSchemeLines) && op.markSchemeLines.length
            ? op.markSchemeLines
            : rp.markSchemeLines,
        commandWord: op.commandWord != null ? op.commandWord : rp.commandWord,
        skill: op.skill != null ? op.skill : rp.skill,
        explanation: rp.explanation,
      };
    }

    return {
      ...rp,
      label,
      type: opType || rp.type,
      marks: op.marks != null ? op.marks : rp.marks,
      questionText:
        String(op.questionText || "").trim().length >= 8 ? op.questionText : rp.questionText,
      markSchemeLines:
        Array.isArray(op.markSchemeLines) && op.markSchemeLines.length
          ? op.markSchemeLines
          : rp.markSchemeLines,
      commandWord: op.commandWord != null ? op.commandWord : rp.commandWord,
      skill: op.skill != null ? op.skill : rp.skill,
    };
  });

  return {
    ...repairedParsed,
    difficulty,
    title: String(originalCandidate.title || "").trim() || repairedParsed.title,
    sharedStem: String(originalCandidate.sharedStem || "").trim() || repairedParsed.sharedStem,
    parts: mergedParts,
  };
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
  hasImage,
  issues,
  invalidDraft,
}) {
  const issueList = (issues || []).map((i) => `- ${i}`).join("\n");
  const focus = [];
  if ((issues || []).some((i) => String(i).includes("explanation"))) {
    focus.push(
      "Provide a substantive MCQ explanation (1–3 sentences) that teaches why the correct option is right. Do not repeat the option alone, do not use mark-scheme language, and do not invent a different correct answer."
    );
  }

  return `Repair this invalid ${difficulty} composite exam question draft.

Subject: ${subject}
Exam board: ${examBoard || "(unspecified)"}
Level: ${level || "(unspecified)"}
Topic: ${topic || "(from topicKey)"}
topicKey: ${topicKey}
Preferred title hint: ${preferredTitle || "(none)"}
hasImage: ${hasImage ? "true" : "false"}

Validation errors to fix:
${issueList}

Priority fixes:
${focus.length ? focus.map((f) => `- ${f}`).join("\n") : "- Fix every validation error listed above."}

Preserve where already valid:
- sharedStem
- question wording
- options
- correctIndex
- marks
- markSchemeLines
- labels
- part ordering
- totalMarks consistency

Correct only missing or weak fields — especially the MCQ explanation.
Do NOT change the correct answer (correctIndex / options) unless the draft is structurally unusable.
Do NOT invent a generic fallback explanation such as "This is correct" or "The selected response matches the correct answer".

Invalid draft JSON:
${JSON.stringify(invalidDraft)}

Return ONE corrected full JSON draft that satisfies ALL rules:
- parts: ${band.minParts}-${band.maxParts}
- totalMarks: ${band.minMarks}-${band.maxMarks}
- REQUIRED mix: ${mixHint}
- REQUIRED: exactly one type "mcq" part with options, correctIndex and explanation
- REQUIRED: at least one type "short" part
- FORBIDDEN: type "table"; short-only drafts; more than one MCQ

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
- REQUIRED: the MCQ part must include a substantive "explanation" field.
- FORBIDDEN: type "table"; short-only drafts; more than one MCQ.

${hasImage ? "An image is already attached; you may refer to it carefully if useful." : "No image is attached. Do not mention diagrams, figures, graphs, photographs, or images."}

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
  };

  let validated = validateCompositeExamAiDraft(candidate, { difficulty, hasImage });
  if (validated.ok) {
    return validated.draft;
  }

  let lastIssues = validated.issues || [];
  let lastMsg = validated.msg || "AI draft failed validation.";

  if (!isRepairableDraftFailure(lastIssues)) {
    const err = new Error(lastMsg);
    err.statusCode = 422;
    err.code = "AI_DRAFT_INVALID";
    err.issues = lastIssues;
    throw err;
  }

  for (let attempt = 1; attempt <= MAX_REPAIR_ATTEMPTS; attempt += 1) {
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
          hasImage,
          issues: lastIssues,
          invalidDraft: candidate,
        }),
        temperature,
      });
    } catch (e) {
      if (e && (e.code === "LLM_NOT_CONFIGURED" || e.code === "LLM_EMPTY" || e.code === "LLM_BAD_JSON")) {
        e.statusCode = 503;
      }
      throw e;
    }

    candidate = mergeRepairPreservingStructure(candidate, repairedParsed, difficulty);
    validated = validateCompositeExamAiDraft(candidate, { difficulty, hasImage });
    if (validated.ok) {
      return validated.draft;
    }
    lastIssues = validated.issues || [];
    lastMsg = validated.msg || "AI draft failed validation.";
  }

  const err = new Error(lastMsg);
  err.statusCode = 422;
  err.code = "AI_DRAFT_INVALID";
  err.issues = lastIssues;
  throw err;
}

module.exports = {
  generateCompositeExamDraft,
  SYSTEM,
  MAX_REPAIR_ATTEMPTS,
  mergeRepairPreservingStructure,
  isRepairableDraftFailure,
};
