/**
 * Block 28 — semantic-readiness heuristic generalisation regression tests.
 */
const {
  SEMANTIC_READINESS,
  assessSemanticReadiness,
  assessMarkSchemeQuality,
  hasSpecificBiologicalContent,
  isGenericFillerPoint,
} = require("../services/block28Phase2/schemeQuality");

const DNA_REPLICATION_STEM =
  "Outline how the structure of DNA enables it to be copied during cell division.";
const DNA_TEMPLATE_POINT =
  "Each original strand acts as a template for a new complementary strand.";
const MEIOSIS_STEM = "What is the chromosome number in a human gamete?";

const ARCHIVED_NEGATIVE_POINTS = [
  "Gives a valid continuous example, e.g. height or body mass.",
  "Describes an environmental influence on the same characteristic.",
  "This knowledge can be used in an appropriate medical application, e.g. screening, diagnosis or treatment choice.",
  "Gives a correctly linked example, e.g. different light levels affecting plant growth or diet affecting body mass.",
  "Discuss the result.",
  "Consider a suitable application.",
  "Gives a valid example.",
  "Describes the process.",
  "States the function.",
  "23",
  "many chromosomes",
  "correct number",
  "a suitable number",
  "50",
  "3",
  "Uses the template.",
  "Describes the strand.",
  "Considers the template.",
];

const FIVE_FALSE_NEGATIVES = [
  {
    lesson: "Human Reproductive Systems",
    questionId: "6a46d337281f4adf9b46d83a",
    marks: 3,
    markScheme: [
      "Sperm are produced in the testis.",
      "Sperm pass along the sperm duct, where fluids from glands are added.",
      "Semen leaves the body through the urethra in the penis.",
    ],
  },
  {
    lesson: "Oestrogen & Progesterone",
    questionId: "6a48c58b097a88b2343a734b",
    marks: 2,
    markScheme: [
      "Progesterone levels fall.",
      "The uterine lining breaks down and is lost from the body as menstrual bleeding.",
    ],
  },
  {
    lesson: "FSH & LH",
    questionId: "6a4a84666f0055b6eb939a10",
    marks: 2,
    markScheme: [
      "FSH and LH are produced by the pituitary gland.",
      "FSH stimulates follicle maturation; LH triggers ovulation.",
    ],
  },
  {
    lesson: "Sex Chromosomes",
    questionId: "6a7b9b44c14e5af7fdf8114b",
    marks: 2,
    markScheme: [
      "Females have the sex chromosomes XX.",
      "Males have the sex chromosomes XY.",
    ],
  },
  {
    lesson: "Diploid vs Haploid",
    questionId: "6a8408a92e505d6b1f999dfa",
    marks: 2,
    markScheme: [
      "Gametes contain 23 chromosomes (one set).",
      "If gametes were diploid, fertilisation would double the chromosome number each generation.",
    ],
  },
];

const GENERIC_MUST_FAIL = [
  "Describes the process.",
  "States the function.",
  "Identifies the location.",
  "Explains the answer.",
  "Gives an example.",
  "Mentions a factor.",
  "",
  "   ",
];

const CROSS_TOPIC_VALID = [
  { topic: "reproduction", point: "Sperm travel through the sperm duct to the urethra." },
  { topic: "endocrine", point: "Progesterone maintains the lining of the uterus after ovulation." },
  { topic: "genetics", point: "Females usually have XX sex chromosomes." },
  { topic: "cell division", point: "Sister chromatids are pulled to opposite poles during anaphase." },
  { topic: "plant biology", point: "Pollen grains land on the stigma during pollination." },
  { topic: "enzymes", point: "Enzymes lower the activation energy of a reaction." },
  { topic: "ecology", point: "Predators reduce the population size of their prey." },
];

