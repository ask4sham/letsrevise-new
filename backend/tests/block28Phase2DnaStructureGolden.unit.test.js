/**
 * Block 28 Phase 2 — DNA Structure golden selection regression (pre-repair candidate pool).
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
  DNA_STRUCTURE_LESSON_ID,
  APPROVED_MASTER_IDS,
  DEPRIORITISED_MASTER_IDS,
} = require("../services/block28Phase2/dnaStructureGoldenCapture");

const DNA_CANDIDATES = [
  {
    id: "6a6f2be17ddc99159b9b6a55",
    question: "Analyse the significance of DNA's double helix structure for its function.",
    marks: 6,
    markScheme: [
      "Explains how the double helix structure facilitates replication",
      "Discusses the role of base pairing in genetic information storage",
      "Links structure to stability and protection of genetic material",
    ],
  },
  {
    id: "6a6f2be17ddc99159b9b6a5b",
    question: "Explain how the structure of DNA relates to its role in protein synthesis.",
    marks: 4,
    markScheme: [
      "Links the sequence of bases to amino acid coding",
      "Describes how DNA's structure allows for transcription and translation",
    ],
  },
  {
    id: "6a6f2be17ddc99159b9b6a58",
    question: "Outline the process of DNA replication and its importance for cell division.",
    marks: 4,
    markScheme: [
      "Describes the unwinding of DNA and strand separation",
      "Explains the formation of new complementary strands",
    ],
  },
  {
    id: "6a6f2be17ddc99159b9b6a52",
    question: "Suggest how errors in DNA replication might affect an organism.",
    marks: 4,
    markScheme: [
      "Identifies potential consequences of mutations",
      "Links errors in replication to changes in protein function",
    ],
  },
  {
    id: "6a6f2be17ddc99159b9b6a4f",
    question: "Explain why hydrogen bonds between bases are essential for the stability of DNA.",
    marks: 4,
    markScheme: [
      "Describes how hydrogen bonds hold the two strands together",
      "Explains the significance of this for the double helix structure",
    ],
  },
  {
    id: "6a6f2be17ddc99159b9b6a4c",
    question: "Compare the roles of the sugar-phosphate backbone and the nitrogenous bases in DNA structure.",
    marks: 4,
    markScheme: [
      "Describes the structural role of the sugar-phosphate backbone",
      "Explains the functional role of nitrogenous bases in genetic coding",
    ],
  },
  {
    id: "6a6f2be07ddc99159b9b6a49",
    question: "Justify the role of DNA in inheritance.",
    marks: 4,
    markScheme: [
      "Explains how DNA carries genetic information",
      "Links DNA structure to its function in inheritance",
    ],
  },
  {
    id: "6a6f2be07ddc99159b9b6a46",
    question: "Outline how the structure of DNA enables it to be copied during cell division.",
    marks: 4,
    markScheme: [
      "Describes the unwinding of the double helix",
      "Explains the role of complementary base pairing in replication",
    ],
  },
  {
    id: "6a6f2be07ddc99159b9b6a43",
    question: "Explain the structure of DNA and its components.",
    marks: 4,
    markScheme: [
      "Identifies the double helix structure and sugar-phosphate backbone",
      "Lists the four nitrogenous bases and their pairing",
    ],
  },
  {
    id: "6a6f2be07ddc99159b9b6a40",
    question: "Evaluate the importance of complementary base pairing in DNA replication.",
    marks: 4,
    markScheme: [
      "Describes how complementary base pairing ensures accurate replication",
      "Discusses implications for genetic fidelity and inheritance",
    ],
  },
];

function makeDnaStructureGoldenLesson() {
  const pages = [
    {
      blocks: [
        {
          text:
            "Describe the chemical structure of DNA, including its components and shape. Explain complementary base pairing and identify the four bases. Understand how DNA structure enables copying during cell division. Relate DNA structure to inheritance and protein synthesis. DNA is a double helix with sugar-phosphate backbone and bases A, T, G, C held by hydrogen bonds. During cell division DNA unwinds and each strand is a template for a new complementary strand.",
        },
      ],
    },
  ];
  return {
    _id: DNA_STRUCTURE_LESSON_ID,
    title: "DNA Structure",
    topicKey: "edexcel-igcse-biology:dna-structure",
    pages,
    examQuestions: DNA_CANDIDATES.map((c, i) => ({
      questionId: c.id,
      addedAt: new Date(`2026-01-${String(i + 1).padStart(2, "0")}`),
    })),
  };
}

function buildGoldenMasters() {
  const masters = new Map();
  for (const c of DNA_CANDIDATES) {
    masters.set(c.id, {
      _id: c.id,
      type: "short",
      subject: "Biology",
      examBoard: "Edexcel",
      level: "IGCSE",
      topicKey: "edexcel-igcse-biology:dna-structure",
      question: c.question,
      marks: c.marks,
      markScheme: c.markScheme,
      status: "published",
    });
  }
  masters.set("6a6f664f7ddc99159b9c68df", {
    _id: "6a6f664f7ddc99159b9c68df",
    type: "composite",
    question: "Consider the structure of DNA and its role in genetic information.",
    marks: 8,
    markScheme: [],
    status: "published",
  });
  return masters;
}

describe("Block 28 Phase 2 DNA Structure golden selection", () => {
  const lesson = makeDnaStructureGoldenLesson();
  const masters = buildGoldenMasters();
  const usage = new Map(DNA_CANDIDATES.map((c) => [c.id, 1]));
  const boundary = deriveLessonContentBoundary(lesson);

  test("replication cluster questions are HIGH duplicates", () => {
    const preferred =
      "Outline how the structure of DNA enables it to be copied during cell division.";
    const duplicateOutline =
      "Outline the process of DNA replication and its importance for cell division.";
    const duplicateEvaluate =
      "Evaluate the importance of complementary base pairing in DNA replication.";

    expect(assessConceptualOverlap(preferred, duplicateOutline).severity).toBe("HIGH");
    expect(assessConceptualOverlap(preferred, duplicateEvaluate).severity).toBe("HIGH");
    expect(assessConceptualOverlap(duplicateOutline, duplicateEvaluate).severity).toBe("HIGH");
  });

  test("structure anchor is not HIGH duplicate of hydrogen bonds question", () => {
    const assessment = assessConceptualOverlap(
      "Explain the structure of DNA and its components.",
      "Explain why hydrogen bonds between bases are essential for the stability of DNA."
    );
    expect(assessment.severity).not.toBe("HIGH");
  });

  test("objective ranking favours core objectives over mutation and generic justify", () => {
    const replicationPreferred = objectiveAlignmentScore(
      "Outline how the structure of DNA enables it to be copied during cell division.",
      boundary
    );
    const replicationDuplicate = objectiveAlignmentScore(
      "Outline the process of DNA replication and its importance for cell division.",
      boundary
    );
    const mutationErrors = objectiveAlignmentScore(
      "Suggest how errors in DNA replication might affect an organism.",
      boundary
    );
    const inheritanceJustify = objectiveAlignmentScore("Justify the role of DNA in inheritance.", boundary);
    const structureAnchor = objectiveAlignmentScore("Explain the structure of DNA and its components.", boundary);

    expect(replicationPreferred).toBeGreaterThan(replicationDuplicate);
    expect(structureAnchor).toBeGreaterThan(mutationErrors);
    expect(replicationPreferred).toBeGreaterThan(inheritanceJustify);
    expect(mutationErrors).toBeLessThan(0);
    expect(inheritanceJustify).toBeLessThan(0);
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
    expect(selectedIds.filter((id) => id === "6a6f2be07ddc99159b9b6a46")).toHaveLength(1);
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
