/**
 * Composite Exam Question helpers (V1 + additive V2 table parts).
 *
 * V1 parts remain mcq/short with no partData.
 * V2 table parts add type "table" + partData { headers, rows }.
 * Old questions require zero migration.
 */

const PART_TYPES = ["mcq", "short", "table"];
const DEFAULT_LABELS = "abcdefghijklmnopqrstuvwxyz".split("");

function isCompositePayload(body) {
  if (!body) return false;
  return (
    String(body.questionMode || "").toLowerCase() === "composite" ||
    String(body.type || "").toLowerCase() === "composite"
  );
}

function normalizeTableCell(rawCell) {
  if (!rawCell || typeof rawCell !== "object") {
    return { value: String(rawCell ?? ""), blank: false };
  }
  return {
    value: rawCell.value != null ? String(rawCell.value) : "",
    blank: Boolean(rawCell.blank),
    correctAnswer:
      rawCell.correctAnswer != null && String(rawCell.correctAnswer).trim()
        ? String(rawCell.correctAnswer).trim()
        : undefined,
  };
}

function normalizeTablePartData(raw) {
  if (!raw || typeof raw !== "object") return null;
  const headers = Array.isArray(raw.headers)
    ? raw.headers.map((h) => String(h ?? "").trim())
    : [];
  const rows = Array.isArray(raw.rows)
    ? raw.rows
        .map((row) => {
          if (!row || typeof row !== "object") return null;
          const cells = Array.isArray(row.cells) ? row.cells.map(normalizeTableCell) : [];
          return { cells };
        })
        .filter(Boolean)
    : [];
  if (headers.length < 1 || rows.length < 1) return null;
  return { headers, rows };
}

function validateTablePartData(partData, label) {
  const data = normalizeTablePartData(partData);
  if (!data) {
    return { ok: false, msg: `Part (${label}) table needs headers and at least one row.` };
  }
  let blankCount = 0;
  for (let r = 0; r < data.rows.length; r += 1) {
    const row = data.rows[r];
    for (let c = 0; c < row.cells.length; c += 1) {
      const cell = row.cells[c];
      if (!cell.blank) continue;
      blankCount += 1;
      if (!cell.correctAnswer) {
        return {
          ok: false,
          msg: `Part (${label}) blank cell at row ${r + 1}, column ${c + 1} needs a correct answer.`,
        };
      }
    }
  }
  if (blankCount < 1) {
    return { ok: false, msg: `Part (${label}) table needs at least one blank (editable) cell.` };
  }
  return { ok: true, data };
}

/** Clean a single incoming part into the stored shape. */
function normalizePart(rawPart, index) {
  const part = rawPart && typeof rawPart === "object" ? rawPart : {};
  const rawType = String(part.type || "").toLowerCase();
  const type = PART_TYPES.includes(rawType) ? rawType : "short";
  const label =
    typeof part.label === "string" && part.label.trim()
      ? part.label.trim()
      : DEFAULT_LABELS[index] || String(index + 1);
  const marksNum = Number(part.marks);
  const marks = Number.isFinite(marksNum) && marksNum > 0 ? marksNum : 1;
  const questionText = typeof part.questionText === "string" ? part.questionText.trim() : "";
  const markScheme = Array.isArray(part.markScheme)
    ? part.markScheme.map((s) => String(s ?? "").trim()).filter(Boolean)
    : [];

  const out = { label, type, marks, questionText, markScheme };

  if (type === "mcq") {
    const options = Array.isArray(part.options)
      ? part.options.map((o) => String(o ?? "").trim()).filter(Boolean)
      : [];
    out.options = options;
    const idx = Number(part.correctIndex);
    out.correctIndex = Number.isInteger(idx) && idx >= 0 && idx < options.length ? idx : null;
  } else {
    out.options = [];
    out.correctIndex = null;
  }

  if (type === "table") {
    const tableData = normalizeTablePartData(part.partData);
    if (tableData) out.partData = tableData;
  }

  return out;
}

