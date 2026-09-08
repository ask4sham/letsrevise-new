/**
 * Block 28 Phase 2 — Random Fertilisation golden selection regression.
 */
const { auditLessonAttachments } = require("../services/block28Phase2/lessonAttachmentAudit");
const { deriveLessonContentBoundary } = require("../services/block28Phase2/lessonContentBoundary");
const {
  classifyAttachments,
  proposeFinalSet,
  objectiveAlignmentScore,
  SELECTION,
} = require("../services/block28Phase2/selectionEngine");
const { assessConceptualOverlap } = require("../services/block28Phase2/conceptualOverlap");
const { buildLessonReviewPack, PACK_STATUS } = require("../services/block28Phase2/batchReviewPack");
const {
  RANDOM_FERTILISATION_LESSON_ID,
  APPROVED_MASTER_IDS,
  DEPRIORITISED_MASTER_IDS,
} = require("../services/block28Phase2/randomFertilisationGoldenCapture");

const CANDIDATES = [
  {
    id: "6a81a3a949f694aca0cb5b8a",
    question:
      "Compare the processes of meiosis and random fertilisation in terms of their contributions to genetic variation.",
    marks: 6,
    markScheme: [
      "Meiosis creates diverse gametes through genetic shuffling.",
      "Random fertilisation combines these gametes unpredictably.",
    ],
  },
  {
    id: "6a81a3a849f694aca0cb5b87",
    question: "Analyse the role of genetic variation in the context of natural selection.",
    marks: 6,
    markScheme: [
      "Genetic variation provides different traits for selection.",
      "Natural selection favors advantageous traits, leading to evolution.",
    ],
  },
  {
    id: "6a81a3a949f694aca0cb5b8c",
    question:
      "Outline how meiosis and random fertilisation together contribute to genetic diversity in a population.",
    marks: 4,
    markScheme: [
      "Meiosis produces genetically varied gametes.",
      "Random fertilisation combines these gametes to create unique offspring.",
    ],
  },
  {
    id: "6a81a3a949f694aca0cb5b8b",
    question: "Explain the significance of alleles in the context of genetic variation.",
    marks: 4,
    markScheme: [
      "Alleles are different forms of a gene affecting traits.",
      "Variation in alleles leads to different phenotypes in offspring.",
    ],
  },
  {
    id: "6a81a3a949f694aca0cb5b89",
    question: "Describe how random fertilisation can lead to unique traits in offspring.",
    marks: 4,
    markScheme: [
      "Random fertilisation combines different alleles from parents.",
      "This results in offspring with unique combinations of traits.",
    ],
  },
  {
    id: "6a81a3a849f694aca0cb5b88",
    question: "Justify the importance of genetic variation for the survival of a species.",
    marks: 4,
    markScheme: [
      "Genetic variation increases adaptability to environmental changes.",
      "It reduces the risk of extinction due to disease or changes.",
    ],
  },
  {
    id: "6a81a3a849f694aca0cb5b86",
    question:
      "Apply your knowledge of meiosis and fertilisation to explain how they work together to increase genetic variation.",
    marks: 4,
    markScheme: [
      "Meiosis produces genetically diverse gametes.",
      "Random fertilisation combines these gametes unpredictably.",
    ],
  },
  {
    id: "6a81a3a849f694aca0cb5b85",
    question: "Outline the process of random fertilisation and its role in producing genetic diversity.",
    marks: 4,
    markScheme: [
      "Random fertilisation combines any sperm with any egg.",
      "This results in unique combinations of alleles in offspring.",
    ],
  },
  {
    id: "6a81a3a849f694aca0cb5b84",
    question: "Explain how meiosis contributes to genetic variation in gametes.",
    marks: 4,
    markScheme: [
      "Meiosis involves independent assortment of chromosomes.",
      "Crossing over occurs, creating new allele combinations.",
    ],
  },
  {
    id: "6a81a3a849f694aca0cb5b83",
    question:
      "Evaluate the significance of genetic variation in a population for survival and evolution.",
    marks: 4,
    markScheme: [
      "Genetic variation increases survival chances in changing environments.",
      "It provides raw material for natural selection and evolution.",
    ],
  },
];

function makeGoldenLesson() {
  const pages = [
    {
      blocks: [
        {
          text:
            "Describe how meiosis contributes to genetic variation in gametes. Explain the process of random fertilisation and its role in producing genetic diversity. Random fertilisation occurs when one of many genetically different male gametes randomly fuses with a female gamete. Meiosis shuffles alleles through independent assortment and crossing over producing genetically unique gametes. Random fertilisation combines gametes unpredictably creating unique allele combinations in offspring. Genetic variation is important for survival when environmental conditions change.",
        },
      ],
    },
  ];
  return {
    _id: RANDOM_FERTILISATION_LESSON_ID,
    title: "Random Fertilisation & Genetic Variation",
    topicKey: "edexcel-igcse-biology:random-fertilisation-and-genetic-variation",
    pages,
    examQuestions: CANDIDATES.map((c, i) => ({
      questionId: c.id,
      addedAt: new Date(`2026-01-${String(i + 1).padStart(2, "0")}`),
    })),
  };
}

