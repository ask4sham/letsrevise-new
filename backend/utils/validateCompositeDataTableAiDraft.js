/**
 * Validate AI-generated data-table composite drafts (V1).
 * Display-only stimulus + short parts only — never type "table" / MCQ / fill-in blanks.
 * Pure — no DB, no LLM.
 */

const DIFFICULTIES = Object.freeze({
  easy: { minMarks: 2, maxMarks: 4, minParts: 2, maxParts: 3 },
  medium: { minMarks: 4, maxMarks: 6, minParts: 3, maxParts: 3 },
  hard: { minMarks: 6, maxMarks: 9, minParts: 3, maxParts: 4 },
});

const ALLOWED_PART_TYPES = new Set(["short"]);
const LABELS = "abcdefghijklmnopqrstuvwxyz";

const IMAGE_LANGUAGE_RE =
  /\b(the\s+diagram\s+shows|diagram\s+shows|the\s+figure\s+shows|figure\s+shows|the\s+image\s+shows|look\s+at\s+the\s+(diagram|figure|graph|image|photograph)|shown\s+in\s+the\s+(diagram|figure|graph|image)|the\s+graph\s+shows|the\s+photograph\s+shows|as\s+shown\s+in\s+the\s+(diagram|figure))\b/i;

const US_SPELLING_RE =
  /\b(color|analyze|organize|favor|behavior|center|fiber|defense|offense|modeling)\b/i;

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

function isNumericCell(value) {
  const s = String(value ?? "")
    .trim()
    .replace(/,/g, "");
  if (!s) return false;
  return /^-?\d+(\.\d+)?([eE][+-]?\d+)?%?$/.test(s);
}

function parseNumeric(value) {
  const s = String(value ?? "")
    .trim()
    .replace(/,/g, "")
    .replace(/%$/, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function columnLooksNumeric(rows, colIndex) {
  let numeric = 0;
  let total = 0;
  for (const row of rows) {
    const cell = row[colIndex];
    if (cell == null || String(cell).trim() === "") continue;
    total += 1;
    if (isNumericCell(cell)) numeric += 1;
  }
  return total > 0 && numeric / total >= 0.6;
}

function headingHasUnitHint(heading, unit) {
  const h = String(heading || "").trim();
  const u = String(unit || "").trim();
  if (u) return true;
  return /\([^)]+\)|°|%|\/|per\b/i.test(h);
}

/**
 * @param {unknown} rawTable
 * @returns {{ ok: true, table: object, warnings: string[] } | { ok: false, issues: string[] }}
 */
function normalizeAndValidateDataTable(rawTable) {
  const issues = [];
  const warnings = [];
  if (!rawTable || typeof rawTable !== "object" || Array.isArray(rawTable)) {
    return { ok: false, issues: ["data_table_missing"] };
  }

  const title = String(rawTable.title || "").trim();
  if (!title || title.length < 3) {
    issues.push("data_table_title_weak");
  }

  const rawColumns = Array.isArray(rawTable.columns) ? rawTable.columns : null;
  if (!rawColumns) {
    return { ok: false, issues: ["data_table_columns_missing"] };
  }
  if (rawColumns.length < 2 || rawColumns.length > 5) {
    issues.push(`data_table_column_count:${rawColumns.length}_expected_2-5`);
  }

  const columns = rawColumns.map((c, i) => {
    if (!c || typeof c !== "object") {
      issues.push(`data_table_column_invalid:${i}`);
      return { heading: "", unit: "" };
    }
    const heading = String(c.heading || "").trim();
    const unit = String(c.unit || "").trim();
    if (!heading || heading.length < 2) {
      issues.push(`data_table_heading_unclear:col_${i}`);
    }
    return { heading, unit };
  });

  const rawRows = Array.isArray(rawTable.rows) ? rawTable.rows : null;
  if (!rawRows) {
    return { ok: false, issues: [...issues, "data_table_rows_missing"] };
  }
  if (rawRows.length < 3 || rawRows.length > 6) {
    issues.push(`data_table_row_count:${rawRows.length}_expected_3-6`);
  }

  const colCount = columns.length;
  const rows = [];
  for (let r = 0; r < rawRows.length; r += 1) {
    const row = rawRows[r];
    if (!Array.isArray(row)) {
      issues.push(`data_table_row_not_array:${r}`);
      continue;
    }
    if (colCount > 0 && row.length !== colCount) {
      issues.push(`data_table_row_length_mismatch:row_${r}_got_${row.length}_expected_${colCount}`);
    }
    const cells = row.map((cell, c) => {
      const value = String(cell ?? "").trim();
      if (!value) {
        issues.push(`data_table_blank_cell:row_${r}_col_${c}`);
      }
      return value;
    });
    rows.push(cells);
  }

  for (let c = 0; c < columns.length; c += 1) {
    if (columnLooksNumeric(rows, c) && !headingHasUnitHint(columns[c].heading, columns[c].unit)) {
      issues.push(`data_table_missing_unit:col_${c}`);
    }
  }

  if (issues.length) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    table: { title, columns, rows },
    warnings,
  };
}

