/**
 * Composite Exam Question V1 helpers.
 *
 * A composite question stores one shared stem/image plus an ordered list of sub-parts.
 * These helpers normalise incoming payloads and validate them for draft (lenient) and
 * publish (strict), mirroring the "draft lenient, publish strict" rule used for single
 * questions.
 */

const PART_TYPES = ["mcq", "short"];
const DEFAULT_LABELS = "abcdefghijklmnopqrstuvwxyz".split("");

function isCompositePayload(body) {
  if (!body) return false;
  return (
    String(body.questionMode || "").toLowerCase() === "composite" ||
    String(body.type || "").toLowerCase() === "composite"
  );
}

/** Clean a single incoming part into the stored shape. */
function normalizePart(rawPart, index) {
  const part = rawPart && typeof rawPart === "object" ? rawPart : {};
  const type = PART_TYPES.includes(String(part.type || "").toLowerCase())
    ? String(part.type).toLowerCase()
    : "short";
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
  return {
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
  computeTotalMarks,
  buildCompositeFields,
  validateCompositeDraft,
  validateCompositePublish,
};
