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

/** Rubric-style phrases with no independently awardable biological claim. */
const GENERIC_RUBRIC_PATTERNS = [
  /^describes? (the )?(process|mechanism|answer|what happens|role|function)\b/i,
  /^states? (the )?(function|role|location|answer|importance|significance)\b/i,
  /^identifies? (the )?(location|structure|function|role|answer)\b/i,
  /^explains? (the )?(process|answer|what happens|significance|role|function|importance)\b/i,
  /^gives? (a |an )?(clear |correct )?(example|reason|factor|point|description)\b/i,
  /^mentions? (a )?(factor|hormone|example|point)\b/i,
  /^outlines? (the )?(process|role|function)\b/i,
  /^defines? (it|the term|the process)\.?$/i,
  /^links? .+to the (biological )?context/i,
  /^provides? (a |an )?(example|reason|explanation|description)\b/i,
  /^uses? accurate scientific terminology/i,
  /^reaches? a (supported )?conclusion/i,
  /^explains? the answer\.?$/i,
];

/** Supporting vocabulary roots — substring match tolerates plurals/inflections; not the sole gate. */
const BIOLOGY_VOCABULARY_ROOTS = [
  "allele", "gene", "dna", "rna", "chromosome", "meiosis", "mitosis", "fertil", "gamete", "zygote",
  "haploid", "diploid", "cell", "protein", "nucleotide", "uracil", "thymine", "ribose", "deoxyribose",
  "replication", "transcription", "translation", "phenotype", "genotype", "dominant", "recessive",
  "variation", "mutation", "evolution", "mrna", "trna", "rrna", "codon", "amino", "locus", "homolog",
  "enzyme", "photosynth", "respir", "ecosystem", "pathogen", "antibody", "stomata", "xylem", "phloem",
  "pollen", "ovule", "embryo", "uterus", "oviduct", "testis", "testes", "scrotum", "progesterone",
  "oestrogen", "estrogen", "testosterone", "pituitary", "sperm", "semen", "egg", "ovum", "urethra",
  "penis", "placenta", "ribosome", "mitochond", "chloroplast", "stamen", "stigma", "radicle", "neuron",
  "predator", "prey", "population", "species", "habitat", "biodiversity", "activation", "catalyst",
  "oxygen", "glucose", "carbon", "dioxide", "urea", "nutrient", "membrane", "fluid", "fruit", "ovary",
  "individual", "trait", "average", "dispers", "glucose", "waste", "exchange", "villi", "barrier",
];

const BIOLOGICAL_RELATION_PATTERNS = [
  /\b(produced|secreted|released|transported|travels?|passes?|moves?|maintains?|breaks? down|fuses?|forms?|contains?|carries?|stimulates?|triggers?|inhibits?|prevents?|allows?|enables?|reduces?|increases?|doubles?|halves?|lines? up|attaches?|pulls?|condenses?|replicates?|transcribes?|translates?|pairs?|catalyses?|catalyzes?|activates?|absorbs?|exchanges?|diffuses?|filters?|implants?|ovulates?|fertilises?|fertilizes?|germinates?|digests?|respires?|photosynthes|leaves?|left|enters?|exits?|lowers?|raises?|binds?|unwinds?|reforms?|holds?|held|protects?|protected|surrounds?|surrounded|encloses?|enclosed|develops?|developed|inherits?|inherited|aids?|aided|disperses?|dispersed|makes?|made|contributes?)\w*/i,
  /\b(is|are|was|were|has|have|had|contain|includes?|located|found|made|composed|formed|called|known as|become|remains?|stay|stays)\b/i,
];

const BIOLOGICAL_ENTITY_PATTERNS = [
  /\b[A-Z]{2,6}\b/,
  /\b\d+\s+(chromosomes?|pairs?|cells?|nucleotides?|amino acids?)\b/i,
  /\b(XX|XY|2n|n)\b/,
  /\bfrom .+ to .+:/i,
];

function hasVocabularyHint(text) {
  const norm = normalizeForCompare(text);
  return BIOLOGY_VOCABULARY_ROOTS.some((root) => norm.includes(root));
}

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "in", "to", "for", "is", "are", "was", "were", "be", "by",
  "with", "from", "as", "at", "on", "it", "its", "this", "that", "which", "where", "when", "body",
  "through", "along", "into", "during", "after", "before", "each", "one", "two", "three", "four",
  "five", "six", "seven", "eight", "nine", "ten", "not", "may", "can", "more", "less", "than",
]);

function meaningfulContentWords(text) {
  return normalizeForCompare(text)
    .split(" ")
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function isGenericRubricPhrase(point) {
  const text = String(point || "").trim();
  return GENERIC_RUBRIC_PATTERNS.some((re) => re.test(text));
}

function hasBiologicalEntity(text) {
  return BIOLOGICAL_ENTITY_PATTERNS.some((re) => re.test(text)) || hasVocabularyHint(text);
}

function hasBiologicalRelation(text) {
  return BIOLOGICAL_RELATION_PATTERNS.some((re) => re.test(text));
}

function isGenericFillerPoint(point) {
  const text = String(point || "").trim();
  if (!text) return true;
  if (GENERIC_FILLER_PATTERNS.some((re) => re.test(text))) return true;
  if (isGenericRubricPhrase(text)) return true;
  if (text.length < 8) return true;
  return false;
}

/**
 * A scheme point is specific when it states an independently awardable biological claim,
 * not merely because it matches a finite topic-word regex.
 */
function hasSpecificBiologicalContent(point) {
  const text = String(point || "").trim();
  if (!text || text.length < 10) return false;
  if (isGenericFillerPoint(text)) return false;

  const contentWords = meaningfulContentWords(text);
  if (contentWords.length < 2) return false;

  const hasEntity = hasBiologicalEntity(text);
  const hasRelation = hasBiologicalRelation(text);
  const substantive = contentWords.length >= 3;
  const vocabularyHint = hasVocabularyHint(text);

  if (hasEntity && (hasRelation || substantive || vocabularyHint)) return true;
  if (vocabularyHint && substantive) return true;
  if (contentWords.length >= 4 && (hasRelation || vocabularyHint)) return true;

  return false;
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
  GENERIC_RUBRIC_PATTERNS,
  BIOLOGY_VOCABULARY_ROOTS,
  isGenericFillerPoint,
  hasVocabularyHint,
  isGenericRubricPhrase,
  hasSpecificBiologicalContent,
  assessMarkSchemeQuality,
  assessSemanticReadiness,
};
