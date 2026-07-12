/**
 * Validate AI-generated composite exam drafts (V1.1: short + mcq; no table).
 * Pure — no DB, no LLM.
 */

const DIFFICULTIES = Object.freeze({
  // Exactly one MCQ + remaining short answers (table never AI-generated).
  easy: { minMarks: 2, maxMarks: 4, minParts: 2, maxParts: 2 },
  medium: { minMarks: 4, maxMarks: 6, minParts: 3, maxParts: 3 },
  hard: { minMarks: 6, maxMarks: 9, minParts: 3, maxParts: 4 },
});

const ALLOWED_PART_TYPES = new Set(["short", "mcq"]);
const LABELS = "abcdefghijklmnopqrstuvwxyz";

const IMAGE_LANGUAGE_RE =
  /\b(the\s+diagram\s+shows|diagram\s+shows|the\s+figure\s+shows|figure\s+shows|the\s+image\s+shows|look\s+at\s+the\s+(diagram|figure|graph|image|photograph)|shown\s+in\s+the\s+(diagram|figure|graph|image)|the\s+graph\s+shows|the\s+photograph\s+shows|as\s+shown\s+in\s+the\s+(diagram|figure))\b/i;

const US_SPELLING_RE =
  /\b(color|analyze|organize| favor|behavior|center|fiber|defense|offense|modeling)\b/i;

const BANNED_MCQ_OPTION_RE = /\b(all of the above|none of the above)\b/i;

/**
 * @param {string} difficulty
 * @returns {{ minMarks: number, maxMarks: number, minParts: number, maxParts: number } | null}
 */
function getDifficultyBand(difficulty) {
  const key = String(difficulty || "")
    .trim()
    .toLowerCase();
  return DIFFICULTIES[key] || null;
}

function normalizeDifficulty(difficulty) {
  const key = String(difficulty || "")
    .trim()
    .toLowerCase();
  return DIFFICULTIES[key] ? key : null;
}

/**
 * @param {unknown} raw
 * @param {{ difficulty: string, hasImage?: boolean }} opts
 * @returns {{ ok: true, draft: object } | { ok: false, msg: string, issues: string[] }}
 */
