/**
 * Block 28 Phase 2 — Variation within a Species golden repair metadata (read-only).
 */
const VARIATION_LESSON_ID = "6a859bcebac845d194489029";

const APPROVED_MASTER_IDS = Object.freeze([
  "6a8ead38d738cc2a4b0af21a",
  "6a8ead38d738cc2a4b0af21b",
  "6a86b942659f42083d304629",
  "6a86b942659f42083d30462e",
  "6a86b942659f42083d30462a",
  "6a86b942659f42083d30462b",
  "6a86b942659f42083d30462d",
  "6a8ead38d738cc2a4b0af21c",
  "6a86b942659f42083d30462f",
  "6a86b942659f42083d30462c",
]);

const DEPRIORITISED_MASTER_IDS = Object.freeze([
  "6a86b600659f42083d2fbcd2",
  "6a86b942659f42083d304631",
  "6a86b942659f42083d304630",
  "6a90a47565e15e080aebb98a",
]);

const APPROVED_REPAIR_METADATA = Object.freeze([
  {
    questionId: "6a8ead38d738cc2a4b0af21a",
    proposedQuestion: "Define variation within a species and give one example.",
    proposedMarks: 2,
    proposedScheme: [
      "Variation means differences between individuals of the same species.",
      "Gives one valid example of variation within a species.",
    ],
  },
  {
    questionId: "6a8ead38d738cc2a4b0af21b",
    proposedQuestion:
      "Explain how mutation, meiosis and random fertilisation can produce genetic variation within a species.",
    proposedMarks: 4,
    proposedScheme: [
      "Mutation changes DNA and may create a new allele.",
      "Meiosis produces gametes with different combinations of alleles.",
      "Random fertilisation combines gametes / alleles in different combinations.",
      "Offspring therefore have different genotypes / allele combinations.",
    ],
  },
  {
    questionId: "6a86b942659f42083d304629",
    proposedQuestion: "Explain the difference between genetic and environmental causes of variation within a species.",
    proposedMarks: 4,
    proposedScheme: [
      "Genetic variation results from differences in alleles / DNA / genotype between individuals.",
      "Genetic differences may be inherited and/or arise through mutation or sexual reproduction.",
      "Environmental variation results from external conditions affecting an individual's phenotype.",
      "Environmental effects can change phenotype without changing the DNA sequence.",
    ],
  },
  {
    questionId: "6a86b942659f42083d30462e",
    proposedQuestion:
      "Explain how environmental factors can cause variation in phenotype without changing the DNA sequence.",
    proposedMarks: 4,
    proposedScheme: [
      "Individuals may experience different environmental conditions.",
      "Environmental conditions can affect development, growth or other aspects of phenotype.",
      "The DNA / allele sequence itself is not changed by these environmental effects.",
      "Gives a correctly linked example, e.g. different light levels affecting plant growth or diet affecting body mass.",
    ],
  },
  {
    questionId: "6a86b942659f42083d30462a",
    proposedQuestion:
      "Outline the characteristics of discontinuous and continuous variation, providing examples of each.",
    proposedMarks: 4,
    proposedScheme: [
      "Discontinuous variation falls into distinct categories with no intermediate values.",
      "Gives a valid discontinuous example, e.g. ABO blood group.",
      "Continuous variation shows a range of values between two extremes.",
      "Gives a valid continuous example, e.g. height or body mass.",
    ],
  },
  {
    questionId: "6a86b942659f42083d30462b",
    proposedQuestion:
      "Apply your knowledge of genetic and environmental factors to explain how they might interact to influence a specific characteristic.",
    proposedMarks: 4,
    proposedScheme: [
      "Names a characteristic influenced by both genetic and environmental factors, e.g. height or body mass.",
      "Describes a genetic contribution to the characteristic.",
      "Describes an environmental influence on the same characteristic.",
      "Explains that the observed phenotype results from interaction between genetic and environmental factors.",
    ],
  },
  {
    questionId: "6a86b942659f42083d30462d",
    proposedQuestion: "Evaluate the statement: 'All variation within a species is caused by genetic factors.'",
    proposedMarks: 4,
    proposedScheme: [
      "Genetic factors can cause variation through differences in alleles / DNA.",
      "Environmental factors can also cause phenotypic variation without changing DNA.",
      "Some characteristics are influenced by both genetic and environmental factors.",
      "Therefore the statement is incorrect because variation is not caused only by genetic factors.",
    ],
  },
  {
    questionId: "6a8ead38d738cc2a4b0af21c",
    proposedQuestion:
      "Explain why genetic variation within a population can be important when environmental conditions change.",
    proposedMarks: 4,
    proposedScheme: [
      "Individuals in the population have different alleles / inherited characteristics.",
      "Some inherited variants may make individuals better suited to the changed conditions.",
      "Better-adapted individuals are more likely to survive and reproduce.",
      "Alleles associated with advantageous inherited characteristics may become more common in later generations.",
    ],
  },
  {
    questionId: "6a86b942659f42083d30462f",
    proposedQuestion:
      "Explain why genetic variation and environmental conditions are both important when conserving a species.",
    proposedMarks: 4,
    proposedScheme: [
      "Genetic variation provides different inherited characteristics within the population.",
      "Some variants may be better suited to future environmental changes.",
      "Environmental conditions affect survival, growth and reproduction.",
      "Conservation must protect both genetic diversity and suitable habitats / environmental conditions.",
    ],
  },
  {
    questionId: "6a86b942659f42083d30462c",
    proposedQuestion: "Describe how selective breeding can increase variation within a domesticated species.",
    proposedMarks: 4,
    proposedScheme: [
      "Selective breeding chooses parents with desired characteristics.",
      "Offspring with desired traits are bred again over generations.",
      "This increases the frequency of alleles for the selected traits.",
      "Greater variation in selected traits can be produced within the domesticated population.",
    ],
  },
]);

module.exports = {
  VARIATION_LESSON_ID,
  APPROVED_MASTER_IDS,
  DEPRIORITISED_MASTER_IDS,
  APPROVED_REPAIR_METADATA,
};