describe("block28 semantic readiness generalisation", () => {
  describe("five bulk-sprint false negatives", () => {
    for (const q of FIVE_FALSE_NEGATIVES) {
      test(`${q.lesson} (${q.questionId}) passes semantic readiness`, () => {
        const result = assessSemanticReadiness({ marks: q.marks, markScheme: q.markScheme });
        expect(result.semanticReadiness).toBe(SEMANTIC_READINESS.PASS);
        expect(result.reasons).not.toContain("weak_unspecific_points");
        expect(result.reasons).not.toContain("generic_filler_points");
      });
    }
  });

  describe("generic filler still fails", () => {
    for (const point of GENERIC_MUST_FAIL) {
      test(`rejects: "${point.trim() || "(empty)"}"`, () => {
        expect(isGenericFillerPoint(point)).toBe(true);
        expect(hasSpecificBiologicalContent(point)).toBe(false);
      });
    }

    test("rejects legacy template filler in a full scheme", () => {
      const result = assessSemanticReadiness({
        marks: 2,
        markScheme: ["Describes the process or mechanism relevant to the question.", "States the function."],
      });
      expect(result.semanticReadiness).not.toBe(SEMANTIC_READINESS.PASS);
      expect(result.reasons).toContain("generic_filler_points");
    });
  });

  describe("cross-topic specific valid points", () => {
    for (const { topic, point } of CROSS_TOPIC_VALID) {
      test(`${topic}: accepts specific point`, () => {
        expect(hasSpecificBiologicalContent(point)).toBe(true);
        const result = assessSemanticReadiness({ marks: 1, markScheme: [point] });
        expect(result.semanticReadiness).toBe(SEMANTIC_READINESS.PASS);
      });
    }
  });

  describe("cross-topic generic invalid points", () => {
    const invalid = [
      "Explains what happens.",
      "Gives a correct example.",
      "Mentions a hormone.",
      "Provides an explanation.",
    ];
    for (const point of invalid) {
      test(`rejects: "${point}"`, () => {
        expect(hasSpecificBiologicalContent(point)).toBe(false);
      });
    }
  });

  test("duplicate scheme points still fail", () => {
    const result = assessSemanticReadiness({
      marks: 2,
      markScheme: [
        "Dominant allele masks recessive allele in heterozygotes.",
        "Dominant allele masks recessive allele in heterozygotes.",
      ],
    });
    expect(result.reasons).toContain("duplicate_credit_in_scheme");
    expect(result.semanticReadiness).not.toBe(SEMANTIC_READINESS.PASS);
  });

  describe("context-aware and numeric biological specificity (policy E)", () => {
    test("DNA replication template point passes with stem context", () => {
      const result = assessSemanticReadiness({
        marks: 3,
        stem: DNA_REPLICATION_STEM,
        markScheme: [
          "The DNA double helix unwinds and the two strands separate.",
          DNA_TEMPLATE_POINT,
          "Complementary bases pair A–T and G–C, producing two DNA molecules with the same base sequence as the original.",
        ],
      });
      expect(result.semanticReadiness).toBe(SEMANTIC_READINESS.PASS);
    });

    test("Meiosis atomic chromosome number passes with recall stem", () => {
      const result = assessSemanticReadiness({
        marks: 1,
        stem: MEIOSIS_STEM,
        markScheme: ["23 chromosomes."],
      });
      expect(result.semanticReadiness).toBe(SEMANTIC_READINESS.PASS);
    });

    test("additional numeric biological quantity with matching stem", () => {
      const stem = "How many chromosomes are in a human body cell?";
      const result = assessSemanticReadiness({
        marks: 1,
        stem,
        markScheme: ["46 chromosomes."],
      });
      expect(result.semanticReadiness).toBe(SEMANTIC_READINESS.PASS);
    });

    test("rich stem does not rescue generic template rubric", () => {
      const stem = "Outline how DNA is copied during cell division.";
      expect(hasSpecificBiologicalContent("Uses the template.", { stem })).toBe(false);
      const result = assessSemanticReadiness({
        marks: 1,
        stem,
        markScheme: ["Uses the template."],
      });
      expect(result.semanticReadiness).not.toBe(SEMANTIC_READINESS.PASS);
    });

    test("rich stem does not rescue mentions-the-noun rubric credit lines", () => {
      const stem = "Outline how DNA is copied during cell division.";
      for (const point of [
        "Mentions the chromosome.",
        "Mentions the gene.",
        "Mentions the cell.",
        "Names a valid chromosome.",
      ]) {
        expect(hasSpecificBiologicalContent(point, { stem, marks: 1 })).toBe(false);
        expect(
          assessSemanticReadiness({ marks: 1, stem, markScheme: [point] }).semanticReadiness
        ).not.toBe(SEMANTIC_READINESS.PASS);
      }
    });

    test("rubric credit detection does not reject substantive biological sentences", () => {
      const stem = "Outline how DNA is copied during cell division.";
      for (const point of [
        "The chromosome contains DNA.",
        "Homologous chromosomes separate during meiosis I.",
        "A human gamete contains 23 chromosomes.",
      ]) {
        expect(hasSpecificBiologicalContent(point, { stem, marks: 2 })).toBe(true);
      }
    });

    test("non-DNA context-aware mechanism point passes", () => {
      const stem = "Outline how transcription produces mRNA from a DNA template.";
      const point =
        "RNA polymerase binds and the DNA template strand is used to assemble a complementary mRNA strand.";
      expect(hasSpecificBiologicalContent(point, { stem, marks: 1 })).toBe(true);
      expect(
        assessSemanticReadiness({ marks: 1, stem, markScheme: [point] }).semanticReadiness
      ).toBe(SEMANTIC_READINESS.PASS);
    });

    test("23 bananas fails numeric biological answer gate", () => {
      const stem = "What is the chromosome number in a human gamete?";
      expect(hasSpecificBiologicalContent("23 bananas.", { stem, marks: 1 })).toBe(false);
      expect(
        assessSemanticReadiness({ marks: 1, stem, markScheme: ["23 bananas."] }).semanticReadiness
      ).not.toBe(SEMANTIC_READINESS.PASS);
    });

    test("vague quantifier with biological unit fails", () => {
      expect(hasSpecificBiologicalContent("many chromosomes")).toBe(false);
      expect(hasSpecificBiologicalContent("correct number")).toBe(false);
      expect(hasSpecificBiologicalContent("a suitable number")).toBe(false);
    });

    test("bare numeral without stem quantity context fails", () => {
      expect(hasSpecificBiologicalContent("23", { stem: "Explain inheritance.", marks: 2 })).toBe(false);
    });

    test("digit plus irrelevant noun on explain stem does not bypass explanation demand", () => {
      const result = assessSemanticReadiness({
        marks: 2,
        stem: "Explain how mitosis produces genetically identical daughter cells.",
        markScheme: ["2 cells."],
      });
      expect(result.semanticReadiness).not.toBe(SEMANTIC_READINESS.PASS);
    });

    test("archived weak/meta negative points remain unspecific", () => {
      const stem = "Explain a process.";
      for (const point of ARCHIVED_NEGATIVE_POINTS) {
        expect(hasSpecificBiologicalContent(point, { stem, marks: 2 })).toBe(false);
      }
    });

    test("live DNA and Meiosis effective payloads pass scheme quality with stem", () => {
      const dna = assessMarkSchemeQuality(
        [
          "The DNA double helix unwinds and the two strands separate.",
          DNA_TEMPLATE_POINT,
          "Complementary bases pair A–T and G–C, producing two DNA molecules with the same base sequence as the original.",
        ],
        { stem: DNA_REPLICATION_STEM, marks: 3 }
      );
      expect(dna.weakIndices).toHaveLength(0);

      const meiosis = assessMarkSchemeQuality(["23 chromosomes."], { stem: MEIOSIS_STEM, marks: 1 });
      expect(meiosis.weakIndices).toHaveLength(0);
    });
  });
});