function validateCompositeExamAiDraft(raw, opts = {}) {
  const issues = [];
  const difficulty = normalizeDifficulty(opts.difficulty);
  const hasImage = Boolean(opts.hasImage);
  const band = difficulty ? DIFFICULTIES[difficulty] : null;

  if (!difficulty || !band) {
    return { ok: false, msg: "difficulty must be easy, medium, or hard.", issues: ["invalid_difficulty"] };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, msg: "AI draft must be a JSON object.", issues: ["not_object"] };
  }

  const title = String(raw.title || "").trim();
  if (!title || title.length < 5) {
    issues.push("title_missing_or_weak");
  }

  const sharedStem = String(raw.sharedStem || "").trim();
  if (!sharedStem || sharedStem.length < 12) {
    issues.push("shared_stem_missing");
  }

  if (!Array.isArray(raw.parts) || raw.parts.length < 1) {
    issues.push("parts_missing");
    return {
      ok: false,
      msg: "AI draft is missing a valid parts array.",
      issues,
    };
  }

  if (raw.parts.length < band.minParts || raw.parts.length > band.maxParts) {
    issues.push(
      `parts_count_out_of_band:${raw.parts.length}_expected_${band.minParts}-${band.maxParts}`
    );
  }

  const parts = [];
  const seenTexts = new Set();
  let mcqCount = 0;
  let shortCount = 0;

  for (let i = 0; i < raw.parts.length; i++) {
    const p = raw.parts[i];
    if (!p || typeof p !== "object") {
      issues.push(`part_${i}_invalid`);
      continue;
    }
    const expectedLabel = LABELS[i];
    const label = String(p.label || "")
      .trim()
      .toLowerCase();
    if (label !== expectedLabel) {
      issues.push(`label_not_sequential:expected_${expectedLabel}_got_${label || "(empty)"}`);
    }

    const type = String(p.type || "")
      .trim()
      .toLowerCase();
    if (!ALLOWED_PART_TYPES.has(type)) {
      issues.push(`unsupported_type:${type || "(empty)"}`);
    }
    if (type === "mcq") mcqCount += 1;
    if (type === "short") shortCount += 1;

    const marks = Number(p.marks);
    if (!Number.isFinite(marks) || !Number.isInteger(marks) || marks < 1 || marks > 6) {
      issues.push(`marks_invalid:part_${expectedLabel || i}`);
    }
    if (type === "mcq" && marks !== 1) {
      issues.push(`mcq_marks_must_be_1:part_${expectedLabel || i}`);
    }

    const questionText = String(p.questionText || "").trim();
    if (!questionText || questionText.length < 8) {
      issues.push(`question_text_empty:part_${expectedLabel || i}`);
    }

    const markSchemeLines = Array.isArray(p.markSchemeLines)
      ? p.markSchemeLines.map((l) => String(l || "").trim()).filter(Boolean)
      : [];
    if (markSchemeLines.length < 1) {
      issues.push(`mark_scheme_empty:part_${expectedLabel || i}`);
    } else {
      const substantial = markSchemeLines.filter((l) => l.length >= 10);
      const needed =
        type === "mcq"
          ? 1
          : Number.isFinite(marks) && marks >= 1
            ? Math.min(marks, 4)
            : 1;
      if (substantial.length < needed) {
        issues.push(`mark_scheme_weak:part_${expectedLabel || i}`);
      }
    }

    /** @type {string[]} */
    let options = [];
    /** @type {number | null} */
    let correctIndex = null;

    if (type === "mcq") {
      options = Array.isArray(p.options)
        ? p.options.map((o) => String(o || "").trim())
        : [];
      if (options.length !== 4) {
        issues.push(`mcq_options_count:part_${expectedLabel || i}`);
      }
      if (options.some((o) => !o)) {
        issues.push(`mcq_options_empty:part_${expectedLabel || i}`);
      }
      if (options.some((o) => BANNED_MCQ_OPTION_RE.test(o))) {
        issues.push(`mcq_banned_option:part_${expectedLabel || i}`);
      }
      const norms = options.map((o) => o.toLowerCase());
      if (new Set(norms).size !== norms.length) {
        issues.push(`mcq_options_duplicate:part_${expectedLabel || i}`);
      }
      const ci = Number(p.correctIndex);
      if (!Number.isInteger(ci) || ci < 0 || ci > 3) {
        issues.push(`mcq_correct_index_invalid:part_${expectedLabel || i}`);
      } else {
        correctIndex = ci;
        // Mark scheme should reference the correct choice somehow
        const correctOpt = options[ci] || "";
        const letter = String.fromCharCode(65 + ci); // A/B/C/D
        const schemeJoined = markSchemeLines.join(" ").toLowerCase();
        const mentions =
          (correctOpt && schemeJoined.includes(correctOpt.toLowerCase())) ||
          schemeJoined.includes(`option ${letter.toLowerCase()}`) ||
          schemeJoined.includes(`(${letter.toLowerCase()})`) ||
          new RegExp(`\\b${letter.toLowerCase()}\\b`).test(schemeJoined);
        if (!mentions) {
          issues.push(`mcq_mark_scheme_missing_correct:part_${expectedLabel || i}`);
        }
        // Question must not include the correct option text verbatim (answer leak)
        if (correctOpt.length >= 8 && questionText.toLowerCase().includes(correctOpt.toLowerCase())) {
          issues.push(`answer_leak:part_${expectedLabel || i}`);
        }
      }
    }

    const normText = questionText.toLowerCase().replace(/\s+/g, " ");
    if (normText && seenTexts.has(normText)) {
      issues.push(`duplicate_question_text:part_${expectedLabel || i}`);
    }
    if (normText) seenTexts.add(normText);

    // Answer leakage: question contains a long mark-scheme phrase (short parts)
    if (type === "short") {
      for (const line of markSchemeLines) {
        const phrase = line.replace(/^award\s+\d+\s+mark(?:s)?\s+for\s+/i, "").trim();
        if (phrase.length >= 18 && questionText.toLowerCase().includes(phrase.toLowerCase())) {
          issues.push(`answer_leak:part_${expectedLabel || i}`);
          break;
        }
      }
    }
    if (/\b(the\s+answer\s+is|correct\s+answer\s*:|mark\s+scheme\s*:)\b/i.test(questionText)) {
      issues.push(`answer_leak:part_${expectedLabel || i}`);
    }

    const partOut = {
      label: expectedLabel,
      type: ALLOWED_PART_TYPES.has(type) ? type : "short",
      marks: Number.isFinite(marks) ? marks : 0,
      questionText,
      markSchemeLines,
      commandWord: p.commandWord != null ? String(p.commandWord).trim() : "",
      skill: p.skill != null ? String(p.skill).trim() : "",
    };
    if (type === "mcq") {
      partOut.options = options;
      partOut.correctIndex = correctIndex;
    }
    parts.push(partOut);
  }

  if (mcqCount !== 1) {
    issues.push(mcqCount === 0 ? "mcq_required_exactly_one" : `too_many_mcq_parts:${mcqCount}_max_1`);
  }
  if (shortCount < 1) {
    issues.push("short_part_required");
  }

  const sumMarks = parts.reduce((s, p) => s + (Number.isFinite(p.marks) ? p.marks : 0), 0);
  const totalMarksRaw = Number(raw.totalMarks);
  if (!Number.isFinite(totalMarksRaw) || totalMarksRaw !== sumMarks) {
    issues.push(`total_marks_mismatch:declared_${totalMarksRaw}_sum_${sumMarks}`);
  }
  if (sumMarks < band.minMarks || sumMarks > band.maxMarks) {
    issues.push(`total_marks_out_of_band:${sumMarks}_expected_${band.minMarks}-${band.maxMarks}`);
  }

  const combinedText = [
    title,
    sharedStem,
    ...parts.map((p) => p.questionText),
    ...parts.flatMap((p) => (Array.isArray(p.options) ? p.options : [])),
  ].join("\n");
  if (!hasImage && IMAGE_LANGUAGE_RE.test(combinedText)) {
    issues.push("image_language_without_image");
  }
  if (US_SPELLING_RE.test(combinedText)) {
    issues.push("non_british_spelling");
  }

  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.map((w) => String(w || "").trim()).filter(Boolean)
    : [];

  if (issues.length) {
    return {
      ok: false,
      msg: "AI draft failed validation.",
      issues,
    };
  }

  return {
    ok: true,
    draft: {
      title,
      sharedStem,
      difficulty,
      totalMarks: sumMarks,
      parts,
      warnings,
    },
  };
}

module.exports = {
  DIFFICULTIES,
  ALLOWED_PART_TYPES,
  IMAGE_LANGUAGE_RE,
  getDifficultyBand,
  normalizeDifficulty,
  validateCompositeExamAiDraft,
};