function findColumnIndex(columns, nameHint) {
  const hint = String(nameHint || "")
    .trim()
    .toLowerCase();
  if (!hint) return -1;
  return columns.findIndex((col) => {
    const h = String(col.heading || "")
      .trim()
      .toLowerCase();
    return h === hint || h.includes(hint) || hint.includes(h);
  });
}

function columnValues(table, colIndex) {
  return table.rows.map((row) => parseNumeric(row[colIndex]));
}

function checkHighestLowestConsistency(part, table, issues, warnings) {
  const text = `${part.questionText} ${part.skill} ${part.dataDependency}`.toLowerCase();
  const wantsHighest = /\b(highest|maximum|max|greatest)\b/.test(text);
  const wantsLowest = /\b(lowest|minimum|min|smallest)\b/.test(text);
  if (!wantsHighest && !wantsLowest) return;

  // Prefer Rate / Time / Temperature numeric columns referenced in dependency/question.
  let colIndex = -1;
  for (const hint of ["rate", "time", "temperature", "mass", "volume", "concentration", "percentage", "%"]) {
    if (text.includes(hint)) {
      colIndex = findColumnIndex(table.columns, hint);
      if (colIndex >= 0) break;
    }
  }
  if (colIndex < 0) {
    // Fall back to last numeric column
    for (let c = table.columns.length - 1; c >= 0; c -= 1) {
      if (columnLooksNumeric(table.rows, c)) {
        colIndex = c;
        break;
      }
    }
  }
  if (colIndex < 0) {
    warnings.push(`could_not_verify_extreme:part_${part.label}`);
    return;
  }

  const values = columnValues(table, colIndex);
  if (values.some((v) => v == null)) {
    warnings.push(`extreme_non_numeric:part_${part.label}`);
    return;
  }

  let targetIdx = 0;
  for (let i = 1; i < values.length; i += 1) {
    if (wantsHighest && values[i] > values[targetIdx]) targetIdx = i;
    if (wantsLowest && values[i] < values[targetIdx]) targetIdx = i;
  }

  const scheme = part.markSchemeLines.join(" ").toLowerCase();
  const expectedCell = String(table.rows[targetIdx][colIndex]).toLowerCase();
  // Also accept the paired first-column label (e.g. temperature at max rate)
  const paired = String(table.rows[targetIdx][0] || "").toLowerCase();
  const mentionsExpected =
    (expectedCell && scheme.includes(expectedCell)) ||
    (paired && scheme.includes(paired));

  if (!mentionsExpected) {
    issues.push(`extreme_answer_mismatch:part_${part.label}`);
  }
}

function checkTrendConsistency(part, table, issues, warnings) {
  const text = `${part.questionText} ${part.skill} ${part.dataDependency}`.toLowerCase();
  if (!/\b(trend|increases?|decreases?|rises?|falls?)\b/.test(text)) return;

  // Only hard-check trends on clearly quantitative series (avoid comparison/text tables).
  let colIndex = findColumnIndex(table.columns, "rate");
  if (colIndex < 0) {
    for (let c = table.columns.length - 1; c >= 0; c -= 1) {
      if (columnLooksNumeric(table.rows, c) && c > 0) {
        colIndex = c;
        break;
      }
    }
  }
  if (colIndex < 0 || !columnLooksNumeric(table.rows, colIndex)) {
    warnings.push(`could_not_verify_trend:part_${part.label}`);
    return;
  }

  const values = columnValues(table, colIndex);
  if (values.some((v) => v == null) || values.length < 3) {
    warnings.push(`trend_non_numeric:part_${part.label}`);
    return;
  }

  let ups = 0;
  let downs = 0;
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] > values[i - 1]) ups += 1;
    if (values[i] < values[i - 1]) downs += 1;
  }

  const scheme = part.markSchemeLines.join(" ").toLowerCase();
  const mentionsIncrease = /\b(increase|increases|rising|rises|higher)\b/.test(scheme);
  const mentionsDecrease = /\b(decrease|decreases|falling|falls|lower|denatur)\b/.test(scheme);

  const overallTrend =
    /\bdescribe the trend\b/.test(text) ||
    String(part.skill || "")
      .toLowerCase()
      .includes("describe_trend");
  const scopedSegment = /\bfrom\b.+\bto\b/.test(text);

  if (ups > 0 && downs === 0 && !mentionsIncrease) {
    issues.push(`trend_contradiction:part_${part.label}_expected_increase`);
  } else if (downs > 0 && ups === 0 && !mentionsDecrease) {
    issues.push(`trend_contradiction:part_${part.label}_expected_decrease`);
  } else if (ups > 0 && downs > 0 && overallTrend && !scopedSegment) {
    if (/\b(constant|no change|unchanged|stays the same|does not change)\b/.test(scheme)) {
      issues.push(`trend_contradiction:part_${part.label}_claimed_constant`);
    } else if (!(mentionsIncrease && mentionsDecrease)) {
      // Soft: peak patterns are common; teacher reviews incomplete wording.
      warnings.push(`trend_pattern_unclear:part_${part.label}_expected_increase_and_decrease`);
    }
  } else if (ups > 0 && downs > 0 && scopedSegment) {
    if (!mentionsIncrease && !mentionsDecrease) {
      warnings.push(`trend_direction_unclear:part_${part.label}`);
    }
  }
}

