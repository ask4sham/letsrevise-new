/**
 * Block 28 Phase 2 — mark-scheme quality and semantic-readiness rules.
 */
const { normalizeMarkSchemeLines, validateShortMarksMarkSchemeInvariant } = require("../../../lib/block28PracticePolicy");
const { jaccardSimilarity, normalizeForCompare } = require("./qualityGates");

const SCHEME_STATUS = Object.freeze({
  READY: "READY",
  HUMAN_REVIEW_REQUIRED: "HUMAN_REVIEW_REQUIRED",
});

const SEMANTIC_READINESS = Object.freeze({
  PASS: "PASS",
  FAIL: "FAIL",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
});

/** Generic template filler — never valid as Biology mark points. */
const GENERIC_FILLER_PATTERNS = [
  /describes the process or mechanism relevant to the question/i,
  /links the explanation to the biological context/i,
  /uses accurate scientific terminology appropriate to edexcel igcse biology/i,
  /provides evidence or reasoning supporting one side/i,
  /provides contrasting evidence or a counter-?argument/i,
  /reaches a supported conclusion linked to the question/i,
  /gives a (second|third|fourth) valid point related to the question/i,
  /gives further detail/i,
  /explains significance in general terms/i,
  /mark point \d+ — requires human biology review/i,
  /^explains significance\.?$/i,
];

const BIOLOGY_CONTENT_HINT =
  /\b(allele|gene|dna|rna|chromosome|meiosis|mitosis|fertilis|gamete|cell|protein|base|nucleotide|uracil|thymine|ribose|deoxyribose|hydrogen bond|replication|transcription|translation|phenotype|genotype|dominant|recessive|variation|mutation|natural selection|evolution|haploid|diploid|zygote|mrna|trna|rrna|codon|amino acid|locus|homologous|crossing over|independent assortment|hydrogen|phosphate|helix|strand)\b/i;

function isGenericFillerPoint(point) {
  const text = String(point || "").trim();
  if (!text) return true;
  if (GENERIC_FILLER_PATTERNS.some((re) => re.test(text))) return true;
  if (text.length < 12 && !BIOLOGY_CONTENT_HINT.test(text)) return true;
  return false;
}

function hasSpecificBiologicalContent(point) {
  const text = String(point || "").trim();
  if (!text || text.length < 8) return false;
  if (isGenericFillerPoint(text)) return false;
  const words = normalizeForCompare(text).split(" ").filter((w) => w.length > 3);
  if (words.length < 2) return BIOLOGY_CONTENT_HINT.test(text);
  return BIOLOGY_CONTENT_HINT.test(text) || words.length >= 4;
}

function assessMarkSchemeQuality(markScheme) {
  const points = normalizeMarkSchemeLines(markScheme);
  const genericIndices = [];
  const weakIndices = [];
  points.forEach((p, i) => {
    if (isGenericFillerPoint(p)) genericIndices.push(i);
    else if (!hasSpecificBiologicalContent(p)) weakIndices.push(i);
  });
  const duplicatePairs = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (jaccardSimilarity(points[i], points[j]) >= 0.72) {
        duplicatePairs.push({ i, j, similarity: jaccardSimilarity(points[i], points[j]) });
      }
    }
  }
  return {
    points,
    genericIndices,
    weakIndices,
    duplicatePairs,
    hasGenericFiller: genericIndices.length > 0,
    allPointsSpecific: genericIndices.length === 0 && weakIndices.length === 0 && points.every(hasSpecificBiologicalContent),
  };
}

/**
 * @param {object} opts
 * @param {number} opts.marks
 * @param {string[]} opts.markScheme
 * @param {object} [opts.markDemand]
 * @param {string} [opts.overlapRisk] - LOW | MEDIUM | HIGH for this question in final set
 * @param {boolean} [opts.highOverlapInSet]
 */
function assessSemanticReadiness(opts) {
  const marks = Number(opts.marks);
  const quality = assessMarkSchemeQuality(opts.markScheme);
  const inv = validateShortMarksMarkSchemeInvariant(marks, quality.points);
  const reasons = [];

  if (!inv.ok) reasons.push("marks_scheme_count_mismatch");
  if (quality.hasGenericFiller) reasons.push("generic_filler_points");
  if (quality.weakIndices.length > 0) reasons.push("weak_unspecific_points");
  if (quality.duplicatePairs.length > 0) reasons.push("duplicate_credit_in_scheme");
  if (opts.markDemand?.verdict === "BORDERLINE" || opts.markDemand?.verdict === "ARTIFICIALLY_PADDED") {
    reasons.push("unresolved_mark_demand");
  }
  if (opts.highOverlapInSet || opts.overlapRisk === "HIGH") reasons.push("high_overlap_in_final_set");
  if (opts.schemeStatus === SCHEME_STATUS.HUMAN_REVIEW_REQUIRED) reasons.push("scheme_unresolved");

  if (reasons.length === 0 && quality.allPointsSpecific && inv.ok) {
    return { semanticReadiness: SEMANTIC_READINESS.PASS, reasons: [], quality, invariantPass: true };
  }
  if (reasons.includes("scheme_unresolved") || reasons.includes("generic_filler_points")) {
    return {
      semanticReadiness: SEMANTIC_READINESS.REVIEW_REQUIRED,
      reasons,
      quality,
      invariantPass: inv.ok,
    };
  }
  return { semanticReadiness: SEMANTIC_READINESS.FAIL, reasons, quality, invariantPass: inv.ok };
}

module.exports = {
  SCHEME_STATUS,
  SEMANTIC_READINESS,
  GENERIC_FILLER_PATTERNS,
  isGenericFillerPoint,
  hasSpecificBiologicalContent,
  assessMarkSchemeQuality,
  assessSemanticReadiness,
};
