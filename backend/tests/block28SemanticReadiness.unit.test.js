/**
 * Block 28 — semantic-readiness heuristic generalisation regression tests.
 */
const {
  SEMANTIC_READINESS,
  assessSemanticReadiness,
  hasSpecificBiologicalContent,
  isGenericFillerPoint,
} = require("../services/block28Phase2/schemeQuality");

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
});