function buildGoldenMasters() {
  const masters = new Map();
  for (const c of CANDIDATES) {
    masters.set(c.id, {
      _id: c.id,
      type: "short",
      subject: "Biology",
      examBoard: "Edexcel",
      level: "IGCSE",
      topicKey: "edexcel-igcse-biology:random-fertilisation-and-genetic-variation",
      question: c.question,
      marks: c.marks,
      markScheme: c.markScheme,
      status: "published",
    });
  }
  masters.set("6a819fbe49f694aca0caef3c", {
    _id: "6a819fbe49f694aca0caef3c",
    type: "composite",
    question: "Random fertilisation contributes to genetic variation in sexually reproducing organisms.",
    marks: 7,
    markScheme: [],
    status: "published",
  });
  return masters;
}

describe("Block 28 Phase 2 Random Fertilisation golden selection", () => {
  const lesson = makeGoldenLesson();
  const masters = buildGoldenMasters();
  const usage = new Map(CANDIDATES.map((c) => [c.id, 1]));
  const boundary = deriveLessonContentBoundary(lesson);

  test("random fertilisation process questions are HIGH duplicates", () => {
    const preferred = "Outline the process of random fertilisation and its role in producing genetic diversity.";
    const duplicate = "Describe how random fertilisation can lead to unique traits in offspring.";
    expect(assessConceptualOverlap(preferred, duplicate).severity).toBe("HIGH");
  });

  test("combined meiosis+fertilisation questions are HIGH duplicates", () => {
    const preferred =
      "Compare the processes of meiosis and random fertilisation in terms of their contributions to genetic variation.";
    const outline =
      "Outline how meiosis and random fertilisation together contribute to genetic diversity in a population.";
    const apply =
      "Apply your knowledge of meiosis and fertilisation to explain how they work together to increase genetic variation.";
    expect(assessConceptualOverlap(preferred, outline).severity).toBe("HIGH");
    expect(assessConceptualOverlap(preferred, apply).severity).toBe("HIGH");
  });

  test("dedicated meiosis gamete question is not HIGH duplicate of combined synthesis", () => {
    const meiosisOnly = "Explain how meiosis contributes to genetic variation in gametes.";
    const combined =
      "Compare the processes of meiosis and random fertilisation in terms of their contributions to genetic variation.";
    expect(assessConceptualOverlap(meiosisOnly, combined).severity).not.toBe("HIGH");
  });

  test("survival/evolution extension questions are HIGH duplicates", () => {
    const preferred = "Justify the importance of genetic variation for the survival of a species.";
    const evaluate =
      "Evaluate the significance of genetic variation in a population for survival and evolution.";
    const analyse = "Analyse the role of genetic variation in the context of natural selection.";
    expect(assessConceptualOverlap(preferred, evaluate).severity).toBe("HIGH");
    expect(assessConceptualOverlap(preferred, analyse).severity).toBe("HIGH");
  });

  test("objective ranking favours random fertilisation and penalises evolution duplicates", () => {
    const randomFert = objectiveAlignmentScore(
      "Outline the process of random fertilisation and its role in producing genetic diversity.",
      boundary
    );
    const meiosisGametes = objectiveAlignmentScore(
      "Explain how meiosis contributes to genetic variation in gametes.",
      boundary
    );
    const naturalSelection = objectiveAlignmentScore(
      "Analyse the role of genetic variation in the context of natural selection.",
      boundary
    );
    const combinedDup = objectiveAlignmentScore(
      "Outline how meiosis and random fertilisation together contribute to genetic diversity in a population.",
      boundary
    );
    expect(randomFert).toBeGreaterThan(naturalSelection);
    expect(meiosisGametes).toBeGreaterThan(naturalSelection);
    expect(randomFert).toBeGreaterThan(combinedDup);
    expect(naturalSelection).toBeLessThan(0);
  });

  test("selection prefers the five approved biology clusters", () => {
    const audit = auditLessonAttachments(lesson, masters, usage);
    const { classified } = classifyAttachments(audit, boundary);
    const { selected } = proposeFinalSet(classified, boundary);
    const selectedIds = selected.map((s) => s.questionId);

    for (const id of APPROVED_MASTER_IDS) {
      expect(selectedIds).toContain(id);
    }
    for (const id of DEPRIORITISED_MASTER_IDS) {
      expect(selectedIds).not.toContain(id);
    }
    expect(selected.length).toBe(5);
  });

  test("deprioritised questions are detached as duplicate, excess, or out of scope", () => {
    const audit = auditLessonAttachments(lesson, masters, usage);
    const { classified } = classifyAttachments(audit, boundary);
    proposeFinalSet(classified, boundary);

    for (const id of DEPRIORITISED_MASTER_IDS) {
      const row = classified.find((c) => c.questionId === id);
      expect(row.selection).not.toBe(SELECTION.RETAIN);
      expect([
        SELECTION.DETACH_DUPLICATE,
        SELECTION.DETACH_EXCESS,
        SELECTION.REJECT_CONTENT,
      ]).toContain(row.selection);
    }
  });

  test("pre-selection HIGH is informational when final set is clean", () => {
    const pack = buildLessonReviewPack(lesson, masters, usage);
    expect(pack.qualitySummary.preSelectionHighPairs).toBeGreaterThan(0);
    expect(pack.qualitySummary.finalSetHighPairs).toBe(0);
    expect(pack.qualitySummary.unresolvedHighPairs).toBe(0);
    expect(pack.packStatus).not.toBe(PACK_STATUS.BLOCKED_BY_DUPLICATION);
  });
});
