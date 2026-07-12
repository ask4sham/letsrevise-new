/**
 * Validate AI-generated composite exam drafts (V1: short parts only).
 * Pure — no DB, no LLM.
 */

const DIFFICULTIES = Object.freeze({
  easy: { minMarks: 2, maxMarks: 4, minParts: 1, maxParts: 2 },
  medium: { minMarks: 4, maxMarks: 6, minParts: 2, maxParts: 3 },
  hard: { minMarks: 6, maxMarks: 9, minParts: 3, maxParts: 4 },
});

const LABELS = "abcdefghijklmnopqrstuvwxyz";

const IMAGE_LANGUAGE_RE =
  /\b(the\s+diagram\s+shows|diagram\s+shows|the\s+figure\s+shows|figure\s+shows|the\s+image\s+shows|look\s+at\s+the\s+(diagram|figure|graph|image|photograph)|shown\s+in\s+the\s+(diagram|figure|graph|image)|the\s+graph\s+shows|the\s+photograph\s+shows|as\s+shown\s+in\s+the\s+(diagram|figure))\b/i;

const US_SPELLING_RE =
  /\b(color|analyze|organize| favor|behavior|center|fiber|defense|offense|modeling)\b/i;

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
    if (type !== "short") {
      issues.push(`unsupported_type:${type || "(empty)"}`);
    }

    const marks = Number(p.marks);
    if (!Number.isFinite(marks) || !Number.isInteger(marks) || marks < 1 || marks > 6) {
      issues.push(`marks_invalid:part_${expectedLabel || i}`);
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
      const needed = Number.isFinite(marks) && marks >= 1 ? Math.min(marks, 4) : 1;
      if (substantial.length < needed) {
        issues.push(`mark_scheme_weak:part_${expectedLabel || i}`);
      }
    }

    const normText = questionText.toLowerCase().replace(/\s+/g, " ");
    if (normText && seenTexts.has(normText)) {
      issues.push(`duplicate_question_text:part_${expectedLabel || i}`);
    }
    if (normText) seenTexts.add(normText);

    // Answer leakage: question contains a long mark-scheme phrase
    for (const line of markSchemeLines) {
      const phrase = line.replace(/^award\s+\d+\s+mark(?:s)?\s+for\s+/i, "").trim();
      if (phrase.length >= 18 && questionText.toLowerCase().includes(phrase.toLowerCase())) {
        issues.push(`answer_leak:part_${expectedLabel || i}`);
        break;
      }
    }
    if (/\b(the\s+answer\s+is|correct\s+answer\s*:|mark\s+scheme\s*:)\b/i.test(questionText)) {
      issues.push(`answer_leak:part_${expectedLabel || i}`);
    }

    parts.push({
      label: expectedLabel,
      type: "short",
      marks: Number.isFinite(marks) ? marks : 0,
      questionText,
      markSchemeLines,
      commandWord: p.commandWord != null ? String(p.commandWord).trim() : "",
      skill: p.skill != null ? String(p.skill).trim() : "",
    });
  }

  const sumMarks = parts.reduce((s, p) => s + (Number.isFinite(p.marks) ? p.marks : 0), 0);
  const totalMarksRaw = Number(raw.totalMarks);
  const totalMarks = Number.isFinite(totalMarksRaw) ? totalMarksRaw : sumMarks;
  if (!Number.isFinite(totalMarksRaw) || totalMarksRaw !== sumMarks) {
    issues.push(`total_marks_mismatch:declared_${totalMarksRaw}_sum_${sumMarks}`);
  }
  if (sumMarks < band.minMarks || sumMarks > band.maxMarks) {
    issues.push(`total_marks_out_of_band:${sumMarks}_expected_${band.minMarks}-${band.maxMarks}`);
  }

  const combined = `${title}\n${sharedStem}\n${parts.map((p) => p.questionText).join("\n")}`;
  if (!hasImage && IMAGE_LANGUAGE_RE.test(combined)) {
    issues.push("image_language_without_image");
  }
  if (US_SPELLING_RE.test(combined)) {
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
  IMAGE_LANGUAGE_RE,
  getDifficultyBand,
  normalizeDifficulty,
  validateCompositeExamAiDraft,
};
