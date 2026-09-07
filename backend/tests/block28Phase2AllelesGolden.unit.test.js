/**
 * Block 28 Phase 2 — Alleles golden selection regression (pre-repair candidate pool).
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

const ALLELES_LESSON_ID = "6a70fcaeffc00db240652548";

const APPROVED_IDS = [
  "6a719917cb1b96aa69d00dec",
  "6a719917cb1b96aa69d00de7",
  "6a719917cb1b96aa69d00def",
  "6a719917cb1b96aa69d00de8",
  "6a719917cb1b96aa69d00de6",
];

const DEPRIORITISED_IDS = [
  "6a719917cb1b96aa69d00dee",
  "6a719917cb1b96aa69d00ded",
  "6a719917cb1b96aa69d00deb",
  "6a719917cb1b96aa69d00dea",
  "6a719917cb1b96aa69d00de9",
];

const ALLELES_CANDIDATES = [
  {
    id: "6a719917cb1b96aa69d00dee",
    question: "Evaluate how the study of alleles contributes to our understanding of evolution.",
    marks: 6,
    markScheme: ["Discuss the role of genetic variation in evolution", "Explain how alleles influence natural selection"],
  },
  {
    id: "6a719917cb1b96aa69d00def",
    question: "Explain the significance of dominant and recessive alleles in genetic inheritance.",
    marks: 4,
    markScheme: ["Define dominant and recessive alleles", "Describe their impact on phenotype expression"],
  },
  {
    id: "6a719917cb1b96aa69d00ded",
    question: "Suggest reasons why individuals with the same alleles may still exhibit different traits.",
    marks: 4,
    markScheme: ["Discuss environmental factors affecting traits", "Mention the role of other genes in trait expression"],
  },
  {
    id: "6a719917cb1b96aa69d00dec",
    question: "Compare the roles of alleles and genes in determining inherited traits.",
    marks: 4,
    markScheme: ["Define genes and alleles", "Discuss how they interact to influence traits"],
  },
  {
    id: "6a719917cb1b96aa69d00deb",
    question: "Outline the process by which alleles are inherited from parents to offspring.",
    marks: 4,
    markScheme: ["Describe the role of gametes in inheritance", "Explain how alleles combine in offspring"],
  },
  {
    id: "6a719917cb1b96aa69d00dea",
    question: "Justify why understanding alleles is essential for studying genetics and inheritance.",
    marks: 4,
    markScheme: ["Explain the role of alleles in genetic variation", "Discuss their importance in inheritance patterns"],
  },
  {
    id: "6a719917cb1b96aa69d00de9",
    question: "Analyse the relationship between alleles and the concept of dominant and recessive traits.",
    marks: 4,
    markScheme: ["Define dominant and recessive alleles", "Discuss how they interact in heterozygous individuals"],
  },
  {
    id: "6a719917cb1b96aa69d00de8",
    question: "Apply your knowledge of alleles to explain how they can affect an individual's ability to taste PTC.",
    marks: 4,
    markScheme: ["Identify the alleles involved in PTC tasting", "Explain the effect of these alleles on taste perception"],
  },
  {
    id: "6a719917cb1b96aa69d00de7",
    question: "Explain how alleles contribute to the inheritance of traits in humans.",
    marks: 4,
    markScheme: ["Define alleles and their role in inheritance", "Describe how one allele is inherited from each parent"],
  },
  {
    id: "6a719917cb1b96aa69d00de6",
    question: "Evaluate the importance of alleles in causing variation in inherited characteristics.",
    marks: 4,
    markScheme: ["Discuss how alleles lead to variation in traits", "Mention the role of genetic variation in natural selection"],
  },
];

function makeAllelesGoldenLesson() {
  const pages = [
    {
      blocks: [
        {
          text:
            "Define alleles and explain their relationship to genes. Describe how alleles cause variation in inherited characteristics. Explain how humans inherit two alleles for each gene, one from each parent. Apply knowledge of alleles to examples such as PTC tasting.",
        },
      ],
    },
  ];
  return {
    _id: ALLELES_LESSON_ID,
    title: "Alleles",
    topicKey: "edexcel-igcse-biology:alleles",
    pages,
    examQuestions: ALLELES_CANDIDATES.map((c, i) => ({
      questionId: c.id,
      addedAt: new Date(`2026-01-0${i + 1}`),
    })),
  };
}

function buildGoldenMasters() {
  const masters = new Map();
  for (const c of ALLELES_CANDIDATES) {
    masters.set(c.id, {
      _id: c.id,
      type: "short",
      subject: "Biology",
      examBoard: "Edexcel",
      level: "IGCSE",
      topicKey: "edexcel-igcse-biology:alleles",
      question: c.question,
      marks: c.marks,
      markScheme: c.markScheme,
      status: "published",
    });
  }
  masters.set("6a719c90cb1b96aa69d070d2", {
    _id: "6a719c90cb1b96aa69d070d2",
    type: "composite",
    question: "Consider the inheritance of alleles in a population of pea plants.",
    marks: 7,
    markScheme: [],
    status: "published",
  });
  return masters;
}

describe("Block 28 Phase 2 Alleles golden selection", () => {
  const lesson = makeAllelesGoldenLesson();
  const masters = buildGoldenMasters();
  const usage = new Map(ALLELES_CANDIDATES.map((c) => [c.id, 1]));
  const boundary = deriveLessonContentBoundary(lesson);

  test("inheritance vs variation approved stems are not HIGH duplicates", () => {
    const assessment = assessConceptualOverlap(
      "Explain how alleles contribute to the inheritance of traits in humans.",
      "Describe how alleles cause variation in inherited characteristics within a species."
    );
    expect(assessment.severity).not.toBe("HIGH");
  });

  test("objective ranking penalises evolution and environment over core objectives", () => {
    const evolution = objectiveAlignmentScore(
      "Evaluate how the study of alleles contributes to our understanding of evolution.",
      boundary
    );
    const environment = objectiveAlignmentScore(
      "Suggest reasons why individuals with the same alleles may still exhibit different traits.",
      boundary
    );
    const ptc = objectiveAlignmentScore(
      "Apply your knowledge of alleles to explain how they can affect an individual's ability to taste PTC.",
      boundary
    );
    const geneAllele = objectiveAlignmentScore(
      "Compare the roles of alleles and genes in determining inherited traits.",
      boundary
    );
    expect(ptc).toBeGreaterThan(evolution);
    expect(geneAllele).toBeGreaterThan(environment);
    expect(evolution).toBeLessThan(0);
    expect(environment).toBeLessThan(0);
  });

  test("selection prefers the five approved biology clusters", () => {
    const audit = auditLessonAttachments(lesson, masters, usage);
    const { classified } = classifyAttachments(audit, boundary);
    const { selected } = proposeFinalSet(classified, boundary);
    const selectedIds = selected.map((s) => s.questionId);

    for (const id of APPROVED_IDS) {
      expect(selectedIds).toContain(id);
    }
    for (const id of DEPRIORITISED_IDS) {
      expect(selectedIds).not.toContain(id);
    }
    expect(selected.length).toBe(5);
  });

  test("deprioritised questions are detached as duplicate or excess", () => {
    const audit = auditLessonAttachments(lesson, masters, usage);
    const { classified } = classifyAttachments(audit, boundary);
    proposeFinalSet(classified, boundary);

    for (const id of DEPRIORITISED_IDS) {
      const row = classified.find((c) => c.questionId === id);
      expect(row.selection).not.toBe(SELECTION.RETAIN);
      expect([SELECTION.DETACH_DUPLICATE, SELECTION.DETACH_EXCESS, SELECTION.REJECT_CONTENT]).toContain(
        row.selection
      );
    }
  });

  test("pre-selection HIGH alone does not block when final set is clean", () => {
    const pack = buildLessonReviewPack(lesson, masters, usage);
    expect(pack.qualitySummary.preSelectionHighPairs).toBeGreaterThan(0);
    expect(pack.qualitySummary.finalSetHighPairs).toBe(0);
    expect(pack.qualitySummary.unresolvedHighPairs).toBe(0);
    expect(pack.packStatus).not.toBe(PACK_STATUS.BLOCKED_BY_DUPLICATION);
  });

  test("resolvePackStatus blocks only on unresolved final-set HIGH", () => {
    expect(
      resolvePackStatus({
        preSelectionHighPairs: 12,
        finalSetHighPairs: 0,
        unresolvedHighPairs: 0,
        unresolvedSchemeCount: 0,
        genericFillerCount: 0,
        semanticReviewRequiredCount: 0,
        borderlineCount: 2,
        semanticFailCount: 0,
      })
    ).toBe(PACK_STATUS.NEEDS_CONTENT_REVIEW);

    expect(
      resolvePackStatus({
        preSelectionHighPairs: 12,
        finalSetHighPairs: 2,
        unresolvedHighPairs: 2,
        unresolvedSchemeCount: 0,
        genericFillerCount: 0,
        semanticReviewRequiredCount: 0,
        borderlineCount: 0,
        semanticFailCount: 0,
      })
    ).toBe(PACK_STATUS.BLOCKED_BY_DUPLICATION);
  });
});
