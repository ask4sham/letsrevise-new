/**
 * Block 28 Phase 2 — Random Fertilisation golden repair metadata (read-only).
 * Biology-reviewed content for guarded production repair — NOT written to DB by this module.
 */
const RANDOM_FERTILISATION_LESSON_ID = "6a80d5e049f694aca0c94bf1";

const APPROVED_MASTER_IDS = Object.freeze([
  "6a81a3a849f694aca0cb5b85",
  "6a81a3a849f694aca0cb5b84",
  "6a81a3a949f694aca0cb5b8a",
  "6a81a3a949f694aca0cb5b8b",
  "6a81a3a849f694aca0cb5b88",
]);

const DEPRIORITISED_MASTER_IDS = Object.freeze([
  "6a81a3a949f694aca0cb5b8c",
  "6a81a3a849f694aca0cb5b86",
  "6a81a3a949f694aca0cb5b89",
  "6a81a3a849f694aca0cb5b83",
  "6a81a3a849f694aca0cb5b87",
]);

/** Biology-approved repair metadata — pending guarded production write. */
const APPROVED_REPAIR_METADATA = Object.freeze([
  {
    questionId: "6a81a3a849f694aca0cb5b85",
    proposedQuestion:
      "Describe what happens during random fertilisation and explain how it increases genetic variation in offspring.",
    proposedMarks: 2,
    proposedScheme: [
      "Which sperm fertilises which egg is random / any sperm may fertilise the egg.",
      "This combines different parental allele combinations, producing offspring with a different / unique combination of alleles.",
    ],
  },
  {
    questionId: "6a81a3a849f694aca0cb5b84",
    proposedQuestion: "Explain how meiosis produces genetically different gametes.",
    proposedMarks: 2,
    proposedScheme: [
      "Independent assortment produces gametes with different combinations of maternal and paternal chromosomes / alleles.",
      "Crossing over produces new combinations of alleles on homologous chromosomes.",
    ],
  },
  {
    questionId: "6a81a3a949f694aca0cb5b8a",
    proposedQuestion:
      "Two children with the same biological parents can have different combinations of alleles. Explain how meiosis and random fertilisation can cause this variation.",
    proposedMarks: 3,
    proposedScheme: [
      "Meiosis produces gametes containing different combinations of alleles.",
      "Which sperm fertilises which egg is random.",
      "Each fertilisation event can therefore combine parental alleles differently, producing genetically different offspring.",
    ],
  },
  {
    questionId: "6a81a3a949f694aca0cb5b8b",
    proposedQuestion: "Explain how different alleles contribute to genetic variation in offspring.",
    proposedMarks: 2,
    proposedScheme: [
      "Alleles are alternative forms of the same gene.",
      "Offspring can inherit different combinations of alleles from their parents, producing variation in inherited characteristics / phenotype.",
    ],
  },
  {
    questionId: "6a81a3a849f694aca0cb5b88",
    proposedQuestion:
      "Explain why genetic variation can be important for the survival of a species when environmental conditions change.",
    proposedMarks: 2,
    proposedScheme: [
      "Individuals in a population have different inherited characteristics.",
      "Some variants may be better suited to changed conditions, so those individuals are more likely to survive and reproduce.",
    ],
  },
]);

module.exports = {
  RANDOM_FERTILISATION_LESSON_ID,
  APPROVED_MASTER_IDS,
  DEPRIORITISED_MASTER_IDS,
  APPROVED_REPAIR_METADATA,
};
