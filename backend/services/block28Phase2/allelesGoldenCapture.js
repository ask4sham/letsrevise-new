/**
 * Block 28 Phase 2 — Alleles golden repair metadata (read-only).
 */
const ALLELES_LESSON_ID = "6a70fcaeffc00db240652548";

const APPROVED_MASTER_IDS = Object.freeze([
  "6a719917cb1b96aa69d00dec",
  "6a719917cb1b96aa69d00de7",
  "6a719917cb1b96aa69d00def",
  "6a719917cb1b96aa69d00de8",
  "6a719917cb1b96aa69d00de6",
]);

const DEPRIORITISED_MASTER_IDS = Object.freeze([
  "6a719917cb1b96aa69d00dee",
  "6a719917cb1b96aa69d00ded",
  "6a719917cb1b96aa69d00deb",
  "6a719917cb1b96aa69d00dea",
  "6a719917cb1b96aa69d00de9",
]);

const APPROVED_REPAIR_METADATA = Object.freeze([
  {
    questionId: "6a719917cb1b96aa69d00dec",
    proposedQuestion: "Describe the relationship between genes and alleles.",
    proposedMarks: 3,
    proposedScheme: [
      "A gene is a section of DNA that codes for a specific protein.",
      "An allele is an alternative form / version of the same gene.",
      "Alleles of the same gene occur at the same locus on homologous chromosomes and may have different DNA base sequences.",
    ],
  },
  {
    questionId: "6a719917cb1b96aa69d00de7",
    proposedQuestion: "Explain how alleles contribute to the inheritance of traits in humans.",
    proposedMarks: 3,
    proposedScheme: [
      "For most genes, a person has two alleles.",
      "One allele is inherited from each parent via gametes.",
      "The combination of alleles influences the inherited characteristic / phenotype.",
    ],
  },
  {
    questionId: "6a719917cb1b96aa69d00def",
    proposedQuestion: "Explain how dominant and recessive alleles affect the phenotype of an individual.",
    proposedMarks: 3,
    proposedScheme: [
      "A dominant allele can be expressed in the phenotype when only one copy is present.",
      "A recessive allele is expressed when two recessive copies are present.",
      "Therefore a heterozygous individual usually shows the phenotype associated with the dominant allele.",
    ],
  },
  {
    questionId: "6a719917cb1b96aa69d00de8",
    proposedQuestion:
      "Apply your knowledge of alleles to explain how they can affect an individual's ability to taste PTC.",
    proposedMarks: 3,
    proposedScheme: [
      "PTC tasting is controlled by taster and non-taster alleles.",
      "An individual inherits one allele from each parent.",
      "At least one taster allele results in the taster phenotype; two non-taster alleles result in the non-taster phenotype.",
    ],
  },
  {
    questionId: "6a719917cb1b96aa69d00de6",
    proposedQuestion: "Describe how alleles cause variation in inherited characteristics within a species.",
    proposedMarks: 3,
    proposedScheme: [
      "Different alleles of a gene may have different DNA base sequences.",
      "Different allele sequences can result in different protein forms or inherited characteristics.",
      "Individuals can have different combinations of alleles, producing genetic variation within the species.",
    ],
  },
]);

module.exports = {
  ALLELES_LESSON_ID,
  APPROVED_MASTER_IDS,
  DEPRIORITISED_MASTER_IDS,
  APPROVED_REPAIR_METADATA,
};
