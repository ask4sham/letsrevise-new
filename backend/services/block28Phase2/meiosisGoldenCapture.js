/**
 * Block 28 Phase 2 — Meiosis human-approved repair metadata (read-only).
 * Biology-reviewed content for guarded production repair — NOT written to DB by this module.
 */
const MEIOSIS_LESSON_ID = "6a7dc559c14e5af7fdfce64d";

const APPROVED_MASTER_IDS = Object.freeze([
  "69e289aa02aaae48199699f2",
  "69e289aa02aaae48199699f1",
  "69e289aa02aaae48199699ee",
  "6a802b93b3b6a72c08c7aa92",
  "6a802b92b3b6a72c08c7aa8d",
  "6a802b92b3b6a72c08c7aa8e",
]);

const DEPRIORITISED_MASTER_IDS = Object.freeze([
  "6a802b93b3b6a72c08c7aa95",
  "6a802b93b3b6a72c08c7aa90",
  "6a802b93b3b6a72c08c7aa94",
  "6a802b93b3b6a72c08c7aa93",
  "6a802b93b3b6a72c08c7aa91",
  "6a802b92b3b6a72c08c7aa8f",
  "6a802b92b3b6a72c08c7aa8c",
  "69e289aa02aaae48199699ef",
  "69e289aa02aaae48199699f0",
]);

/** Biology-approved repair metadata — pending guarded production write. */
const APPROVED_REPAIR_METADATA = Object.freeze([
  {
    questionId: "69e289aa02aaae48199699f2",
    proposedQuestion: "What is the chromosome number in a human gamete?",
    proposedMarks: 1,
    proposedScheme: ["23 chromosomes."],
  },
  {
    questionId: "69e289aa02aaae48199699f1",
    proposedQuestion: "Where does meiosis take place in humans?",
    proposedMarks: 1,
    proposedScheme: ["In the testes and ovaries / gonads."],
  },
  {
    questionId: "69e289aa02aaae48199699ee",
    proposedQuestion:
      "Describe what meiosis produces and explain why the chromosome number is halved.",
    proposedMarks: 2,
    proposedScheme: [
      "Meiosis produces four haploid gametes, each containing one set of chromosomes.",
      "Halving the chromosome number allows fertilisation to restore the diploid chromosome number / prevents chromosome number doubling each generation.",
    ],
  },
  {
    questionId: "6a802b93b3b6a72c08c7aa92",
    proposedQuestion:
      "Describe the two divisions of meiosis and explain how they produce haploid gametes.",
    proposedMarks: 3,
    proposedScheme: [
      "In meiosis I, homologous chromosomes separate.",
      "In meiosis II, sister chromatids separate.",
      "After the two divisions, four haploid cells/gametes are produced, each containing one set of chromosomes.",
    ],
  },
  {
    questionId: "6a802b92b3b6a72c08c7aa8d",
    proposedQuestion: "Explain how meiosis produces genetic variation in gametes.",
    proposedMarks: 3,
    proposedScheme: [
      "Crossing over between homologous chromosomes creates new combinations of alleles.",
      "Independent assortment causes different combinations of maternal and paternal chromosomes to enter gametes.",
      "The gametes produced therefore contain different combinations of alleles / genetic information.",
    ],
  },
  {
    questionId: "6a802b92b3b6a72c08c7aa8e",
    proposedQuestion: "Compare the outcomes of meiosis and mitosis.",
    proposedMarks: 2,
    proposedScheme: [
      "Meiosis produces four genetically different haploid cells.",
      "Mitosis produces two genetically identical diploid cells.",
    ],
  },
]);

module.exports = {
  MEIOSIS_LESSON_ID,
  APPROVED_MASTER_IDS,
  DEPRIORITISED_MASTER_IDS,
  APPROVED_REPAIR_METADATA,
};
