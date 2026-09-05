/**
 * Block 28 Phase 2 — deterministic and heuristic quality gates (read-only).
 */
const { normalizeMarkSchemeLines, validateShortMarksMarkSchemeInvariant } = require("../../../lib/block28PracticePolicy");

function normalizeForCompare(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function jaccardSimilarity(a, b) {
  const sa = new Set(normalizeForCompare(a).split(" ").filter((w) => w.length > 2));
  const sb = new Set(normalizeForCompare(b).split(" ").filter((w) => w.length > 2));
  if (!sa.size && !sb.size) return 1;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  const union = sa.size + sb.size - inter;
  return union ? inter / union : 0;
}

function looksLikeCombinedMarkBullet(line) {
  const lower = String(line || "").toLowerCase();
  const andCount = (lower.match(/\band\b/g) || []).length;
  return andCount >= 2 || (/\band\b/.test(lower) && /\b(because|so that|which)\b/.test(lower));
}

function looksLikeAlternativeBullet(line) {
  return /\s+\/\s+/.test(line) || /\bor\b/i.test(line);
}

/**
 * @param {object} master - original master record
 * @param {object} proposal - { proposedMarkScheme, question?, marks? }
 * @param {object} [context] - { lessonEditFingerprints: string[] }
 */
function evaluateQualityGates(master, proposal, context = {}) {
  const proposed = normalizeMarkSchemeLines(proposal?.proposedMarkScheme || []);
  const originalQuestion = String(master.question || "");
  const originalMarks = Number(master.marks);
  const deterministic = {};
  const heuristic = {};
  const failures = [];

  const inv = validateShortMarksMarkSchemeInvariant(originalMarks, proposed);
  deterministic.schemeLengthMatchesMarks = inv.ok === true;
  if (!deterministic.schemeLengthMatchesMarks) failures.push("scheme_length_mismatch");

  deterministic.noBlankPoints = proposed.length > 0 && proposed.every((p) => String(p).trim());
  if (!deterministic.noBlankPoints) failures.push("blank_points");

  const normalizedPoints = proposed.map(normalizeForCompare);
  const dupes = normalizedPoints.filter((p, i) => normalizedPoints.indexOf(p) !== i);
  deterministic.noExactDuplicates = dupes.length === 0;
  if (!deterministic.noExactDuplicates) failures.push("exact_duplicate_points");

  deterministic.questionUnchanged =
    (proposal?._rawQuestion == null || String(proposal._rawQuestion) === originalQuestion) &&
    String(proposal?.question ?? originalQuestion) === originalQuestion;
  if (!deterministic.questionUnchanged) failures.push("question_changed");

  deterministic.marksUnchanged =
    (proposal?._rawMarks == null || Number(proposal._rawMarks) === originalMarks) &&
    Number(proposal?.marks ?? originalMarks) === originalMarks;
  if (!deterministic.marksUnchanged) failures.push("marks_changed");

  deterministic.typeStillShort = String(master.type || "short").toLowerCase() === "short";
  if (!deterministic.typeStillShort) failures.push("type_changed");

  deterministic.lessonEditUnchanged = true;
  if (context.lessonEditChanged === true) {
    deterministic.lessonEditUnchanged = false;
    failures.push("lesson_edit_changed");
  }

  deterministic.attachmentUnchanged = context.attachmentChanged !== true;

  heuristic.nearDuplicatePoints = [];
  for (let i = 0; i < proposed.length; i++) {
    for (let j = i + 1; j < proposed.length; j++) {
      const sim = jaccardSimilarity(proposed[i], proposed[j]);
      if (sim >= 0.75) heuristic.nearDuplicatePoints.push({ i, j, similarity: sim });
    }
  }

  heuristic.combinedMarkBullets = proposed
    .map((line, index) => (looksLikeCombinedMarkBullet(line) ? index : null))
    .filter((i) => i != null);

  heuristic.alternativeBullets = proposed
    .map((line, index) => (looksLikeAlternativeBullet(line) ? index : null))
    .filter((i) => i != null);

  heuristic.scientificUncertainty = proposed.some((line) =>
    /\b(may|can|might|could)\b/i.test(line)
  );
  heuristic.terminologyUncertainty = false;
  heuristic.scopeDrift = false;

  const deterministicPass = Object.values(deterministic).every(Boolean);
  const needsReview =
    heuristic.nearDuplicatePoints.length > 0 ||
    heuristic.combinedMarkBullets.length > 0 ||
    heuristic.alternativeBullets.length > 0;

  return {
    deterministic,
    heuristic,
    deterministicPass,
    needsReview,
    failures,
    passed: deterministicPass,
  };
}

module.exports = {
  evaluateQualityGates,
  normalizeForCompare,
  jaccardSimilarity,
  looksLikeCombinedMarkBullet,
  looksLikeAlternativeBullet,
};
