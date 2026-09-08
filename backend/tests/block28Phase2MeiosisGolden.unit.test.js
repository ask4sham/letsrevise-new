/**
 * Block 28 Phase 2 — Meiosis golden selection regression (pre-repair candidate pool).
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
const { buildLessonReviewPack, resolvePackStatus, PACK_STATUS } = require("../services/block28Phase2/batchReviewPack");
const {
  MEIOSIS_LESSON_ID,
  APPROVED_MASTER_IDS,
  DEPRIORITISED_MASTER_IDS,
} = require("../services/block28Phase2/meiosisGoldenCapture");

const MEIOSIS_CANDIDATES = [
  {
    id: "6a802b93b3b6a72c08c7aa95",
    question: "Analyse how errors in meiosis can lead to genetic disorders.",
    marks: 6,
    markScheme: [
      "Errors such as nondisjunction can result in aneuploidy.",
      "Aneuploidy can lead to conditions like Down syndrome.",
    ],
  },
  {
    id: "6a802b93b3b6a72c08c7aa90",
    question: "Analyse the role of crossing over during meiosis and its effect on genetic diversity.",
    marks: 6,
    markScheme: [
      "Crossing over occurs during meiosis I between homologous chromosomes.",
      "It results in new allele combinations, increasing genetic diversity.",
    ],
  },
  {
    id: "6a802b93b3b6a72c08c7aa94",
    question: "Apply your knowledge of meiosis to suggest how it affects evolution.",
    marks: 4,
    markScheme: [
      "Meiosis increases genetic variation, which is crucial for evolution.",
      "Genetic diversity allows populations to adapt to changing environments.",
    ],
  },
  {
    id: "6a802b93b3b6a72c08c7aa93",
    question: "Explain the consequences of not having meiosis in a species.",
    marks: 4,
    markScheme: [
      "Without meiosis, chromosome numbers would double each generation.",
      "This would lead to genetic instability and potential extinction.",
    ],
  },
  {
    id: "6a802b93b3b6a72c08c7aa92",
    question: "Recall the stages of meiosis and describe their significance in producing gametes.",
    marks: 4,
    markScheme: [
      "Meiosis involves two divisions: meiosis I and meiosis II.",
      "Each division has distinct roles in chromosome separation.",
    ],
  },
  {
    id: "6a802b93b3b6a72c08c7aa91",
    question: "Evaluate the importance of independent assortment in meiosis.",
    marks: 4,
    markScheme: [
      "Independent assortment leads to genetic variation.",
      "It ensures random distribution of maternal and paternal chromosomes.",
    ],
  },
  {
    id: "6a802b92b3b6a72c08c7aa8f",
    question: "Apply your understanding of meiosis to explain why gametes must be haploid.",
    marks: 4,
    markScheme: [
      "Haploid gametes ensure the correct diploid number after fertilisation.",
      "Fusion of two haploid gametes restores diploid state.",
    ],
  },
  {
    id: "6a802b92b3b6a72c08c7aa8e",
    question: "Outline the differences between meiosis and mitosis in terms of their outcomes.",
    marks: 4,
    markScheme: [
      "Meiosis produces four genetically different haploid cells.",
      "Mitosis produces two genetically identical diploid cells.",
    ],
  },
  {
    id: "6a802b92b3b6a72c08c7aa8d",
    question: "Explain how meiosis contributes to genetic variation in offspring.",
    marks: 4,
    markScheme: [
      "Meiosis involves crossing over and independent assortment.",
      "These processes create new allele combinations.",
    ],
  },
  {
    id: "6a802b92b3b6a72c08c7aa8c",
    question: "Evaluate the significance of meiosis in maintaining stable chromosome numbers across generations.",
    marks: 4,
    markScheme: [
      "Meiosis halves the chromosome number to maintain stability.",
      "Prevents doubling of chromosome number each generation.",
    ],
  },
  {
    id: "69e289aa02aaae48199699ef",
    question: "How does meiosis lead to genetic variation?",
    marks: 2,
    markScheme: ["Crossing over; random assortment of chromosomes; each gamete gets different combination."],
  },
  {
    id: "69e289aa02aaae48199699ee",
    question: "What does meiosis produce and why is the chromosome number halved?",
    marks: 2,
    markScheme: [
      "Produces gametes. Halved so that when two gametes fuse at fertilisation, diploid number is restored.",
    ],
  },
  {
    id: "69e289aa02aaae48199699f2",
    question: "What is the chromosome number in a human gamete?",
    marks: 1,
    markScheme: ["23 (haploid)."],
  },
  {
    id: "69e289aa02aaae48199699f1",
    question: "Where does meiosis take place in humans?",
    marks: 1,
    markScheme: ["Ovaries (eggs); testes (sperm)."],
  },
  {
    id: "69e289aa02aaae48199699f0",
    question: "How many divisions occur in meiosis?",
    marks: 1,
    markScheme: ["Two divisions (meiosis I and II)."],
  },
];

function makeMeiosisGoldenLesson() {
  const pages = [
    {
      blocks: [
        {
          text:
            "Describe the process of meiosis and how it produces haploid gametes. Explain the importance of halving the chromosome number during meiosis. Understand how meiosis increases genetic variation in offspring. Compare and contrast meiosis with mitosis in terms of purpose and outcome. Meiosis produces four genetically different haploid gametes. In humans meiosis occurs in testes and ovaries producing gametes with 23 chromosomes. Meiosis involves two divisions: meiosis I separates homologous chromosomes and meiosis II separates sister chromatids. Crossing over and independent assortment increase genetic variation. Fertilisation restores the diploid chromosome number.",
        },
      ],
    },
  ];
  return {
    _id: MEIOSIS_LESSON_ID,
    title: "Meiosis",
    topicKey: "edexcel-igcse-biology:meiosis",
    pages,
    examQuestions: MEIOSIS_CANDIDATES.map((c, i) => ({
      questionId: c.id,
      addedAt: new Date(`2026-01-${String(i + 1).padStart(2, "0")}`),
    })),
  };
}

function buildGoldenMasters() {
  const masters = new Map();
  for (const c of MEIOSIS_CANDIDATES) {
    masters.set(c.id, {
      _id: c.id,
      type: "short",
      subject: "Biology",
      examBoard: "Edexcel",
      level: "IGCSE",
      topicKey: "edexcel-igcse-biology:meiosis",
      question: c.question,
      marks: c.marks,
      markScheme: c.markScheme,
      status: "published",
    });
  }
  masters.set("6a8019c5b3b6a72c08c759e7", {
    _id: "6a8019c5b3b6a72c08c759e7",
    type: "composite",
    question: "Meiosis is a crucial process in sexual reproduction that contributes to genetic diversity.",
    marks: 7,
    markScheme: [],
    status: "published",
  });
  return masters;
}

describe("Block 28 Phase 2 Meiosis golden selection", () => {
  const lesson = makeMeiosisGoldenLesson();
  const masters = buildGoldenMasters();
  const usage = new Map(MEIOSIS_CANDIDATES.map((c) => [c.id, 1]));
  const boundary = deriveLessonContentBoundary(lesson);

  test("genetic variation cluster questions are HIGH duplicates", () => {
    const preferred = "Explain how meiosis contributes to genetic variation in offspring.";
    const crossingOver = "Analyse the role of crossing over during meiosis and its effect on genetic diversity.";
    const independentAssortment = "Evaluate the importance of independent assortment in meiosis.";
    const shortVariation = "How does meiosis lead to genetic variation?";

    expect(assessConceptualOverlap(preferred, crossingOver).severity).toBe("HIGH");
    expect(assessConceptualOverlap(preferred, independentAssortment).severity).toBe("HIGH");
    expect(assessConceptualOverlap(preferred, shortVariation).severity).toBe("HIGH");
    expect(assessConceptualOverlap(crossingOver, independentAssortment).severity).toBe("HIGH");
  });

  test("chromosome halving cluster questions are HIGH duplicates", () => {
    const preferred = "What does meiosis produce and why is the chromosome number halved?";
    const haploid = "Apply your understanding of meiosis to explain why gametes must be haploid.";
    const stableNumbers =
      "Evaluate the significance of meiosis in maintaining stable chromosome numbers across generations.";
    const noMeiosis = "Explain the consequences of not having meiosis in a species.";

    expect(assessConceptualOverlap(preferred, haploid).severity).toBe("HIGH");
    expect(assessConceptualOverlap(preferred, stableNumbers).severity).toBe("HIGH");
    expect(assessConceptualOverlap(preferred, noMeiosis).severity).toBe("HIGH");
  });

  test("two-divisions question is not HIGH duplicate of halving anchor", () => {
    const assessment = assessConceptualOverlap(
      "What does meiosis produce and why is the chromosome number halved?",
      "Recall the stages of meiosis and describe their significance in producing gametes."
    );
    expect(assessment.severity).not.toBe("HIGH");
  });

  test("objective ranking favours core objectives over errors, evolution, and analyse stems", () => {
    const humanGamete = objectiveAlignmentScore("What is the chromosome number in a human gamete?", boundary);
    const location = objectiveAlignmentScore("Where does meiosis take place in humans?", boundary);
    const halvingAnchor = objectiveAlignmentScore(
      "What does meiosis produce and why is the chromosome number halved?",
      boundary
    );
    const variationAnchor = objectiveAlignmentScore(
      "Explain how meiosis contributes to genetic variation in offspring.",
      boundary
    );
    const errors = objectiveAlignmentScore("Analyse how errors in meiosis can lead to genetic disorders.", boundary);
    const evolution = objectiveAlignmentScore(
      "Apply your knowledge of meiosis to suggest how it affects evolution.",
      boundary
    );
    const crossingOver = objectiveAlignmentScore(
      "Analyse the role of crossing over during meiosis and its effect on genetic diversity.",
      boundary
    );

    expect(humanGamete).toBeGreaterThan(errors);
    expect(location).toBeGreaterThan(evolution);
    expect(halvingAnchor).toBeGreaterThan(
      objectiveAlignmentScore(
        "Apply your understanding of meiosis to explain why gametes must be haploid.",
        boundary
      )
    );
    expect(variationAnchor).toBeGreaterThan(crossingOver);
    expect(errors).toBeLessThan(0);
    expect(evolution).toBeLessThan(0);
  });

  test("selection prefers the six approved biology clusters", () => {
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
    expect(selected.length).toBe(6);
    expect(selectedIds.filter((id) => id === "6a802b92b3b6a72c08c7aa8d")).toHaveLength(1);
    expect(selectedIds.filter((id) => id === "69e289aa02aaae48199699ee")).toHaveLength(1);
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

  test("resolvePackStatus still blocks only on unresolved final-set HIGH", () => {
    expect(
      resolvePackStatus({
        preSelectionHighPairs: 6,
        finalSetHighPairs: 0,
        unresolvedHighPairs: 0,
        unresolvedSchemeCount: 0,
        genericFillerCount: 0,
        semanticReviewRequiredCount: 0,
        borderlineCount: 2,
        semanticFailCount: 0,
      })
    ).toBe(PACK_STATUS.NEEDS_CONTENT_REVIEW);
  });
});
