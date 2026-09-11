/**
 * Block 28 Phase 2 — mark-scheme quality and semantic-readiness rules.
 */
const { normalizeMarkSchemeLines, validateShortMarksMarkSchemeInvariant } = require("../../../lib/block28PracticePolicy");
const { isRubricCreditInstructionPoint } = require("../../../lib/block28RubricFragment");
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
  /^uses?\s+the\s+template\b/i,
  /^mentions?\s+the\s+strand\b/i,
  /^describes?\s+the\s+(template|strand)\b/i,
  /^considers?\s+the\s+(template|strand)\b/i,
  /^gives?\s+(a\s+)?valid\s+template\b/i,
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
  /\b\d+\s+(chromosomes?|pairs?|cells?|gametes?|nucleotides?|amino acids?)\b/i,
  /\b(XX|XY|2n|n)\b/,
  /\bfrom .+ to .+:/i,
];

const VAGUE_QUANTIFIER_PATTERN =
  /\b(many|several|some|few|correct|suitable|appropriate|valid|linked)\s+(number|chromosomes?|gametes?|cells?|pairs?)\b/i;

const MECHANISM_POINT_LEXICON =
  /\b(strand|strands|template|complementary|replicat|unwind|unwinds|separate|separates|pair|pairs|transcri|translat|mitosis|meiosis)\b/i;

function normalizeSpecificityContext(context) {
  if (context == null || typeof context !== "object") return { stem: "", marks: undefined };
  const stem = context.stem != null ? String(context.stem) : context.question != null ? String(context.question) : "";
  const marks = context.marks != null ? Number(context.marks) : undefined;
  return { stem, marks };
}

function stemEstablishesBiology(stem) {
  const text = String(stem || "").trim();
  if (!text) return false;
  return hasVocabularyHint(text) || BIOLOGICAL_ENTITY_PATTERNS.some((re) => re.test(text));
}

function isVagueQuantifierBiologyPoint(point) {
  const norm = normalizeForCompare(point);
  if (/\b\d+\b/.test(String(point || ""))) return false;
  if (VAGUE_QUANTIFIER_PATTERN.test(norm)) return true;
  if (/\ba\s+(suitable|correct|valid|linked)\s+number\b/.test(norm)) return true;
  if (
    /\b(many|several|some|few)\b/.test(norm)
    && /\b(chromosomes?|gametes?|cells?|pairs?)\b/.test(norm)
  ) {
    return true;
  }
  return false;
}

function stemAsksForBiologicalQuantity(stem, marks) {
  const stemNorm = normalizeForCompare(stem);
  if (!stemNorm) return false;
  const quantityCue =
    /\b(how many|what is the|state the|give the)\b/.test(stemNorm)
    && /\b(number|amount|chromosome|gamete|haploid|diploid|cell|pair)\b/.test(stemNorm);
  const chromosomeNumberCue = /\bchromosome number\b/.test(stemNorm);
  const oneMarkRecall =
    marks === 1
    && /\b(what is|state|give|how many|name)\b/.test(stemNorm)
    && /\b(chromosome|gamete|haploid|diploid|cell|pair|number)\b/.test(stemNorm);
  return quantityCue || chromosomeNumberCue || oneMarkRecall;
}

function pointNumericUnitMatchesStem(point, stem) {
  const stemNorm = normalizeForCompare(stem);
  const pointText = String(point || "");
  if (/\bchromosomes?\b/i.test(pointText) && /\bchromosome/i.test(stemNorm)) return true;
  if (/\bgametes?\b/i.test(pointText) && /\bgamete/i.test(stemNorm)) return true;
  if (/\bcells?\b/i.test(pointText) && /\bcell/i.test(stemNorm)) return true;
  if (/\bpairs?\b/i.test(pointText) && /\bpair/i.test(stemNorm)) return true;
  if (/\b(haploid|diploid)\b/i.test(pointText) && /\b(haploid|diploid|chromosome|gamete)\b/i.test(stemNorm)) {
    return true;
  }
  if (/\bchromosomes?\b/i.test(pointText) && /\bgamete/i.test(stemNorm)) return true;
  return false;
}

function isExactNumericBiologicalAnswer(point, context) {
  const text = String(point || "").trim();
  const { stem, marks } = context;
  if (!text || isVagueQuantifierBiologyPoint(text)) return false;
  if (!/\b\d+\b/.test(text)) return false;
  const numericWithUnit =
    /\b\d+\s+(chromosomes?|pairs?|gametes?|cells?|nucleotides?)\b/i.test(text)
    || /\b\d+\s*\(\s*haploid\s*\)/i.test(text);
  if (!numericWithUnit) return false;
  if (!stemAsksForBiologicalQuantity(stem, marks)) return false;
  return pointNumericUnitMatchesStem(text, stem);
}

function isContextAwareMechanismPoint(point, stem) {
  const text = String(point || "").trim();
  if (!text || isGenericRubricPhrase(text) || isVagueQuantifierBiologyPoint(text)) return false;
  if (!stemEstablishesBiology(stem)) return false;
  const pointNorm = normalizeForCompare(text);
  if (!MECHANISM_POINT_LEXICON.test(pointNorm)) return false;
  const contentWords = meaningfulContentWords(text);
  if (contentWords.length < 4) return false;
  const hasMechanismLink =
    /\bacts?\s+as\b/.test(pointNorm)
    || /\bfor\s+(a\s+)?new\b/.test(pointNorm)
    || hasBiologicalRelation(text);
  return hasMechanismLink;
}

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
  if (isRubricCreditInstructionPoint(text)) return true;
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
 * @param {string} point
 * @param {{ stem?: string, question?: string, marks?: number }} [context]
 */
function hasSpecificBiologicalContent(point, context) {
  const text = String(point || "").trim();
  const ctx = normalizeSpecificityContext(context);
  if (!text || text.length < 10) return false;
  if (isGenericFillerPoint(text)) return false;
  if (isVagueQuantifierBiologyPoint(text)) return false;

  if (isExactNumericBiologicalAnswer(text, ctx)) return true;
  if (isContextAwareMechanismPoint(text, ctx.stem)) return true;

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

function assessMarkSchemeQuality(markScheme, context) {
  const ctx = normalizeSpecificityContext(context);
  const points = normalizeMarkSchemeLines(markScheme);
  const genericIndices = [];
  const weakIndices = [];
  points.forEach((p, i) => {
    if (isGenericFillerPoint(p)) genericIndices.push(i);
    else if (!hasSpecificBiologicalContent(p, ctx)) weakIndices.push(i);
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
    allPointsSpecific:
      genericIndices.length === 0
      && weakIndices.length === 0
      && points.every((p) => hasSpecificBiologicalContent(p, ctx)),
  };
}

/**
 * @param {object} opts
 * @param {number} opts.marks
 * @param {string[]} opts.markScheme
 * @param {string} [opts.stem]
 * @param {string} [opts.question]
 * @param {object} [opts.markDemand]
 * @param {string} [opts.overlapRisk] - LOW | MEDIUM | HIGH for this question in final set
 * @param {boolean} [opts.highOverlapInSet]
 */
function assessSemanticReadiness(opts) {
  const marks = Number(opts.marks);
  const specificityContext = {
    stem: opts.stem ?? opts.question,
    marks,
  };
  const quality = assessMarkSchemeQuality(opts.markScheme, specificityContext);
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
