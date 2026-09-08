/**
 * Block 28 Phase 2 — central golden lesson registry for bulk review.
 */
const { VARIATION_LESSON_ID, ...variation } = require("./variationGoldenCapture");
const { ALLELES_LESSON_ID, ...alleles } = require("./allelesGoldenCapture");
const { DNA_STRUCTURE_LESSON_ID, ...dna } = require("./dnaStructureGoldenCapture");
const { MEIOSIS_LESSON_ID, ...meiosis } = require("./meiosisGoldenCapture");
const {
  RANDOM_FERTILISATION_LESSON_ID,
  ...randomFert
} = require("./randomFertilisationGoldenCapture");
const { RNA_STRUCTURE_LESSON_ID, ...rna } = require("./rnaStructureGoldenCapture");
const { MUTATION_LESSON_ID } = require("./constants");

const GOLDEN_MODE = Object.freeze({
  AUTHORITATIVE: "AUTHORITATIVE",
  REVIEW_METADATA: "REVIEW_METADATA",
  CANONICAL_READONLY: "CANONICAL_READONLY",
});

const PROTECTED_LESSON_IDS = Object.freeze([
  VARIATION_LESSON_ID,
  ALLELES_LESSON_ID,
  DNA_STRUCTURE_LESSON_ID,
  MEIOSIS_LESSON_ID,
  RANDOM_FERTILISATION_LESSON_ID,
  MUTATION_LESSON_ID,
]);

function captureEntry(lessonId, title, mode, capture) {
  return {
    lessonId,
    title,
    mode,
    APPROVED_MASTER_IDS: capture.APPROVED_MASTER_IDS,
    DEPRIORITISED_MASTER_IDS: capture.DEPRIORITISED_MASTER_IDS || [],
    APPROVED_REPAIR_METADATA: capture.APPROVED_REPAIR_METADATA || [],
  };
}

const GOLDEN_REGISTRY = new Map([
  [
    VARIATION_LESSON_ID,
    captureEntry(VARIATION_LESSON_ID, "Variation within a Species", GOLDEN_MODE.AUTHORITATIVE, variation),
  ],
  [ALLELES_LESSON_ID, captureEntry(ALLELES_LESSON_ID, "Alleles", GOLDEN_MODE.AUTHORITATIVE, alleles)],
  [
    DNA_STRUCTURE_LESSON_ID,
    captureEntry(DNA_STRUCTURE_LESSON_ID, "DNA Structure", GOLDEN_MODE.AUTHORITATIVE, dna),
  ],
  [MEIOSIS_LESSON_ID, captureEntry(MEIOSIS_LESSON_ID, "Meiosis", GOLDEN_MODE.AUTHORITATIVE, meiosis)],
  [
    RANDOM_FERTILISATION_LESSON_ID,
    captureEntry(
      RANDOM_FERTILISATION_LESSON_ID,
      "Random Fertilisation & Genetic Variation",
      GOLDEN_MODE.AUTHORITATIVE,
      randomFert
    ),
  ],
  [
    RNA_STRUCTURE_LESSON_ID,
    captureEntry(RNA_STRUCTURE_LESSON_ID, "RNA Structure", GOLDEN_MODE.REVIEW_METADATA, rna),
  ],
  [
    MUTATION_LESSON_ID,
    {
      lessonId: MUTATION_LESSON_ID,
      title: "Mutation",
      mode: GOLDEN_MODE.CANONICAL_READONLY,
      APPROVED_MASTER_IDS: [],
      DEPRIORITISED_MASTER_IDS: [],
      APPROVED_REPAIR_METADATA: [],
    },
  ],
]);

function getGoldenCaptureForLesson(lessonId) {
  return GOLDEN_REGISTRY.get(String(lessonId || "")) || null;
}

function isProtectedLessonId(lessonId) {
  return PROTECTED_LESSON_IDS.includes(String(lessonId || ""));
}

function listGoldenCaptures() {
  return [...GOLDEN_REGISTRY.values()];
}

module.exports = {
  GOLDEN_MODE,
  PROTECTED_LESSON_IDS,
  GOLDEN_REGISTRY,
  getGoldenCaptureForLesson,
  isProtectedLessonId,
  listGoldenCaptures,
  VARIATION_LESSON_ID,
  ALLELES_LESSON_ID,
  DNA_STRUCTURE_LESSON_ID,
  MEIOSIS_LESSON_ID,
  RANDOM_FERTILISATION_LESSON_ID,
  RNA_STRUCTURE_LESSON_ID,
  MUTATION_LESSON_ID,
};