/** Normalise a full parts array (drops non-objects, re-labels blanks). */
function normalizeParts(rawParts) {
  if (!Array.isArray(rawParts)) return [];
  return rawParts.map((p, i) => normalizePart(p, i));
}

function computeTotalMarks(parts) {
  if (!Array.isArray(parts)) return 0;
  return parts.reduce((sum, p) => sum + (Number.isFinite(Number(p?.marks)) ? Number(p.marks) : 0), 0);
}

/**
 * Build the persisted composite fields from an incoming payload.
 * Returns an object suitable for spreading onto an ExamQuestion.
 */
function buildCompositeFields(body) {
  const parts = normalizeParts(body?.parts);
  const sharedStem = typeof body?.sharedStem === "string" ? body.sharedStem.trim() : "";
  const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim() : null;
  const totalMarks = computeTotalMarks(parts);
  const hasTable = parts.some((p) => p.type === "table");
  const fields = {
    questionMode: "composite",
    type: "composite",
    title,
    sharedStem: sharedStem || null,
    parts,
    totalMarks,
    // `question` and `marks` are required/used elsewhere; mirror shared data so
    // list views, search and legacy consumers keep working.
    question: sharedStem || title || "Composite exam question",
    marks: totalMarks,
  };
  if (hasTable) fields.schemaVersion = 2;
  return fields;
}

/** Lenient checks for saving a composite draft. */
function validateCompositeDraft(body) {
  const topicKey = String(body?.topicKey || "").trim();
  if (!topicKey) {
    return {
      ok: false,
      msg:
        "Cannot save: select a topic from the taxonomy list (canonical topicKey required so Exam Practice can match lessons).",
    };
  }
  const sharedStem = typeof body?.sharedStem === "string" ? body.sharedStem.trim() : "";
  if (!sharedStem) {
    return { ok: false, msg: "Add a shared question stem for the composite question." };
  }
  const parts = normalizeParts(body?.parts);
  if (parts.length < 1) {
    return { ok: false, msg: "Add at least one part (a, b, c…) to the composite question." };
  }
  for (const part of parts) {
    if (!part.questionText) {
      return { ok: false, msg: `Part (${part.label}) needs question text.` };
    }
    if (!(part.marks > 0)) {
      return { ok: false, msg: `Part (${part.label}) needs at least 1 mark.` };
    }
    if (part.type === "mcq") {
      if (part.options.length < 2) {
        return { ok: false, msg: `Part (${part.label}) MCQ needs at least 2 options.` };
      }
      if (part.correctIndex == null) {
        return { ok: false, msg: `Part (${part.label}) MCQ needs a selected correct option.` };
      }
    }
    if (part.type === "table") {
      const tableCheck = validateTablePartData(part.partData, part.label);
      if (!tableCheck.ok) return tableCheck;
    }
  }
  return { ok: true };
}

/** Strict checks for publishing a composite question. */
function validateCompositePublish(doc) {
  const draft = validateCompositeDraft(doc);
  if (!draft.ok) return draft;
  const parts = normalizeParts(doc?.parts);
  for (const part of parts) {
    if (part.type === "short") {
      const substantial = (part.markScheme || []).filter((l) => l.length >= 10);
      if (substantial.length < 1) {
        return {
          ok: false,
          msg: `Part (${part.label}) needs at least one substantive mark-scheme point before publishing.`,
        };
      }
    }
    if (part.type === "table") {
      const tableCheck = validateTablePartData(part.partData, part.label);
      if (!tableCheck.ok) return tableCheck;
      if ((part.markScheme || []).length < 1) {
        return {
          ok: false,
          msg: `Part (${part.label}) table needs a mark scheme before publishing.`,
        };
      }
    }
  }
  if (computeTotalMarks(parts) < 1) {
    return { ok: false, msg: "Composite question must have at least 1 total mark." };
  }
  return { ok: true };
}

module.exports = {
  PART_TYPES,
  isCompositePayload,
  normalizePart,
  normalizeParts,
  normalizeTablePartData,
  validateTablePartData,
  computeTotalMarks,
  buildCompositeFields,
  validateCompositeDraft,
  validateCompositePublish,
};