function validateDataDependency(part, table, issues, warnings) {
  const dep = String(part.dataDependency || "").trim();
  if (!dep || dep.length < 4) {
    issues.push(`data_dependency_missing:part_${part.label}`);
    return;
  }
  const depLower = dep.toLowerCase();
  const headingHit = table.columns.some((c) => {
    const h = String(c.heading || "")
      .trim()
      .toLowerCase();
    return h && (depLower.includes(h) || h.includes(depLower.slice(0, Math.min(12, depLower.length))));
  });
  const genericHit =
    /\b(row|column|table|rate|trend|temperature|time|value|result|data|compare|comparison|method|type)\b/i.test(
      dep
    );
  if (!headingHit && !genericHit) {
    // Soft: keep editable; teacher can fix dependency wording.
    warnings.push(`data_dependency_unknown:part_${part.label}`);
  }
}

/**
 * @param {unknown} raw
 * @param {{ difficulty: string }} opts
 * @returns {{ ok: true, draft: object } | { ok: false, msg: string, issues: string[] }}
 */
function validateCompositeDataTableAiDraft(raw, opts = {}) {
  const issues = [];
  const warnings = [];
  const difficulty = normalizeDifficulty(opts.difficulty);
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

  const tableResult = normalizeAndValidateDataTable(raw.dataTable);
  if (!tableResult.ok) {
    issues.push(...tableResult.issues);
  } else {
    warnings.push(...(tableResult.warnings || []));
  }
  const table = tableResult.ok ? tableResult.table : null;

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

  for (let i = 0; i < raw.parts.length; i += 1) {
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
    if (type === "table") {
      issues.push(`unsupported_type:table`);
    } else if (type === "mcq") {
      issues.push(`mcq_not_allowed_in_data_table_mode`);
    } else if (!ALLOWED_PART_TYPES.has(type)) {
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

    const partOut = {
      label: expectedLabel,
      type: "short",
      marks: Number.isFinite(marks) ? marks : 0,
      questionText,
      markSchemeLines,
      commandWord: p.commandWord != null ? String(p.commandWord).trim() : "",
      skill: p.skill != null ? String(p.skill).trim() : "",
      dataDependency: p.dataDependency != null ? String(p.dataDependency).trim() : "",
    };

    if (table) {
      validateDataDependency(partOut, table, issues, warnings);
      checkHighestLowestConsistency(partOut, table, issues, warnings);
      checkTrendConsistency(partOut, table, issues, warnings);
    }

    parts.push(partOut);
  }

  const sumMarks = parts.reduce((s, p) => s + (Number.isFinite(p.marks) ? p.marks : 0), 0);
  const totalMarksRaw = Number(raw.totalMarks);
  if (!Number.isFinite(totalMarksRaw) || totalMarksRaw !== sumMarks) {
    issues.push(`total_marks_mismatch:declared_${totalMarksRaw}_sum_${sumMarks}`);
  }
  if (sumMarks < band.minMarks || sumMarks > band.maxMarks) {
    issues.push(`total_marks_out_of_band:${sumMarks}_expected_${band.minMarks}-${band.maxMarks}`);
  }

  const combinedText = [title, sharedStem, ...parts.map((p) => p.questionText)].join("\n");
  if (IMAGE_LANGUAGE_RE.test(combinedText)) {
    issues.push("image_language_without_image");
  }
  if (US_SPELLING_RE.test(combinedText)) {
    issues.push("non_british_spelling");
  }

  const incomingWarnings = Array.isArray(raw.warnings)
    ? raw.warnings.map((w) => String(w || "").trim()).filter(Boolean)
    : [];

  if (issues.length) {
    return {
      ok: false,
      msg: "AI data-table draft failed validation.",
      issues,
    };
  }

  return {
    ok: true,
    draft: {
      title,
      sharedStem,
      difficulty,
      questionStyle: "data_table",
      totalMarks: sumMarks,
      dataTable: table,
      parts,
      warnings: [...incomingWarnings, ...warnings],
    },
  };
}

module.exports = {
  DIFFICULTIES,
  ALLOWED_PART_TYPES,
  IMAGE_LANGUAGE_RE,
  getDifficultyBand,
  normalizeDifficulty,
  normalizeAndValidateDataTable,
  validateCompositeDataTableAiDraft,
};
